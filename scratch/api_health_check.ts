
import axios from 'axios';

async function checkHealth() {
  const BASE_URL = 'http://localhost:5000/api';
  console.log('🔍 [API Health Check] 시작...');

  const endpoints = [
    { name: 'AI 예산 조회', url: `${BASE_URL}/ai/budget`, method: 'GET' },
    { name: 'AI 사용량 조회', url: `${BASE_URL}/ai/usage-daily?scopeType=login`, method: 'GET' },
    { name: '자동매매 설정 조회', url: `${BASE_URL}/autotrading/settings/1`, method: 'GET' },
    { name: '유저 정보 조회', url: `${BASE_URL}/auth/me`, method: 'GET' },
  ];

  for (const ep of endpoints) {
    try {
      console.log(`\n📡 [${ep.name}] 테스트 중...`);
      // 실제 세션 쿠키가 없으므로 401이 뜰 수 있지만, 
      // 500(서버 에러)이 뜨는지가 중요함 (로직 붕괴 여부 판단)
      const res = await axios({
        method: ep.method,
        url: ep.url,
        timeout: 5000,
        validateStatus: () => true, // 모든 상태 코드 허용
      });

      if (res.status === 500) {
        console.error(`❌ [${ep.name}] 서버 에러 발생 (500)`);
        console.error(`   내용:`, res.data);
      } else if (res.status === 401) {
        console.log(`✅ [${ep.name}] 정상 (인증 만료 - 로직은 살아있음)`);
      } else {
        console.log(`✅ [${ep.name}] 정상 (상태: ${res.status})`);
      }
    } catch (e: any) {
      console.error(`❌ [${ep.name}] 연결 실패:`, e.message);
    }
  }
}

checkHealth();
