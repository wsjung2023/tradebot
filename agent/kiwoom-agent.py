"""
kiwoom-agent.py — 집 PC에서 실행하는 키움 REST API 폴링 에이전트
Replit 서버에 2~5초마다 할 일을 가져와 키움 API를 호출하고 결과를 돌려줍니다.

실행 방법:
  1. pip install requests python-dotenv websocket-client
  2. .env 파일 생성 (아래 설정 참고)
  3. python agent/kiwoom-agent.py

.env 파일 예시 (agent/ 폴더 또는 프로젝트 루트에 생성):
  # 단일 URL (배포 서버만 폴링):
  REPLIT_URL=https://your-replit-app.replit.app

  # 다중 URL (배포 + 개발 서버 동시 폴링, 쉼표 구분):
  REPLIT_URLS=https://your-app.replit.app,https://xxxx.spock.replit.dev

  AGENT_KEY=여기에_랜덤_비밀키_입력

  # 실계좌와 모의계좌 앱키가 다른 경우 (키움 포털에서 각각 발급):
  KIWOOM_APP_KEY_REAL=실계좌_앱키
  KIWOOM_APP_SECRET_REAL=실계좌_앱시크릿
  KIWOOM_APP_KEY_MOCK=모의계좌_앱키
  KIWOOM_APP_SECRET_MOCK=모의계좌_앱시크릿

  # 실계좌/모의계좌 앱키가 동일한 경우 (하위 호환):
  # KIWOOM_APP_KEY=앱키
  # KIWOOM_APP_SECRET=앱시크릿

  KIWOOM_IS_MOCK=false
  POLL_INTERVAL=2
"""

import os
import time
import json
import threading
import logging
import requests
import websocket
from dotenv import load_dotenv

load_dotenv()

# REPLIT_URLS (쉼표 구분 다중 URL) 또는 REPLIT_URL (단일 URL) 지원
_raw_urls = os.getenv("REPLIT_URLS") or os.getenv("REPLIT_URL", "")
REPLIT_URLS = [u.strip().rstrip("/") for u in _raw_urls.split(",") if u.strip()]
REPLIT_URL = REPLIT_URLS[0] if REPLIT_URLS else ""  # 하위 호환성
AGENT_KEY = os.getenv("AGENT_KEY", "")

# 실계좌/모의계좌 앱키 — 로컬 .env 또는 서버에서 자동 수신
# 우선순위: 로컬 .env > 서버 /api/kiwoom-agent/appkeys 자동 수신
_APP_KEY_COMMON = os.getenv("KIWOOM_APP_KEY", "")
_APP_SECRET_COMMON = os.getenv("KIWOOM_APP_SECRET", "")
KIWOOM_APP_KEY_REAL = os.getenv("KIWOOM_APP_KEY_REAL", _APP_KEY_COMMON)
KIWOOM_APP_SECRET_REAL = os.getenv("KIWOOM_APP_SECRET_REAL", _APP_SECRET_COMMON)
KIWOOM_APP_KEY_MOCK = os.getenv("KIWOOM_APP_KEY_MOCK", _APP_KEY_COMMON)
KIWOOM_APP_SECRET_MOCK = os.getenv("KIWOOM_APP_SECRET_MOCK", _APP_SECRET_COMMON)
KIWOOM_APP_KEY = _APP_KEY_COMMON
KIWOOM_APP_SECRET = _APP_SECRET_COMMON

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
    app_key = KIWOOM_APP_KEY_MOCK if is_mock else KIWOOM_APP_KEY_REAL
    app_secret = KIWOOM_APP_SECRET_MOCK if is_mock else KIWOOM_APP_SECRET_REAL
    try:
        url = f"{base_url}/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "secretkey": app_secret,
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


def kiwoom_ws_request(api_id, payload, is_mock=None):
    """
    키움 WebSocket API 요청 (단발성 요청-응답)
    - 조건검색(ka10171, ka10172) 등에 사용
    """
    use_mock = KIWOOM_IS_MOCK if is_mock is None else is_mock
    token = get_kiwoom_token(is_mock=use_mock)
    if not token:
        raise ValueError("키움 WebSocket 토큰 없음")

    base_ws = "wss://mockapi.kiwoom.com:10000" if use_mock else "wss://api.kiwoom.com:10000"
    ws_url = f"{base_ws}/api/dostk/websocket"
    result = {"data": None, "error": None}

    def on_open(ws):
        ws.send(json.dumps(payload))

    def on_message(ws, raw):
        try:
            msg = json.loads(raw)
            if msg.get("trnm") == "REAL":
                return

            rc = msg.get("return_code")
            if rc is not None and rc != 0 and str(rc) != "0":
                result["error"] = f"키움 WS 오류: {msg.get('return_msg')} (code: {rc})"
            else:
                result["data"] = msg
        except Exception as e:
            result["error"] = str(e)
        finally:
            ws.close()

    def on_error(ws, error):
        result["error"] = str(error)
        ws.close()

    ws_app = websocket.WebSocketApp(
        ws_url,
        header=[
            f"api-id: {api_id}",
            f"Authorization: Bearer {token}",
        ],
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
    )
    timeout_seconds = 20

    def force_timeout():
        result["error"] = f"키움 WebSocket 타임아웃 ({timeout_seconds}초, api_id={api_id})"
        ws_app.close()

    timer = threading.Timer(timeout_seconds, force_timeout)
    timer.start()
    try:
        ws_app.run_forever(ping_timeout=timeout_seconds)
    finally:
        timer.cancel()

    if result["error"]:
        raise ValueError(result["error"])
    if result["data"] is None:
        raise TimeoutError(f"키움 WebSocket 응답 없음 (api_id={api_id})")

    return result["data"]


# ===== 종목 캐시 =====
_stock_cache = []
_stock_cache_built_at = 0
_STOCK_CACHE_TTL = 24 * 60 * 60


def _normalize_abs_number(value):
    if value is None:
        return "0"
    return str(value).strip().replace(",", "").lstrip("-") or "0"


def _normalize_signed_number(value):
    if value is None:
        return "0"
    raw = str(value).strip().replace(",", "")
    if not raw:
        return "0"
    if raw.startswith("+") or raw.startswith("-"):
        return raw
    return raw


def _extract_chart_list(data, period):
    list_key_map = {
        "D": "stk_dt_pole_chart_qry",
        "W": "stk_stk_pole_chart_qry",
        "M": "stk_mth_pole_chart_qry",
    }
    items = data.get(list_key_map.get(period, "stk_dt_pole_chart_qry"), []) or []
    if items:
        return items
    for fallback_key in ("stk_dt_pole_chart_qry", "stk_stk_pole_chart_qry", "stk_mth_pole_chart_qry", "output", "items"):
        rows = data.get(fallback_key, []) or []
        if rows:
            return rows
    return []


def ensure_stock_cache():
    global _stock_cache, _stock_cache_built_at
    now = time.time()
    if _stock_cache and now - _stock_cache_built_at < _STOCK_CACHE_TTL:
        return _stock_cache

    cache = []
    seen = set()
    for market_type in ("0", "10"):
        data = kiwoom_post("/api/dostk/stkinfo", "ka10099", {"mrkt_tp": market_type})
        rows = data.get("stk_list", []) or data.get("list", []) or data.get("output", []) or []
        for row in rows:
            code = str(row.get("stk_cd") or row.get("code") or "").replace("A", "", 1)
            name = str(row.get("stk_nm") or row.get("name") or "").strip()
            if not code or not name or code in seen:
                continue
            seen.add(code)
            cache.append({"code": code, "name": name})

    _stock_cache = cache
    _stock_cache_built_at = now
    return _stock_cache


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
    """일봉/주봉/월봉 차트 조회 — 구형 서비스와 동일한 필드 우선 사용"""
    code = payload.get("stockCode", "")
    period = payload.get("period", "D").upper()
    count = int(payload.get("count", 100))

    api_id_map = {"D": "ka10081", "W": "ka10082", "M": "ka10083"}
    api_id = api_id_map.get(period, "ka10081")

    today = time.strftime("%Y%m%d")
    data = kiwoom_post("/api/dostk/chart", api_id, {
        "stk_cd": code,
        "base_dt": today,
        "upd_stkpc_tp": "1",
    })

    raw_items = _extract_chart_list(data, period)
    items = []
    for item in raw_items[:count]:
        open_price = _normalize_abs_number(item.get("open_pric") or item.get("oppr") or 0)
        high_price = _normalize_abs_number(item.get("high_pric") or item.get("hgpr") or 0)
        low_price = _normalize_abs_number(item.get("low_pric") or item.get("lwpr") or 0)
        close_price = _normalize_abs_number(item.get("cur_prc") or item.get("close") or 0)
        date_value = str(item.get("dt") or item.get("date") or "")[:8]
        volume = str(item.get("trde_qty") or item.get("volume") or "0").replace(",", "")
        parsed_close = float(close_price or "0")
        if not date_value or parsed_close <= 0:
            continue
        items.append({
            "date": date_value,
            "open": float(open_price or "0"),
            "high": float(high_price or "0"),
            "low": float(low_price or "0"),
            "close": parsed_close,
            "volume": int(volume or "0"),
        })
    return items


def handle_stock_info(payload):
    """종목 기본정보 조회 — ka10001"""
    code = payload.get("stockCode", "")
    data = kiwoom_post("/api/dostk/stkinfo", "ka10001", {"stk_cd": code})
    return {
        "stockCode": code,
        "name": data.get("stk_nm", ""),
        "marketName": data.get("mrkt_cls_nm") or data.get("mrkt_nm", ""),
        "state": data.get("mang_stk_cls_nm") or data.get("stk_stat_nm", ""),
        "currentPrice": _normalize_abs_number(data.get("cur_prc") or 0),
        "raw": data,
    }


def handle_stock_search(payload):
    """종목명/코드 검색 — 코드 exact + 캐시 기반 부분검색 + API 검색 병행"""
    keyword = str(payload.get("keyword", "")).strip()
    if not keyword:
        return []

    results = []
    seen = set()

    def append_result(stock_code, stock_name, current_price="0", market_name=""):
        stock_code = str(stock_code or "").replace("A", "", 1)
        stock_name = str(stock_name or "").strip()
        if not stock_code or not stock_name or stock_code in seen:
            return
        seen.add(stock_code)
        results.append({
            "stockCode": stock_code,
            "stockName": stock_name,
            "currentPrice": _normalize_abs_number(current_price),
            "marketName": market_name or "",
        })

    if keyword.isdigit() and len(keyword) == 6:
        try:
            info = handle_stock_info({"stockCode": keyword})
            append_result(keyword, info.get("name"), info.get("currentPrice"), info.get("marketName"))
        except Exception as error:
            logger.warning(f"stock.search exact lookup 실패: {error}")

    try:
        for stock in ensure_stock_cache():
            if keyword in stock["code"] or keyword in stock["name"]:
                append_result(stock["code"], stock["name"])
                if len(results) >= 20:
                    break
    except Exception as error:
        logger.warning(f"stock.search 캐시 조회 실패: {error}")

    try:
        data = kiwoom_post("/api/dostk/stkinfo", "ka10002", {"stk_nm": keyword})
        raw_items = data.get("stk_info", []) or data.get("output", []) or []
        for item in raw_items:
            append_result(
                item.get("stk_cd"),
                item.get("stk_nm"),
                item.get("cur_prc", "0"),
                item.get("mrkt_cls_nm") or item.get("mrkt_nm", ""),
            )
            if len(results) >= 20:
                break
    except Exception as error:
        logger.warning(f"stock.search API 검색 실패: {error}")

    return results[:20]


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
        "version": "2.5",
        "features": ["accountType-routing", "raw-output1", "token-test", "split-appkey", "server-appkey", "financials-get"],
    }


def handle_token_test(payload):
    """실계좌/모의 토큰 발급 테스트 — 키움 /oauth2/token 직접 호출"""
    account_type = payload.get("accountType", "real")
    is_mock = account_type == "mock"
    base_url = KIWOOM_MOCK_BASE if is_mock else KIWOOM_REAL_BASE
    app_key = KIWOOM_APP_KEY_MOCK if is_mock else KIWOOM_APP_KEY_REAL
    app_secret = KIWOOM_APP_SECRET_MOCK if is_mock else KIWOOM_APP_SECRET_REAL
    url = f"{base_url}/oauth2/token"
    req_body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "secretkey": app_secret,
    }
    try:
        resp = requests.post(
            url,
            json=req_body,
            headers={"Content-Type": "application/json;charset=UTF-8"},
            timeout=10
        )
        data = resp.json()
        return {
            "accountType": account_type,
            "url": url,
            "httpStatus": resp.status_code,
            "returnCode": data.get("return_code"),
            "returnMsg": data.get("return_msg"),
            "hasToken": bool(data.get("access_token") or data.get("token")),
            "raw": data,
        }
    except Exception as e:
        return {
            "accountType": account_type,
            "url": url,
            "error": str(e),
            "hasToken": False,
        }


def handle_financials_get(payload):
    """
    종목 재무 스냅샷 조회 — ka10001 기반
    - 키움 REST는 상세 재무제표 API를 직접 제공하지 않으므로
      기본정보 응답에서 재무 관련 필드를 추출해 output 배열 형태로 반환.
    """
    stock_code = str(payload.get("stockCode", "")).strip()
    if not stock_code:
        raise ValueError("financials.get: stockCode 파라미터가 필요합니다.")

    info = kiwoom_post("/api/dostk/stkinfo", "ka10001", {
        "stk_cd": stock_code,
        "dt": "",
        "qry_tp": "1",
    })

    stac_yymm = time.strftime("%Y%m")
    output = [{
        "stac_yymm": stac_yymm,
        "sale_account": info.get("sale_acnt") or info.get("acc_trde_prica") or "0",
        "sale_cost": "0",
        "sale_totl_prfi": "0",
        "bsop_prti": info.get("oprt_prft") or "0",
        "ntin": info.get("net_incm") or "0",
        "total_aset": info.get("tot_aset") or "0",
        "total_lblt": info.get("tot_lblt") or "0",
        "cpfn": info.get("cap") or "0",
    }]

    return {
        "stockCode": stock_code,
        "output": output,
        "raw": info,
    }


def handle_condition_list(_payload):
    """키움 HTS 조건검색식 목록 조회 — ka10171 (WebSocket)"""
    try:
        msg = kiwoom_ws_request("ka10171", {"trnm": "CNSRLST"})
    except Exception as e:
        logger.error(f"condition.list WebSocket 실패: {e}")
        raise

    rows = msg.get("data") or msg.get("output") or []
    result = []
    for row in rows:
        if isinstance(row, list):
            seq = int(row[0]) if len(row) > 0 else 0
            name = str(row[1]) if len(row) > 1 else ""
        elif isinstance(row, dict):
            seq = int(row.get("seq") or row.get("condition_index") or 0)
            name = str(row.get("name") or row.get("condition_name") or "")
        else:
            continue

        if name:
            result.append({
                "condition_index": seq,
                "condition_name": name,
            })

    logger.info(f"condition.list 조회 완료: {len(result)}개")
    return {"output": result}


def handle_condition_run(payload):
    """키움 HTS 조건검색식 실행 — ka10172 (WebSocket)"""
    seq = str(payload.get("seq", "")).strip()
    if not seq:
        raise ValueError("condition.run: seq 파라미터가 필요합니다.")

    try:
        msg = kiwoom_ws_request("ka10172", {
            "trnm": "CNSRREQ",
            "seq": seq,
            "search_type": "0",
            "stex_tp": "K",
            "cont_yn": "N",
            "next_key": "",
        })
    except Exception as e:
        logger.error(f"condition.run WebSocket 실패 (seq={seq}): {e}")
        raise

    rows = msg.get("data") or msg.get("output1") or msg.get("output") or []
    result = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        stock_code = str(item.get("9001") or item.get("stck_cd") or item.get("stock_code") or "").replace("A", "", 1)
        stock_name = str(item.get("302") or item.get("stck_nm") or item.get("stock_name") or "")
        current_price = _normalize_abs_number(item.get("10") or item.get("stck_prpr") or item.get("current_price") or "0")
        change_rate = _normalize_signed_number(item.get("12") or item.get("prdy_ctrt") or item.get("change_rate") or "0")

        if not stock_code:
            continue

        result.append({
            "stock_code": stock_code,
            "stock_name": stock_name,
            "current_price": current_price,
            "change_rate": change_rate,
        })

    logger.info(f"condition.run 완료 (seq={seq}): {len(result)}개 종목")
    return result


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
    "financials.get": handle_financials_get,
    "ping": handle_ping,
    "token.test": handle_token_test,
    "condition.list": handle_condition_list,
    "condition.run": handle_condition_run,
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


def fetch_appkeys_from_server():
    """서버 Replit Secrets에서 실계좌/모의계좌 앱키를 자동으로 받아옴"""
    global KIWOOM_APP_KEY_REAL, KIWOOM_APP_SECRET_REAL
    global KIWOOM_APP_KEY_MOCK, KIWOOM_APP_SECRET_MOCK
    global KIWOOM_APP_KEY, KIWOOM_APP_SECRET

    for base_url in REPLIT_URLS:
        try:
            resp = requests.get(
                f"{base_url}/api/kiwoom-agent/appkeys",
                params={"agent_key": AGENT_KEY},
                headers={"x-agent-key": AGENT_KEY},
                timeout=8
            )
            if resp.status_code == 200:
                data = resp.json()
                real = data.get("real", {})
                mock = data.get("mock", {})
                if real.get("appKey"):
                    KIWOOM_APP_KEY_REAL = real["appKey"]
                    KIWOOM_APP_SECRET_REAL = real["appSecret"]
                if mock.get("appKey"):
                    KIWOOM_APP_KEY_MOCK = mock["appKey"]
                    KIWOOM_APP_SECRET_MOCK = mock["appSecret"]
                    KIWOOM_APP_KEY = mock["appKey"]
                    KIWOOM_APP_SECRET = mock["appSecret"]
                logger.info(f"서버에서 앱키 수신 완료 (실계좌: {'있음' if real.get('appKey') else '없음'}, 모의: {'있음' if mock.get('appKey') else '없음'})")
                return True
        except Exception as e:
            logger.debug(f"앱키 수신 실패 ({base_url}): {e}")
    logger.warning("서버에서 앱키 수신 실패 — 로컬 .env 값 사용")
    return False


def validate_config():
    if not REPLIT_URLS:
        raise ValueError("REPLIT_URL 또는 REPLIT_URLS 환경변수가 없습니다. .env 파일을 확인하세요.")
    if not AGENT_KEY:
        raise ValueError("AGENT_KEY 환경변수가 없습니다. .env 파일을 확인하세요.")


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

    # ──────────────────────────────────────────────────────────────────────
    # ⚠️  앱키 수신 로직 — 변경 금지 (재발 방지 2025)
    # ──────────────────────────────────────────────────────────────────────
    # 반드시 환경변수 이름으로만 체크해야 한다.
    # KIWOOM_APP_KEY_REAL 변수값으로 체크하면 안 된다.
    #
    # 이유: 로컬 .env에 KIWOOM_APP_KEY만 있어도
    #   KIWOOM_APP_KEY_REAL = os.getenv("KIWOOM_APP_KEY_REAL", _APP_KEY_COMMON)
    #   → KIWOOM_APP_KEY_REAL에 모의계좌 앱키가 복사됨
    #   → if not KIWOOM_APP_KEY_REAL → False (이미 값이 있으므로)
    #   → fetch_appkeys_from_server() 호출 안 됨
    #   → 모의계좌 앱키로 실계좌 API 호출 → 8030 오류
    #
    # ❌ 절대 이렇게 하지 말 것:
    #   if not KIWOOM_APP_KEY_REAL or not KIWOOM_APP_KEY_MOCK:
    #
    # ✅ 반드시 이렇게 유지:
    #   _has_real_specific = bool(os.getenv("KIWOOM_APP_KEY_REAL"))
    # ──────────────────────────────────────────────────────────────────────
    _has_real_specific = bool(os.getenv("KIWOOM_APP_KEY_REAL"))
    _has_mock_specific = bool(os.getenv("KIWOOM_APP_KEY_MOCK"))
    if not _has_real_specific or not _has_mock_specific:
        fetch_appkeys_from_server()
    else:
        logger.info("로컬 .env 전용 앱키 사용 (실계좌/모의계좌 분리됨)")

    if KIWOOM_APP_KEY_REAL or KIWOOM_APP_KEY_MOCK:
        refresh_kiwoom_token(is_mock=False)
        refresh_kiwoom_token(is_mock=True)

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
