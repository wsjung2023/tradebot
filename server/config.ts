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

  // SaaS billing (public_saas only)
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_CLIENT_TOKEN: z.string().optional(), // frontend Paddle.js 초기화용 (test_xxx / live_xxx)
  PADDLE_PRICE_BASIC: z.string().optional(),
  PADDLE_PRICE_PRO: z.string().optional(),
  PADDLE_PRICE_ENTERPRISE: z.string().optional(),

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
