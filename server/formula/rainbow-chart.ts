export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RainbowLine {
  lineNumber: number; // 0-9
  price: number;
  zone: 'scale-in' | 'primary-buy' | 'sell'; // 0-4: scale-in, 5: primary, 6-9: sell
  weight: number; // 1-10 (line 5 has weight 10)
}

export interface RainbowChartResult {
  stockCode: string;
  high2Y: number;
  low2Y: number;
  current: number;
  lines: RainbowLine[];
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  currentZone: string;
}

export class RainbowChartAnalyzer {
  static analyze(stockCode: string, ohlcvData: OHLCVData[]): RainbowChartResult {
    if (ohlcvData.length === 0) {
      throw new Error('No OHLCV data provided');
    }

    // Find 2-year high/low
    const high2Y = Math.max(...ohlcvData.map(d => d.high));
    const low2Y = Math.min(...ohlcvData.map(d => d.low));
    const current = ohlcvData[ohlcvData.length - 1].close;
    
    // Calculate 10 lines (0=0%, 5=50%, 9=90%)
    // Line percentages: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%
    const range = high2Y - low2Y;
    const lines: RainbowLine[] = [];
    
    for (let i = 0; i <= 9; i++) {
      const percentage = i * 0.1; // 0.0, 0.1, 0.2, ..., 0.9
      const price = low2Y + (range * percentage);
      let zone: 'scale-in' | 'primary-buy' | 'sell';
      let weight: number;
      
      if (i < 5) {
        zone = 'scale-in';
        weight = i + 1; // 1-5
      } else if (i === 5) {
        zone = 'primary-buy';
        weight = 10; // Highest weight for 50% line
      } else {
        zone = 'sell';
        weight = 10 - i; // 4-1
      }
      
      lines.push({ lineNumber: i, price, zone, weight });
    }
    
    // Determine current position & recommendation
    let currentZone = 'unknown';
    let recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell' = 'hold';
    
    const currentPercent = ((current - low2Y) / range) * 100;
    
    if (currentPercent < 20) { // Below line 2 (20%)
      currentZone = 'deep-value';
      recommendation = 'strong-buy';
    } else if (currentPercent < 40) { // Lines 2-3 (20-40%)
      currentZone = 'scale-in-zone';
      recommendation = 'buy';
    } else if (currentPercent >= 40 && currentPercent <= 60) { // Lines 4-6 (40-60%, centered at 50%)
      currentZone = 'primary-buy-zone';
      recommendation = 'buy';
    } else if (currentPercent > 60 && currentPercent <= 80) { // Lines 7-8 (60-80%)
      currentZone = 'profit-taking-zone';
      recommendation = 'sell';
    } else { // Above line 8 (>80%)
      currentZone = 'overbought';
      recommendation = 'strong-sell';
    }
    
    return {
      stockCode,
      high2Y,
      low2Y,
      current,
      lines,
      recommendation,
      currentZone
    };
  }

  static getSignalStrength(result: RainbowChartResult): number {
    // Return 0-100 score based on position
    const currentPercent = ((result.current - result.low2Y) / (result.high2Y - result.low2Y)) * 100;
    
    if (currentPercent <= 50) {
      // Lower = stronger buy (100 at 0%, 50 at 50%)
      return 100 - currentPercent;
    } else {
      // Higher = stronger sell (50 at 50%, 100 at 100%)
      return currentPercent;
    }
  }
}
