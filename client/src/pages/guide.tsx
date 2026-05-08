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
  { id: "model", title: "모델 생성/활성화", icon: Bot, color: "neon-cyan", badge: "자동매매" },
  { id: "settings", title: "모델 상세 설정", icon: SlidersHorizontal, color: "neon-purple", badge: "핵심" },
  { id: "scan", title: "후보 스캔 조건", icon: Search, color: "neon-green", badge: "중요" },
  { id: "issue", title: "시장 이슈 연동", icon: Newspaper, color: "neon-cyan", badge: "옵션" },
  { id: "jobs", title: "배치잡 제어", icon: ServerCog, color: "neon-purple", badge: "운영" },
  { id: "monitor", title: "실시간 모니터링", icon: Activity, color: "neon-green", badge: "운영" },
  { id: "runtime", title: "실행 동작 규칙", icon: Workflow, color: "neon-cyan", badge: "로직" },
  { id: "learning", title: "학습 시점/방식", icon: GraduationCap, color: "neon-purple", badge: "중요" },
  { id: "safety", title: "안전장치/주의사항", icon: ShieldAlert, color: "neon-cyan", badge: "리스크" },
];

function SectionCard({ id, title, icon: Icon, color, badge, children }: Section & { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={`border-[hsl(var(--${color}))]/25`} id={id}>
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between gap-2 pb-3 flex-wrap"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-[hsl(var(--${color}))]/15 flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 text-[hsl(var(--${color}))]`} />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
          {badge && (
            <Badge variant="outline" className={`text-[hsl(var(--${color}))] border-[hsl(var(--${color}))]/40 text-xs`}>
              {badge}
            </Badge>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted/40 rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-border/30">
      {children}
    </pre>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
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
      <div>
        <h1 className="text-3xl font-bold mb-1">사용 가이드</h1>
        <p className="text-muted-foreground text-sm">
          현재 앱의 실제 UI/기능 기준으로 정리한 운영 가이드입니다. 화면 이름과 설정 항목을 그대로 따라가면 됩니다.
        </p>
      </div>

      <SectionCard {...sections[0]}>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            "설정 > 키움증권 API 키(APP KEY/SECRET) 저장",
            "설정 > 집 PC 에이전트 연결 상태가 '연결됨'",
            "설정 > 거래 모드(모의/실전) 의도대로 설정",
            "자동매매 > 모델에 계좌(accountId) 지정",
            "배치잡 관리 > 스캔/매매 잡 상태 확인",
            "실시간 모니터 > 엔진 상태 및 최근 피드 확인",
          ].map(item => (
            <div key={item} className="p-3 bg-muted/30 rounded-md border border-border/30 text-sm">
              {item}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard {...sections[1]}>
        <Code>{`자동매매 페이지 기본 순서
1) [AI 모델 생성] 클릭
2) 전략 유형 선택 (모멘텀 / 가치투자 / 기술적분석 / 커스텀)
3) 최대 보유 종목, 손절/익절 기본값 입력
4) 모델 카드의 스위치를 켜서 작동중 상태로 전환
5) 모델 카드 클릭 후 상세 설정 카드 진입`}</Code>
        <Warn>
          모델이 활성화돼 있어도 계좌 미지정, 조건검색식 미설정, 에이전트 미연결이면 실제 매매는 실행되지 않습니다.
        </Warn>
      </SectionCard>

      <SectionCard {...sections[2]}>
        <div className="space-y-1">
          <Row label="기본 전략 설정" value="maxPositions, CL 손절(legacy), 익절, unitSize, lineUnits" />
          <Row label="자동매매 설정" value="maxDailyTrades, 동적청산, AI 최소 신뢰도, 가중치(합계 100)" />
          <Row label="유닛/라더" value="baseUnitSize, maxUnitsPerStock, 5단계 entryLadder" />
          <Row label="손절 정책" value="disabled / soft_ai_first / conditional / hard" />
          <Row label="조건검색식" value="conditionSearchSequences (비어 있으면 스캔 스킵)" />
          <Row label="후보 재평가 쿨다운" value="aiEntryPolicy.candidateDecisionCooldownMode: 120분 / 하루 3회(09:10,13:30,15:10) / 하루 1회" />
          <Row label="AI 재량 스위치" value="추가매수/부분익절/목표초과보유/투기성허용" />
        </div>
      </SectionCard>

      <SectionCard {...sections[3]}>
        <p className="text-sm text-muted-foreground">후보 스캔은 모델별 조건검색식 목록으로 실행됩니다.</p>
        <Code>{`스캔 실행 조건
- 한국장 시간
- 에이전트 연결됨(최근 폴링)
- 모델 accountId 설정됨
- conditionSearchSequences 1개 이상

스캔 처리
- 조건검색식별 결과 수집
- DART 위험공시 키워드 종목 제외
- candidate_stocks upsert`}</Code>
      </SectionCard>

      <SectionCard {...sections[4]}>
        <p className="text-sm text-muted-foreground">
          자동매매 페이지의 "시장 이슈 종목 관리"에서 날짜별 종목을 등록할 수 있습니다.
        </p>
        <Code>{`requireMarketIssue = ON 일 때
- 당일(issueDate=YYYYMMDD) market_issues에 등록된 종목만 진입 평가
- 미등록 종목은 SKIP 알림으로 기록`}</Code>
      </SectionCard>

      <SectionCard {...sections[5]}>
        <Code>{`배치잡 관리 페이지에서 가능한 작업
- 잡 시작/중지
- 즉시 실행 (일부 잡 제외)
- 주기 변경 (분/초/특정 시각)

특징
- 상태와 주기 설정은 DB에 저장
- 서버 재시작 후에도 유지`}</Code>
      </SectionCard>

      <SectionCard {...sections[6]}>
        <Code>{`실시간 모니터 페이지
- 엔진 상태(run state, last cycle)
- 잡 상태 카드(실행/정지, 마지막/다음 실행, 오류 횟수)
- 후보 종목 테이블(라인/평가/스킵 사유)
- 매매 결정 피드(BUY/SELL/SKIP/ADDITIONAL_BUY/EXIT_SELL)
- 계산 근거: confidence=(theme*w1 + news*w2 + financials*w3 + liquidity*w4 + institutional*w5)/(w1+w2+w3+w4+w5)
- 알림 요약(미확인, 경고, 긴급)`}</Code>
      </SectionCard>

      <SectionCard {...sections[7]}>
        <Code>{`매매 사이클 핵심 흐름
1) 보유 포지션 관리(익절/손절정책/동적청산/AI결정)
2) 후보 종목 평가
  - 후보 재평가 쿨다운 윈도우(120분 / 하루3회 / 하루1회) 내 동일 종목 중복 평가 스킵
  - requireMarketIssue
  - minAiConfidence
  - 재무/유동성 필터
  - DART 위험공시 차단(항상)
  - 투기성 필터(allowSpeculativeLeaderTrades OFF 시)
3) AI 진입 정책(decideEntryPolicy) 승인 시 라더 매수
4) 스케일인/부분익절/전량청산은 정책/AI결정에 따라 실행`}</Code>
      </SectionCard>

      <SectionCard {...sections[8]}>
        <Code>{`학습 잡 실행 시점
- 기본: 매일 16:00 (배치잡 관리에서 시각 변경 가능)
- 즉시 실행: 배치잡 관리 > 학습 잡 > 즉시 실행

학습이 실제 동작하는 조건
- ENABLE_ADVANCED_LEARNING=true 일 때만 실행
- false이면 학습 사이클 자체가 skip

학습 데이터 기준
- 20건 미만: 통계/기록만 생성, 최적화 적용 안 함
- 50건 미만: autoApply=true여도 자동 반영 안 함
- 50건 이상: 안전조건 충족 시 자동 반영

자동 반영 안전조건(autoApply)
- 승률 >= 45%
- 총 수익률 > 0
- 최대 낙폭 < 30%
- 거래 수 >= 50

학습 결과 저장
- learning_records에 추천/적용여부 기록
- 적용 시 가중치/임계치/라더/손절정책 등을 업데이트`}</Code>
      </SectionCard>

      <SectionCard {...sections[9]}>
        <div className="space-y-1">
          <Row label="모의/실전 안전장치" value="모의 모드 + 실계좌 조합이면 거래 차단" />
          <Row label="에이전트 타임아웃 누적" value="자동 일시중지 + 쿨다운 상태로 전환 가능" />
          <Row label="가중치 합계 검증" value="AI 가중치 합이 100% 아니면 저장 거부" />
          <Row label="라더 유닛 검증" value="라더 총 유닛이 종목당 최대 유닛 초과 시 저장 거부" />
        </div>
        <Warn>
          에이전트가 끊긴 상태에서 잡만 실행하면 SKIP/오류가 누적됩니다. 먼저 설정 페이지에서 에이전트 연결 복구 후 재개하세요.
        </Warn>
      </SectionCard>

      <div className="pt-1 text-xs text-muted-foreground">
        안내 기준: 현재 코드의 `자동매매`, `설정`, `배치잡 관리`, `실시간 모니터` 화면 동작.
      </div>
    </div>
  );
}
