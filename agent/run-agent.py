"""
run-agent.py — 에이전트 자동 업데이트 실행기
서버에서 최신 kiwoom-agent.py를 받아서 실행합니다.
KIWOOM_IS_MOCK 설정 없이도 모의/실계좌 자동 분기.

실행 방법:
  python run-agent.py

.env 파일 (agent/ 폴더에 생성):
  REPLIT_URLS=https://your-app.replit.app,https://xxxx.spock.replit.dev
  AGENT_KEY=여기에_키_입력
  KIWOOM_APP_KEY=키움_앱키
  KIWOOM_APP_SECRET=키움_앱시크릿
"""

import os
import sys
import subprocess
import hashlib
import requests
from dotenv import load_dotenv

load_dotenv()

_raw_urls = os.getenv("REPLIT_URLS") or os.getenv("REPLIT_URL", "")
REPLIT_URLS = [u.strip().rstrip("/") for u in _raw_urls.split(",") if u.strip()]
AGENT_KEY = os.getenv("AGENT_KEY", "")

AGENT_FILE = os.path.join(os.path.dirname(__file__), "kiwoom-agent.py")


def get_file_hash(path):
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except FileNotFoundError:
        return None


def download_latest():
    for base_url in REPLIT_URLS:
        try:
            url = f"{base_url}/api/kiwoom-agent/download"
            resp = requests.get(url, params={"agent_key": AGENT_KEY}, timeout=10)
            if resp.status_code == 200:
                return resp.text
        except Exception as e:
            print(f"[run-agent] {base_url} 다운로드 실패: {e}")
    return None


def main():
    if not REPLIT_URLS or not AGENT_KEY:
        print("[run-agent] .env 파일에 REPLIT_URLS, AGENT_KEY 설정 필요")
        sys.exit(1)

    print("[run-agent] 서버에서 최신 에이전트 확인 중...")
    latest = download_latest()

    if latest:
        old_hash = get_file_hash(AGENT_FILE)
        new_hash = hashlib.md5(latest.encode()).hexdigest()

        if old_hash != new_hash:
            print("[run-agent] 최신 버전 발견 → 업데이트 중...")
            with open(AGENT_FILE, "w", encoding="utf-8") as f:
                f.write(latest)
            print("[run-agent] 업데이트 완료")
        else:
            print("[run-agent] 이미 최신 버전")
    else:
        print("[run-agent] 서버 연결 실패 — 기존 파일로 실행")

    print("[run-agent] 에이전트 시작...")
    os.execv(sys.executable, [sys.executable, AGENT_FILE])


if __name__ == "__main__":
    main()
