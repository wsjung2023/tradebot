ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expiry timestamp;
-- 기존 유저(Google OAuth 등)는 이미 인증된 것으로 처리
UPDATE users SET is_email_verified = true WHERE is_email_verified = false AND auth_provider != 'local';
