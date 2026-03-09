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

  app.post('/api/admin/jobs/:id/start', isAuth, (req, res) => {
    const result = jobManager.startJob(req.params.id);
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/stop', isAuth, (req, res) => {
    const result = jobManager.stopJob(req.params.id);
    res.json(result);
  });

  app.patch('/api/admin/jobs/:id', isAuth, (req, res) => {
    const { intervalMinutes } = req.body;
    if (typeof intervalMinutes !== 'number') {
      return res.status(400).json({ error: 'intervalMinutes 값이 필요합니다.' });
    }
    const result = jobManager.setInterval(req.params.id, intervalMinutes);
    res.json(result);
  });

  app.post('/api/admin/jobs/:id/run', isAuth, async (req, res) => {
    const result = await jobManager.runNow(req.params.id);
    res.json(result);
  });
}
