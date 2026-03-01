// kiwoom.condition.ts — 키움증권 HTS 조건검색식 실행 및 모니터링 메서드
import { KiwoomBase, type ConditionListResponse, type ConditionSearchResultsResponse } from "./kiwoom.base";

export class KiwoomCondition extends KiwoomBase {
  async getConditionList(): Promise<ConditionListResponse> {
    if (this.stubMode) {
      // Return mock condition list including "뒷차기2"
      return {
        rt_cd: '0',
        msg_cd: '0000',
        msg1: 'OK',
        output: [
          {
            condition_name: '뒷차기2',
            condition_index: 0,
          },
          {
            condition_name: '급등주',
            condition_index: 1,
          },
          {
            condition_name: '저점 매수',
            condition_index: 2,
          },
        ],
      } as any;
    }
    
    try {
      const response = await this.api.get<ConditionListResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-condition-list',
        {
          headers: {
            tr_id: 'OPT10075',
          },
        }
      );
      console.log('Condition list response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get condition list:', error);
      throw error;
    }
  }

  /**
   * Get stocks matching a specific condition formula
   * @param conditionName - Name of the condition formula
   * @param conditionIndex - Index of the condition formula
   * @returns List of stocks matching the condition
   */
  async getConditionSearchResults(
    conditionName: string,
    conditionIndex: number
  ): Promise<ConditionSearchResultsResponse> {
    if (this.stubMode) {
      // Return mock stocks matching the condition
      // Include some Korean stocks that typically fit the "뒷차기2" pattern
      return {
        rt_cd: '0',
        msg_cd: '0000',
        msg1: 'OK',
        output1: [
          { stock_code: '005930', stock_name: '삼성전자' },
          { stock_code: '035720', stock_name: '카카오' },
          { stock_code: '051910', stock_name: 'LG화학' },
          { stock_code: '035420', stock_name: 'NAVER' },
          { stock_code: '068270', stock_name: '셀트리온' },
          { stock_code: '207940', stock_name: '삼성바이오로직스' },
          { stock_code: '005380', stock_name: '현대차' },
          { stock_code: '000660', stock_name: 'SK하이닉스' },
        ],
      } as any;
    }
    
    try {
      const response = await this.api.get<ConditionSearchResultsResponse>(
        '/uapi/domestic-stock/v1/quotations/inquire-condition-search',
        {
          params: {
            FID_COND_NM: conditionName,
            FID_COND_IDX: conditionIndex.toString(),
            FID_COND_SCR_DIV_CD: '0',
          },
          headers: {
            tr_id: 'OPT10076',
          },
        }
      );
      console.log('Condition search results:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to get condition search results:', error);
      throw error;
    }
  }

  /**
   * Start real-time monitoring for a condition formula
   * NOTE: This requires WebSocket connection for real-time updates
   * @param conditionName - Name of the condition formula
   * @param conditionIndex - Index of the condition formula
   * @returns Registration result
   */
  async startConditionMonitoring(
    conditionName: string,
    conditionIndex: number
  ): Promise<any> {
    try {
      const response = await this.api.post(
        '/uapi/domestic-stock/v1/quotations/register-condition-realtime',
        {
          FID_COND_NM: conditionName,
          FID_COND_IDX: conditionIndex.toString(),
          FID_COND_SCR_DIV_CD: '1',
        },
        {
          headers: {
            tr_id: 'OPT10077',
          },
        }
      );
      console.log('Condition monitoring started:', response.data);
      console.log('NOTE: Real-time updates require WebSocket connection');
      return response.data;
    } catch (error) {
      console.error('Failed to start condition monitoring:', error);
      throw error;
    }
  }
}
