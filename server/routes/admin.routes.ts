// admin.routes.ts — 관리자 전용 백그라운드 작업(Job) 관리 라우터
import type { Express } from 'express';
import { jobManager } from '../job-manager';

export function registerAdminRoutes(app: Express) {
  const isAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: '로그인이 필요합니다.' });
  };

  app.get('/api/admin/jobs', isAuth, (_req, res) => {
    res.json(jobManager.getJobs());
  });

  app.post('/api/admin/jobs/:id/start', isAuth, async (req, res) => {
    const result = await jobManager.startJob(req.params.id);
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/stop', isAuth, async (req, res) => {
    const result = await jobManager.stopJob(req.params.id);
    res.json(result);
  });

  // 인터벌 변경 — 분/초/시각 모두 지원, DB에 영속화
  app.patch('/api/admin/jobs/:id', isAuth, async (req, res) => {
    const { intervalMinutes, intervalSeconds, scheduleTime } = req.body;
    const result = await jobManager.updateInterval(req.params.id, {
      intervalMinutes: typeof intervalMinutes === 'number' ? intervalMinutes : undefined,
      intervalSeconds: typeof intervalSeconds === 'number' ? intervalSeconds : undefined,
      scheduleTime: typeof scheduleTime === 'string' ? scheduleTime : undefined,
    });
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/run', isAuth, async (req, res) => {
    const result = await jobManager.runNow(req.params.id);
    res.json(result);
  });
}
