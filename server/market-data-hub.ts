import { WebSocket } from "ws";
import { AgentTimeoutError } from "./services/agent-proxy.service";
import { getUserKiwoomService } from "./services/user-kiwoom.service";

export interface MarketDataMessage {
  type: "subscribe" | "unsubscribe" | "price" | "orderbook" | "trade" | "ping" | "pong";
  symbol?: string;
  symbols?: string[];
  channels?: string[];
  payload?: any;
  timestamp?: number;
}

interface ClientSubscription {
  ws: WebSocket;
  userId: string;
  symbols: Set<string>;
  channels: Set<string>;
  lastActivity: number;
}

interface SymbolDemand {
  clients: Set<WebSocket>;
  channels: Set<string>;
}

function absNumberString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return String(value).replace(/,/g, "").replace(/^-/, "") || "0";
}

export class MarketDataHub {
  private userKiwoomService = getUserKiwoomService();
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private priceUpdateTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly CLIENT_TIMEOUT = 90000;
  private readonly UPDATE_INTERVAL = 2000;
  private readonly MAX_SYMBOL_UPDATES_PER_CYCLE = 8;

  constructor() {
    this.scheduleNextUpdate();
    this.startHeartbeat();
  }

  addClient(ws: WebSocket, userId: string) {
    this.clients.set(ws, {
      ws,
      userId,
      symbols: new Set(),
      channels: new Set(),
      lastActivity: Date.now(),
    });

    ws.on("message", (data) => this.handleClientMessage(ws, data));
    ws.on("close", () => this.removeClient(ws));
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.removeClient(ws);
    });
    ws.on("pong", () => this.updateClientActivity(ws));

    this.sendMessage(ws, { type: "pong", timestamp: Date.now() });
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
  }

  private updateClientActivity(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  private handleClientMessage(ws: WebSocket, data: any) {
    this.updateClientActivity(ws);

    try {
      const message: MarketDataMessage = JSON.parse(data.toString());
      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(ws, message);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, message);
          break;
        case "ping":
          this.sendMessage(ws, { type: "pong", timestamp: Date.now() });
          break;
      }
    } catch (error) {
      console.error("Error handling client message:", error);
    }
  }

  private handleSubscribe(ws: WebSocket, message: MarketDataMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    const symbols = message.symbols || (message.symbol ? [message.symbol] : []);
    const channels = message.channels || ["price", "orderbook", "trade"];

    symbols.forEach((symbol) => client.symbols.add(symbol));
    channels.forEach((channel) => client.channels.add(channel));

    void this.sendInitialSnapshot(ws, symbols, channels);
  }

  private handleUnsubscribe(ws: WebSocket, message: MarketDataMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    const symbols = message.symbols || (message.symbol ? [message.symbol] : []);
    symbols.forEach((symbol) => client.symbols.delete(symbol));
  }

  private async sendInitialSnapshot(ws: WebSocket, symbols: string[], channels: string[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    for (const symbol of symbols) {
      await this.pushSymbolSnapshot(client.userId, symbol, channels, [ws]);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const deadClients: WebSocket[] = [];

      this.clients.forEach((client, ws) => {
        const timeSinceActivity = now - client.lastActivity;
        if (timeSinceActivity > this.CLIENT_TIMEOUT) {
          deadClients.push(ws);
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });

      deadClients.forEach((ws) => {
        this.removeClient(ws);
        ws.close();
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private scheduleNextUpdate() {
    this.priceUpdateTimer = setTimeout(async () => {
      await this.doUpdateCycle();
      if (this.priceUpdateTimer !== null) {
        this.scheduleNextUpdate();
      }
    }, this.UPDATE_INTERVAL);
  }

  private async doUpdateCycle() {
    if (this.isUpdating) return;
    if (this.clients.size === 0) return;

    this.isUpdating = true;
    try {
      const demandByUser = new Map<string, Map<string, SymbolDemand>>();

      this.clients.forEach((client, ws) => {
        if (client.symbols.size === 0 || client.channels.size === 0) return;

        let symbolsForUser = demandByUser.get(client.userId);
        if (!symbolsForUser) {
          symbolsForUser = new Map();
          demandByUser.set(client.userId, symbolsForUser);
        }

        client.symbols.forEach((symbol) => {
          let demand = symbolsForUser!.get(symbol);
          if (!demand) {
            demand = { clients: new Set(), channels: new Set() };
            symbolsForUser!.set(symbol, demand);
          }
          demand.clients.add(ws);
          client.channels.forEach((channel) => demand!.channels.add(channel));
        });
      });

      const symbolTasks = Array.from(demandByUser.entries()).flatMap(([userId, symbols]) =>
        Array.from(symbols.entries()).map(([symbol, demand]) => () =>
          this.pushSymbolSnapshot(userId, symbol, Array.from(demand.channels), Array.from(demand.clients)),
        ),
      );
      await this.runTasksWithLimit(symbolTasks, this.MAX_SYMBOL_UPDATES_PER_CYCLE);
    } finally {
      this.isUpdating = false;
    }
  }

  private async runTasksWithLimit(tasks: Array<() => Promise<void>>, limit: number) {
    if (tasks.length === 0) return;
    const concurrency = Math.max(1, Math.min(limit, tasks.length));
    let cursor = 0;

    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < tasks.length) {
          const current = cursor;
          cursor += 1;
          await tasks[current]();
        }
      }),
    );
  }

  private async pushSymbolSnapshot(userId: string, symbol: string, channels: string[], targets: WebSocket[]) {
    try {
      const tasks: Promise<void>[] = [];

      if (channels.includes("price")) {
        tasks.push(
          this.userKiwoomService.getPrice(userId, symbol)
            .then((priceData) => {
              const payload = this.transformPriceData(priceData, symbol);
              targets.forEach((ws) => {
                const client = this.clients.get(ws);
                if (!client?.channels.has("price")) return;
                this.sendMessage(ws, { type: "price", symbol, payload, timestamp: Date.now() });
              });
            }),
        );
      }

      if (channels.includes("orderbook")) {
        tasks.push(
          this.userKiwoomService.getOrderbook(userId, symbol)
            .then((orderbookData) => {
              const payload = this.transformOrderbookData(orderbookData);
              targets.forEach((ws) => {
                const client = this.clients.get(ws);
                if (!client?.channels.has("orderbook")) return;
                this.sendMessage(ws, { type: "orderbook", symbol, payload, timestamp: Date.now() });
              });
            }),
        );
      }

      await Promise.all(tasks);
    } catch (error) {
      if (!(error instanceof AgentTimeoutError)) {
        console.error(`Error updating ${symbol} for user ${userId}:`, error);
      }
    }
  }

  private transformPriceData(data: any, symbol: string) {
    const output = data?.output || data?.raw || data || {};
    return {
      currentPrice: parseFloat(absNumberString(data?.currentPrice ?? output.stck_prpr ?? output.cur_prc)),
      change: parseFloat(absNumberString(data?.change ?? output.prdy_vrss ?? output.prc_diff)),
      changeRate: parseFloat(absNumberString(data?.changeRate ?? output.prdy_ctrt ?? output.flu_rt)),
      openPrice: parseFloat(absNumberString(data?.open ?? output.stck_oprc ?? output.open_pric ?? output.oppr)),
      highPrice: parseFloat(absNumberString(data?.high ?? output.stck_hgpr ?? output.high_pric ?? output.hgpr)),
      lowPrice: parseFloat(absNumberString(data?.low ?? output.stck_lwpr ?? output.low_pric ?? output.lwpr)),
      volume: parseInt(absNumberString(data?.volume ?? output.acml_vol ?? output.acc_trde_qty ?? output.trde_qty), 10),
      stockName: data?.stockName || output.stck_nm || output.stk_nm || symbol,
    };
  }

  private transformOrderbookData(data: any) {
    if (data?.buy && data?.sell) {
      return data;
    }

    const raw = data?.raw || data || {};
    const sell = [] as Array<{ price: number; quantity: number }>;
    const buy = [] as Array<{ price: number; quantity: number }>;

    for (let i = 10; i >= 1; i--) {
      const suffix = i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : `${i}th`;
      const price = raw[`sel_${suffix}_pre_bid`] ?? raw[`sel_${i}th_pre_bid`];
      const quantity = raw[`sel_${suffix}_pre_req`] ?? raw[`sel_${i}th_pre_req`];
      if (price) {
        sell.push({
          price: Number(absNumberString(price)),
          quantity: Number(absNumberString(quantity)),
        });
      }
    }

    for (let i = 1; i <= 10; i++) {
      const suffix = i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : `${i}th`;
      const price = raw[`buy_${suffix}_pre_bid`] ?? raw[`buy_${i}th_pre_bid`];
      const quantity = raw[`buy_${suffix}_pre_req`] ?? raw[`buy_${i}th_pre_req`];
      if (price) {
        buy.push({
          price: Number(absNumberString(price)),
          quantity: Number(absNumberString(quantity)),
        });
      }
    }

    return { buy, sell, raw };
  }

  private sendMessage(ws: WebSocket, message: MarketDataMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  stop() {
    if (this.priceUpdateTimer) {
      clearTimeout(this.priceUpdateTimer);
      this.priceUpdateTimer = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.forEach((_, ws) => ws.close());
    this.clients.clear();
  }
}
