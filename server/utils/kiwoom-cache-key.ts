// kiwoom-cache-key.ts — 계좌별 키움 서비스 캐시 키(fingerprint) 생성 (순수 함수)
//
// 캐시가 앱키+시크릿만으로 키를 잡으면, DB에서 accountType(mock/real)이 바뀌어도
// 옛 서비스(mock)가 계속 재사용돼 재시작 전까지 반영 안 됨 → "재시작 때 갑자기 real로 터짐" 버그.
// accountType을 fingerprint에 포함해 타입 변경이 즉시 새 서비스로 이어지게 한다.

export function accountServiceFingerprint(
  appKey: string,
  appSecret: string,
  accountType: string | null | undefined,
): string {
  const type = accountType === "real" ? "real" : "mock"; // 안전 기본: real이 아니면 mock
  return `${appKey}:${appSecret}:${type}`;
}
