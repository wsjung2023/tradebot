/**
 * BackAttack Line (레인보우 차트) - 정확한 HTS 수식 구현
 * 
 * 참고: BackAttackLine.md
 * Period: 240일 (일봉 기준 약 1년)
 * 라인: 11개 (최고점 → 10% 간격 → 최저점)
 */

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RainbowLine {
  name: string;           // '10%', '20%', ..., 'MAX', 'CL', 'MIN'
  percentage: number;     // 10, 20, ..., 100
  price: number;          // 실제 가격
  color: string;          // HEX 색상 코드
  weight: number;         // 선 두께 (1=보통, 2=굵게, 3=두껍게)
  zone: 'overbought' | 'sell' | 'primary-buy' | 'scale-in' | 'deep-value';
}

export interface RainbowChartResult {
  stockCode: string;
  period: number;         // 240
  highest: number;        // CL 설정 시점의 240일 최고가 (고정)
  lowest: number;         // 계산된 100% 라인 (고정)
  CL: number;             // Center Line (50% 초록선) (고정)
  clWidth: number;        // CL폭 (%)
  current: number;        // 현재가
  currentPosition: number;// 현재가 위치 (0-100%)
  lines: RainbowLine[];   // 11개 라인
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  currentZone: string;
  signals: {
    nearCL: boolean;      // CL 근처 (±3%)
    aboveCL: boolean;     // CL 위
    belowCL: boolean;     // CL 아래
    inPrimaryBuyZone: boolean;  // 40-60% 구간
  };
}

/**
 * CL 스냅샷 (최고점 갱신 시의 상태)
 */
interface CLSnapshot {
  CL: number;           // Center Line
  highest: number;      // 그때의 최고가
  lowest: number;       // 그때의 최저가
  updateDate: string;   // 갱신 날짜
}

/**
 * valuewhen 함수 구현
 * HTS 수식: valuewhen(1, condition, value)
 * 
 * @param conditions 조건 배열 (true/false)
 * @param values 값 배열
 * @returns 가장 최근에 조건이 true였을 때의 값
 */
function valuewhen(conditions: boolean[], values: any[]): any {
  // 최근(오른쪽)부터 검색
  for (let i = values.length - 1; i >= 0; i--) {
    if (conditions[i]) {
      return values[i];
    }
  }
  // 조건이 한 번도 만족되지 않은 경우 가장 최근 값 반환
  return values[values.length - 1];
}

/**
 * BackAttack Line (레인보우 차트) 분석기
 */
export class RainbowChartAnalyzer {
  /**
   * 레인보우 차트 분석
   * 
   * @param stockCode 종목코드
   * @param ohlcvData OHLCV 데이터 (최소 240개 이상 권장)
   * @param period 기간 (기본값: 240)
   * @returns 레인보우 차트 분석 결과
   */
  static analyze(
    stockCode: string,
    ohlcvData: OHLCVData[],
    period: number = 240
  ): RainbowChartResult {
    if (ohlcvData.length < period) {
      throw new Error(`Insufficient data. Need at least ${period} bars, got ${ohlcvData.length}`);
    }

    // 최근 period개 데이터만 사용
    const recentData = ohlcvData.slice(-period);
    const current = recentData[recentData.length - 1].close;

    // Step 1: CL 스냅샷 계산 (최고점 갱신 시의 highest/lowest 포함)
    const clSnapshot = this.calculateCLSnapshot(recentData, period);

    // Step 2: 11개 라인 계산 (고정된 snapshot 사용)
    const lines = this.calculateLines(clSnapshot);

    // Step 3: CL폭 계산
    const clWidth = this.calculateCLWidth(clSnapshot);

    // Step 4: 현재가 위치 계산
    const lowest = lines.find(l => l.name === 'MIN')!.price;
    const highest = lines.find(l => l.name === 'MAX')!.price;
    const currentPosition = ((current - lowest) / (highest - lowest)) * 100;

    // Step 5: 추천 및 신호 생성
    const { recommendation, currentZone, signals } = this.generateSignals(
      current,
      clSnapshot.CL,
      lines,
      currentPosition
    );

    return {
      stockCode,
      period,
      highest: clSnapshot.highest,
      lowest,
      CL: clSnapshot.CL,
      clWidth,
      current,
      currentPosition,
      lines,
      recommendation,
      currentZone,
      signals,
    };
  }

  /**
   * CL 스냅샷 계산 (최고점 갱신 시의 highest/lowest 포함)
   * 
   * HTS 수식:
   * CL = valuewhen(
   *   highest(h(1), period) < highest(h, period),
   *   (highest(high, Period) + lowest(low, Period)) / 2
   * )
   * 
   * 핵심: 최고점 갱신 시의 highest/lowest도 함께 저장!
   */
  private static calculateCLSnapshot(data: OHLCVData[], period: number): CLSnapshot {
    const conditions: boolean[] = [];
    const snapshots: CLSnapshot[] = [];

    for (let i = 0; i < data.length; i++) {
      // 이전까지의 최고가
      const prevHighest = i === 0
        ? 0
        : Math.max(...data.slice(Math.max(0, i - period + 1), i).map(d => d.high));
      
      // 현재까지의 최고가/최저가
      const currentHighest = Math.max(...data.slice(Math.max(0, i - period + 1), i + 1).map(d => d.high));
      const currentLowest = Math.min(...data.slice(Math.max(0, i - period + 1), i + 1).map(d => d.low));
      
      // 최고점 갱신 조건
      const isNewHigh = prevHighest < currentHighest;
      conditions.push(isNewHigh);

      // CL 스냅샷 (최고점 갱신 시 highest/lowest 함께 저장!)
      const snapshot: CLSnapshot = {
        CL: (currentHighest + currentLowest) / 2,
        highest: currentHighest,
        lowest: currentLowest,
        updateDate: data[i].date,
      };
      snapshots.push(snapshot);
    }

    // valuewhen: 가장 최근에 최고점이 갱신되었을 때의 스냅샷
    const latestSnapshot = valuewhen(conditions, snapshots);
    
    // 초기 데이터가 없을 경우 fallback
    if (!latestSnapshot) {
      const currentHighest = Math.max(...data.map(d => d.high));
      const currentLowest = Math.min(...data.map(d => d.low));
      return {
        CL: (currentHighest + currentLowest) / 2,
        highest: currentHighest,
        lowest: currentLowest,
        updateDate: data[data.length - 1].date,
      };
    }

    return latestSnapshot;
  }

  /**
   * 11개 라인 계산 (고정된 CL 스냅샷 사용)
   * 
   * Line N = highest - (((highest - CL) / 5) * N)
   * 
   * 핵심: snapshot의 highest 사용 (현재 rolling high가 아님!)
   */
  private static calculateLines(snapshot: CLSnapshot): RainbowLine[] {
    const { highest, CL } = snapshot;
    const distance = (highest - CL) / 5;

    // distance가 음수가 되면 안 됨 (safety check)
    if (distance < 0) {
      console.warn(`Warning: CL (${CL}) exceeds highest (${highest}). Using fallback.`);
      // Fallback: CL을 highest로 clamp
      const safeDistance = 0;
      const safeCL = highest;
      
      return this.calculateLinesWithDistance(highest, safeCL, safeDistance);
    }

    return this.calculateLinesWithDistance(highest, CL, distance);
  }

  /**
   * distance 기반 라인 계산 (헬퍼 함수)
   */
  private static calculateLinesWithDistance(
    highest: number,
    CL: number,
    distance: number
  ): RainbowLine[] {
    const lineConfigs = [
      { n: 0, name: 'MAX', percentage: 100, color: '#000000', weight: 2, zone: 'overbought' as const },
      { n: 1, name: '10%', percentage: 90, color: '#9966CC', weight: 1, zone: 'sell' as const },
      { n: 2, name: '20%', percentage: 80, color: '#FF0000', weight: 1, zone: 'sell' as const },
      { n: 3, name: '30%', percentage: 70, color: '#FF8C00', weight: 1, zone: 'sell' as const },
      { n: 4, name: '40%', percentage: 60, color: '#FFD700', weight: 1, zone: 'primary-buy' as const },
      { n: 5, name: 'CL', percentage: 50, color: '#00FF00', weight: 2, zone: 'primary-buy' as const },
      { n: 6, name: '60%', percentage: 40, color: '#0000FF', weight: 1, zone: 'primary-buy' as const },
      { n: 7, name: '70%', percentage: 30, color: '#000080', weight: 1, zone: 'scale-in' as const },
      { n: 8, name: '80%', percentage: 20, color: '#9966CC', weight: 1, zone: 'scale-in' as const },
      { n: 9, name: '90%', percentage: 10, color: '#000000', weight: 1, zone: 'deep-value' as const },
      { n: 10, name: 'MIN', percentage: 0, color: '#000000', weight: 3, zone: 'deep-value' as const },
    ];

    return lineConfigs.map(config => ({
      name: config.name,
      percentage: config.percentage,
      price: highest - (distance * config.n),
      color: config.color,
      weight: config.weight,
      zone: config.zone,
    }));
  }

  /**
   * CL폭 계산
   * 
   * HTS 수식:
   * CL = (Highest(H, Period) + Lowest(L, Period)) / 2
   * CL1 = Highest(H, Period) - (Highest(H, Period) - CL) / 5 * 2
   * CL폭 = (1 - (CL1 / Highest(H, Period))) * 100
   */
  private static calculateCLWidth(snapshot: CLSnapshot): number {
    const { highest, CL } = snapshot;
    const CL1 = highest - ((highest - CL) / 5) * 2; // 20% 라인
    const clWidth = (1 - (CL1 / highest)) * 100;
    return Math.round(clWidth * 100) / 100; // 소수점 2자리
  }

  /**
   * 투자 신호 생성
   */
  private static generateSignals(
    current: number,
    CL: number,
    lines: RainbowLine[],
    currentPosition: number
  ) {
    // CL 근처 판단 (±3%)
    const clDistance = Math.abs(current - CL) / CL;
    const nearCL = clDistance < 0.03;
    const aboveCL = current > CL;
    const belowCL = current < CL;
    const inPrimaryBuyZone = currentPosition >= 40 && currentPosition <= 60;

    // 추천 로직
    let recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell' = 'hold';
    let currentZone = 'unknown';

    if (currentPosition < 20) {
      currentZone = 'deep-value';
      recommendation = 'strong-buy';
    } else if (currentPosition < 40) {
      currentZone = 'scale-in-zone';
      recommendation = 'buy';
    } else if (currentPosition >= 40 && currentPosition <= 60) {
      currentZone = 'primary-buy-zone';
      recommendation = nearCL && aboveCL ? 'buy' : 'hold';
    } else if (currentPosition > 60 && currentPosition <= 80) {
      currentZone = 'profit-taking-zone';
      recommendation = 'sell';
    } else {
      currentZone = 'overbought';
      recommendation = 'strong-sell';
    }

    return {
      recommendation,
      currentZone,
      signals: {
        nearCL,
        aboveCL,
        belowCL,
        inPrimaryBuyZone,
      },
    };
  }

  /**
   * 신호 강도 계산 (0-100)
   * 
   * 50% (CL) 기준:
   * - CL 근처 = 높은 점수 (매수 기회)
   * - CL에서 멀어질수록 낮은 점수
   */
  static getSignalStrength(result: RainbowChartResult): number {
    const { currentPosition, signals } = result;

    // CL(50%) 근처일수록 높은 점수
    const distanceFromCL = Math.abs(currentPosition - 50);
    let score = 100 - (distanceFromCL * 2); // 0-50% 범위에서 100-0점

    // CL 근처 보너스
    if (signals.nearCL) {
      score += 20;
    }

    // CL 위 + Primary Buy Zone 보너스
    if (signals.aboveCL && signals.inPrimaryBuyZone) {
      score += 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
