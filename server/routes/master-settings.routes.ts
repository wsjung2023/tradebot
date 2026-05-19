// master-settings.routes.ts — 마스터 API 키 관리 (관리자 전용)
import { Router, type Request, type Response } from "express";
import { masterSettings, MASTER_KEY } from "../services/master-settings.service";
import { isEncrypted } from "../utils/crypto";
import { storage } from "../storage";

const router = Router();

const EXPOSED_KEYS = [
  { key: MASTER_KEY.OPENAI_API_KEY,        label: "OpenAI API 키",       envHint: "OPENAI_API_KEY" },
  { key: MASTER_KEY.DART_API_KEY,          label: "DART API 키",         envHint: "DART_API_KEY" },
  { key: MASTER_KEY.KIWOOM_APP_KEY_REAL,   label: "키움 실계좌 APP KEY",  envHint: "KIWOOM_APP_KEY_REAL" },
  { key: MASTER_KEY.KIWOOM_APP_SECRET_REAL,label: "키움 실계좌 APP SECRET",envHint: "KIWOOM_APP_SECRET_REAL" },
  { key: MASTER_KEY.KIWOOM_APP_KEY_MOCK,   label: "키움 모의 APP KEY",   envHint: "KIWOOM_APP_KEY_MOCK" },
  { key: MASTER_KEY.KIWOOM_APP_SECRET_MOCK,label: "키움 모의 APP SECRET", envHint: "KIWOOM_APP_SECRET_MOCK" },
];

function mask(value: string | null): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return "****" + value.slice(-4);
}

// GET /api/master-settings — 마스킹된 값 목록
router.get("/", async (_req: Request, res: Response) => {
  const result = await Promise.all(
    EXPOSED_KEYS.map(async ({ key, label, envHint }) => {
      const raw = await storage.getSystemConfig(key);
      const hasValue = !!raw;
      let masked = "";
      if (hasValue) {
        const plain = await masterSettings.get(key);
        masked = mask(plain);
      }
      return { key, label, envHint, hasValue, masked };
    })
  );
  res.json(result);
});

// PUT /api/master-settings/:key — 키 값 저장
router.put("/:key", async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!EXPOSED_KEYS.find(k => k.key === key)) {
    return res.status(400).json({ error: "허용되지 않은 키입니다" });
  }
  if (!value || typeof value !== "string" || value.trim().length < 8) {
    return res.status(400).json({ error: "키 값이 너무 짧습니다" });
  }

  await masterSettings.set(key, value.trim());

  // 즉시 process.env 반영 (동적 키 교체)
  const meta = EXPOSED_KEYS.find(k => k.key === key)!;
  process.env[meta.envHint] = value.trim();

  // 실계좌 서비스 캐시 무효화 — 새 키 즉시 적용
  masterSettings.invalidate(key);

  res.json({ ok: true });
});

export { router as masterSettingsRouter };
