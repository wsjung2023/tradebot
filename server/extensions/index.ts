// extensions/index.ts — Extension Layer 진입점
// Private Cloud 고객은 이 폴더의 파일을 커스터마이징 가능.
// Core 코드(routes/, services/kiwoom/, storage/)는 수정 금지.

export { getStrategyExtension } from './strategy.ext';
export { getPromptExtension } from './prompt.ext';
export { getReportExtension } from './report.ext';
