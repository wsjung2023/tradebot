// master-settings.service.ts — 전역 API 키 관리 (system_config 테이블, AES-256 암호화)
// 최초 부팅 시 .env 값을 DB로 자동 이관. 이후 DB 우선 읽기.
import { storage } from "../storage";
import { encrypt, decrypt, isEncrypted } from "../utils/crypto";

// system_config key 상수
export const MASTER_KEY = {
  OPENAI_API_KEY: "master.openai_api_key",
  DART_API_KEY: "master.dart_api_key",
  KIWOOM_APP_KEY_REAL: "master.kiwoom_app_key_real",
  KIWOOM_APP_SECRET_REAL: "master.kiwoom_app_secret_real",
  KIWOOM_APP_KEY_MOCK: "master.kiwoom_app_key_mock",
  KIWOOM_APP_SECRET_MOCK: "master.kiwoom_app_secret_mock",
} as const;

type MasterKeyName = keyof typeof MASTER_KEY;

// .env 폴백 맵
const ENV_FALLBACK: Record<string, string> = {
  [MASTER_KEY.OPENAI_API_KEY]: "OPENAI_API_KEY",
  [MASTER_KEY.DART_API_KEY]: "DART_API_KEY",
  [MASTER_KEY.KIWOOM_APP_KEY_REAL]: "KIWOOM_APP_KEY_REAL",
  [MASTER_KEY.KIWOOM_APP_SECRET_REAL]: "KIWOOM_APP_SECRET_REAL",
  [MASTER_KEY.KIWOOM_APP_KEY_MOCK]: "KIWOOM_APP_KEY_MOCK",
  [MASTER_KEY.KIWOOM_APP_SECRET_MOCK]: "KIWOOM_APP_SECRET_MOCK",
};

class MasterSettingsService {
  private cache = new Map<string, string>(); // 복호화된 값 메모리 캐싱
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.migrateFromEnv();
    await this.syncToProcessEnv();
    this.initialized = true;
  }

  // 최초 부팅: .env에 있는 키가 DB에 없으면 암호화해서 저장
  private async migrateFromEnv(): Promise<void> {
    for (const [dbKey, envKey] of Object.entries(ENV_FALLBACK)) {
      const envVal = process.env[envKey];
      if (!envVal) continue;
      const existing = await storage.getSystemConfig(dbKey);
      if (!existing) {
        await storage.setSystemConfig(dbKey, encrypt(envVal));
        console.log(`[MasterSettings] .env ${envKey} → DB 이관 완료`);
      }
    }
  }

  // DB 값으로 process.env 갱신 — 기존 서비스들이 변경 없이 DB 값 사용
  private async syncToProcessEnv(): Promise<void> {
    for (const [dbKey, envKey] of Object.entries(ENV_FALLBACK)) {
      const val = await this.get(dbKey);
      if (val) process.env[envKey] = val;
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;

    const raw = await storage.getSystemConfig(key);
    if (raw) {
      const plain = isEncrypted(raw) ? decrypt(raw) : raw;
      this.cache.set(key, plain);
      return plain;
    }

    // DB 없으면 .env 폴백
    const envKey = ENV_FALLBACK[key];
    const envVal = envKey ? (process.env[envKey] ?? null) : null;
    if (envVal) this.cache.set(key, envVal);
    return envVal;
  }

  async set(key: string, plainValue: string): Promise<void> {
    await storage.setSystemConfig(key, encrypt(plainValue));
    this.cache.set(key, plainValue);
  }

  // 캐시 무효화 (UI에서 키 변경 후 즉시 반영)
  invalidate(key?: string): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  // 편의 메서드
  async getOpenAiKey(): Promise<string | null> { return this.get(MASTER_KEY.OPENAI_API_KEY); }
  async getDartKey(): Promise<string | null> { return this.get(MASTER_KEY.DART_API_KEY); }
  async getKiwoomRealKey(): Promise<{ appKey: string; appSecret: string } | null> {
    const [k, s] = await Promise.all([
      this.get(MASTER_KEY.KIWOOM_APP_KEY_REAL),
      this.get(MASTER_KEY.KIWOOM_APP_SECRET_REAL),
    ]);
    if (!k || !s) return null;
    return { appKey: k, appSecret: s };
  }
  async getKiwoomMockKey(): Promise<{ appKey: string; appSecret: string } | null> {
    const [k, s] = await Promise.all([
      this.get(MASTER_KEY.KIWOOM_APP_KEY_MOCK),
      this.get(MASTER_KEY.KIWOOM_APP_SECRET_MOCK),
    ]);
    if (!k || !s) return null;
    return { appKey: k, appSecret: s };
  }
}

export const masterSettings = new MasterSettingsService();
