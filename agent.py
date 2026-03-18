# agent.py - 집 PC에서 실행하는 키움 REST 호출 에이전트
# Replit 서버에 주기적으로 접속해서 "할 일"을 가져오고, 키움 REST 호출 후 결과를 돌려줌

import requests
import time
import json

# ========== 설정 (여기만 바꾸면 됨) ==========
REPLIT_URL = "https://kiwoom-stock-ai-mainstop3.replit.app"  # 서버 주소
AGENT_KEY  = "my-secret-agent-key-2024"  # 비밀키 (서버와 동일하게 맞출 것)
POLL_SEC   = 3  # 몇 초마다 확인할지
# =============================================

def mock_watchlist():
    """키움 관심종목 조회 (나중에 실제 키움 REST로 교체)"""
    return [
        {"code": "005930", "name": "삼성전자"},
        {"code": "000660", "name": "SK하이닉스"},
        {"code": "035420", "name": "NAVER"},
    ]

def handle_job(job):
    """작업 타입에 따라 처리"""
    job_type = job.get("type")
    print(f"  → 작업 처리 중: {job_type}")

    if job_type == "watchlist.get":
        result = mock_watchlist()
        return {"status": "done", "result": {"items": result}}
    else:
        return {"status": "error", "result": {"message": f"알 수 없는 작업: {job_type}"}}

def main():
    print("=== 키움 에이전트 시작 ===")
    print(f"서버: {REPLIT_URL}")
    print("Ctrl+C 로 종료\n")

    while True:
        try:
            # 다음 작업 가져오기
            res = requests.get(
                f"{REPLIT_URL}/api/kiwoom/jobs/next",
                params={"agent_key": AGENT_KEY},
                timeout=10
            )

            if res.status_code == 200:
                job = res.json()
                if job:
                    print(f"[작업 수신] id={job.get('id')} type={job.get('type')}")
                    result = handle_job(job)

                    # 결과 전송
                    res2 = requests.post(
                        f"{REPLIT_URL}/api/kiwoom/jobs/{job['id']}/result",
                        params={"agent_key": AGENT_KEY},
                        json=result,
                        timeout=10
                    )
                    print(f"[결과 전송] {res2.status_code} - {result['status']}\n")
                else:
                    print(".", end="", flush=True)  # 작업 없음
            else:
                print(f"[오류] 서버 응답: {res.status_code}")

        except requests.exceptions.ConnectionError:
            print("\n[연결 오류] 서버에 연결 못함. 재시도 중...")
        except Exception as e:
            print(f"\n[예외] {e}")

        time.sleep(POLL_SEC)

if __name__ == "__main__":
    main()

