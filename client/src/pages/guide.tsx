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
            { t: "계좌 등록", d: "설정 > 키움증권 계좌(App Key/Secret)를 반드시 DB에 저장" },
            { t: "에이전트 연결", d: "집 PC의 Kiwoom Agent가 '연결됨' 상태여야 실시간 주문 가능" },
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

      <SectionCard {...sections[4]}>
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

      <SectionCard {...sections[5]}>
        <Code>{`1. 배치잡 관리 (Jobs)
- [스캔 잡]: 조건검색식을 돌려 후보를 뽑는 주기 (보통 1~5분)
- [매매 잡]: 뽑힌 후보를 AI가 평가하고 실제 주문을 내는 주기 (보통 1~2분)
- [학습 잡]: 하루 매매 데이터를 분석해 AI 파라미터를 자동 최적화 (매일 16:00 실행)
  · 거래 데이터 20건 미만 → 분석 스킵 (권고사항 없음)
  · 20~49건 → 분석 + 권고사항 생성, 파라미터 자동 적용은 보류
  · 50건 이상 → 분석 + 파라미터 자동 적용 (minAiConfidence 등 조정)

2. 실시간 모니터링 (Monitor)
- 엔진 상태가 'running' 인지 상시 확인
- '매매 결정 피드'에서 AI가 왜 SKIP 했는지 사유(Low Confidence, High Position 등)를 확인 가능`}</Code>
      </SectionCard>

      <SectionCard {...sections[6]}>
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
              <li>집 PC의 키움 에이전트가 실행 중이며 '연결됨' 상태인지 확인</li>
              <li>거래 모드(모의/실전)를 변경했다면 에이전트와 서버를 한 번 재시작하는 것이 안전합니다.</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <div className="pt-8 text-center">
        <p className="text-xs text-muted-foreground italic">
          최종 업데이트: 2026년 5월 16일 (뒷차기2 통합 엔진 기준)
        </p>
      </div>
    </div>
  );
}
