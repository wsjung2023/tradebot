// report.ext.ts — PDF 리포트 커스터마이징 Extension Point
// Private Cloud 고객이 회사 로고, 브랜딩, 추가 섹션을 주입할 수 있습니다.

export interface ReportExtension {
  // 리포트 상단 회사/브랜드명 (기본: 'TradeBot')
  brandName: string;
  // 리포트 헤더 컬러 (hex, 기본: '#0ea5e9')
  primaryColor: string;
  // 커버 페이지 하단에 표시할 추가 텍스트 (null 시 생략)
  coverFooterText: string | null;
  // 리포트 마지막에 추가할 면책조항 (null 시 기본 면책조항 사용)
  disclaimer: string | null;
}

const defaultReport: ReportExtension = {
  brandName: 'TradeBot',
  primaryColor: '#0ea5e9',
  coverFooterText: null,
  disclaimer: null,
};

export function getReportExtension(): ReportExtension {
  return defaultReport;
}
