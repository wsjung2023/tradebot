import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Brain, TrendingUp, Filter, ShoppingCart, TrendingDown,
  GraduationCap, Settings2, Database, Cpu, Zap, AlertTriangle,
  ChevronDown, ChevronRight, BarChart3, Layers
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: any;
  color: string;
  badge?: string;
}

const sections: Section[] = [
  { id: "architecture", title: "전체 아키텍처", icon: Layers, color: "neon-cyan", badge: "개요" },
  { id: "scan", title: "스캔 배치잡 (30분 주기)", icon: Database, color: "neon-purple", badge: "CRON" },
  { id: "trading", title: "매매 배치잡 (1분 주기)", icon: Zap, color: "neon-green", badge: "CRON" },
  { id: "gpt", title: "GPT 분석 프로세스", icon: Brain, color: "neon-cyan", badge: "AI" },
  { id: "confidence", title: "신뢰도(Confidence) 산출", icon: BarChart3, color: "neon-purple", badge: "산식" },
  { id: "filter", title: "매수 필터 체계", icon: Filter, color: "neon-green", badge: "필터" },
  { id: "rainbow", title: "레인보우 라인 체계", icon: TrendingUp, color: "neon-cyan", badge: "진입" },
  { id: "buy", title: "매수 / 추가매수 로직", icon: ShoppingCart, color: "neon-purple", badge: "매수" },
  { id: "sell", title: "청산 로직", icon: TrendingDown, color: "neon-green", badge: "매도" },
  { id: "learning", title: "야간 학습 사이클 (매일 16:00)", icon: GraduationCap, color: "neon-cyan", badge: "학습" },
  { id: "settings", title: "설정 파라미터 전체 목록", icon: Settings2, color: "neon-purple", badge: "설정" },
  { id: "accounts", title: "계좌 구성 & 제어 방법", icon: Cpu, color: "neon-green", badge: "계좌" },
];

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted/40 rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-border/30">
      {children}
    </pre>
  );
}

function SectionCard({ id, title, icon: Icon, color, badge, children }: Section & { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={`border-[hsl(var(--${color}))]/25`} id={id}>
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between gap-2 pb-3 flex-wrap"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-[hsl(var(--${color}))]/15 flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 text-[hsl(var(--${color}))]`} />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
          {badge && <Badge variant="outline" className={`text-[hsl(var(--${color}))] border-[hsl(var(--${color}))]/40 text-xs`}>{badge}</Badge>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5" data-testid="text-guide-title">

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">시스템 운영 매뉴얼</h1>
        <p className="text-muted-foreground text-sm">키움 AI 자동매매 플랫폼 — 실제 작동 방식 완전 기술서</p>
      </div>

      {/* ── 1. 전체 아키텍처 ── */}
      <SectionCard {...sections[0]}>
        <p className="text-sm text-muted-foreground">세 개의 독립 cron 잡이 서버에서 상시 실행됩니다. 배치잡은 서버 시작 시 자동으로 켜지지 않으며, 자동매매 페이지에서 직접 시작해야 합니다.</p>
        <Code>{`[스캔잡]    매 30분  →  뒷차기2 조건검색 → DART 필터 → candidate_stocks DB 저장
[매매잡]    매  1분  →  후보종목 → 레인보우 → GPT분석 → confidence → 매수/청산
[학습잡]    매일 16:00 →  AI모델 성과분석 → 파라미터 자동 최적화`}</Code>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { t: "키움 에이전트", d: "PC에서 실행되는 키움 Open API 프록시. 서버와 HTTP로 통신하며 실시간 시세·주문을 처리" },
            { t: "서버 (Node.js)", d: "cron 스케줄러, GPT 호출, DART 조회, 레인보우 계산, 주문 실행 모두 서버에서 처리" },
            { t: "PostgreSQL", d: "candidate_stocks, auto_trading_positions, auto_trading_logs, ai_models 등 핵심 테이블 보관" },
          ].map(({ t, d }) => (
            <div key={t} className="p-3 bg-muted/30 rounded-md border border-border/30">
              <p className="text-sm font-semibold mb-1">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 2. 스캔 배치잡 ── */}
      <SectionCard {...sections[1]}>
        <p className="text-sm text-muted-foreground">30분마다 키움 조건검색을 실행하고, 위험 공시가 없는 종목만 후보로 DB에 저장합니다.</p>
        <Code>{`1. 활성 AI 모델 전체 조회 (status = 'active')
2. 각 모델의 키움 계좌로 조건검색 실행 (뒷차기2)
3. 결과 종목 순회:
   a. DART API 조회 → 위험 공시 키워드 포함 시 제외
   b. 통과 종목 → candidate_stocks 테이블에 upsert (source = '뒷차기2')
4. 조건검색 결과 0건이면 기존 후보 전체 삭제 (초기화)`}</Code>
        <div className="p-3 bg-muted/30 rounded-md border border-border/30">
          <p className="text-sm font-semibold mb-2">DART 위험 공시 차단 키워드 (13종)</p>
          <div className="flex flex-wrap gap-1.5">
            {['유상증자','전환사채','신주인수권부사채','횡령','배임','관리종목','상장폐지','영업정지','파산','회생절차','불성실공시','투자경고','투자위험'].map(k => (
              <Badge key={k} variant="outline" className="text-xs text-red-500 border-red-500/30">{k}</Badge>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── 3. 매매 배치잡 ── */}
      <SectionCard {...sections[2]}>
        <p className="text-sm text-muted-foreground">매 1분마다 실행되며, 평일 09:00–15:30 (한국 주식 시장 개장 시간) 에만 실제 매매 판단을 수행합니다.</p>
        <Code>{`[1분 사이클 — 활성 모델 순회]
1. 한국장 개장 여부 확인 (09:00 ~ 15:30, 평일)
2. 모델별 autoTradingEnabled 확인 → false면 건너뜀
3. ─── 청산 판단 ───
   보유 포지션 전체 조회 → 각 종목 현재가 조회
   → 익절/손절/급등청산/장기보유청산 조건 확인 → 매도 주문
4. ─── 신규 매수 판단 ───
   candidate_stocks 조회 → 미보유 종목만 필터
   → maxPositions / maxDailyTrades 초과 체크
   → comprehensiveAiAnalysis() 호출 (GPT 분석)
   → 필터 통과 여부 판단
   → 레인보우 라인 ≤ 50% 이면 매수 주문
5. ─── 추가매수 판단 ───
   기존 보유 종목 중 추가매수 조건 충족 시 주문`}</Code>
        <Warn>시장이 닫혀 있는 시간에도 잡 자체는 실행되지만 매매 로직은 건너뜁니다. 잡 실행 ≠ 매매 실행.</Warn>
      </SectionCard>

      {/* ── 4. GPT 분석 ── */}
      <SectionCard {...sections[3]}>
        <p className="text-sm text-muted-foreground">후보 종목 1개당 GPT 호출 2개가 병렬로 실행됩니다. 설정 → AI 모델에서 선택한 GPT 모델을 사용합니다.</p>
        <Code>{`병렬 실행:
  [A] aiService.analyzeStock()
      입력: 종목코드, 현재가, 거래량, 레인보우 라인 데이터
      GPT가 분석: 테마적합성, 모멘텀, 기술적 신호
      출력: themeScore (0~100)

  [B] aiService.integratedAnalysis()
      입력: 종목코드, 뉴스 헤드라인, DART 공시, PER/PBR/ROE
      GPT가 분석: 뉴스 센티멘트, 재무 건전성
      출력: newsScore (0~100), financialScore (0~100)

[C] 규칙 기반 (GPT 미사용):
  liquidityScore    거래량 기준
    ≥ 500,000주 → 80점
    ≥ 100,000주 → 65점
    ≥  50,000주 → 45점
    그 외       → 25점

  institutionalScore  동일한 acml_vol(당일 누적 거래량)을 더 높은 임계값으로 재평가
    ≥ 1,000,000주 → 75점
    ≥   500,000주 → 65점
    ≥   100,000주 → 55점
    ≥    50,000주 → 45점
    그 외          → 35점

※ liquidityScore와 institutionalScore 모두 동일한 거래량(acml_vol) 변수 사용
   institutionalScore는 별도 기관 데이터가 없고, 임계값만 더 높게 설정됨`}</Code>
      </SectionCard>

      {/* ── 5. Confidence 산출 ── */}
      <SectionCard {...sections[4]}>
        <p className="text-sm text-muted-foreground">5개 점수를 자동매매 설정의 "AI 분석 가중치" 슬라이더 값으로 가중합산합니다. 합계가 100이 아니어도 totalWeight로 나눠 자동 정규화됩니다.</p>
        <Code>{`totalWeight = themeWeight + newsWeight + financialsWeight + liquidityWeight + institutionalWeight

confidence = (
  themeScore         × themeWeight         [기본: 20]
+ newsScore          × newsWeight          [기본: 15]
+ financialScore     × financialsWeight    [기본: 25]
+ liquidityScore     × liquidityWeight     [기본: 20]
+ institutionalScore × institutionalWeight [기본: 20]
) / totalWeight

결과 범위: 0 ~ 100 (clamp)

※ 슬라이더 합계가 100이 아니어도 totalWeight로 나누므로 정규화됨
   예) 가중치 합이 80이면 denominator=80으로 나눔`}</Code>
        <div className="space-y-1">
          <Row label="hasGoodFinancials 판정" value="financialScore ≥ 60 이면 true" />
          <Row label="hasHighLiquidity 판정" value="liquidityScore ≥ 40 이면 true" />
        </div>
      </SectionCard>

      {/* ── 6. 매수 필터 ── */}
      <SectionCard {...sections[5]}>
        <p className="text-sm text-muted-foreground">GPT 분석 완료 후 아래 필터를 순서대로 통과해야 매수 진행. 하나라도 실패하면 해당 종목 스킵.</p>
        <div className="space-y-2">
          {[
            { k: "minAiConfidence", v: "confidence < 설정값(%) 이면 스킵 (예: 60이면 60점 미만 종목 제외)" },
            { k: "requireGoodFinancials", v: "ON이면 financialScore < 60인 종목 매수 차단" },
            { k: "requireHighLiquidity", v: "ON이면 liquidityScore < 40인 종목 매수 차단" },
            { k: "DART 위험공시", v: "dartDangerKeyword 있으면 무조건 매수 차단 (스캔 단계 + 매수 단계 이중 확인)" },
            { k: "maxPositions", v: "현재 보유 종목 수 ≥ 설정값이면 신규 매수 건너뜀" },
            { k: "maxDailyTrades", v: "오늘 자동매매 건수 ≥ 설정값이면 추가 매수 건너뜀" },
            { k: "레인보우 라인 > 50%", v: "현재 가격이 50% 라인보다 위에 있으면 매수하지 않음" },
          ].map(({ k, v }) => (
            <div key={k} className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-md border border-border/30">
              <Badge variant="outline" className="text-xs shrink-0 font-mono">{k}</Badge>
              <p className="text-xs text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 7. 레인보우 라인 ── */}
      <SectionCard {...sections[6]}>
        <p className="text-sm text-muted-foreground">레인보우 라인은 240일 구간의 고점-저점 범위 내에서 현재가가 어느 위치인지를 10% 단위로 나타냅니다. 낮을수록 저점권.</p>
        <Code>{`[레인보우 라인 계산]
range        = 구간최고가 - 구간최저가  (RainbowChartAnalyzer 240일 기준)
currentPct   = (현재가 - 구간최저가) / range × 100
currentLine  = round(currentPct / 10) × 10   (클램프: 최소 10, 최대 100)

→ 결과: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100

자동매매 설정 > "레인보우 라인 설정"에서 라인별 유닛 수 지정:
  예) 10% 라인 → 3유닛, 20% 라인 → 2유닛, 30% 라인 → 1유닛

매수 조건: currentLine ≤ 50 이고 해당 라인 유닛 수 > 0`}</Code>
        <div className="grid grid-cols-5 gap-1.5">
          {[10,20,30,40,50,60,70,80,90,100].map(l => (
            <div key={l} className={`p-2 rounded-md text-center text-xs border ${l <= 50 ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-border/30 bg-muted/30 text-muted-foreground'}`}>
              {l}%<br/><span className="text-[10px]">{l <= 50 ? '매수권' : '관망'}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 8. 매수 / 추가매수 ── */}
      <SectionCard {...sections[7]}>
        <Code>{`[신규 매수]
주문 수량 = floor( unitSize × unitCount(currentLine) ÷ 현재가 )

  unitSize  : 1유닛당 금액 (원), 자동매매 설정에서 지정
  unitCount : lineUnits[currentLine] ?? 1  (미설정 라인은 1유닛)
  예) unitSize=500,000 / unitCount=2 / 주가=25,000
      → floor(500,000 × 2 ÷ 25,000) = 40주

[추가매수]
  조건1: entryLine > 10  (10% 라인에서 진입했으면 추가매수 불가)
  조건2: currentLine ≤ entryLine - 10  (한 단계 더 내려가야 함)
  조건3: currentLine ≥ 10  (최하위 라인 이상이어야 함)
  예) 30%에 진입 → currentLine ≤ 20 이고 ≥ 10 이면 추가매수
  수량: 동일 유닛 공식 적용 (해당 currentLine의 unitCount 기준)`}</Code>
        <Warn>같은 종목에 이미 보유 중이면 추가매수 조건이 충족될 때만 추가 주문합니다. 동일 라인에 중복 추가매수는 발생하지 않습니다.</Warn>
      </SectionCard>

      {/* ── 9. 청산 로직 ── */}
      <SectionCard {...sections[8]}>
        <Code>{`[청산 우선순위 — 1분 사이클마다 보유 종목 전체 점검]

1. 익절 (takeProfitPercent)
   수익률 ≥ takeProfitPercent% → 전량 시장가 매도

2. 손절 (stopLoss)
   수익률 < 0 이고 |수익률| ≥ stopLoss.percent% → 전량 시장가 매도
   (stopLoss.color 설정으로 특정 레인보우 색 이하 시 손절 가능)

3. 급등 청산 (surgeThreshold)
   수익률 ≥ surgeThreshold% → 익절 유사 청산
   (takeProfitPercent와 별도로 빠른 급등 시 조기 매도)

4. 장기보유 청산 (stalePeriodDays)
   보유 일수 ≥ stalePeriodDays 이고 손실 중 → 청산`}</Code>
      </SectionCard>

      {/* ── 10. 학습 ── */}
      <SectionCard {...sections[9]}>
        <p className="text-sm text-muted-foreground">매일 오후 4시에 자동 실행됩니다. 별도로 조작할 필요 없음.</p>
        <Code>{`[학습 사이클]
1. 활성 AI 모델 전체 조회
2. 각 모델별 거래 성과 분석:
   - totalTrades, winRate(%), totalReturn(%)
3. 결과에 따라 파라미터 자동 조정:
   - winRate 낮으면 minAiConfidence 상향
   - return 높으면 현재 설정 유지 권장
4. 자동 적용 여부: appliedChanges = true/false
5. 권장사항(recommendations) 콘솔 출력`}</Code>
      </SectionCard>

      {/* ── 11. 설정 파라미터 ── */}
      <SectionCard {...sections[10]}>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">자동매매 기본 설정</p>
            <div className="space-y-0.5">
              <Row label="unitSize" value="1유닛당 투자금액 (원)" />
              <Row label="lineUnits[N]" value="레인보우 N% 라인에서 매수할 유닛 수" />
              <Row label="maxPositions" value="최대 동시 보유 종목 수" />
              <Row label="maxDailyTrades" value="일일 최대 자동매매 건수" />
              <Row label="takeProfitPercent" value="익절 기준 수익률 (%)" />
              <Row label="stopLoss.percent" value="손절 기준 손실률 (%)" />
              <Row label="surgeThreshold" value="급등 청산 기준 수익률 (%)" />
              <Row label="stalePeriodDays" value="장기보유 청산 기준 일수" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">AI 분석 가중치 (합계 = 100%)</p>
            <div className="space-y-0.5">
              <Row label="themeWeight" value="GPT 테마/모멘텀 점수 비중 (기본 20%)" />
              <Row label="newsWeight" value="GPT 뉴스 센티멘트 점수 비중 (기본 15%)" />
              <Row label="financialsWeight" value="GPT 재무 점수 비중 (기본 25%)" />
              <Row label="liquidityWeight" value="거래량 유동성 점수 비중 (기본 20%)" />
              <Row label="institutionalWeight" value="기관 거래량 점수 비중 (기본 20%)" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">AI 최소 신뢰도 필터</p>
            <div className="space-y-0.5">
              <Row label="minAiConfidence" value="이 값 미만 confidence면 매수 스킵 (0=비활성)" />
              <Row label="requireGoodFinancials" value="ON: financialScore < 60 종목 제외" />
              <Row label="requireHighLiquidity" value="ON: liquidityScore < 40 종목 제외" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">전역 AI 설정 (설정 메뉴)</p>
            <div className="space-y-0.5">
              <Row label="GPT 모델" value="GPT 분석에 사용할 OpenAI 모델 선택" />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 12. 계좌 ── */}
      <SectionCard {...sections[11]}>
        <div className="space-y-2">
          <p className="text-sm font-semibold">등록 계좌</p>
          <div className="space-y-0.5">
            <Row label="실계좌 1 (id=17)" value="59190647" mono />
            <Row label="실계좌 2 (id=18)" value="51342627" mono />
            <Row label="실계좌 3 (id=19)" value="39083177" mono />
            <Row label="모의계좌 (id=20)" value="81208166" mono />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">배치잡 제어 방법</p>
          <Code>{`자동매매 메뉴 > Job 제어 패널
  [스캔잡 시작]    → 30분 주기 조건검색 시작
  [매매잡 시작]    → 1분 주기 매매 사이클 시작
  [학습잡 시작]    → 매일 16:00 학습 시작
  [즉시 실행]      → 지금 당장 1회 실행

※ 서버 재시작 시 잡은 자동으로 켜지지 않음 — 수동 시작 필요`}</Code>
        </div>
        <Warn>키움 에이전트(PC 프로그램)가 실행 중이어야 실제 시세 조회·주문이 작동합니다. 에이전트 없이 잡을 시작하면 AgentTimeoutError가 연속 3회 이후 해당 모델 자동 비활성화됩니다.</Warn>
      </SectionCard>

    </div>
  );
}
