// report.service.ts — 월간 성과 PDF 리포트 생성
import { pool } from '../db';
import { getReportExtension } from '../extensions/report.ext';

export interface MonthlyReportData {
  userId: string;
  year: number;
  month: number; // 1~12
}

interface MonthSummary {
  totalBuyOrders: number;
  totalSellOrders: number;
  totalInvested: number;
  totalProceeds: number;
  winCount: number;
  lossCount: number;
  models: ModelStat[];
}

interface ModelStat {
  modelName: string;
  totalTrades: number;
  winRate: string | null;
  totalReturn: string | null;
}

async function fetchMonthSummary(userId: string, year: number, month: number): Promise<MonthSummary> {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const ordersRes = await pool.query<{
    order_type: string;
    executed_price: string;
    executed_quantity: number;
  }>(`
    SELECT o.order_type, o.executed_price, o.executed_quantity
    FROM orders o
    JOIN kiwoom_accounts ka ON ka.id = o.account_id
    WHERE ka.user_id = $1
      AND o.order_status = 'completed'
      AND o.executed_at >= $2
      AND o.executed_at < $3
  `, [userId, from, to]);

  let totalBuyOrders = 0, totalSellOrders = 0;
  let totalInvested = 0, totalProceeds = 0;

  for (const row of ordersRes.rows) {
    const amount = parseFloat(row.executed_price || '0') * row.executed_quantity;
    if (row.order_type === 'buy') { totalBuyOrders++; totalInvested += amount; }
    else { totalSellOrders++; totalProceeds += amount; }
  }

  const modelsRes = await pool.query<ModelStat & { model_name: string; total_trades: number; win_rate: string; total_return: string }>(`
    SELECT model_name, total_trades, win_rate, total_return
    FROM ai_models
    WHERE user_id = $1 AND total_trades > 0
    ORDER BY total_trades DESC
    LIMIT 5
  `, [userId]);

  const models: ModelStat[] = modelsRes.rows.map(r => ({
    modelName: r.model_name,
    totalTrades: r.total_trades,
    winRate: r.win_rate,
    totalReturn: r.total_return,
  }));

  // 단순 추정: 매도 금액 > 매수 평균가이면 승리 (정확한 P&L은 매수-매도 쌍 매칭 필요)
  const winCount = Math.round(totalSellOrders * (models[0] ? parseFloat(models[0].winRate || '0') / 100 : 0.5));

  return { totalBuyOrders, totalSellOrders, totalInvested, totalProceeds, winCount, lossCount: totalSellOrders - winCount, models };
}

export async function generateMonthlyReport(data: MonthlyReportData): Promise<Buffer> {
  const ext = getReportExtension();
  const summary = await fetchMonthSummary(data.userId, data.year, data.month);

  const monthLabel = `${data.year}년 ${data.month}월`;
  const primaryColor = ext.primaryColor;
  const pnl = summary.totalProceeds - summary.totalInvested;
  const pnlRate = summary.totalInvested > 0 ? ((pnl / summary.totalInvested) * 100).toFixed(2) : '0.00';

  const { default: PDFDocument } = await import('pdfkit');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 495; // 595 - 2*50
    const hex2rgb = (hex: string): [number, number, number] => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const [pr, pg, pb] = hex2rgb(primaryColor);

    // ── 커버 헤더 ──
    doc.rect(50, 50, W, 4).fill([pr, pg, pb]);
    doc.moveDown(1);
    doc.fontSize(28).fillColor('#1e293b').font('Helvetica-Bold')
      .text(`${ext.brandName}`, 50, 70);
    doc.fontSize(16).fillColor('#475569').font('Helvetica')
      .text(`${monthLabel} 월간 성과 리포트`, 50, 108);
    doc.fontSize(11).fillColor('#94a3b8')
      .text(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, 50, 132);

    doc.rect(50, 155, W, 1).fill('#e2e8f0');
    doc.moveDown(2);

    // ── 요약 섹션 ──
    doc.fontSize(13).fillColor([pr, pg, pb]).font('Helvetica-Bold').text('거래 요약', 50, 170);
    doc.moveDown(0.5);

    const col = W / 3;
    const summaryItems = [
      { label: '매수 주문', value: `${summary.totalBuyOrders}건` },
      { label: '매도 주문', value: `${summary.totalSellOrders}건` },
      { label: '순손익', value: `${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()}원` },
    ];
    let sx = 50;
    for (const item of summaryItems) {
      doc.rect(sx, 195, col - 8, 60).fill('#f8fafc').stroke('#e2e8f0');
      doc.fontSize(10).fillColor('#64748b').font('Helvetica').text(item.label, sx + 10, 205);
      doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text(item.value, sx + 10, 221);
      sx += col;
    }

    // 수익률
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor([pr, pg, pb]).font('Helvetica-Bold').text('수익률', 50, 275);
    const rateColor: [number, number, number] = pnl >= 0 ? [16, 185, 129] : [239, 68, 68];
    doc.fontSize(32).fillColor(rateColor).font('Helvetica-Bold')
      .text(`${pnl >= 0 ? '+' : ''}${pnlRate}%`, 50, 295);

    doc.rect(50, 345, W, 1).fill('#e2e8f0');

    // ── AI 모델 성과 ──
    doc.fontSize(13).fillColor([pr, pg, pb]).font('Helvetica-Bold').text('AI 모델 성과', 50, 360);
    doc.moveDown(0.5);

    if (summary.models.length === 0) {
      doc.fontSize(11).fillColor('#94a3b8').font('Helvetica').text('이 기간에 활성 AI 모델이 없습니다.', 50, 385);
    } else {
      // 테이블 헤더
      const cols = [200, 80, 80, 100];
      const headers = ['모델명', '거래 수', '승률', '수익률'];
      let tx = 50, ty = 382;
      doc.rect(50, ty, W, 20).fill('#f1f5f9');
      headers.forEach((h, i) => {
        doc.fontSize(10).fillColor('#475569').font('Helvetica-Bold').text(h, tx + 5, ty + 5, { width: cols[i] });
        tx += cols[i];
      });
      ty += 20;
      for (const m of summary.models) {
        tx = 50;
        const rowData = [
          m.modelName,
          `${m.totalTrades}건`,
          m.winRate ? `${parseFloat(m.winRate).toFixed(1)}%` : '-',
          m.totalReturn ? `${parseFloat(m.totalReturn) >= 0 ? '+' : ''}${parseFloat(m.totalReturn).toFixed(2)}%` : '-',
        ];
        rowData.forEach((val, i) => {
          doc.fontSize(10).fillColor('#1e293b').font('Helvetica').text(val, tx + 5, ty + 4, { width: cols[i] });
          tx += cols[i];
        });
        doc.rect(50, ty + 18, W, 0.5).fill('#e2e8f0');
        ty += 22;
      }
    }

    // ── 면책조항 ──
    const disclaimer = ext.disclaimer ?? '본 리포트는 투자 판단의 참고 자료이며, 투자 결과에 대한 책임은 투자자 본인에게 있습니다.';
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
      .text(disclaimer, 50, 760, { width: W, align: 'center' });

    if (ext.coverFooterText) {
      doc.fontSize(9).fillColor('#64748b').text(ext.coverFooterText, 50, 775, { width: W, align: 'center' });
    }

    doc.rect(50, 780, W, 2).fill([pr, pg, pb]);

    doc.end();
  });
}
