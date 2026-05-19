-- kiwoom_accounts에 계좌별 API 키 컬럼 추가
ALTER TABLE "kiwoom_accounts"
  ADD COLUMN IF NOT EXISTS "kiwoom_app_key" text,
  ADD COLUMN IF NOT EXISTS "kiwoom_app_secret" text;
