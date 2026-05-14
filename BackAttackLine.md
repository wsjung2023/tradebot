# BackAttack Line (레인보우 차트) 완전 가이드

## 목차
1. [개요](#개요)
2. [핵심 개념: CL (Center Line)](#핵심-개념-cl-center-line)
3. [11개 라인 수식 완전 분석](#11개-라인-수식-완전-분석)
4. [CL폭 지표](#cl폭-지표)
5. [뒷차기2 검색 조건](#뒷차기2-검색-조건)
6. [투자 전략](#투자-전략)
7. [구현 세부사항](#구현-세부사항)

---

## 개요

**BackAttack Line (백어택 라인)**은 240일(약 1년) 기간의 고가/저가를 기반으로 11개의 수평선을 그려 현재 주가의 위치를 파악하는 기술적 지표입니다.

### 핵심 특징
- **Period**: 240일 (일봉 기준 약 1년)
- **라인 개수**: 11개 (최고점 → 10% 간격 → 최저점)
- **중심선**: 50% 초록선 (주력 매수 구간)
- **CL폭**: 각 구간의 폭 → 클수록 수익 기회 ↑

---

## 핵심 개념: CL (Center Line)

### CL이란?
**CL (Center Line, 중심선)**은 최고점이 갱신되는 순간의 중심 가격을 의미합니다.

### CL 계산 수식
```
CL = valuewhen(
  최고점 갱신 조건: highest(h(1), 240) < highest(h, 240),
  계산값: (highest(high, 240) + lowest(low, 240)) / 2
)
```

### 한글 해석
```
만약 (어제까지 240일 최고가) < (오늘까지 240일 최고가) 라면:
  CL = (240일 최고가 + 240일 최저가) / 2 로 업데이트
  
그렇지 않으면:
  CL = 이전 CL 값 유지 (고정)
```

### 핵심 포인트
- **최고점 갱신 시에만** CL이 업데이트됩니다
- 최고점이 갱신되지 않으면 **CL은 그대로 유지**됩니다
- 이로 인해 CL은 "과거 최고점 시점의 중심선"을 나타냅니다

---

## 11개 라인 수식 완전 분석

### 기본 공식 구조
모든 라인은 다음 구조를 따릅니다:
```
Line N = highest(H, 240) - (((highest(H, 240) - CL) / 5) * N)
```

### 지표 1: 빨주노초 (5개 라인)

#### 1️⃣ 10% 보라색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_10% = highest(H, period) - (((highest(H, period) - CL) / 5) * 1)
```
**의미**: 최고점에서 CL 거리의 1/5 아래 (90% 위치)

#### 2️⃣ 20% 빨간색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_20% = highest(H, period) - (((highest(H, period) - CL) / 5) * 2)
```
**의미**: 최고점에서 CL 거리의 2/5 아래 (80% 위치)

#### 3️⃣ 30% 주황색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_30% = highest(H, period) - (((highest(H, period) - CL) / 5) * 3)
```
**의미**: 최고점에서 CL 거리의 3/5 아래 (70% 위치)

#### 4️⃣ 40% 노란색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_40% = highest(H, period) - (((highest(H, period) - CL) / 5) * 4)
```
**의미**: 최고점에서 CL 거리의 4/5 아래 (60% 위치)

#### 5️⃣ 최고점 검정색 라인 (굵게)
```
Line_MAX = highest(h, period)
```
**의미**: 240일 기간 내 최고가 (100% 위치, 기준선)

---

### 지표 2: 파남보 (5개 라인)

#### 6️⃣ 50% 초록색 라인 ⭐ **중심선 (CL)**
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_50% = highest(H, period) - (((highest(H, period) - CL) / 5) * 5)
```
**의미**: 최고점에서 CL 거리의 5/5 아래 = **CL 자체** (50% 위치)
**투자 의미**: 🎯 **주력 매수 구간!** (50% 되돌림)

#### 7️⃣ 60% 파란색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_60% = highest(H, period) - (((highest(H, period) - CL) / 5) * 6)
```
**의미**: CL 아래 1구간 (40% 위치)

#### 8️⃣ 70% 군청색(남색) 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_70% = highest(H, period) - (((highest(H, period) - CL) / 5) * 7)
```
**의미**: CL 아래 2구간 (30% 위치)

#### 9️⃣ 80% 보라색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_80% = highest(H, period) - (((highest(H, period) - CL) / 5) * 8)
```
**의미**: CL 아래 3구간 (20% 위치)

#### 🔟 90% 검정색 라인
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_90% = highest(H, period) - (((highest(H, period) - CL) / 5) * 9)
```
**의미**: CL 아래 4구간 (10% 위치)

---

### 지표 3: 최저점 (1개 라인)

#### 1️⃣1️⃣ 100% 최하 검정색 라인 (두껍게)
```
CL = valuewhen(1, (highest(h(1), period) < highest(h, period)), 
               ((highest(high, Period) + lowest(low, Period)) / 2));
Line_100% = highest(H, period) - (((highest(H, period) - CL) / 5) * 10)
```
**의미**: CL 아래 5구간 (0% 위치, 최저선)

---

## CL폭 지표

### 수식
```
CL = (Highest(H, Period) + Lowest(L, Period)) / 2;
CL1 = Highest(H, Period) - (Highest(H, Period) - CL) / 5 * 2;
CL폭 = (1 - (CL1 / Highest(H, Period))) * 100
```

### 해석
```
CL1 = 20% 빨간색 라인의 가격
CL폭 = (최고점 대비 CL1의 거리) * 100
```

### 의미
- **CL폭이 크다** = 각 구간(10%p)의 실제 가격 폭이 크다
- **투자 관점**: CL폭이 큰 종목일수록 한 구간만 올라도 수익률이 높음
- **예시**: 
  - CL폭 5%: 한 구간 상승 시 약 5% 수익
  - CL폭 15%: 한 구간 상승 시 약 15% 수익 🎯

---

## 뒷차기2 검색 조건

### 전체 로직
```
((조건A AND 조건B) OR (조건C AND 조건D)) 
AND 조건E 
AND 조건M 
AND 조건F 
AND 조건G 
AND 조건H 
AND 조건I 
AND 조건J 
AND 조건K 
AND 조건L
```

### 조건 분석

#### 🅰️ 코스피/코스닥 구분 (둘 중 하나)
```
조건A: 코스피 (시장 = KOSPI)
조건B: 기간내 등락률 [일]1봉전 60봉이내에서 전일종가기대비등가 29.5% 이상

OR

조건C: 코스닥 (시장 = KOSDAQ)
조건D: 기간내 등락률 [일]1봉전 60봉이내에서 전일종가기대비등가 20% 이상
```
**해석**: 
- **코스피 종목**: 최근 60일 이내 29.5% 이상 급등
- **코스닥 종목**: 최근 60일 이내 20% 이상 급등
- **의미**: 급등 후 조정 들어간 종목 찾기

#### 🅱️ 신고가 대량 발생
```
조건E: [일]1봉전 60봉이내 240봉 신고가대량 발생
```
**해석**: 최근 60일 이내에 240일 신고가 + 대량 거래 발생
**의미**: 강한 상승 모멘텀 확인

#### 🅲️ 유동성 확보
```
조건M: [일]1봉전 60봉이내 240봉 신고가대량 발생
조건F: 기간내 거래대금 [일]1봉전 60봉이내 거래대금(일/주:백만, 분:천원) 200000상 1회 이상
```
**해석**: 거래대금 2억원 이상 발생
**의미**: 충분한 유동성으로 매수/매도 가능

#### 🅳️ 레인보우 차트 핵심 조건 (뒷차기 타이밍!)
```
조건G: [일]1봉전 일목균형표(1,240,1) 기준선 주가 근접률 3%이내
조건H: [일]1봉전 일목균형표(1,240,1) 주가 > 기준선
조건I: [일]2봉전 일목균형표(1,240,1) 주가 > 기준선
조건J: [일]3봉전 일목균형표(1,240,1) 주가 > 기준선
조건K: [일]4봉전 일목균형표(1,240,1) 주가 > 기준선
조건L: [일]5봉전 일목균형표(1,240,1) 주가 > 기준선
```
**해석**: 
- 일목균형표 기준선(240일) = **레인보우 차트의 50% 초록선 (CL) 근처**
- 현재가가 기준선 ±3% 이내
- 최근 5일간 기준선 위에서 거래 중

**의미**: 
- 🎯 **50% 되돌림(초록선) 근처 도달** = 뒷차기(BackAttack) 매수 타이밍!
- 5일간 지지선(CL) 위 유지 = 추세 전환 신호 확인

---

## 투자 전략

### 1️⃣ 종목 발굴: "뒷차기2" 검색
```
급등 종목 중 → 50% 되돌림 근처 → 반등 시작
```

### 2️⃣ 레인보우 차트 확인
```
✅ CL폭이 큰가? (10% 이상 권장)
✅ 현재가가 50% 초록선(CL) 근처인가?
✅ 최근 5일간 CL 위에서 거래 중인가?
```

### 3️⃣ 매수 타이밍
```
🟢 50% 초록선(CL) 근처 = 주력 매수 구간
🔵 60% 파란선 근처 = 추가 매수 고려
🟣 70% 남색선 이하 = 손절 검토
```

### 4️⃣ 목표 수익
```
📈 한 구간(10%p) 상승 = CL폭만큼 수익
   예: CL폭 15% → 50%→40% 이동 시 약 15% 수익

📈 두 구간(20%p) 상승 = CL폭 * 2 수익
   예: CL폭 15% → 50%→30% 이동 시 약 30% 수익
```

### 5️⃣ 리스크 관리
```
⚠️ 50% 아래로 이탈 시 = 추세 전환 가능성, 관찰
⚠️ 60% 아래로 이탈 시 = 추가 하락 가능성, 손절 검토
⚠️ 70% 아래로 이탈 시 = 강한 하락 추세, 손절 권장
```

---

## 구현 세부사항

### TypeScript 구현 시 고려사항

#### 1. valuewhen 로직 구현
```typescript
function valuewhen(condition: boolean[], value: number[]): number {
  // 최근(오른쪽)부터 검색
  for (let i = value.length - 1; i >= 0; i--) {
    if (condition[i]) {
      return value[i];
    }
  }
  return value[value.length - 1]; // fallback
}
```

#### 2. CL 계산 (최고점 갱신 추적)
```typescript
const period = 240;
const chartData = await getStockChart(stockCode, 'D', period + 1);

let CL = 0;
const clValues: number[] = [];

for (let i = period; i < chartData.length; i++) {
  const prevHighest = Math.max(...chartData.slice(i - period, i).map(d => d.high));
  const currentHighest = Math.max(...chartData.slice(i - period + 1, i + 1).map(d => d.high));
  
  if (prevHighest < currentHighest) {
    // 최고점 갱신!
    const highest = currentHighest;
    const lowest = Math.min(...chartData.slice(i - period + 1, i + 1).map(d => d.low));
    CL = (highest + lowest) / 2;
  }
  
  clValues.push(CL);
}
```

#### 3. 11개 라인 계산
```typescript
const highest = Math.max(...chartData.slice(-period).map(d => d.high));
const distance = (highest - CL) / 5;

const lines = {
  line_max: highest,                    // 최고점 (검정 굵게)
  line_10: highest - distance * 1,      // 10% 보라
  line_20: highest - distance * 2,      // 20% 빨강
  line_30: highest - distance * 3,      // 30% 주황
  line_40: highest - distance * 4,      // 40% 노랑
  line_50: highest - distance * 5,      // 50% 초록 (CL)
  line_60: highest - distance * 6,      // 60% 파랑
  line_70: highest - distance * 7,      // 70% 남색
  line_80: highest - distance * 8,      // 80% 보라
  line_90: highest - distance * 9,      // 90% 검정
  line_min: highest - distance * 10,    // 최저점 (검정 두껍게)
};
```

#### 4. CL폭 계산
```typescript
const CL1 = highest - (highest - CL) / 5 * 2; // 20% 라인
const clWidth = (1 - (CL1 / highest)) * 100;
```

#### 5. 색상 매핑
```typescript
const colors = {
  line_max: '#000000',      // 검정 (굵게)
  line_10: '#9966CC',       // 보라
  line_20: '#FF0000',       // 빨강
  line_30: '#FF8C00',       // 주황
  line_40: '#FFD700',       // 노랑
  line_50: '#00FF00',       // 초록 (CL, 굵게)
  line_60: '#0000FF',       // 파랑
  line_70: '#000080',       // 남색
  line_80: '#9966CC',       // 보라
  line_90: '#000000',       // 검정
  line_min: '#000000',      // 검정 (두껍게)
};
```

---

## 요약

### ✅ 핵심 포인트
1. **CL은 최고점 갱신 시에만 업데이트** - valuewhen 로직 필수
2. **11개 라인은 (최고점-CL)/5 기반** - 10% 간격이 아님!
3. **50% 초록선 = CL = 주력 매수 구간**
4. **CL폭 큰 종목 = 수익 기회 큼**
5. **뒷차기2 = 급등 후 50% 되돌림 종목**

### 🎯 자동매매 적용
```
조건검색 "뒷차기2" 실행
  → 검색된 종목에 레인보우 차트 적용
  → CL폭 확인 (10% 이상 필터링)
  → 현재가가 50%~60% 구간인지 확인
  → GPT-4 종합 분석
  → 매수 신호 생성
  → 키움 API 자동 매수
```

---

**작성일**: 2025-11-14  
**Period**: 240일 (고정)  
**차트 종류**: 일봉 (D) 기본, 주봉(W)/월봉(M) 확장 가능
