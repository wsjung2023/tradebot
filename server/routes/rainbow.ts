import { Router } from 'express';
import { RainbowChartAnalyzer } from '../formula/rainbow-chart';
import { getKiwoomService } from '../services/kiwoom.service';
import { isAuthenticated } from '../auth';

export const rainbowRouter = Router();

rainbowRouter.post('/analyze', isAuthenticated, async (req, res) => {
  const { stockCode, period = 'D' } = req.body;
  
  if (!stockCode) {
    return res.status(400).json({ error: 'Stock code required' });
  }
  
  try {
    const kiwoomService = getKiwoomService();
    const ohlcvData = await kiwoomService.getOHLCV(stockCode, 730);
    const result = RainbowChartAnalyzer.analyze(stockCode, ohlcvData);
    const signalStrength = RainbowChartAnalyzer.getSignalStrength(result);
    
    res.json({ ...result, signalStrength });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
