import { Router } from 'express';
import { RainbowChartAnalyzer, OHLCVData } from '../formula/rainbow-chart';
import { isAuthenticated, getCurrentUser } from '../auth';
import { AgentTimeoutError } from '../services/agent-proxy.service';
import { getUserKiwoomService } from '../services/user-kiwoom.service';

export const rainbowRouter = Router();
const userKiwoomService = getUserKiwoomService();

function toOhlcvData(rawChartData: any): OHLCVData[] {
  if (Array.isArray(rawChartData)) {
    return rawChartData.map((item: any) => ({
      date: item.date || item.stck_bsop_date || '',
      open: parseFloat(item.open || item.stck_oprc || 0),
      high: parseFloat(item.high || item.stck_hgpr || 0),
      low: parseFloat(item.low || item.stck_lwpr || 0),
      close: parseFloat(item.close || item.stck_clpr || 0),
      volume: parseInt(item.volume || item.acml_vol || 0, 10),
    }));
  }

  if (rawChartData.output1 || rawChartData.output) {
    const outputData = rawChartData.output1 || rawChartData.output;
    return outputData.map((item: any) => ({
      date: item.stck_bsop_date || '',
      open: parseFloat(item.stck_oprc || 0),
      high: parseFloat(item.stck_hgpr || 0),
      low: parseFloat(item.stck_lwpr || 0),
      close: parseFloat(item.stck_clpr || 0),
      volume: parseInt(item.acml_vol || 0, 10),
    }));
  }

  throw new Error('Invalid chart data format');
}

/**
 * 레인보우 차트 분석 API
 * POST /api/rainbow/analyze
 * Body: { stockCode: string, period?: 'D'|'W'|'M' }
 */
rainbowRouter.post('/analyze', isAuthenticated, async (req, res) => {
  const { stockCode, period = 'D' } = req.body;

  if (!stockCode) {
    return res.status(400).json({ error: 'Stock code required' });
  }

  try {
    const user = getCurrentUser(req);
    const rawChartData = await userKiwoomService.getChart(user!.id, stockCode, period, 250);
    const ohlcvData = toOhlcvData(rawChartData);

    if (ohlcvData.length < 240) {
      return res.status(400).json({
        error: `Insufficient data for rainbow chart analysis. Need 240+ bars, got ${ohlcvData.length}`,
      });
    }

    const result = RainbowChartAnalyzer.analyze(stockCode, ohlcvData, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);

    res.json({ ...result, signalStrength });
  } catch (error: any) {
    if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
    console.error('Rainbow chart analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 종목 코드로 레인보우 차트 조회 (GET 버전)
 * GET /api/rainbow/:stockCode
 */
rainbowRouter.get('/:stockCode', isAuthenticated, async (req, res) => {
  const { stockCode } = req.params;
  const { period = 'D' } = req.query;

  try {
    const user = getCurrentUser(req);
    const rawChartData = await userKiwoomService.getChart(user!.id, stockCode, period as string, 250);
    const ohlcvData = toOhlcvData(rawChartData);

    if (ohlcvData.length < 240) {
      return res.status(400).json({
        error: `Insufficient data. Need 240+ bars, got ${ohlcvData.length}`,
      });
    }

    const result = RainbowChartAnalyzer.analyze(stockCode, ohlcvData, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);

    res.json({ ...result, signalStrength });
  } catch (error: any) {
    if (error instanceof AgentTimeoutError) return res.status(503).json({ error: error.message });
    console.error('Rainbow chart error:', error);
    res.status(500).json({ error: error.message });
  }
});
