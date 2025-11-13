import { useState, useEffect, useRef, useCallback } from "react";

interface MarketDataMessage {
  type: "subscribe" | "unsubscribe" | "price" | "orderbook" | "trade" | "ping" | "pong";
  symbol?: string;
  payload?: any;
  timestamp?: number;
}

interface StockPrice {
  currentPrice: number;
  change: number;
  changeRate: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  stockName: string;
}

interface Orderbook {
  buy: Array<{ price: number; quantity: number }>;
  sell: Array<{ price: number; quantity: number }>;
}

export function useMarketStream(symbols: string[], channels: string[] = ["price", "orderbook"]) {
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [orderbooks, setOrderbooks] = useState<Record<string, Orderbook>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Construct WebSocket URL from current origin (works for both local dev and Replit)
    // window.location.host includes port automatically when present
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/ws/market`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      
      if (symbols.length > 0) {
        ws.send(JSON.stringify({
          type: "subscribe",
          symbols,
          channels,
        }));
      }

      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: MarketDataMessage = JSON.parse(event.data);

        switch (message.type) {
          case "price":
            if (message.symbol && message.payload) {
              setPrices((prev) => ({
                ...prev,
                [message.symbol!]: message.payload,
              }));
            }
            break;
          case "orderbook":
            if (message.symbol && message.payload) {
              setOrderbooks((prev) => ({
                ...prev,
                [message.symbol!]: message.payload,
              }));
            }
            break;
          case "pong":
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      setConnected(false);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, [symbols.join(','), channels.join(',')]);

  useEffect(() => {
    if (symbols.length > 0) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connect]);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: "subscribe",
        symbols,
        channels,
      }));
    }
  }, [symbols.join(','), channels.join(',')]);

  return {
    prices,
    orderbooks,
    connected,
  };
}
