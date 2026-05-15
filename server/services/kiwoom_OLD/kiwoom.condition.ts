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

      let loginSent = false;
      let loginDone = false;
      let realMessages: any[] = [];
      let collectTimer: ReturnType<typeof setTimeout> | null = null;

      const finishWithReal = () => {
        if (collectTimer) clearTimeout(collectTimer);
        clearTimeout(timer);
        ws.close();
        resolve({ trnm: payload.trnm, return_code: 0, data: realMessages });
      };

      ws.on("open", () => {
        console.log(`[KiwoomWS] open apiId=${apiId} → LOGIN 메시지 전송`);
        ws.send(JSON.stringify({ trnm: "LOGIN", token: this.accessToken }));
        loginSent = true;
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          console.log(`[KiwoomWS] message loginDone=${loginDone} trnm=${msg.trnm}:`, JSON.stringify(msg).slice(0, 200));

          // REAL: 조건검색 결과 종목 수집
          if (msg.trnm === "REAL") {
            if (loginDone) realMessages.push(msg);
            return;
          }

          const rc = msg.return_code;

          // LOGIN ack 처리
          if (!loginDone && loginSent) {
            if (rc !== undefined && rc !== null && rc !== 0 && String(rc) !== "0") {
              clearTimeout(timer);
              ws.close();
              reject(new Error(`WS 로그인 실패 ${rc}: ${msg.return_msg ?? "unknown"}`));
              return;
            }
            loginDone = true;
            console.log(`[KiwoomWS] 로그인 완료 → payload 전송:`, JSON.stringify(payload));
            ws.send(JSON.stringify(payload));
            return;
          }

          // PING = 구독 ack (CNSRREQ), 3초 수집 후 종료
          if (msg.trnm === "PING") {
            if (collectTimer === null) {
              console.log(`[KiwoomWS] PING 수신 → 3초 REAL 수집 후 종료`);
              collectTimer = setTimeout(finishWithReal, 3_000);
            }
            return;
          }

          // 일반 응답 (CNSRLST 등)
          clearTimeout(timer);
          ws.close();
          if (rc !== undefined && rc !== null && rc !== 0 && String(rc) !== "0") {
            reject(new Error(`조건검색 오류 ${rc}: ${msg.return_msg ?? "unknown"}`));
          } else {
            resolve(msg);
          }
        } catch (error) {
          clearTimeout(timer);
          ws.close();
          reject(error);
        }
      });

      ws.on("error", (error) => {
        console.log(`[KiwoomWS] error:`, error.message);
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

    // res.data = REAL 메시지 배열 (각 메시지 = 종목 1개)
    const rows: any[] = res.data || res.output1 || res.output || [];
    return {
      output: rows.map((item: any) => {
        // REAL 메시지: item 자체가 메시지, 데이터는 item.data 또는 item 직접
        const d = item?.data ?? item;
        return {
          stock_code: String(d["9001"] ?? d.stck_cd ?? d.stock_code ?? "").replace(/^A/, ""),
          stock_name: String(d["302"] ?? d.stck_nm ?? d.stock_name ?? ""),
          current_price: String(d["10"] ?? d.stck_prpr ?? d.current_price ?? "0"),
          change_rate: String(d["12"] ?? d.prdy_ctrt ?? d.change_rate ?? "0"),
        };
      }),
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
