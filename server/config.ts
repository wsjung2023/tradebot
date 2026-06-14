import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DEPLOYMENT_TIER: z.enum(['public_saas', 'private_cloud', 'on_prem']).default('on_prem'),
  PORT: z.coerce.number().default(5000),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Session
  SESSION_SECRET: z.string().optional(),

  // Agent auth
  AGENT_KEY: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),

  // Kiwoom
  KIWOOM_APP_KEY: z.string().optional(),
  KIWOOM_APP_SECRET: z.string().optional(),
  KIWOOM_APP_KEY_REAL: z.string().optional(),
  KIWOOM_APP_SECRET_REAL: z.string().optional(),
  KIWOOM_APP_KEY_MOCK: z.string().optional(),
  KIWOOM_APP_SECRET_MOCK: z.string().optional(),

  // SaaS billing — Paddle Classic (public_saas only)
  PADDLE_SANDBOX: z.enum(['true', 'false']).optional(), // 'true' = sandbox
  PADDLE_VENDOR_ID: z.string().optional(),              // 숫자형 Vendor ID
  PADDLE_VENDOR_AUTH_CODE: z.string().optional(),       // API 인증 코드 (Dashboard > Developer Tools)
  PADDLE_PUBLIC_KEY: z.string().optional(),             // 웹훅 서명 검증용 RSA 공개키
  PADDLE_PLAN_BASIC: z.string().optional(),             // 숫자형 Plan ID
  PADDLE_PLAN_PRO: z.string().optional(),
  PADDLE_PLAN_ENTERPRISE: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().optional(),

  // CORS allowed origins (comma-separated)
  ALLOWED_ORIGINS: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[Config] Environment validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const config = parseEnv();

export const isProduction = config.NODE_ENV === 'production';
export const isPublicSaaS = config.DEPLOYMENT_TIER === 'public_saas';

export function getAllowedOrigins(): string[] {
  const envOrigins = config.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
  const defaults = [
    'http://localhost:5000',
    'http://localhost:5002',
  ];
  return [...defaults, ...envOrigins];
}
