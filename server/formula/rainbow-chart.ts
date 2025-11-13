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
    
    // Calculate 10 lines (0=low, 5=50% retracement, 9=high)
    const range = high2Y - low2Y;
    const lines: RainbowLine[] = [];
    
    for (let i = 0; i <= 9; i++) {
      const price = low2Y + (range * i / 9);
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
    
    if (currentPercent < 22.2) { // Below line 2
      currentZone = 'deep-value';
      recommendation = 'strong-buy';
    } else if (currentPercent < 44.4) { // Lines 2-4
      currentZone = 'scale-in-zone';
      recommendation = 'buy';
    } else if (currentPercent >= 44.4 && currentPercent <= 55.6) { // Line 5 (50%)
      currentZone = 'primary-buy-zone';
      recommendation = 'buy';
    } else if (currentPercent > 55.6 && currentPercent <= 77.8) { // Lines 6-7
      currentZone = 'profit-taking-zone';
      recommendation = 'sell';
    } else { // Above line 8
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
