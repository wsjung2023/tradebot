// admin.routes.ts — 관리자 전용 API (Job 관리 + 유저 관리)
import type { Express } from 'express';
import { jobManager } from '../job-manager';
import { requireAdmin } from '../middleware/require-admin';
import { storage } from '../storage';

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
}
