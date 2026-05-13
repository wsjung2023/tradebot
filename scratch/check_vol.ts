
import { KiwoomService } from '../server/services/kiwoom/index.ts';
import { normalizeChartDataAsc } from '../server/utils/chart-normalization.ts';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkVolume() {
  const stockCode = '078070'; // 유비쿼스홀딩스
  const kiwoom = new KiwoomService();
  
  try {
    console.log(`Checking volume for ${stockCode}...`);
    const chartData = await kiwoom.getStockChart(stockCode, 'D', 30);
    const ohlcv = normalizeChartDataAsc(chartData.output || chartData);
    
    if (ohlcv.length < 2) {
      console.log('Not enough chart data.');
      return;
    }

    // Previous days average (excluding the last one which is today)
    const prevDays = ohlcv.slice(0, -1);
    const avgVol = prevDays.reduce((sum, day) => sum + (Number(day.volume) || 0), 0) / prevDays.length;
    const today = ohlcv[ohlcv.length - 1];
    
    console.log('--- VOLUME DATA ---');
    console.log(`Average Volume (last 29 days): ${Math.round(avgVol).toLocaleString()}`);
    console.log(`Today's Total Volume: ${Number(today.volume).toLocaleString()}`);
    console.log(`Ratio: ${(Number(today.volume) / avgVol).toFixed(2)}x`);
    
    console.log('\n--- DAILY VOLUMES (Last 5 days) ---');
    ohlcv.slice(-5).forEach(day => {
      console.log(`${day.date}: ${Number(day.volume).toLocaleString()}`);
    });

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

checkVolume();
