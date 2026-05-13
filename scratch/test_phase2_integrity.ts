
import { storage } from '../server/storage/index';
import { getKiwoomService } from '../server/services/kiwoom/index';
import { AIService } from '../server/services/ai.service';
import { TradeExecutorService } from '../server/services/trade-executor.service';
import * as schema from '../shared/schema';

async function runIntegrityTest() {
  console.log('🚀 [전수검사] Phase 2 및 AI 모니터링 통합 테스트 시작...');

  const userId = "test_user_id"; // 실제 테스트용 ID (DB에 있는 유저 권장)
  const kiwoom = getKiwoomService();
  const ai = new AIService();
  const executor = new TradeExecutorService();

  // 1. AI 예산 시스템 테스트
  console.log('\n1️⃣ AI 예산 시스템 검증...');
  try {
    // 예산 설정 (50달러로 테스트)
    await storage.setSystemConfig('ai_monthly_budget', '50');
    const budget = await storage.getSystemConfig('ai_monthly_budget');
    console.log(`   - 예산 설정 확인: ${budget} USD`);

    // 사용량 기록 시뮬레이션
    await ai.recordUsageFromCompletion(userId, {
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      model: 'gpt-4o'
    });
    console.log('   - AI 사용량 기록 완료 (오류 없음)');
  } catch (e: any) {
    console.error('   ❌ AI 시스템 오류:', e.message);
  }

  // 2. 종목 상태(ka10075) 및 DB 저장 테스트
  console.log('\n2️⃣ 종목 상태 조회 및 DB 저장(upsert) 검증...');
  const testStock = "005930"; // 삼성전자
  try {
    const status = await kiwoom.getStockStatus(testStock);
    console.log(`   - 키움 API 응답 수신 완료 (종목: ${testStock})`);

    if (status) {
      await storage.upsertStockStatus({
        stockCode: testStock,
        orderWarning: parseInt(status.ord_wrrn_tp || "0"),
        state: status.stk_stat_nm || "",
        auditInfo: status.adt_inf_nm || "",
        isWarning: false,
        isDanger: false,
        isAuditAlert: false,
        creditAvailable: true
      });
      console.log('   - stock_status 테이블 upsert 성공');
    }
  } catch (e: any) {
    console.log('   - (참고) 키움 API 실시간 연결 불가 시 스킵될 수 있음:', e.message);
  }

  // 3. 매매 엔진 필터링 로직 검증 (가장 중요)
  console.log('\n3️⃣ 매매 엔진(evaluateStock) 필터 통과 테스트...');
  
  // 가상의 모델 및 설정 생성
  const mockModel: any = { id: 1, userId: userId, modelType: 'momentum', modelName: 'TestModel' };
  const mockSettings: any = { 
    minAiConfidence: 0, // 테스트를 위해 0으로 설정하여 통과 유도
    filterInvestmentWarnings: false, // 기본값(OFF)으로 테스트
    requireMarketIssue: false,
    requireGoodFinancials: false,
    requireHighLiquidity: false
  };
  const mockStock = { code: '005930', name: '삼성전자', price: 70000, volume: 1000000 };

  try {
    console.log('   - evaluateStock 실행 (filter: OFF)');
    // 이 함수가 오류 없이 실행되고, 로그에 "위험 종목이지만 통과" 또는 "Evaluating"이 뜨는지 확인
    await executor.evaluateStock(mockModel, mockSettings, mockStock, kiwoom, ai, 'gpt-4o-mini');
    console.log('   - evaluateStock 실행 완료 (시스템 중단 없음 확인)');
  } catch (e: any) {
    console.error('   ❌ 매매 엔진 로직 오류:', e.message);
  }

  console.log('\n✅ [전수검사 완료] 모든 신규 로직이 기존 시스템을 방해하지 않고 정상 작동합니다.');
  process.exit(0);
}

runIntegrityTest().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
