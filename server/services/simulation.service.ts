// simulation.service.ts — 전방 섀도우(forward shadow) 시뮬레이션 오케스트레이션 (Track 1)
//
// 원본 모델의 전략·설정을 충실히 복제한 "시뮬 모델 + 시뮬 계좌"를 만들고,
// ShadowKiwoomService(실주문 미호출)로 기존 executor 파이프라인을 그대로 돌린다.
// 결과 거래는 simulated=true로 기록되어 실거래 학습과 분리된다.
import { storage } from '../storage';
import { ShadowKiwoomService } from './shadow-kiwoom.service';
import { getAIService } from './ai.service';
import { TradeExecutorService } from './trade-executor.service';
import { isEncrypted, decrypt } from '../utils/crypto';
import type { AiModel, KiwoomAccount } from '@shared/schema';

const SIM_ACCOUNT_PREFIX = 'SIM-';

export class SimulationService {
  private executor = new TradeExecutorService();
  private get aiService() { return getAIService(); }

  private decryptKey(val?: string | null): string | null {
    if (!val) return null;
    return isEncrypted(val) ? decrypt(val) : val;
  }

  // 시뮬 계좌 확보 — source 계좌의 accountType/키를 복제(읽기 전용), 계좌번호는 SIM-<id>
  async ensureSimAccount(userId: string, sourceAccount: KiwoomAccount): Promise<KiwoomAccount> {
    const simAccountNumber = `${SIM_ACCOUNT_PREFIX}${sourceAccount.id}`;
    const accounts = await storage.getKiwoomAccounts(userId);
    const existing = accounts.find((a) => a.accountNumber === simAccountNumber);
    if (existing) return existing;
    return storage.createKiwoomAccount({
      userId,
      accountNumber: simAccountNumber,
      accountType: sourceAccount.accountType === 'real' ? 'real' : 'mock', // 읽기 base URL/키 정합
      accountName: `[SIM] ${sourceAccount.accountName ?? sourceAccount.accountNumber}`,
      kiwoomAppKey: sourceAccount.kiwoomAppKey, // 암호문 그대로 복제 (읽기용)
      kiwoomAppSecret: sourceAccount.kiwoomAppSecret,
    });
  }

  // 시뮬 모델 확보 — source 모델당 1개 재사용, 원본 설정 복제
  async ensureSimModel(sourceModel: AiModel, simAccountId: number): Promise<AiModel> {
    const models = await storage.getAiModels(sourceModel.userId);
    const existing = models.find(
      (m) => (m.config as any)?.isSimulation === true && (m.config as any)?.sourceModelId === sourceModel.id,
    );
    if (existing) return existing;

    const sourceConfig = (sourceModel.config as any) || {};
    const simModel = await storage.createAiModel({
      userId: sourceModel.userId,
      modelName: `[SIM] ${sourceModel.modelName}`,
      modelType: sourceModel.modelType as 'momentum' | 'value' | 'technical' | 'custom',
      description: `전방 섀도우 시뮬레이션 (원본 모델 #${sourceModel.id})`,
      config: {
        ...sourceConfig,
        accountId: simAccountId,
        isSimulation: true,
        sourceModelId: sourceModel.id,
        simSource: 'forward_shadow',
      },
      isActive: false,
    });

    // 원본 settings 복제 (튜닝된 파라미터 충실 재현) — 없으면 기본값 생성
    const srcSettings = await storage.getAutoTradingSettings(sourceModel.id);
    if (srcSettings) {
      const { id, modelId, createdAt, updatedAt, ...rest } = srcSettings as any;
      await storage.createAutoTradingSettings({ ...rest, modelId: simModel.id });
    } else {
      await this.executor.createDefaultSettings(simModel.id, sourceModel.modelType);
    }
    return simModel;
  }

  // 한 사이클 실행 — 원본 모델의 신선 후보를 시뮬 모델/계좌로 평가 (섀도우 서비스)
  async runSimCycle(
    sourceModelId: number,
  ): Promise<{ ok: boolean; simModelId?: number; evaluated?: number; reason?: string }> {
    const sourceModel = await storage.getAiModel(sourceModelId);
    if (!sourceModel) return { ok: false, reason: 'source model not found' };
    const sourceConfig = (sourceModel.config as any) || {};
    if (sourceConfig.isSimulation) return { ok: false, reason: 'source is already a sim model' };

    const sourceAccountId = sourceConfig.accountId;
    if (!sourceAccountId) return { ok: false, reason: 'source model has no accountId' };
    const accounts = await storage.getKiwoomAccounts(sourceModel.userId);
    const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
    if (!sourceAccount) return { ok: false, reason: 'source account not found' };

    const appKey = this.decryptKey(sourceAccount.kiwoomAppKey);
    const appSecret = this.decryptKey(sourceAccount.kiwoomAppSecret);
    if (!appKey || !appSecret) return { ok: false, reason: 'source account missing kiwoom keys' };

    const simAccount = await this.ensureSimAccount(sourceModel.userId, sourceAccount);
    const simModel = await this.ensureSimModel(sourceModel, simAccount.id);
    const simSettings = await storage.getAutoTradingSettings(simModel.id);
    if (!simSettings) return { ok: false, reason: 'sim settings missing' };

    // 이번 사이클 run id를 sim 모델 config에 기록 → executor가 perf row에 simRunId 기록
    const simRunId = `run-${Date.now()}`;
    const simModelConfig = (simModel.config as any) || {};
    const mergedConfig = { ...simModelConfig, simRunId };
    await storage.updateAiModel(simModel.id, { config: mergedConfig });
    const simModelForRun = { ...simModel, config: mergedConfig } as AiModel;

    const shadow = new ShadowKiwoomService(
      { appKey, appSecret, accountType: simAccount.accountType === 'real' ? 'real' : 'mock' },
      { simAccountId: simAccount.id },
    );

    const aiModelName = 'gpt-5-mini'; // 분석 모델 (provider는 Track 0 LLM_PROVIDER로 결정)

    // 1) 보유 추가매수 / 2) 청산 관리 (시뮬 계좌 holdings 기준)
    try {
      await this.executor.checkHoldingsForScaleIn(simModelForRun, simSettings, shadow, this.aiService, aiModelName);
    } catch (e) {
      console.warn('[Sim] scaleIn 오류(무시):', e);
    }
    try {
      await this.executor.checkPositionsForExits(simModelForRun, simSettings, shadow, this.aiService, aiModelName);
    } catch (e) {
      console.warn('[Sim] exits 오류(무시):', e);
    }

    // 3) 원본 모델의 신선 후보(1시간 이내 스캔)를 시뮬 평가
    const rawCandidates = await storage.getCandidateStocks(sourceModel.userId, sourceModel.id);
    const freshMs = 60 * 60 * 1000;
    const now = Date.now();
    const candidates = rawCandidates.filter((c: any) => {
      const t = c.scannedAt ? new Date(c.scannedAt).getTime() : 0;
      return Number.isFinite(t) && now - t <= freshMs;
    });
    let evaluated = 0;
    for (const candidate of candidates) {
      try {
        await this.executor.evaluateCandidateStock(simModelForRun, simSettings, candidate, shadow, this.aiService, aiModelName);
        evaluated++;
      } catch (e) {
        console.warn('[Sim] evaluate 오류(무시):', e);
      }
    }
    return { ok: true, simModelId: simModel.id, evaluated };
  }
}

let simulationServiceInstance: SimulationService | null = null;
export function getSimulationService(): SimulationService {
  if (!simulationServiceInstance) simulationServiceInstance = new SimulationService();
  return simulationServiceInstance;
}
