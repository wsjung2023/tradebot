// reports.routes.ts — PDF 월간 리포트 API
import type { Router } from 'express';
import { isAuthenticated, getCurrentUser } from '../auth';
import { deployment } from '../config/deployment';
import { generateMonthlyReport } from '../services/report.service';

export function registerReportsRoutes(app: Router) {
  // Private Cloud / On-prem 전용
  app.get('/api/reports/monthly', isAuthenticated, async (req, res) => {
    if (!deployment.hasPdfReports) {
      return res.status(403).json({ error: 'PDF 리포트는 Private Cloud / On-prem 플랜에서 사용 가능합니다.' });
    }

    const user = getCurrentUser(req)!;
    const now = new Date();
    const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year, month 파라미터를 확인해주세요.' });
    }

    const pdfBuffer = await generateMonthlyReport({ userId: user.id, year, month });
    const filename = `tradebot-report-${year}-${String(month).padStart(2, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  });
}
