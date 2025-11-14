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

    // 전체 데이터 사용 (rolling window를 위해)
    const current = ohlcvData[ohlcvData.length - 1].close;

    // Step 1: CL 스냅샷 계산 (전체 데이터 전달!)
    const clSnapshot = this.calculateCLSnapshot(ohlcvData, period);

    // Step 2: 11개 라인 계산 (고정된 snapshot 사용)
    const lines = this.calculateLines(clSnapshot);

    // Step 3: CL폭 계산
    const clWidth = this.calculateCLWidth(clSnapshot);

    // Step 4: 현재가 위치 계산
    const lowest = lines.find(l => l.name === 'MIN')!.price;
    const highest = lines.find(l => l.name === 'MAX')!.price;
    
    // Zero-range 방어 (highest == lowest)
    const range = highest - lowest;
    const currentPosition = range > 0 ? ((current - lowest) / range) * 100 : 50;

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
   * CL 스냅샷 계산 (HTS 정확한 로직)
   * 
   * HTS 로직:
   * 1. 첫 period개로 초기 CL 설정
   * 2. period+1번째부터 rolling 체크
   * 3. 이전 최고 < 현재 최고이면 CL 업데이트
   * 4. 그렇지 않으면 이전 CL 유지
   */
  private static calculateCLSnapshot(data: OHLCVData[], period: number): CLSnapshot {
    // Step 1: 첫 period개 데이터로 초기 CL 설정
    const initialWindow = data.slice(0, period);
    const initialHigh = Math.max(...initialWindow.map(d => d.high));
    const initialLow = Math.min(...initialWindow.map(d => d.low));
    
    let currentSnapshot: CLSnapshot = {
      CL: (initialHigh + initialLow) / 2,
      highest: initialHigh,
      lowest: initialLow,
      updateDate: data[period - 1].date,
    };

    // Step 2: period+1번째부터 rolling window 체크
    // HTS: highest(h(1), period) < highest(h, period) → CL 업데이트
    for (let i = period; i < data.length; i++) {
      // 이전 window: [i-period ~ i-1]
      const prevWindow = data.slice(i - period, i);
      const prevHigh = Math.max(...prevWindow.map(d => d.high));
      
      // 현재 window: [i-period+1 ~ i]
      const currentWindow = data.slice(i - period + 1, i + 1);
      const currentHigh = Math.max(...currentWindow.map(d => d.high));
      const currentLow = Math.min(...currentWindow.map(d => d.low));
      
      // 최고점 갱신 체크
      if (prevHigh < currentHigh) {
        // 새로운 최고점! CL 스냅샷 업데이트
        currentSnapshot = {
          CL: (currentHigh + currentLow) / 2,
          highest: currentHigh,
          lowest: currentLow,
          updateDate: data[i].date,
        };
      }
      // else: 최고점 갱신 없음 → currentSnapshot 유지 (이게 핵심!)
    }

    return currentSnapshot;
  }

  /**
   * 11개 라인 계산 (고정된 CL 스냅샷 사용)
   * 
   * Line N = highest - (((highest - CL) / 5) * N)
   */
  private static calculateLines(snapshot: CLSnapshot): RainbowLine[] {
    const { highest, CL } = snapshot;
    const distance = (highest - CL) / 5;

    // distance가 음수가 되면 안 됨 (safety check)
    if (distance < 0) {
      console.warn(`Warning: CL (${CL}) exceeds highest (${highest}). Using fallback.`);
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
   */
  private static calculateCLWidth(snapshot: CLSnapshot): number {
    const { highest, CL } = snapshot;
    
    // Zero-range 방어
    if (highest === 0) return 0;
    
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
    const clDistance = CL > 0 ? Math.abs(current - CL) / CL : 0;
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
   */
  static getSignalStrength(result: RainbowChartResult): number {
    const { currentPosition, signals } = result;

    // CL(50%) 근처일수록 높은 점수
    const distanceFromCL = Math.abs(currentPosition - 50);
    let score = 100 - (distanceFromCL * 2);

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
