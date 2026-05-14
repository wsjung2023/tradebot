// kiwoom.condition.ts — 키움증권 조건검색 (WebSocket: ka10171~ka10174)
import WebSocket from "ws";
import {
  KIWOOM_MOCK_BASE,
  KIWOOM_REAL_BASE,
  KiwoomBase,
  type ConditionListResponse,
  type ConditionSearchResultsResponse,
} from "./kiwoom.base";

export interface ConditionListItem {
  seq: string;
  name: string;
}

export interface ConditionSearchResult {
  stockCode: string;
  stockName: string;
  currentPrice: string;
  changeSign: string;
  change: string;
  changeRate: string;
  volume: string;
  open: string;
  high: string;
  low: string;
}

export class KiwoomCondition extends KiwoomBase {
  private get wsBaseUrl(): string {
    return this.baseURL === KIWOOM_REAL_BASE
      ? "wss://api.kiwoom.com:10000"
      : "wss://mockapi.kiwoom.com:10000";
  }

  private async wsRequest(apiId: string, payload: Record<string, string>): Promise<any> {
    await this.ensureValidToken();

    return new Promise((resolve, reject) => {
      if (!this.accessToken) {
        reject(new Error("Kiwoom 토큰이 없습니다."));
        return;
      }

      const ws = new WebSocket(`${this.wsBaseUrl}/api/dostk/websocket`, {
        headers: {
          "api-id": apiId,
          authorization: `Bearer ${this.accessToken}`,
        },
      });

      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("조건검색 WebSocket 타임아웃 (15초)"));
      }, 15_000);

      ws.on("open", () => {
        ws.send(JSON.stringify(payload));
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.trnm !== "REAL") {
            clearTimeout(timer);
            ws.close();
            if (msg.return_code !== 0 && String(msg.return_code) !== "0") {
              reject(new Error(`조건검색 오류 ${msg.return_code}: ${msg.return_msg ?? "unknown"}`));
            } else {
              resolve(msg);
            }
          }
        } catch (error) {
          clearTimeout(timer);
          ws.close();
          reject(error);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async getConditionList(): Promise<ConditionListResponse> {
    if (this.stubMode) {
      return {
        output: [
          { condition_name: "[테스트] 골든크로스", condition_index: 0 },
          { condition_name: "[테스트] RSI 과매도", condition_index: 1 },
        ],
      };
    }

    const res = await this.wsRequest("ka10171", { trnm: "CNSRLST" });
    const rows: any[] = res.data || res.output || [];
    return {
      output: rows.map((row) => ({
        condition_index: Number(Array.isArray(row) ? row[0] : (row.seq ?? row.condition_index ?? row[0] ?? 0)),
        condition_name: String(Array.isArray(row) ? row[1] : (row.name ?? row.condition_name ?? row[1] ?? "")),
      })),
    };
  }

  async getConditionSearchResults(seq: string, _conditionIndex: number = 0): Promise<ConditionSearchResultsResponse> {
    if (this.stubMode) {
      return {
        output: [
          {
            stock_code: "005930",
            stock_name: "삼성전자",
            current_price: "75000",
            change_rate: "0.67",
          },
        ],
      };
    }

    const res = await this.wsRequest("ka10172", {
      trnm: "CNSRREQ",
      seq: String(seq),
      search_type: "0",
      stex_tp: "K",
      cont_yn: "N",
      next_key: "",
    });

    const rows: any[] = res.data || res.output1 || res.output || [];
    return {
      output: rows.map((item: any) => ({
        stock_code: String(item["9001"] ?? item.stck_cd ?? item.stock_code ?? "").replace(/^A/, ""),
        stock_name: String(item["302"] ?? item.stck_nm ?? item.stock_name ?? ""),
        current_price: String(item["10"] ?? item.stck_prpr ?? item.current_price ?? "0"),
        change_rate: String(item["12"] ?? item.prdy_ctrt ?? item.change_rate ?? "0"),
      })),
    };
  }

  async stopConditionMonitoring(seq: string): Promise<void> {
    if (this.stubMode) return;
    await this.wsRequest("ka10174", { trnm: "CNSRCLR", seq: String(seq) });
  }

  async startConditionMonitoring(conditionName: string, conditionIndex: number): Promise<ConditionSearchResultsResponse> {
    const seq = String(conditionIndex > 0 ? conditionIndex : conditionName);
    return this.getConditionSearchResults(seq, conditionIndex);
  }
}
