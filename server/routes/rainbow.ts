import { Router } from 'express';
import { RainbowChartAnalyzer, OHLCVData } from '../formula/rainbow-chart';
import { getKiwoomService } from '../services/kiwoom';
import { isAuthenticated } from '../auth';

export const rainbowRouter = Router();

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
    const kiwoomService = getKiwoomService();
    
    // getStockChart 호출 - 240개 이상 데이터 요청 (레인보우 차트용)
    const rawChartData = await kiwoomService.getStockChart(stockCode, period, 250);
    
    // 데이터 변환: API 응답 → OHLCVData[]
    let ohlcvData: OHLCVData[];
    
    if (Array.isArray(rawChartData)) {
      // stubMode 또는 이미 배열 형태
      ohlcvData = rawChartData.map((item: any) => ({
        date: item.date || item.stck_bsop_date || '',
        open: parseFloat(item.open || item.stck_oprc || 0),
        high: parseFloat(item.high || item.stck_hgpr || 0),
        low: parseFloat(item.low || item.stck_lwpr || 0),
        close: parseFloat(item.close || item.stck_clpr || 0),
        volume: parseInt(item.volume || item.acml_vol || 0, 10),
      }));
    } else if (rawChartData.output1 || rawChartData.output) {
      // 실제 API 응답 형태
      const outputData = rawChartData.output1 || rawChartData.output;
      ohlcvData = outputData.map((item: any) => ({
        date: item.stck_bsop_date || '',
        open: parseFloat(item.stck_oprc || 0),
        high: parseFloat(item.stck_hgpr || 0),
        low: parseFloat(item.stck_lwpr || 0),
        close: parseFloat(item.stck_clpr || 0),
        volume: parseInt(item.acml_vol || 0, 10),
      }));
    } else {
      throw new Error('Invalid chart data format');
    }

    // 데이터 유효성 검사
    if (ohlcvData.length < 240) {
      return res.status(400).json({
        error: `Insufficient data for rainbow chart analysis. Need 240+ bars, got ${ohlcvData.length}`,
      });
    }

    // 레인보우 차트 분석
    const result = RainbowChartAnalyzer.analyze(stockCode, ohlcvData, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);
    
    res.json({ ...result, signalStrength });
  } catch (error: any) {
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
    const kiwoomService = getKiwoomService();
    // Request 250 bars for rainbow chart analysis (minimum 240 required)
    const rawChartData = await kiwoomService.getStockChart(stockCode, period as string, 250);
    
    let ohlcvData: OHLCVData[];
    
    if (Array.isArray(rawChartData)) {
      ohlcvData = rawChartData.map((item: any) => ({
        date: item.date || item.stck_bsop_date || '',
        open: parseFloat(item.open || item.stck_oprc || 0),
        high: parseFloat(item.high || item.stck_hgpr || 0),
        low: parseFloat(item.low || item.stck_lwpr || 0),
        close: parseFloat(item.close || item.stck_clpr || 0),
        volume: parseInt(item.volume || item.acml_vol || 0, 10),
      }));
    } else if (rawChartData.output1 || rawChartData.output) {
      const outputData = rawChartData.output1 || rawChartData.output;
      ohlcvData = outputData.map((item: any) => ({
        date: item.stck_bsop_date || '',
        open: parseFloat(item.stck_oprc || 0),
        high: parseFloat(item.stck_hgpr || 0),
        low: parseFloat(item.stck_lwpr || 0),
        close: parseFloat(item.stck_clpr || 0),
        volume: parseInt(item.acml_vol || 0, 10),
      }));
    } else {
      throw new Error('Invalid chart data format');
    }

    if (ohlcvData.length < 240) {
      return res.status(400).json({
        error: `Insufficient data. Need 240+ bars, got ${ohlcvData.length}`,
      });
    }

    const result = RainbowChartAnalyzer.analyze(stockCode, ohlcvData, 240);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);
    
    res.json({ ...result, signalStrength });
  } catch (error: any) {
    console.error('Rainbow chart error:', error);
    res.status(500).json({ error: error.message });
  }
});

