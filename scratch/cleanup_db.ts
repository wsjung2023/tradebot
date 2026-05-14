
import { db } from '../server/db';
import * as schema from '../shared/schema';
import { eq, or, isNull } from 'drizzle-orm';

async function cleanup() {
  console.log('🧹 [DB Cleanup] 후보 종목 테이블 정제 시작...');
  const result = await db.delete(schema.candidateStocks)
    .where(
      or(
        isNull(schema.candidateStocks.stockCode),
        eq(schema.candidateStocks.stockCode, '')
      )
    );
  console.log('✅ 정제 완료');
  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ 정제 실패:', err);
  process.exit(1);
});
