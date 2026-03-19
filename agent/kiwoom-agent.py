"""
kiwoom-agent.py — 집 PC에서 실행하는 키움 REST API 폴링 에이전트
Replit 서버에 2~5초마다 할 일을 가져와 키움 API를 호출하고 결과를 돌려줍니다.

실행 방법:
  1. pip install requests python-dotenv
  2. .env 파일 생성 (아래 설정 참고)
  3. python agent/kiwoom-agent.py

.env 파일 예시 (agent/ 폴더 또는 프로젝트 루트에 생성):
  # 단일 URL (배포 서버만 폴링):
  REPLIT_URL=https://your-replit-app.replit.app

  # 다중 URL (배포 + 개발 서버 동시 폴링, 쉼표 구분):
  REPLIT_URLS=https://your-app.replit.app,https://xxxx.spock.replit.dev

  AGENT_KEY=여기에_랜덤_비밀키_입력
  KIWOOM_APP_KEY=키움_앱키
  KIWOOM_APP_SECRET=키움_앱시크릿
  KIWOOM_IS_MOCK=false
  POLL_INTERVAL=2
"""

import os
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

# REPLIT_URLS (쉼표 구분 다중 URL) 또는 REPLIT_URL (단일 URL) 지원
_raw_urls = os.getenv("REPLIT_URLS") or os.getenv("REPLIT_URL", "")
REPLIT_URLS = [u.strip().rstrip("/") for u in _raw_urls.split(",") if u.strip()]
REPLIT_URL = REPLIT_URLS[0] if REPLIT_URLS else ""  # 하위 호환성
AGENT_KEY = os.getenv("AGENT_KEY", "")
KIWOOM_APP_KEY = os.getenv("KIWOOM_APP_KEY", "")
KIWOOM_APP_SECRET = os.getenv("KIWOOM_APP_SECRET", "")
KIWOOM_IS_MOCK = os.getenv("KIWOOM_IS_MOCK", "false").lower() == "true"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "2"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("kiwoom-agent")

KIWOOM_REAL_BASE = "https://api.kiwoom.com"
KIWOOM_MOCK_BASE = "https://mockapi.kiwoom.com"


def get_kiwoom_base_url():
    return KIWOOM_MOCK_BASE if KIWOOM_IS_MOCK else KIWOOM_REAL_BASE


# ===== 키움 토큰 관리 (모의/실계좌 분리) =====
_tokens = {"real": None, "mock": None}
_token_expires = {"real": 0, "mock": 0}


def refresh_kiwoom_token(is_mock=False):
    """키움 REST API 액세스 토큰 발급 — POST /oauth2/token"""
    key = "mock" if is_mock else "real"
    base_url = KIWOOM_MOCK_BASE if is_mock else KIWOOM_REAL_BASE
    try:
        url = f"{base_url}/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "appkey": KIWOOM_APP_KEY,
            "secretkey": KIWOOM_APP_SECRET,
        }
        resp = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json;charset=UTF-8"},
            timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("return_code") and data["return_code"] != 0:
            raise ValueError(f"토큰 발급 실패: {data.get('return_msg')} (code: {data['return_code']})")
        _tokens[key] = data.get("access_token") or data.get("token")
        expires_in = int(data.get("expires_in", 86400))
        _token_expires[key] = time.time() + expires_in - 60
        logger.info(f"키움 토큰 갱신 완료 ({'모의' if is_mock else '실계좌'})")
        return True
    except Exception as e:
        logger.error(f"키움 토큰 갱신 실패 ({'모의' if is_mock else '실계좌'}): {e}")
        return False


def get_kiwoom_token(is_mock=False):
    key = "mock" if is_mock else "real"
    if not _tokens[key] or time.time() >= _token_expires[key]:
        refresh_kiwoom_token(is_mock=is_mock)
    return _tokens[key]


def kiwoom_post(path, api_id, body=None, is_mock=None):
    """
    키움 REST API POST 요청
    - Content-Type: application/json;charset=UTF-8
    - Authorization: Bearer {token}
    - api-id: {api_id}  ← 필수 헤더
    - is_mock: None이면 KIWOOM_IS_MOCK 전역 설정 사용, True/False 이면 강제 적용
    """
    use_mock = KIWOOM_IS_MOCK if is_mock is None else is_mock
    token = get_kiwoom_token(is_mock=use_mock)
    base_url = KIWOOM_MOCK_BASE if use_mock else KIWOOM_REAL_BASE
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": api_id,
    }
    url = f"{base_url}{path}"
    resp = requests.post(url, headers=headers, json=body or {}, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    rc = data.get("return_code")
    if rc is not None and rc != 0 and str(rc) != "0":
        raise ValueError(f"키움 API 오류: {data.get('return_msg')} (code: {rc})")
    return data


# ===== 작업 핸들러 =====

def handle_watchlist_get(payload):
    """관심종목 시세 조회 — ka10007 (현재가) 반복 호출"""
    stock_codes = payload.get("stockCodes", [])
    results = []
    for code in stock_codes:
        try:
            data = kiwoom_post("/api/dostk/mrkcond", "ka10007", {"stk_cd": code})
            results.append({
                "stockCode": code,
                "stockName": data.get("stk_nm", ""),
                "currentPrice": data.get("cur_prc", "0"),
                "changeRate": data.get("flu_rt", "0"),
                "change": data.get("prc_diff", "0"),
                "changeSign": data.get("prdy_vrss_sign", ""),
                "volume": data.get("acc_trde_qty", "0"),
                "high": data.get("hgpr", "0"),
                "low": data.get("lwpr", "0"),
                "open": data.get("oppr", "0"),
                "raw": data,
            })
        except Exception as e:
            results.append({"stockCode": code, "error": str(e)})
    return {"items": results}


def handle_price_get(payload):
    """단일 종목 현재가 조회 — ka10007"""
    code = payload.get("stockCode", "")
    data = kiwoom_post("/api/dostk/mrkcond", "ka10007", {"stk_cd": code})
    return {
        "stockCode": code,
        "stockName": data.get("stk_nm", ""),
        "currentPrice": data.get("cur_prc", "0"),
        "changeRate": data.get("flu_rt", "0"),
        "change": data.get("prc_diff", "0"),
        "volume": data.get("acc_trde_qty", "0"),
        "high": data.get("hgpr", "0"),
        "low": data.get("lwpr", "0"),
        "open": data.get("oppr", "0"),
        "raw": data,
    }


def handle_orderbook_get(payload):
    """호가 조회 — ka10004"""
    code = payload.get("stockCode", "")
    data = kiwoom_post("/api/dostk/mrkcond", "ka10004", {"stk_cd": code})
    return {"stockCode": code, "raw": data}


def handle_chart_get(payload):
    """일봉/주봉/월봉 차트 조회 — ka10081(일), ka10082(주), ka10083(월)"""
    code = payload.get("stockCode", "")
    period = payload.get("period", "D").upper()
    count = int(payload.get("count", 100))

    api_id_map = {"D": "ka10081", "W": "ka10082", "M": "ka10083"}
    api_id = api_id_map.get(period, "ka10081")

    today = time.strftime("%Y%m%d")
    data = kiwoom_post("/api/dostk/chart", api_id, {
        "stk_cd": code,
        "base_dt": today,
        "updn_bnd_cd": "0",
    })

    raw_items = data.get("stk_dt_pole_chart_qry", []) or []
    items = []
    for item in raw_items[:count]:
        items.append({
            "date": item.get("dt", ""),
            "open": float(item.get("oppr", "0") or "0"),
            "high": float(item.get("hgpr", "0") or "0"),
            "low": float(item.get("lwpr", "0") or "0"),
            "close": float(item.get("cur_prc", "0") or "0"),
            "volume": int(item.get("trde_qty", "0") or "0"),
        })
    return items


def handle_stock_info(payload):
    """종목 기본정보 조회 — ka10001"""
    code = payload.get("stockCode", "")
    data = kiwoom_post("/api/dostk/stkinfo", "ka10001", {"stk_cd": code})
    return {
        "stockCode": code,
        "name": data.get("stk_nm", ""),
        "marketName": data.get("mrkt_cls_nm", ""),
        "state": data.get("mang_stk_cls_nm", ""),
        "raw": data,
    }


def handle_stock_search(payload):
    """종목명/코드 검색 — ka10002 (종목정보 검색)"""
    keyword = payload.get("keyword", "")
    try:
        data = kiwoom_post("/api/dostk/stkinfo", "ka10002", {"stk_nm": keyword})
        raw_items = data.get("stk_info", []) or []
        results = []
        for item in raw_items[:20]:
            results.append({
                "stockCode": item.get("stk_cd", ""),
                "stockName": item.get("stk_nm", ""),
                "currentPrice": item.get("cur_prc", "0"),
                "marketName": item.get("mrkt_cls_nm", ""),
            })
        return results
    except Exception as e:
        logger.warning(f"stock.search 실패: {e}")
        return []


def handle_balance_get(payload):
    """계좌 잔고 조회 — kt00018 (계좌평가잔고내역)"""
    account_type = payload.get("accountType", "real")
    is_mock = account_type == "mock"
    dmst_stex_tp = "%" if is_mock else "KRX"
    data = kiwoom_post("/api/dostk/acnt", "kt00018", {
        "qry_tp": "2",
        "dmst_stex_tp": dmst_stex_tp,
    }, is_mock=is_mock)
    # 키움 API는 tot_evlt_amt 등을 raw 최상위에 직접 반환
    holdings = data.get("acnt_evlt_remn_indv_tot", []) or []
    return {
        "totalEvaluationAmount": str(data.get("tot_evlt_amt", data.get("tot_evlu_amt", "0"))),
        "depositAmount": str(data.get("prsm_dpst_aset_amt", data.get("dnca_tot_amt", "0"))),
        "todayProfit": str(data.get("tot_evlt_pl", data.get("tot_evlu_pfls", "0"))),
        "output1": data,
        "output2": holdings,
        "raw": data,
    }


def handle_order_buy(payload):
    """매수 주문 — kt10000"""
    ord_tp = "2" if payload.get("orderType") == "limit" else "1"
    body = {
        "stk_cd": payload.get("stockCode"),
        "buy_sel_tp": "1",
        "ord_tp": ord_tp,
        "ord_qty": str(payload.get("quantity", 0)),
        "ord_prc": str(payload.get("price", 0)),
    }
    return kiwoom_post("/api/dostk/ordr", "kt10000", body)


def handle_order_sell(payload):
    """매도 주문 — kt10000"""
    ord_tp = "2" if payload.get("orderType") == "limit" else "1"
    body = {
        "stk_cd": payload.get("stockCode"),
        "buy_sel_tp": "2",
        "ord_tp": ord_tp,
        "ord_qty": str(payload.get("quantity", 0)),
        "ord_prc": str(payload.get("price", 0)),
    }
    return kiwoom_post("/api/dostk/ordr", "kt10000", body)


def handle_ping(_payload):
    """연결 테스트 — 키움 API 호출 없음"""
    return {
        "pong": True,
        "agentTime": time.time(),
        "mode": "mock" if KIWOOM_IS_MOCK else "real",
        "version": "2.1",
        "features": ["accountType-routing", "raw-output1"],
    }


JOB_HANDLERS = {
    "watchlist.get": handle_watchlist_get,
    "price.get": handle_price_get,
    "orderbook.get": handle_orderbook_get,
    "chart.get": handle_chart_get,
    "stock.info": handle_stock_info,
    "stock.search": handle_stock_search,
    "balance.get": handle_balance_get,
    "order.buy": handle_order_buy,
    "order.sell": handle_order_sell,
    "ping": handle_ping,
}


# ===== Replit 통신 =====

# 다중 URL 순환 인덱스 (어느 서버에서 job을 가져왔는지 추적)
_current_url_index = 0
_job_source_url = {}  # job_id → url 매핑 (결과 전송 시 같은 서버로 보내기)


def fetch_next_job():
    """REPLIT_URLS 목록을 순서대로 폴링하여 job 반환"""
    global _current_url_index
    for i in range(len(REPLIT_URLS)):
        idx = (_current_url_index + i) % len(REPLIT_URLS)
        base_url = REPLIT_URLS[idx]
        try:
            url = f"{base_url}/api/kiwoom-agent/jobs/next"
            resp = requests.get(
                url,
                params={"agent_key": AGENT_KEY},
                headers={"x-agent-key": AGENT_KEY},
                timeout=10
            )
            resp.raise_for_status()
            job = resp.json().get("job")
            if job:
                _current_url_index = (idx + 1) % len(REPLIT_URLS)
                _job_source_url[job["id"]] = base_url
                if len(REPLIT_URLS) > 1:
                    logger.info(f"서버 #{idx+1} ({base_url[:40]}...)에서 job #{job['id']} 수신")
                return job
        except Exception as e:
            logger.debug(f"서버 #{idx+1} 폴링 오류: {e}")
    return None


def submit_result(job_id, status, result=None, error_message=None):
    """job을 가져온 서버로 결과 전송"""
    base_url = _job_source_url.get(job_id, REPLIT_URL)
    url = f"{base_url}/api/kiwoom-agent/jobs/{job_id}/result"
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
    _job_source_url.pop(job_id, None)


# ===== 메인 루프 =====

def process_job(job):
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
    if not REPLIT_URLS:
        raise ValueError("REPLIT_URL 또는 REPLIT_URLS 환경변수가 없습니다. .env 파일을 확인하세요.")
    if not AGENT_KEY:
        raise ValueError("AGENT_KEY 환경변수가 없습니다. .env 파일을 확인하세요.")
    if not KIWOOM_APP_KEY or not KIWOOM_APP_SECRET:
        logger.warning("KIWOOM_APP_KEY/SECRET 없음 — ping 테스트는 가능하나 실제 키움 API 호출 불가")


def main():
    logger.info("=" * 55)
    logger.info("키움 에이전트 시작")
    for i, url in enumerate(REPLIT_URLS):
        logger.info(f"  Replit URL #{i+1}: {url}")
    logger.info(f"  모드: {'모의투자 (mockapi.kiwoom.com)' if KIWOOM_IS_MOCK else '실계좌 (api.kiwoom.com)'}")
    logger.info(f"  지원 jobType: {', '.join(JOB_HANDLERS.keys())}")
    logger.info(f"  폴링 간격: {POLL_INTERVAL}초")
    logger.info("=" * 55)

    try:
        validate_config()
    except ValueError as e:
        logger.error(str(e))
        return

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
