// admin.routes.ts — 관리자 전용 API (Job 관리 + 유저 관리 + Private Cloud)
import type { Express } from 'express';
import { jobManager } from '../job-manager';
import { requireAdmin } from '../middleware/require-admin';
import { storage } from '../storage';
import { pool } from '../db';
import { provisionPrivateCloudInstance, deprovisionPrivateCloudInstance } from '../services/railway-provisioner.service';

export function registerAdminRoutes(app: Express) {
  app.get('/api/admin/jobs', requireAdmin, (_req, res) => {
    res.json(jobManager.getJobs());
  });

  app.post('/api/admin/jobs/:id/start', requireAdmin, async (req, res) => {
    const result = await jobManager.startJob(req.params.id);
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/stop', requireAdmin, async (req, res) => {
    const result = await jobManager.stopJob(req.params.id);
    res.json(result);
  });

  // 인터벌 변경 — 분/시각 지원, DB에 영속화
  app.patch('/api/admin/jobs/:id', requireAdmin, async (req, res) => {
    const { intervalMinutes, intervalSeconds, scheduleTime } = req.body;
    const result = await jobManager.updateInterval(req.params.id, {
      intervalMinutes: typeof intervalMinutes === 'number' ? intervalMinutes : undefined,
      intervalSeconds: typeof intervalSeconds === 'number' ? intervalSeconds : undefined,
      scheduleTime: typeof scheduleTime === 'string' ? scheduleTime : undefined,
    });
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/run', requireAdmin, async (req, res) => {
    const result = await jobManager.runNow(req.params.id);
    res.json(result);
  });

  // 유저 목록 (구독 정보 포함)
  app.get('/api/admin/users', requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const subs = await Promise.all(users.map(u => storage.getUserSubscription(u.id)));
      const result = users.map((u, i) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        authProvider: u.authProvider,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
        subscription: subs[i] ? {
          tier: subs[i]!.tier,
          status: subs[i]!.status,
          aumTier: subs[i]!.aumTier,
        } : null,
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 유저 role 변경
  app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'role must be admin or user' });
    }
    const updated = await storage.updateUser(req.params.id, { role });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ id: updated.id, email: updated.email, role: updated.role });
  });

  // 유저 구독 tier 강제 변경 (어드민 전용)
  app.patch('/api/admin/users/:id/subscription', requireAdmin, async (req, res) => {
    const { tier } = req.body;
    const validTiers = ['free', 'saas_basic', 'saas_pro', 'saas_enterprise'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `tier는 ${validTiers.join('|')} 중 하나` });
    }
    try {
      const updated = await storage.upsertSubscription({ userId: req.params.id, tier, status: 'active' });
      res.json({ ok: true, tier: updated.tier });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 어드민 대시보드 통계
  app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const subs = await Promise.all(users.map(u => storage.getUserSubscription(u.id)));

      const byTier: Record<string, number> = { free: 0, saas_basic: 0, saas_pro: 0, saas_enterprise: 0 };
      let activeCount = 0;
      for (const sub of subs) {
        const tier = sub?.tier ?? 'free';
        byTier[tier] = (byTier[tier] ?? 0) + 1;
        if (sub?.status === 'active' && sub.tier !== 'free') activeCount++;
      }

      const MONTHLY_USD: Record<string, number> = { saas_basic: 85, saas_pro: 180, saas_enterprise: 320 };
      const mrrUsd = subs.reduce((sum, sub) => {
        if (sub?.status !== 'active') return sum;
        return sum + (MONTHLY_USD[sub.tier ?? ''] ?? 0);
      }, 0);

      const recentUsers = [...users]
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 5)
        .map(u => ({ id: u.id, email: u.email, createdAt: u.createdAt }));

      res.json({ totalUsers: users.length, byTier, activeSubscriptions: activeCount, mrrUsd, recentUsers });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Private Cloud 고객 관리 ──

  // 목록 조회
  app.get('/api/admin/private-cloud', requireAdmin, async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM private_cloud_customers ORDER BY created_at DESC`
    );
    res.json(rows);
  });

  // 고객 등록 + 프로비저닝 시작
  app.post('/api/admin/private-cloud', requireAdmin, async (req, res) => {
    const { name, email, companyName, subdomain, monthlyFeeKrw, notes } = req.body;
    if (!name || !email || !subdomain) {
      return res.status(400).json({ error: 'name, email, subdomain 필수' });
    }
    // subdomain 중복 확인
    const dup = await pool.query(
      `SELECT id FROM private_cloud_customers WHERE subdomain=$1`, [subdomain]
    );
    if (dup.rows.length) return res.status(400).json({ error: '이미 사용 중인 서브도메인입니다.' });

    const { rows } = await pool.query(
      `INSERT INTO private_cloud_customers (name, email, company_name, subdomain, monthly_fee_krw, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, email, companyName || null, subdomain, monthlyFeeKrw || null, notes || null]
    );
    const customer = rows[0];

    // 비동기 프로비저닝 (응답은 즉시 반환)
    provisionPrivateCloudInstance({
      customerId: customer.id,
      customerName: name,
      customerEmail: email,
      subdomain,
    }).catch(err => console.error(`[PrivateCloud] 프로비저닝 실패 customer=${customer.id}:`, err.message));

    res.status(201).json(customer);
  });

  // 단건 조회 (프로비저닝 상태 폴링용)
  app.get('/api/admin/private-cloud/:id', requireAdmin, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM private_cloud_customers WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  });

  // 고객 정보 수정
  app.patch('/api/admin/private-cloud/:id', requireAdmin, async (req, res) => {
    const { notes, monthlyFeeKrw } = req.body;
    const { rows } = await pool.query(
      `UPDATE private_cloud_customers SET notes=$1, monthly_fee_krw=$2 WHERE id=$3 RETURNING *`,
      [notes ?? null, monthlyFeeKrw ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  });

  // 인스턴스 비활성화 (Railway 프로젝트 삭제)
  app.delete('/api/admin/private-cloud/:id', requireAdmin, async (req, res) => {
    await deprovisionPrivateCloudInstance(parseInt(req.params.id, 10));
    res.json({ ok: true });
  });

  // 프로비저닝 재시도 (failed 상태)
  app.post('/api/admin/private-cloud/:id/reprovision', requireAdmin, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM private_cloud_customers WHERE id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const c = rows[0];
    provisionPrivateCloudInstance({
      customerId: c.id,
      customerName: c.name,
      customerEmail: c.email,
      subdomain: c.subdomain,
    }).catch(err => console.error(`[PrivateCloud] 재프로비저닝 실패:`, err.message));
    res.json({ ok: true, message: '프로비저닝을 다시 시작했습니다.' });
  });
}
