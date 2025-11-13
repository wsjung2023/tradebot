import { WebSocket } from "ws";
import type { KiwoomService } from "./services/kiwoom.service";

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
}

export class MarketDataHub {
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private symbolSubscribers: Map<string, Set<WebSocket>> = new Map();
  private kiwoomService: KiwoomService;
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  constructor(kiwoomService: KiwoomService) {
    this.kiwoomService = kiwoomService;
    this.startPriceUpdates();
  }

  addClient(ws: WebSocket) {
    this.clients.set(ws, {
      ws,
      symbols: new Set(),
      channels: new Set(),
    });

    ws.on("message", (data) => this.handleClientMessage(ws, data));
    ws.on("close", () => this.removeClient(ws));
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.removeClient(ws);
    });

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

  private handleClientMessage(ws: WebSocket, data: any) {
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
          const payload = this.transformPriceData(priceData, symbol);
          this.sendMessage(ws, {
            type: "price",
            symbol,
            payload,
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

  private startPriceUpdates() {
    this.priceUpdateInterval = setInterval(async () => {
      const allSymbols = Array.from(this.symbolSubscribers.keys());
      
      for (const symbol of allSymbols) {
        try {
          const subscribers = this.symbolSubscribers.get(symbol);
          if (!subscribers || subscribers.size === 0) continue;

          const priceData = await this.kiwoomService.getStockPrice(symbol);
          const orderbook = await this.kiwoomService.getStockOrderbook(symbol);

          subscribers.forEach((ws) => {
            const client = this.clients.get(ws);
            if (!client) return;

            if (client.channels.has("price")) {
              const payload = this.transformPriceData(priceData, symbol);
              this.sendMessage(ws, {
                type: "price",
                symbol,
                payload,
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
    }, 1000); // Update every second
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
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
    this.clients.forEach((_, ws) => ws.close());
    this.clients.clear();
    this.symbolSubscribers.clear();
  }
}
