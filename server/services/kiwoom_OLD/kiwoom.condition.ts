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

  private async wsRequest(apiId: string, payload: Record<string, string>, retried = false): Promise<any> {
    await this.ensureValidToken();

    // CNSRREQ는 같은 WS 연결에서 CNSRLST를 먼저 보내야 응답에 종목 데이터가 포함됨
    const needsCnsrlstFirst = payload.trnm === "CNSRREQ";

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

      let settled = false;
      const reqId = Math.random().toString(36).slice(2, 6);
      console.log(`[KiwoomWS:${reqId}] created apiId=${apiId} needsCnsrlstFirst=${needsCnsrlstFirst}`);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.log(`[KiwoomWS:${reqId}] 타임아웃 fired`);
        ws.terminate();
        reject(new Error("조건검색 WebSocket 타임아웃 (60초)"));
      }, 60_000);

      let loginDone = false;
      let cnsrlstDone = false; // CNSRREQ 전 CNSRLST 완료 여부

      const finish = (result: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        resolve(result);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(err);
      };

      ws.on("open", () => {
        console.log(`[KiwoomWS:${reqId}] open → LOGIN`);
        ws.send(JSON.stringify({ trnm: "LOGIN", token: this.accessToken }));
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          console.log(`[KiwoomWS:${reqId}] msg trnm=${msg.trnm} rc=${msg.return_code} loginDone=${loginDone} cnsrlstDone=${cnsrlstDone}`);

          // LOGIN ack
          if (!loginDone) {
            const rc = msg.return_code;
            if (rc !== undefined && rc !== null && rc !== 0 && String(rc) !== "0") {
              const errMsg = msg.return_msg ?? "unknown";
              const isTokenError =
                String(rc).includes("8005") ||
                errMsg.includes("8005") ||
                errMsg.includes("Token이 유효하지 않습니다") ||
                errMsg.includes("인증에 실패했습니다");
              if (isTokenError && !retried) {
                console.warn(`⚠️  WS 로그인 토큰 오류(${rc}) — 토큰 강제 갱신 후 1회 재시도`);
                settled = true;
                clearTimeout(timer);
                ws.close();
                this.accessToken = "";
                this.tokenExpiry = 0;
                this.ensureValidToken()
                  .then(() => this.wsRequest(apiId, payload, true))
                  .then(resolve)
                  .catch(reject);
                return;
              }
              fail(new Error(`WS 로그인 실패 ${rc}: ${errMsg}`));
              return;
            }
            loginDone = true;
            if (needsCnsrlstFirst) {
              console.log(`[KiwoomWS:${reqId}] 로그인 완료 → CNSRLST 먼저 전송`);
              ws.send(JSON.stringify({ trnm: "CNSRLST" }));
            } else {
              console.log(`[KiwoomWS:${reqId}] 로그인 완료 → payload 전송`);
              ws.send(JSON.stringify(payload));
            }
            return;
          }

          // CNSRLST 응답 → 실제 payload(CNSRREQ) 전송
          if (needsCnsrlstFirst && !cnsrlstDone && msg.trnm === "CNSRLST") {
            cnsrlstDone = true;
            console.log(`[KiwoomWS:${reqId}] CNSRLST 완료 → CNSRREQ 전송 seq=${payload.seq}`);
            ws.send(JSON.stringify(payload));
            return;
          }

          // PING = 구독 ack (CNSRREQ 후) — 이미 CNSRREQ 응답에서 종목을 받았으므로 종료
          if (msg.trnm === "PING") {
            console.log(`[KiwoomWS:${reqId}] PING 수신 (구독 완료) → 종료`);
            return; // already settled by CNSRREQ response; if not yet, ignore
          }

          // REAL = 실시간 업데이트 (이미 종료된 경우 무시)
          if (msg.trnm === "REAL") return;

          // 일반 응답 (CNSRLST 단독, CNSRREQ 결과 등)
          console.log(`[KiwoomWS:${reqId}] 일반 응답 trnm=${msg.trnm} rc=${msg.return_code}`);
          const rc = msg.return_code;
          if (rc !== undefined && rc !== null && rc !== 0 && String(rc) !== "0") {
            fail(new Error(`조건검색 오류 ${rc}: ${msg.return_msg ?? "unknown"}`));
          } else {
            finish(msg);
          }
        } catch (error) {
          fail(error as Error);
        }
      });

      ws.on("close", (code) => {
        console.log(`[KiwoomWS:${reqId}] close code=${code} settled=${settled}`);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`WebSocket 연결 종료 (code=${code})`));
        }
      });

      ws.on("error", (error) => {
        console.log(`[KiwoomWS:${reqId}] error:`, error.message);
        fail(error);
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

    // res.data = CNSRREQ 응답의 종목 배열 (각 항목 = 종목 1개)
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
