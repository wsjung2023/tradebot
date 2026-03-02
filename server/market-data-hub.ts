import { WebSocket } from "ws";
import type { KiwoomService } from "./services/kiwoom";

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
  symbols: Set<string>;
  channels: Set<string>;
  lastActivity: number;
}

export class MarketDataHub {
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private symbolSubscribers: Map<string, Set<WebSocket>> = new Map();
  private kiwoomService: KiwoomService;
  private priceUpdateTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly CLIENT_TIMEOUT = 90000;
  private readonly UPDATE_INTERVAL = 2000; // Increased to 2s to reduce load

  constructor(kiwoomService: KiwoomService) {
    this.kiwoomService = kiwoomService;
    this.scheduleNextUpdate();
    this.startHeartbeat();
  }

  addClient(ws: WebSocket) {
    this.clients.set(ws, {
      ws,
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
    const client = this.clients.get(ws);
    if (!client) return;

    client.symbols.forEach((symbol) => {
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
        }
      }
    });

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

    symbols.forEach((symbol) => {
      client.symbols.add(symbol);
      if (!this.symbolSubscribers.has(symbol)) {
        this.symbolSubscribers.set(symbol, new Set());
      }
      this.symbolSubscribers.get(symbol)!.add(ws);
    });

    channels.forEach((channel) => client.channels.add(channel));
    this.sendInitialSnapshot(ws, symbols, channels);
  }

  private handleUnsubscribe(ws: WebSocket, message: MarketDataMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    const symbols = message.symbols || (message.symbol ? [message.symbol] : []);
    symbols.forEach((symbol) => {
      client.symbols.delete(symbol);
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
        }
      }
    });
  }

  private async sendInitialSnapshot(ws: WebSocket, symbols: string[], channels: string[]) {
    for (const symbol of symbols) {
      try {
        if (channels.includes("price")) {
          const priceData = await this.kiwoomService.getStockPrice(symbol);
          this.sendMessage(ws, {
            type: "price",
            symbol,
            payload: this.transformPriceData(priceData, symbol),
            timestamp: Date.now(),
          });
        }

        if (channels.includes("orderbook")) {
          const orderbook = await this.kiwoomService.getStockOrderbook(symbol);
          this.sendMessage(ws, {
            type: "orderbook",
            symbol,
            payload: orderbook,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error(`Error fetching initial snapshot for ${symbol}:`, error);
      }
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

      deadClients.forEach(ws => {
        this.removeClient(ws);
        ws.close();
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  // Self-scheduling update: next tick only starts AFTER current one completes
  private scheduleNextUpdate() {
    this.priceUpdateTimer = setTimeout(async () => {
      await this.doUpdateCycle();
      // Only schedule next if not stopped
      if (this.priceUpdateTimer !== null) {
        this.scheduleNextUpdate();
      }
    }, this.UPDATE_INTERVAL);
  }

  private async doUpdateCycle() {
    // Guard: skip if already running (should not happen with setTimeout, but just in case)
    if (this.isUpdating) return;

    const allSymbols = Array.from(this.symbolSubscribers.keys());
    if (allSymbols.length === 0) return; // No subscribers — skip API calls entirely

    this.isUpdating = true;
    try {
      for (const symbol of allSymbols) {
        const subscribers = this.symbolSubscribers.get(symbol);
        if (!subscribers || subscribers.size === 0) continue;

        try {
          const [priceData, orderbook] = await Promise.all([
            this.kiwoomService.getStockPrice(symbol),
            this.kiwoomService.getStockOrderbook(symbol),
          ]);

          subscribers.forEach((ws) => {
            const client = this.clients.get(ws);
            if (!client) return;

            if (client.channels.has("price")) {
              this.sendMessage(ws, {
                type: "price",
                symbol,
                payload: this.transformPriceData(priceData, symbol),
                timestamp: Date.now(),
              });
            }

            if (client.channels.has("orderbook")) {
              this.sendMessage(ws, {
                type: "orderbook",
                symbol,
                payload: orderbook,
                timestamp: Date.now(),
              });
            }
          });
        } catch (error) {
          console.error(`Error updating ${symbol}:`, error);
        }
      }
    } finally {
      this.isUpdating = false;
    }
  }

  private transformPriceData(data: any, symbol: string) {
    const output = data?.output || {};
    return {
      currentPrice: parseFloat(output.stck_prpr || '0'),
      change: parseFloat(output.prdy_vrss || '0'),
      changeRate: parseFloat(output.prdy_ctrt || '0'),
      openPrice: parseFloat(output.stck_oprc || '0'),
      highPrice: parseFloat(output.stck_hgpr || '0'),
      lowPrice: parseFloat(output.stck_lwpr || '0'),
      volume: parseInt(output.acml_vol || '0'),
      stockName: symbol,
    };
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
    this.symbolSubscribers.clear();
  }
}
