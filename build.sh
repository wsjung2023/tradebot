#!/usr/bin/env bash
# build.sh — 프로덕션 빌드 스크립트
# git rev-parse --short HEAD 로 커밋 해시를 BUILD_COMMIT 환경 변수에 주입합니다.
# 사용법: bash build.sh

set -e

COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "")
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -n "$COMMIT_HASH" ]; then
  echo "[build] 커밋 해시: $COMMIT_HASH"
else
  echo "[build] WARNING: git rev-parse 실패. BUILD_COMMIT 이 비어있습니다."
fi

export BUILD_COMMIT="$COMMIT_HASH"
export BUILD_TIME="$BUILD_TIMESTAMP"

echo "[build] BUILD_COMMIT=${BUILD_COMMIT:-없음}, BUILD_TIME=$BUILD_TIME"

# 프론트엔드 빌드 (VITE_BUILD_VERSION은 vite.config.ts에서 주입 가능)
VITE_BUILD_VERSION="$BUILD_TIMESTAMP" npx vite build

# 백엔드 번들 (BUILD_COMMIT, BUILD_TIME을 환경 변수로 전달)
BUILD_COMMIT="$BUILD_COMMIT" BUILD_TIME="$BUILD_TIME" \
  npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist

echo "[build] 빌드 완료. BUILD_COMMIT=${BUILD_COMMIT:-없음}"
