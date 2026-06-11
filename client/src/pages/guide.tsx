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
  Monitor,
  Newspaper,
  Search,
  ServerCog,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Workflow,
  Rainbow,
  Code2,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: any;
  color: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
  iconBgColor: string;
  badgeClass: string;
  badge?: string;
}

const sections: Section[] = [
  {
    id: "preflight", title: "시작 전 확인", icon: CheckCircle2,
    color: "neon-green", badge: "필수",
    textColor: "text-emerald-500", borderColor: "border-emerald-500/25",
    bgColor: "bg-emerald-500/5", iconBgColor: "bg-emerald-500/15",
    badgeClass: "text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
  },
  {
    id: "rainbow", title: "레인보우 차트 로직", icon: Workflow,
    color: "neon-cyan", badge: "뒷차기2",
    textColor: "text-cyan-500", borderColor: "border-cyan-500/25",
    bgColor: "bg-cyan-500/5", iconBgColor: "bg-cyan-500/15",
    badgeClass: "text-cyan-600 border-cyan-500/40 dark:text-cyan-400",
  },
  {
    id: "ai-logic", title: "AI 판단 및 수식", icon: Bot,
    color: "neon-purple", badge: "핵심",
    textColor: "text-purple-500", borderColor: "border-purple-500/25",
    bgColor: "bg-purple-500/5", iconBgColor: "bg-purple-500/15",
    badgeClass: "text-purple-600 border-purple-500/40 dark:text-purple-400",
  },
  {
    id: "settings", title: "모델 상세 설정", icon: SlidersHorizontal,
    color: "neon-green", badge: "운용",
    textColor: "text-emerald-500", borderColor: "border-emerald-500/25",
    bgColor: "bg-emerald-500/5", iconBgColor: "bg-emerald-500/15",
    badgeClass: "text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
  },
  {
    id: "exit-strategy", title: "매도 전략 우선순위", icon: Activity,
    color: "neon-red", badge: "매도",
    textColor: "text-red-500", borderColor: "border-red-500/25",
    bgColor: "bg-red-500/5", iconBgColor: "bg-red-500/15",
    badgeClass: "text-red-600 border-red-500/40 dark:text-red-400",
  },
  {
    id: "dart", title: "DART 재무 필터", icon: ShieldAlert,
    color: "neon-cyan", badge: "리스크",
    textColor: "text-cyan-500", borderColor: "border-cyan-500/25",
    bgColor: "bg-cyan-500/5", iconBgColor: "bg-cyan-500/15",
    badgeClass: "text-cyan-600 border-cyan-500/40 dark:text-cyan-400",
  },
  {
    id: "jobs", title: "배치잡 및 모니터링", icon: ServerCog,
    color: "neon-purple", badge: "운영",
    textColor: "text-purple-500", borderColor: "border-purple-500/25",
    bgColor: "bg-purple-500/5", iconBgColor: "bg-purple-500/15",
    badgeClass: "text-purple-600 border-purple-500/40 dark:text-purple-400",
  },
  {
    id: "safety", title: "안전장치 및 429 에러", icon: AlertTriangle,
    color: "neon-green", badge: "중요",
    textColor: "text-emerald-500", borderColor: "border-emerald-500/25",
    bgColor: "bg-emerald-500/5", iconBgColor: "bg-emerald-500/15",
    badgeClass: "text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
  },
  {
    id: "kiwoom-setup", title: "키움 조건검색식 & 차트 수식 설정", icon: Code2,
    color: "neon-cyan", badge: "초기설정",
    textColor: "text-cyan-500", borderColor: "border-cyan-500/25",
    bgColor: "bg-cyan-500/5", iconBgColor: "bg-cyan-500/15",
    badgeClass: "text-cyan-600 border-cyan-500/40 dark:text-cyan-400",
  },
];

function SectionCard({ id, title, icon: Icon, textColor, borderColor, bgColor, iconBgColor, badgeClass, badge, children }: Section & { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={`${borderColor} shadow-lg`} id={id}>
      <CardHeader
        className={`cursor-pointer select-none flex flex-row items-center justify-between gap-2 pb-3 flex-wrap ${bgColor}`}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${iconBgColor} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${textColor}`} />
          </div>
          <CardTitle className="text-base font-bold">{title}</CardTitle>
          {badge && (
            <Badge variant="outline" className={`${badgeClass} text-[10px] uppercase tracking-wider`}>
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
        <span className="text-sm text-right text-cyan-600 dark:text-cyan-400 font-mono">{value}</span>
      </div>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Warn({ children, title = "주의사항" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300/60 rounded-md dark:bg-amber-900/20 dark:border-amber-500/30">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">{title}</p>
        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// 레인보우 차트 10개 라인 정의
const RAINBOW_LINES = [
  { pct: 10,  name: "연두", colorClass: "bg-lime-400",    textClass: "text-lime-600 dark:text-lime-400",   role: "매수",   desc: "극단적 저점 구간. 추가매수(Scale-in) 최우선 타점. 배당·재무 양호 종목만 진입." },
  { pct: 20,  name: "보라", colorClass: "bg-violet-500",  textClass: "text-violet-600 dark:text-violet-400", role: "매수",   desc: "강한 저점 신호. 하락 추세 지속 중 분할매수로 대응. 손절 정책 필수 병행." },
  { pct: 30,  name: "남색", colorClass: "bg-indigo-500",  textClass: "text-indigo-600 dark:text-indigo-400", role: "매수",   desc: "중간 저점 구간. 반등 모멘텀 확인 후 추가 매수 진행." },
  { pct: 40,  name: "파랑", colorClass: "bg-blue-500",    textClass: "text-blue-600 dark:text-blue-400",   role: "매수",   desc: "CL선 직전 진입 타점. 거래량 증가 확인 시 적극 매수." },
  { pct: 50,  name: "초록 (CL)", colorClass: "bg-green-500", textClass: "text-green-600 dark:text-green-400", role: "핵심매수", desc: "Center Line — 뒷차기2의 핵심 진입 타점. 에너지 응축이 가장 강한 지점. 신뢰도 조건 충족 시 최우선 진입." },
  { pct: 60,  name: "노랑", colorClass: "bg-yellow-400",  textClass: "text-yellow-600 dark:text-yellow-400", role: "매도",   desc: "수익 실현 시작 구간. 1차 분할매도 권장. 신규 매수 제한." },
  { pct: 70,  name: "주황", colorClass: "bg-orange-500",  textClass: "text-orange-600 dark:text-orange-400", role: "매도",   desc: "2차 분할매도 타점. 단기 고점 근처. AI 거부권 없이 매도 권장." },
  { pct: 80,  name: "빨강", colorClass: "bg-red-500",     textClass: "text-red-600 dark:text-red-400",     role: "매도",   desc: "강한 매도 신호. 전량 청산 또는 90% 이상 매도. 신규 진입 절대 금지." },
  { pct: 90,  name: "핑크", colorClass: "bg-pink-500",    textClass: "text-pink-600 dark:text-pink-400",   role: "매도",   desc: "과매수 위험. 남은 수량 즉시 청산." },
  { pct: 100, name: "검정", colorClass: "bg-slate-800 dark:bg-slate-200", textClass: "text-slate-700 dark:text-slate-200", role: "매도",   desc: "240일 최고점. 신규매수 불가. 전량 청산 대상." },
];

export default function Guide() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8" data-testid="text-guide-title">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
          TradeBot 운영 마스터 가이드
        </h1>
        <p className="text-muted-foreground text-base max-w-2xl mx-auto">
          "뒷차기2" 엔진의 핵심 로직과 AI 판단 메커니즘을 상세히 설명합니다.
          데이터에 기반한 최적의 운영 설정을 확인하세요.
        </p>
      </div>

      {/* ── 시작 전 확인 ── */}
      <SectionCard {...sections[0]}>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { t: "계좌 등록", d: "계좌번호 8자리 입력 시 상품구분(위탁 11 / 위탁종합 10)을 함께 선택. 10자리 전체 입력도 가능." },
            { t: "거래 모드 확인", d: "설정 > 거래 설정에서 모의투자/실전투자 스위치가 실제 계좌 타입과 일치하는지 확인." },
            { t: "모델 활성화", d: "자동매매 페이지에서 AI 모델을 생성하고 '작동중' 스위치 ON. 연결 계좌가 올바른지 확인." },
            { t: "운영 상황실 확인", d: "운영 상황실 메뉴에서 엔진 상태가 'running'이고 배치잡이 정상 동작하는지 확인." },
          ].map(item => (
            <div key={item.t} className="p-4 bg-muted/20 rounded-xl border border-border/50 hover:border-emerald-500/30 transition-colors">
              <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {item.t}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 계좌·모델 이력 관리 ── */}
      <SectionCard
        id="account-lifecycle"
        title="계좌·모델 이력 관리"
        icon={Settings2}
        color="neon-cyan"
        badge="계좌전환"
        textColor="text-cyan-500"
        borderColor="border-cyan-500/25"
        bgColor="bg-cyan-500/5"
        iconBgColor="bg-cyan-500/15"
        badgeClass="text-cyan-600 border-cyan-500/40 dark:text-cyan-400"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            TradeBot에서는 <strong>계좌는 주문 실행 단위</strong>, <strong>모델은 분석·학습 단위</strong>입니다.
            모의계좌가 만료되어 새 계좌로 바뀌어도 같은 모델의 매매 성과는 이어서 분석해야 합니다.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/20 rounded-xl border border-border/50">
              <h4 className="text-sm font-bold mb-2 text-cyan-600 dark:text-cyan-400">계좌번호와 상품구분</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>8자리 계좌번호만 입력하면 선택한 상품구분 코드가 붙어 저장됩니다.</li>
                <li><strong>11</strong> = 위탁 / <strong>10</strong> = 위탁종합 (실전·모의 구분 아님)</li>
                <li>실전·모의 구분은 계좌 유형(Account Type)과 API 키로 결정됩니다.</li>
              </ul>
            </div>
            <div className="p-4 bg-muted/20 rounded-xl border border-border/50">
              <h4 className="text-sm font-bold mb-2 text-emerald-600 dark:text-emerald-400">모의계좌 만료 시 처리</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>만료 계좌는 삭제 말고 <strong>보관</strong> 처리 (과거 데이터 유지)</li>
                <li>새 모의계좌 등록 후 API Key/Secret 저장</li>
                <li>자동매매 모델의 <strong>연결 계좌</strong>를 새 계좌로 변경</li>
                <li>거래내역/저널 필터 → "전체" 또는 "보관"으로 조회</li>
              </ul>
            </div>
          </div>
          <Warn title="삭제 금지">
            계좌 삭제는 외래키로 연결된 주문·보유종목·매매저널·분석 이력을 모두 삭제합니다.
            운영에서는 반드시 삭제 대신 보관 처리하고 필터로 조회 범위를 조정하세요.
          </Warn>
        </div>
      </SectionCard>

      {/* ── 레인보우 차트 ── */}
      <SectionCard {...sections[1]}>
        <p className="text-sm leading-relaxed">
          <strong>레인보우 차트(BackAttack Line)</strong>는 최근 <strong>240일간의 가격 변동폭</strong>을 10개 라인으로 시각화합니다.
          현재가가 240일 범위의 몇 % 위치에 있는지를 나타내며, 각 라인 색상이 매수/매도 전략의 기준이 됩니다.
        </p>

        {/* 수식 */}
        <Code>{`// 레인보우 포지션 계산 수식
Position(%) = ((현재가 - 240일 최저가) / (240일 최고가 - 240일 최저가)) × 100

CL (Center Line) = 50% 지점  ← 뒷차기2 핵심 진입 타점
CL폭(Width) = (현재가 - 240일최저가) / (240일최고가 × 0.2)
  ▸ 폭이 좁을수록 에너지가 강하게 응축된 상태로 해석`}</Code>

        {/* 라인별 상세 */}
        <div>
          <h4 className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mb-3">라인별 색상 & 전략</h4>
          <div className="space-y-1.5">
            {RAINBOW_LINES.map(line => (
              <div key={line.pct} className="flex items-start gap-3 p-2.5 rounded-md border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 shrink-0 w-32">
                  <div className={`w-3 h-3 rounded-full ${line.colorClass} shrink-0`} />
                  <span className={`text-xs font-bold ${line.textClass}`}>{line.pct}% {line.name}</span>
                </div>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    line.role === "핵심매수"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : line.role === "매수"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  }`}>{line.role}</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{line.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Warn title="레인보우 핵심 원칙">
          50%(CL)는 단순한 중간값이 아닙니다. 240일간 가격이 오르내리면서 에너지가 가장 강하게 수렴된 지점입니다.
          주가가 이 지점에서 반등할 때 거래량이 동반된다면 "뒷차기2" 매수 신호로 해석합니다.
          CL 위(60%~100%)는 이미 에너지가 해소되는 구간이므로 신규 진입하지 않습니다.
        </Warn>
      </SectionCard>

      {/* ── AI 판단 ── */}
      <SectionCard {...sections[2]}>
        <p className="text-sm mb-4 leading-relaxed">
          AI는 단순 지표뿐 아니라 뉴스, 재무, 테마를 종합하여 <strong>신뢰도(Confidence)</strong>를 산출합니다.
        </p>
        <div className="bg-slate-100/50 dark:bg-slate-900/50 p-4 rounded-lg border border-border/30 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-purple-600 dark:text-purple-400 mb-2">종합 신뢰도 공식 (Confidence Score)</h4>
            <Code>{`Confidence = (Theme×w1 + News×w2 + Financials×w3 + Technicals×w4) / TotalWeights

- Theme     (테마성): 현재 주도 섹터(AI, 반도체 등) 부합도
- News      (뉴스):   최근 공시/뉴스 감성 분석 (악재 발생 시 급격한 감점)
- Financials(재무):   DART 연동 퀀트 점수 (PBR, ROE, PER)
- Technicals(기술적): 레인보우 CL 위치 및 거래량 추세
- 각 가중치(w1~w4)는 자동매매 설정 > AI 분석 가중치에서 조정 가능 (합계 = 100%)`}</Code>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-md border border-border/50">
              <p className="text-xs font-bold mb-1 text-emerald-600 dark:text-emerald-400">진입 승인 조건</p>
              <ul className="text-[11px] space-y-1 text-muted-foreground list-disc pl-4">
                <li>레인보우 CL 위치가 40% ~ 55% 구간</li>
                <li>AI 종합 신뢰도 ≥ 설정된 '최소 신뢰도'</li>
                <li>DART 위험 공시(횡령·배임·부도)가 없을 것</li>
              </ul>
            </div>
            <div className="p-3 bg-muted/40 rounded-md border border-border/50">
              <p className="text-xs font-bold mb-1 text-red-600 dark:text-red-400">진입 거부(Skip) 사유</p>
              <ul className="text-[11px] space-y-1 text-muted-foreground list-disc pl-4">
                <li>레인보우 위치 70% 초과 (고점 추격 방지)</li>
                <li>쿨다운 이내 동일 종목 재평가 (비용 방지)</li>
                <li>재무 상태 극도 불량 (DART 필터)</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 모델 상세 설정 ── */}
      <SectionCard {...sections[3]}>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Row label="Max Positions" value="1 ~ 20개" desc="전체 계좌에서 동시에 보유할 최대 종목 수. 초반에는 3~5개 권장." />
            <Row label="Entry Ladder" value="5단계 유닛" desc="첫 진입 후 하락 시 추가 매수할 비중 배분. 예: CL50%×1, CL40%×1, CL30%×1, CL20%×1, CL10%×1" />
            <Row label="재평가 쿨다운" value="30분 ~ 하루 1회" desc="AI가 같은 종목을 너무 자주 평가하여 비용이 발생하는 것을 방지." />
            <Row label="최소 신뢰도" value="60 ~ 80" desc="이 값 이상일 때만 AI가 매수를 승인. 보수적 운용 시 70 이상 권장." />
          </div>
          <div className="space-y-4">
            <Warn title="운용 팁">
              처음에는 '최소 신뢰도'를 70 이상으로 높게 설정하여 우량한 신호에만 진입하세요.
              시장이 좋지 않을 때는 '최대 보유 종목'을 줄이는 것이 리스크 관리에 유리합니다.
            </Warn>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-md">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-1">AI 재량 스위치</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                '추가매수 허용'을 켜면 AI가 판단하여 특정 지지선에서 비중을 더 실을 수 있습니다.
                '목표초과보유'는 익절가 도달 시에도 추세가 강하면 더 보유하게 합니다.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── DART 재무 필터 ── */}
      <SectionCard {...sections[5]}>
        <p className="text-sm leading-relaxed mb-4">
          DART API를 통해 실시간으로 재무 지표를 가져와 분석합니다.
          신규 상장주·관리 종목 등 데이터 부족 시 보수적으로 점수를 깎습니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { l: "저평가 기준", v: "PBR < 1.0", d: "장부 가치보다 주가가 낮을 때 보너스 점수" },
            { l: "수익성 기준", v: "ROE > 15%", d: "자기자본 대비 이익이 높은 우량 기업 선호" },
            { l: "성장/밸류", v: "PER < 20", d: "이익 대비 주가가 합리적인 수준인지 판단" },
          ].map(item => (
            <div key={item.l} className="p-3 bg-muted/20 rounded border border-border/50 text-center">
              <p className="text-xs font-bold text-foreground">{item.l}</p>
              <p className="text-sm font-mono text-cyan-600 dark:text-cyan-400 my-1">{item.v}</p>
              <p className="text-[10px] text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>
        <Warn title="DART 즉시 차단 키워드">
          뉴스·공시 내용 중 <strong>'횡령', '배임', '감사의견 거절', '부도'</strong> 등 키워드가 발견되면
          AI 신뢰도와 무관하게 <strong>즉시 진입이 차단</strong>됩니다.
        </Warn>
      </SectionCard>

      {/* ── 매도 전략 ── */}
      <SectionCard {...sections[4]}>
        <p className="text-sm leading-relaxed mb-3">
          매 <strong>1분 사이클</strong>마다 보유 종목에 대해 아래 순서로 매도 조건을 평가합니다.
          상위 조건이 발동되면 이하 조건은 해당 사이클에서 건너뜁니다.
        </p>
        <Code>{`매도 평가 순서 (높은 우선순위 → 낮은 우선순위)

① ExitStage 분할매도 계획 (최우선)
   - 포트폴리오 > 종목 > 🎯 버튼으로 설정 또는 매도계획 배치잡(08:50 KST) 자동 생성
   - 트리거 종류: profit_rate(수익률%), rainbow_line(CL선%), loss_rate(손절%)
   - 발동 시 설정된 sellRatio(잔여수량 비율) 만큼 분할 매도
   - 해당 단계 fulfilled=true 처리 → 재발동 없음

② 종목별 단순 익절% (수기 오버라이드)
   - 포트폴리오 > 종목 > 🎯 > 수기 설정 탭의 '익절 기준(%)'
   - 모델 기본값보다 우선 적용됨. 미설정 시 ③으로 폴백

③ 모델 익절% (공통 기본값)
   - 자동매매 설정 > 기본 전략 설정의 '익절 기준(%)'

④ 물타기 익절 (추가매수 시 자동 계산)
   - 2유닛→8%, 3유닛→6%, 4유닛→4%, 5유닛→3%

⑤ CL선 분할매도 (rainbowLineSettings.sellWeight)
   - 자동매매 설정 > 레인보우 라인별 sell% 슬라이더
   - CL 60%(노랑) 이상 시 해당 라인의 sellWeight 비율만큼 분할 매도

⑥ 손절 (stop loss policy)
   - hard: 손실 >= hardCutLossPct 즉시 전량 청산
   - conditional: 특정 CL 색상 이하일 때만 발동
   - soft_ai_first: ⑧ AI 거부권 먼저 실행

⑦ 동적 청산
   - 급등 청산: 수익률 ≥ surgeThreshold% → 전량
   - 장기 보유: stalePeriodDays 초과 + 손실 중 → 전량
   - 거래량 급증: 당일 거래량 > 30일 평균 × volumeSpikeMultiplier → 전량

⑧ AI 거부권 (soft_ai_first 모드만)
   - ①~⑦ 발동 후 Claude AI에 최종 판단 의뢰
   - hold → 매도 취소 / partial_exit → 50% 분할 / full_exit → 전량`}</Code>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-300/60 rounded-md dark:bg-amber-900/20 dark:border-amber-500/30 text-xs space-y-1">
          <p className="font-bold text-amber-700 dark:text-amber-400">⚠️ 주의사항</p>
          <p className="text-amber-900 dark:text-amber-200">① 매도계획 배치잡을 꺼도 DB에 저장된 계획은 계속 실행됩니다. 계획 자체를 삭제(🎯 다이얼로그)해야 멈춥니다.</p>
          <p className="text-amber-900 dark:text-amber-200">⑤ CL 분할매도는 수익/손실 무관하게 해당 CL선에 도달하면 발동합니다. 동일 CL선은 한 번만 발동하며 더 높은 선 도달 시 재발동합니다.</p>
          <p className="text-amber-900 dark:text-amber-200">⑧ AI 거부권은 soft_ai_first 모드에서만 작동합니다. hard/conditional/disabled 모드는 AI 판단 없이 즉시 실행됩니다.</p>
        </div>
      </SectionCard>

      {/* ── 배치잡 ── */}
      <SectionCard {...sections[6]}>
        <Code>{`배치잡 목록 (배치잡 관리 페이지에서 시작/중지/주기 변경 가능)

[스캔 잡]      : 30분마다 조건검색식으로 후보 종목 발굴 → condition_scan_logs에 영구 저장
[매매 잡]      : 1분마다 AI 평가 + 매수/매도 실행 (장중에만 실질 동작)
[학습 잡]      : 매일 16:00 KST (장 종료 후) 거래 성과 분석 → 파라미터 변경 제안 생성
  · 거래 데이터 20건 미만 → 분석 스킵 (카드에 '데이터 부족 (현재 N건)' 메시지 표시)
  · autoApply=OFF: 제안이 '검토 필요' 섹션에 표시 → 직접 검토 후 개별 적용/무시
  · autoApply=ON:  제안을 즉시 설정에 반영 후 '자동 적용됨' 섹션에 기록 (무엇이 바뀌었는지 확인 가능)
  · 토글 OFF→ON 전환 시 현재 pending 제안 전부 즉시 적용 (다음날 학습 기다릴 필요 없음)
  · 학습 파라미터 제안 카드는 제안 없어도 항상 표시 (마지막 학습 날짜·이유 표시)
[잔고갱신 잡]  : 5분마다 실계좌 잔고 동기화 (장중 08:30~18:00 KST 월~금)
[매도계획 잡]  : 매일 08:50 KST 보유 종목별 AI 분할매도 계획 자동 생성
  · 꺼도 이미 저장된 계획은 계속 실행됨 (계획 삭제 필요)
  · 포트폴리오에서 수기로 편집 가능

모니터링
- 운영 상황실 페이지에서 엔진 상태 'running' 실시간 확인
- 선정/탈락 이력에서 AI 판단 이유 및 매도 발동 로그 확인 가능`}</Code>
      </SectionCard>

      {/* ── 안전장치 & 429 ── */}
      <SectionCard {...sections[7]}>
        <div className="space-y-4">
          <Warn title="429 Too Many Requests (API 요청 제한)">
            키움증권 REST API는 초당·분당 요청 수 제한이 있습니다.
            배치잡 주기가 너무 짧으면 429 에러가 발생하며 데이터가 누락됩니다.
            <br /><strong>권장 주기: 스캔 잡 30분, 매매 잡 1분 (기본값 준수)</strong>
          </Warn>
          <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-2">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              계좌 정보가 보이지 않을 때
            </h4>
            <ul className="text-xs space-y-1.5 text-muted-foreground list-decimal pl-4">
              <li>계좌 관리 페이지에서 API 키가 등록·저장되었는지 확인</li>
              <li>설정에서 거래 모드(모의/실전)와 실제 계좌 타입이 일치하는지 확인</li>
              <li>거래 모드 변경 후에는 서버를 재시작해야 반영됩니다.</li>
              <li>운영 상황실에서 최근 에러 로그 확인 (API 키 만료 등)</li>
            </ul>
          </div>
          <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-2">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-500" />
              서버 재시작 방법
            </h4>
            <Code>{`작업 스케줄러 방식 (권장):
schtasks /End /TN "TradeBot-Server"
# 3초 대기 후
schtasks /Run /TN "TradeBot-Server"

직접 실행 (로그 확인 가능):
# PowerShell에서 실행
Start-Process cmd.exe -ArgumentList '/c d:\\Projects\\tradebot\\restart-all.bat'`}</Code>
          </div>
        </div>
      </SectionCard>

      {/* ── 키움 조건검색식 & 차트 수식 설정 ── */}
      <SectionCard {...sections[8]}>
        <p className="text-sm leading-relaxed">
          TradeBot이 작동하려면 <strong>두 가지 사전 설정</strong>이 필요합니다:
          키움 영웅문 HTS에 <strong>조건검색식(뒷차기2)</strong>을 만들고,
          <strong>레인보우 CL 차트 보조지표</strong>를 추가하는 것입니다.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 조건검색식 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
              <Search className="w-4 h-4" />
              키움 HTS 조건검색식 설정 (뒷차기2)
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="p-3 bg-muted/20 rounded border border-border/40">
                <p className="font-bold text-foreground mb-1">① 영웅문 → 조건검색 ([0150])</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>신규 조건식 작성 클릭</li>
                  <li>이름: <strong>뒷차기2_CL매수</strong></li>
                </ul>
              </div>
              <div className="p-3 bg-muted/20 rounded border border-border/40">
                <p className="font-bold text-foreground mb-1">② 조건 항목 추가</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>주가 &gt; 이동평균선 (5일선 &gt; 20일선) — 단기 상승 추세</li>
                  <li>거래량 비율 &gt; 150% (20일 평균 대비) — 거래량 증가</li>
                  <li>현재가 &gt; 1,000원 — 저가 잡주 제외</li>
                  <li>시가총액 &gt; 500억 — 소형주 리스크 제한</li>
                  <li>52주 대비 현재가 위치: 45%~60% 사이 — CL 근처 포착</li>
                </ul>
              </div>
              <div className="p-3 bg-muted/20 rounded border border-border/40">
                <p className="font-bold text-foreground mb-1">③ 저장 후 TradeBot에 연결</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>자동매매 → 모델 선택 → 상세 설정 → 조건검색식 추가</li>
                  <li>키움에서 만든 조건식 이름을 선택</li>
                </ul>
              </div>
            </div>
            <Warn title="중요">
              조건검색식이 없으면 스캔 잡이 후보 종목을 가져오지 못합니다.
              반드시 키움 HTS에서 조건식을 먼저 만들고 저장하세요.
            </Warn>
          </div>

          {/* 레인보우 차트 수식 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
              <Workflow className="w-4 h-4" />
              키움 HTS 차트 레인보우 CL 보조지표
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="p-3 bg-muted/20 rounded border border-border/40">
                <p className="font-bold text-foreground mb-1">① 차트 → 보조지표 → 사용자 지표 추가</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>영웅문 차트에서 우클릭 → 지표 추가 → 사용자 지표</li>
                  <li>이름: <strong>Rainbow_CL</strong></li>
                </ul>
              </div>
              <Code>{`// 레인보우 CL 계산 수식 (영웅문 수식 편집기)
H240 = HIGHEST(H, 240)   {240일 최고가}
L240 = LOWEST(L, 240)    {240일 최저가}

// 10개 라인 (각각 다른 색상으로 표시)
L10  = L240 + (H240 - L240) * 0.10
L20  = L240 + (H240 - L240) * 0.20
L30  = L240 + (H240 - L240) * 0.30
L40  = L240 + (H240 - L240) * 0.40
CL   = L240 + (H240 - L240) * 0.50  {Center Line}
L60  = L240 + (H240 - L240) * 0.60
L70  = L240 + (H240 - L240) * 0.70
L80  = L240 + (H240 - L240) * 0.80
L90  = L240 + (H240 - L240) * 0.90
L100 = H240`}</Code>
              <div className="p-3 bg-muted/20 rounded border border-border/40">
                <p className="font-bold text-foreground mb-1">② 색상 설정</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>CL(50%) = 초록(굵게), L40 = 파랑, L60 = 노랑</li>
                  <li>L80, L90, L100 = 빨강 계열</li>
                  <li>현재가 캔들이 CL선 근처에 닿을 때가 진입 타이밍</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="pt-8 text-center">
        <p className="text-xs text-muted-foreground italic">
          최종 업데이트: 2026년 6월 11일 (레인보우 라인별 상세 / 에이전트 제거 / 키움 설정 카드 추가)
        </p>
      </div>
    </div>
  );
}
