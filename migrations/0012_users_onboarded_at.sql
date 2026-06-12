ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamp;
-- 기존 유저는 온보딩 완료로 처리 (신규 가입자만 온보딩 플로우 진행)
UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;
