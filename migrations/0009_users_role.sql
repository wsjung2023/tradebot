ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Seed initial admin
UPDATE users SET role = 'admin' WHERE email = 'mainstop3@gmail.com';
