"""
kiwoom-agent.py — 집 PC에서 실행하는 키움 REST API 폴링 에이전트
Replit 서버에 2~5초마다 할 일을 가져와 키움 API를 호출하고 결과를 돌려줍니다.

실행 방법:
  1. pip install requests python-dotenv
  2. .env 파일 생성 (아래 설정 참고)
  3. python agent/kiwoom-agent.py

.env 파일 예시:
  REPLIT_URL=https://your-replit-app.replit.app
  AGENT_KEY=여기에_랜덤_비밀키_입력
  KIWOOM_APP_KEY=키움_앱키
  KIWOOM_APP_SECRET=키움_앱시크릿
  KIWOOM_IS_MOCK=false
  POLL_INTERVAL=2
"""

import os
import time
import json
import logging
import requests
from dotenv import load_dotenv

# ===== 설정 로드 =====
load_dotenv()

REPLIT_URL = os.getenv("REPLIT_URL", "").rstrip("/")
AGENT_KEY = os.getenv("AGENT_KEY", "")
KIWOOM_APP_KEY = os.getenv("KIWOOM_APP_KEY", "")
KIWOOM_APP_SECRET = os.getenv("KIWOOM_APP_SECRET", "")
KIWOOM_IS_MOCK = os.getenv("KIWOOM_IS_MOCK", "false").lower() == "true"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "2"))

# ===== 로깅 설정 =====
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("kiwoom-agent")

# ===== 키움 REST API 토큰 관리 =====
_kiwoom_token = None
_token_expires_at = 0


def get_kiwoom_base_url():
    if KIWOOM_IS_MOCK:
        return "https://mockapi.koreainvestment.com:29443"
    return "https://api.kiwoom.com"


def refresh_kiwoom_token():
    """키움 REST API 액세스 토큰 발급"""
    global _kiwoom_token, _token_expires_at
    try:
        url = f"{get_kiwoom_base_url()}/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "appkey": KIWOOM_APP_KEY,
            "secretkey": KIWOOM_APP_SECRET,
        }
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        _kiwoom_token = data.get("access_token") or data.get("token")
        # 만료 1분 전에 갱신
        expires_in = int(data.get("expires_in", 3600))
        _token_expires_at = time.time() + expires_in - 60
        logger.info("키움 토큰 갱신 완료")
        return True
    except Exception as e:
        logger.error(f"키움 토큰 갱신 실패: {e}")
        return False


def get_kiwoom_token():
    global _kiwoom_token, _token_expires_at
    if not _kiwoom_token or time.time() >= _token_expires_at:
        refresh_kiwoom_token()
    return _kiwoom_token


def kiwoom_get(path, params=None):
    """키움 REST API GET 요청"""
    token = get_kiwoom_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    url = f"{get_kiwoom_base_url()}{path}"
    resp = requests.get(url, headers=headers, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def kiwoom_post(path, body=None):
    """키움 REST API POST 요청"""
    token = get_kiwoom_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    url = f"{get_kiwoom_base_url()}{path}"
    resp = requests.post(url, headers=headers, json=body or {}, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ===== 작업 핸들러 =====

def handle_watchlist_get(payload):
    """관심종목 시세 조회"""
    stock_codes = payload.get("stockCodes", [])
    results = []
    for code in stock_codes:
        try:
            data = kiwoom_get(f"/api/dostk/quot", params={"stk_cd": code})
            results.append({"stockCode": code, "data": data})
        except Exception as e:
            results.append({"stockCode": code, "error": str(e)})
    return {"items": results}


def handle_balance_get(payload):
    """계좌 잔고 조회"""
    account_number = payload.get("accountNumber", "")
    data = kiwoom_get("/api/dostk/acct", params={"acnt_no": account_number})
    return data


def handle_order_buy(payload):
    """매수 주문"""
    body = {
        "acnt_no": payload.get("accountNumber"),
        "stk_cd": payload.get("stockCode"),
        "ord_qty": payload.get("quantity"),
        "ord_prc": payload.get("price", 0),
        "ord_tp": "2" if payload.get("orderType") == "limit" else "1",  # 1:시장가, 2:지정가
        "buy_sel_tp": "1",  # 1:매수
    }
    return kiwoom_post("/api/dostk/ordr", body)


def handle_order_sell(payload):
    """매도 주문"""
    body = {
        "acnt_no": payload.get("accountNumber"),
        "stk_cd": payload.get("stockCode"),
        "ord_qty": payload.get("quantity"),
        "ord_prc": payload.get("price", 0),
        "ord_tp": "2" if payload.get("orderType") == "limit" else "1",
        "buy_sel_tp": "2",  # 2:매도
    }
    return kiwoom_post("/api/dostk/ordr", body)


def handle_ping(payload):
    """연결 테스트"""
    return {"pong": True, "agentTime": time.time()}


# 작업 타입별 핸들러 매핑
JOB_HANDLERS = {
    "watchlist.get": handle_watchlist_get,
    "balance.get": handle_balance_get,
    "order.buy": handle_order_buy,
    "order.sell": handle_order_sell,
    "ping": handle_ping,
}


# ===== Replit 통신 =====

def fetch_next_job():
    """Replit 서버에서 다음 작업 가져오기"""
    url = f"{REPLIT_URL}/api/kiwoom-agent/jobs/next"
    resp = requests.get(url, params={"agent_key": AGENT_KEY}, timeout=10)
    resp.raise_for_status()
    return resp.json().get("job")


def submit_result(job_id, status, result=None, error_message=None):
    """Replit 서버에 결과 업로드"""
    url = f"{REPLIT_URL}/api/kiwoom-agent/jobs/{job_id}/result"
    body = {"status": status}
    if result is not None:
        body["result"] = result
    if error_message is not None:
        body["errorMessage"] = error_message
    resp = requests.post(
        url,
        json=body,
        headers={"x-agent-key": AGENT_KEY},
        timeout=10
    )
    resp.raise_for_status()


# ===== 메인 루프 =====

def process_job(job):
    """작업 하나를 처리"""
    job_id = job["id"]
    job_type = job["jobType"]
    payload = job.get("payload") or {}
    logger.info(f"작업 처리 시작: #{job_id} [{job_type}]")

    handler = JOB_HANDLERS.get(job_type)
    if not handler:
        error_msg = f"지원하지 않는 작업 타입: {job_type}"
        logger.warning(error_msg)
        submit_result(job_id, "error", error_message=error_msg)
        return

    try:
        result = handler(payload)
        submit_result(job_id, "done", result=result)
        logger.info(f"작업 완료: #{job_id} [{job_type}]")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"작업 실패: #{job_id} [{job_type}] — {error_msg}")
        submit_result(job_id, "error", error_message=error_msg)


def validate_config():
    """시작 전 설정 확인"""
    if not REPLIT_URL:
        raise ValueError("REPLIT_URL 환경변수가 없습니다. .env 파일을 확인하세요.")
    if not AGENT_KEY:
        raise ValueError("AGENT_KEY 환경변수가 없습니다. .env 파일을 확인하세요.")
    if not KIWOOM_APP_KEY or not KIWOOM_APP_SECRET:
        logger.warning("KIWOOM_APP_KEY/SECRET 없음 — 키움 API 호출이 실패할 수 있습니다.")


def main():
    logger.info("=" * 50)
    logger.info("키움 에이전트 시작")
    logger.info(f"  Replit URL: {REPLIT_URL}")
    logger.info(f"  모드: {'모의투자' if KIWOOM_IS_MOCK else '실계좌'}")
    logger.info(f"  폴링 간격: {POLL_INTERVAL}초")
    logger.info("=" * 50)

    try:
        validate_config()
    except ValueError as e:
        logger.error(str(e))
        return

    # 키움 토큰 초기 발급
    if KIWOOM_APP_KEY and KIWOOM_APP_SECRET:
        refresh_kiwoom_token()

    logger.info("폴링 시작 — Ctrl+C로 종료")
    consecutive_errors = 0

    while True:
        try:
            job = fetch_next_job()
            if job:
                process_job(job)
                consecutive_errors = 0
            else:
                # 할 일 없음 — 짧게 대기
                time.sleep(POLL_INTERVAL)
                consecutive_errors = 0
        except KeyboardInterrupt:
            logger.info("에이전트 종료")
            break
        except Exception as e:
            consecutive_errors += 1
            wait = min(POLL_INTERVAL * consecutive_errors, 30)
            logger.error(f"폴링 오류 ({consecutive_errors}회): {e} — {wait}초 후 재시도")
            time.sleep(wait)


if __name__ == "__main__":
    main()
