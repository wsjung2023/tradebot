import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Newspaper,
  Search,
  ServerCog,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: any;
  color: string;
  badge?: string;
}

const sections: Section[] = [
  { id: "preflight", title: "시작 전 확인", icon: CheckCircle2, color: "neon-green", badge: "필수" },
  { id: "rainbow", title: "레인보우 차트 로직", icon: Workflow, color: "neon-cyan", badge: "뒷차기2" },
  { id: "ai-logic", title: "AI 판단 및 수식", icon: Bot, color: "neon-purple", badge: "핵심" },
  { id: "settings", title: "모델 상세 설정", icon: SlidersHorizontal, color: "neon-green", badge: "운용" },
  { id: "exit-strategy", title: "매도 전략 우선순위", icon: Activity, color: "neon-red", badge: "매도" },
  { id: "dart", title: "DART 재무 필터", icon: ShieldAlert, color: "neon-cyan", badge: "리스크" },
  { id: "jobs", title: "배치잡 및 모니터링", icon: ServerCog, color: "neon-purple", badge: "운영" },
  { id: "safety", title: "안전장치 및 429 에러", icon: AlertTriangle, color: "neon-green", badge: "중요" },
];

function SectionCard({ id, title, icon: Icon, color, badge, children }: Section & { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={`border-[hsl(var(--${color}))]/25 shadow-lg shadow-[hsl(var(--${color}))]/5`} id={id}>
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between gap-2 pb-3 flex-wrap bg-[hsl(var(--${color}))]/5"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-[hsl(var(--${color}))]/15 flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 text-[hsl(var(--${color}))]`} />
          </div>
          <CardTitle className="text-base font-bold">{title}</CardTitle>
          {badge && (
            <Badge variant="outline" className={`text-[hsl(var(--${color}))] border-[hsl(var(--${color}))]/40 text-[10px] uppercase tracking-wider`}>
              {badge}
            </Badge>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-4">{children}</CardContent>}
    </Card>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-slate-950 text-slate-300 rounded-md p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-white/10 leading-relaxed">
      {children}
    </pre>
  );
}

function Row({ label, value, desc }: { label: string; value: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex justify-between items-start gap-4">
        <span className="text-sm font-semibold text-foreground shrink-0">{label}</span>
        <span className="text-sm text-right text-glow-cyan font-mono">{value}</span>
      </div>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Warn({ children, title = "주의사항" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold text-yellow-500 mb-1">{title}</p>
        <p className="text-sm text-yellow-200/80 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8" data-testid="text-guide-title">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-[hsl(var(--neon-cyan))] to-[hsl(var(--neon-purple))] bg-clip-text text-transparent">
          TradeBot 운영 마스터 가이드
        </h1>
        <p className="text-muted-foreground text-base max-w-2xl mx-auto">
          "뒷차기2" 엔진의 핵심 로직과 AI 판단 메커니즘을 상세히 설명합니다. 
          데이터에 기반한 최적의 운영 설정을 확인하세요.
        </p>
      </div>

      <SectionCard {...sections[0]}>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { t: "계좌 등록", d: "계좌번호 8자리 입력 시 상품구분(위탁 11 / 위탁종합 10)을 함께 선택" },
            { t: "에이전트 실행", d: "Windows 작업 스케줄러의 'TradeBot-Agent'가 실행 중인지 확인 (작업 관리자에서 python 프로세스 확인)" },
            { t: "거래 모드", d: "모의투자/실전투자 스위치가 실제 계좌 타입과 일치하는지 확인" },
            { t: "모델 활성화", d: "자동매매 페이지에서 AI 모델을 생성하고 '작동중' 스위치 ON" },
          ].map(item => (
            <div key={item.t} className="p-4 bg-muted/20 rounded-xl border border-border/50 hover:border-[hsl(var(--neon-green))]/30 transition-colors">
              <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--neon-green))]" />
                {item.t}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="account-lifecycle"
        title="계좌·모델 이력 관리"
        icon={Settings2}
        color="neon-cyan"
        badge="계좌전환"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            TradeBot에서는 <strong>계좌는 주문 실행 단위</strong>, <strong>모델은 분석·학습 단위</strong>입니다.
            모의계좌가 만료되어 새 계좌로 바뀌어도 같은 모델의 매매 성과는 이어서 분석해야 합니다.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/20 rounded-xl border border-border/50">
              <h4 className="text-sm font-bold mb-2 text-[hsl(var(--neon-cyan))]">계좌번호와 상품구분</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>8자리 계좌번호만 입력하면 화면에서 선택한 상품구분 코드가 뒤에 붙어 저장됩니다.</li>
                <li><strong>11</strong> = 위탁 / 국내주식 계좌, <strong>10</strong> = 위탁종합 계좌입니다.</li>
                <li>상품구분 10/11은 실전·모의 구분이 아닙니다. 실전·모의는 계좌 유형과 API 키로 구분합니다.</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/20 rounded-xl border border-border/50">
              <h4 className="text-sm font-bold mb-2 text-[hsl(var(--neon-green))]">모의계좌 만료 시 처리</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>만료 계좌는 삭제하지 말고 <strong>보관</strong> 처리합니다.</li>
                <li>새 모의계좌를 등록하고 API Key/Secret을 저장합니다.</li>
                <li>자동매매 모델의 <strong>현재 연결 계좌</strong>를 새 계좌로 변경합니다.</li>
                <li>과거 주문·매매저널은 보관 계좌에 남고, 이후 거래는 새 계좌에 쌓입니다.</li>
              </ul>
            </div>
          </div>
          <Code>{`조회/분석 기준

화면 조회:
- 거래내역 / 매매저널 / 포트폴리오에서 전체·활성·보관·계좌유형·계좌별 필터 사용
- 만료 계좌의 과거 데이터가 안 보이면 "전체" 또는 "보관" 필터 확인

성과 분석:
- 계좌별이 아니라 모델별 전체 이력을 기준으로 분석
- 예: 만료 모의계좌(id 20) + 새 모의계좌(id 24) 거래를 같은 모델(id 7)의 성과로 합산
- 실전과 모의가 섞이는 경우에는 별도 비교 분석을 병행`}</Code>
          <Warn title="삭제 금지">
            계좌 삭제는 외래키로 연결된 주문, 보유종목, 매매저널, 분석 이력을 함께 흔들 수 있습니다.
            운영에서는 삭제 대신 보관 처리하고 필터로 조회 범위를 조정하세요.
          </Warn>
        </div>
      </SectionCard>

      <SectionCard {...sections[1]}>
        <p className="text-sm leading-relaxed">
          <strong>레인보우 차트(BackAttack Line)</strong>는 최근 240일간의 가격 변동폭을 11개 라인으로 시각화하여 현재가의 위치를 에너지가 응축된 구간으로 해석합니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[hsl(var(--neon-cyan))] underline decoration-2 underline-offset-4">구간별 진입 전략</h4>
            <div className="space-y-2">
              <div className="p-2.5 rounded border border-blue-500/20 bg-blue-500/5">
                <p className="text-xs font-bold text-blue-400">0% ~ 30% : Deep Value (파랑)</p>
                <p className="text-[11px] text-muted-foreground">과매도 구간. 바닥 확인 시 강력 매수 및 추가 매수(Scale-in) 타점.</p>
              </div>
              <div className="p-2.5 rounded border border-green-500/20 bg-green-500/5">
                <p className="text-xs font-bold text-green-400">40% ~ 55% : Primary Buy (초록 CL)</p>
                <p className="text-[11px] text-muted-foreground">핵심 진입 타점. 50%(Center Line)를 돌파하며 에너지가 분출되는 시점.</p>
              </div>
              <div className="p-2.5 rounded border border-yellow-500/20 bg-yellow-500/5">
                <p className="text-xs font-bold text-yellow-400">60% ~ 80% : Profit Taking (노랑)</p>
                <p className="text-[11px] text-muted-foreground">수익 실현 구간. 신규 진입은 지극히 제한하며 분할 매도 권장.</p>
              </div>
              <div className="p-2.5 rounded border border-red-500/20 bg-red-500/5">
                <p className="text-xs font-bold text-red-400">80% 이상 : Overbought (빨강)</p>
                <p className="text-[11px] text-muted-foreground">단기 고점. 신규 매수 절대 금지.</p>
              </div>
            </div>
          </div>
          <Code>{`// 레인보우 차트 핵심 계산 수식
Position(%) = ((현재가 - 240일 저점) / (240일 고점 - 240일 저점)) * 100

- CL (Center Line): 50% 지점 (중심값)
- CL폭(Width): 최고점 대비 20% 라인과의 이격도. 
  폭이 좁을수록 에너지가 더 강력하게 응축된 상태로 판단.`}</Code>
        </div>
      </SectionCard>

      <SectionCard {...sections[2]}>
        <p className="text-sm mb-4 leading-relaxed">
          AI는 단순 지표뿐 아니라 뉴스, 재무, 테마를 종합하여 <strong>신뢰도(Confidence)</strong>를 산출합니다.
        </p>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-glow-purple mb-2">종합 신뢰도 공식 (Confidence Score)</h4>
            <Code>{`Confidence = (Theme*w1 + News*w2 + Financials*w3 + Technicals*w4) / TotalWeights

- Theme (테마성): 현재 주도 섹터(AI, 반도체 등) 부합도
- News (뉴스): 최근 공시/뉴스 감성 분석 (악재 발생 시 급격한 감점)
- Financials (재무): DART 연동 퀀트 점수
- Technicals (기술적): 레인보우 차트 위치 및 거래량 추세`}</Code>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-md border border-border/50">
              <p className="text-xs font-bold mb-1 text-[hsl(var(--neon-green))]">진입 승인 조건</p>
              <ul className="text-[11px] space-y-1 text-muted-foreground list-disc pl-4">
                <li>레인보우 CL 위치가 40% ~ 55% 사이일 것</li>
                <li>AI 종합 신뢰도가 설정된 '최소 신뢰도' 이상일 것</li>
                <li>DART 위험 공시(횡령, 배임 등)가 없을 것</li>
              </ul>
            </div>
            <div className="p-3 bg-muted/40 rounded-md border border-border/50">
              <p className="text-xs font-bold mb-1 text-[hsl(var(--neon-red))]">진입 거부(Skip) 사유</p>
              <ul className="text-[11px] space-y-1 text-muted-foreground list-disc pl-4">
                <li>현재가가 240일 고점 근처(70% 초과)인 경우</li>
                <li>최근 120분 이내 동일 종목 평가 이력이 있는 경우 (쿨다운)</li>
                <li>재무 상태가 극도로 불량한 경우 (DART 필터)</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard {...sections[3]}>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Row 
              label="Max Positions" 
              value="1 ~ 20개" 
              desc="전체 계좌에서 동시에 보유할 최대 종목 수입니다." 
            />
            <Row 
              label="Entry Ladder" 
              value="5단계 유닛" 
              desc="첫 진입 후 하락 시 추가 매수할 비중을 결정합니다. (예: 1-1-1-1-1)" 
            />
            <Row 
              label="재평가 쿨다운" 
              value="30분 ~ 하루 1회" 
              desc="AI가 같은 종목을 너무 자주 평가하여 비용이 발생하는 것을 방지합니다." 
            />
          </div>
          <div className="space-y-4">
            <Warn title="운용 팁">
              처음에는 '최소 신뢰도'를 70점 정도로 높게 설정하여 우량한 신호에만 진입하도록 하세요. 
              시장이 좋지 않을 때는 '최대 보유 종목' 수를 줄이는 것이 리스크 관리에 유리합니다.
            </Warn>
            <div className="p-4 bg-[hsl(var(--neon-purple))]/10 border border-[hsl(var(--neon-purple))]/20 rounded-md">
              <p className="text-xs font-bold text-[hsl(var(--neon-purple))] mb-1">AI 재량 스위치</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                '추가매수 허용'을 켜면 AI가 판단하여 특정 지지선에서 비중을 더 실을 수 있습니다. 
                '목표초과보유'는 익절가 도달 시에도 추세가 강하면 더 보유하게 합니다.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard {...sections[5]}>
        <p className="text-sm leading-relaxed mb-4">
          DART API를 통해 실시간으로 재무 지표를 가져와 분석합니다. 데이터가 부족한 신규 상장주나 관리 종목은 보수적으로 점수를 깎습니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { l: "저평가 기준", v: "PBR < 1.0", d: "장부 가치보다 주가가 낮을 때 보너스 점수" },
            { l: "수익성 기준", v: "ROE > 15%", d: "자기자본 대비 이익이 높은 우량 기업 선호" },
            { l: "성장/밸류", v: "PER < 20", d: "이익 대비 주가가 합리적인 수준인지 판단" },
          ].map(item => (
            <div key={item.l} className="p-3 bg-muted/20 rounded border border-border/50 text-center">
              <p className="text-xs font-bold text-foreground">{item.l}</p>
              <p className="text-sm font-mono text-[hsl(var(--neon-cyan))] my-1">{item.v}</p>
              <p className="text-[10px] text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>
        <Warn title="DART 차단 로직">
          뉴스나 공시 내용 중 '횡령', '배임', '감사의견 거절', '부도' 등의 키워드가 발견되면 AI 신뢰도와 상관없이 <strong>즉시 진입이 차단</strong>됩니다.
        </Warn>
      </SectionCard>

      <SectionCard {...sections[4]}>
        <p className="text-sm leading-relaxed mb-3">
          매 <strong>1분 사이클</strong>마다 보유 종목에 대해 아래 순서로 매도 조건을 평가합니다.
          상위 조건이 발동되면 이하 조건은 해당 사이클에서 건너뜁니다.
        </p>
        <Code>{`매도 평가 순서 (높은 우선순위 → 낮은 우선순위)

① ExitStage 분할매도 계획 (최우선)
   - 포트폴리오 > 종목 > 🎯 버튼으로 설정하거나, 매도계획 배치잡이 매일 08:50 KST에 자동 생성
   - 트리거 종류: profit_rate(수익률%), rainbow_line(CL선%), loss_rate(손절%)
   - 발동 시 설정된 sellRatio(잔여수량 비율) 만큼 분할 매도
   - 해당 단계는 fulfilled=true 처리 → 같은 단계 재발동 없음

② 종목별 단순 익절% (수기 오버라이드)
   - 포트폴리오 > 종목 > 🎯 > 수기 설정 탭의 '익절 기준(%)'
   - 모델 기본값보다 이 값이 우선 적용됨
   - 미설정 시 ③ 모델 값으로 자동 폴백

③ 모델 익절% (모델 기본값)
   - 자동매매 설정 > 기본 전략 설정의 '익절 기준(%)'
   - 종목별 설정이 없을 때 사용되는 공통 기준

④ 물타기 익절 (자동 계산)
   - 추가매수(scale-in) 2유닛 이상 보유 시 활성화
   - 기본값: 2유닛→8%, 3유닛→6%, 4유닛→4%, 5유닛→3% (유닛 많을수록 목표 낮아짐)
   - 설정에서 'scaleInTakeProfitPct' 값으로 고정 가능

⑤ CL선 분할매도 (rainbowLineSettings.sellWeight)
   - 자동매매 설정 > 레인보우 라인 설정의 각 라인 'sell%' 슬라이더
   - CL이 60%(노랑) 이상 도달 시 해당 라인의 sellWeight 비율만큼 분할 매도
   - 예: CL 70%(주황) sellWeight=50% → 보유수량의 50% 매도
   - 이미 매도 주문이 진행 중이면 중복 방지 로직으로 재발동 차단

⑥ 손절 (stop loss)
   - 모델 설정의 손절 정책(hard / conditional / disabled)에 따라 작동
   - hard: 손실 >= hardCutLossPct 즉시 전량 청산
   - conditional: 특정 CL 색상(초록/파랑) 이하일 때만 손절 발동

⑦ 동적 청산
   - 급등 청산: 수익률이 surgeThreshold% 이상 → 전량
   - 장기 보유 청산: stalePeriodDays 초과 + 손실 중 → 전량
   - 거래량 급증 청산: 당일 거래량 > 30일 평균 × volumeSpikeMultiplier → 전량

⑧ AI 거부권 (soft_ai_first 모드만)
   - ①~⑦ 중 하나가 발동된 후, AI에게 최종 판단을 의뢰
   - AI가 'hold' 판단 시 매도 취소 / 'partial_exit' 시 50% 분할 / 'full_exit' 시 전량`}</Code>
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-xs text-yellow-300 space-y-1">
          <p className="font-bold">⚠️ 주의사항</p>
          <p>① ExitStage 배치잡을 끄더라도 DB에 이미 저장된 계획은 계속 실행됩니다. 계획 자체를 삭제해야 멈춥니다.</p>
          <p>⑤ CL 분할매도는 수익 중일 때만 발동합니다 (손실 중 CL 상승은 발동 안 함).</p>
          <p>⑧ AI 거부권은 soft_ai_first 모드일 때만 작동합니다. 모드가 disabled/hard/conditional이면 AI 판단 없이 바로 실행됩니다.</p>
        </div>
      </SectionCard>

      <SectionCard {...sections[6]}>
        <Code>{`배치잡 목록 (배치잡 관리 페이지에서 시작/중지/시각 변경 가능)

[스캔 잡]      : 30분마다 조건검색식으로 후보 종목 발굴 → condition_scan_logs에 영구 저장
[매매 잡]      : 1분마다 AI 평가 + 매수/매도 실행 (장중에만 실질 동작)
[학습 잡]      : 매일 16:00 KST 거래 성과 분석 → AI 파라미터 자동 최적화
  · 거래 데이터 20건 미만 → 분석 스킵
  · 20~49건 → 권고사항 생성, 자동 적용 보류
  · 50건 이상 → 파라미터 자동 적용
[잔고갱신 잡]  : 5분마다 실계좌 잔고 동기화 (장중 08:30~18:00 KST 월~금)
[매도계획 잡]  : 매일 08:50 KST 보유 종목별 AI 분할매도 계획 자동 생성
  · 꺼도 이미 저장된 계획은 계속 실행됨 (계획 삭제 필요)
  · 포트폴리오에서 수기로 편집 가능

모니터링
- 실시간 모니터 페이지에서 엔진 상태 'running' 확인
- 선정/탈락 이력 페이지에서 AI 판단 이유 및 매도 발동 로그 확인 가능`}</Code>
      </SectionCard>

      <SectionCard {...sections[7]}>
        <div className="space-y-4">
          <Warn title="429 Too Many Requests (API 요청 제한)">
            최근 키움증권 및 기타 API에서 요청 횟수 제한을 강화했습니다. 
            너무 짧은 주기(예: 10초 미만)로 배치잡을 돌리면 429 에러가 발생하며 데이터가 나오지 않을 수 있습니다. 
            <strong>권장 주기: 스캔 2~3분, 매매 1~2분</strong>
          </Warn>
          <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-2">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[hsl(var(--neon-red))]" />
              계좌 정보가 보이지 않을 때
            </h4>
            <ul className="text-xs space-y-1.5 text-muted-foreground list-decimal pl-4">
              <li>'설정' 페이지에서 API 키가 정확히 등록되어 있고 '저장' 되었는지 확인</li>
              <li>작업 스케줄러에서 'TradeBot-Agent'가 실행 중인지 확인 (작업 관리자 &gt; python 프로세스)</li>
              <li>거래 모드(모의/실전)를 변경했다면 에이전트와 서버를 한 번 재시작하는 것이 안전합니다.</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <div className="pt-8 text-center">
        <p className="text-xs text-muted-foreground italic">
          최종 업데이트: 2026년 6월 11일 (에이전트 연결 → Task Scheduler 표현 변경 / 섹션 오매핑 수정)
        </p>
      </div>
    </div>
  );
}
