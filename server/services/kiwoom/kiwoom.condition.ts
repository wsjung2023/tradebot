// kiwoom.condition.ts — 키움증권 조건검색 (REST API 미지원 안내)
// 키움 REST API는 HTS 조건검색을 지원하지 않습니다.
// 조건검색은 키움 HTS/OpenAPI WebSocket 전용 기능입니다.
// 현재 이 플랫폼에서 커스텀 조건식(formula.routes.ts)으로 동일한 기능을 자체 구현합니다.
import { KiwoomBase, type ConditionListResponse, type ConditionSearchResultsResponse } from "./kiwoom.base";

const NOT_SUPPORTED = "키움 REST API는 HTS 조건검색을 지원하지 않습니다. " +
  "커스텀 조건식(조건검색 메뉴)을 사용하세요.";

export class KiwoomCondition extends KiwoomBase {

  // 조건검색 목록 조회 — REST API 미지원
  async getConditionList(): Promise<ConditionListResponse> {
    throw new Error(NOT_SUPPORTED);
  }

  // 조건검색 결과 조회 — REST API 미지원
  async getConditionSearchResults(
    _conditionName: string,
    _conditionIndex: number
  ): Promise<ConditionSearchResultsResponse> {
    throw new Error(NOT_SUPPORTED);
  }

  // 실시간 조건검색 모니터링 — REST API 미지원
  async startConditionMonitoring(
    _conditionName: string,
    _conditionIndex: number
  ): Promise<any> {
    throw new Error(NOT_SUPPORTED);
  }
}
