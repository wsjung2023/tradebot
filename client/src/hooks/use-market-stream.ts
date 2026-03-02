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

export type ConnectionStatus = 'connecting' | 'online' | 'degraded' | 'offline' | 'failed';

export function useMarketStream(symbols: string[], channels: string[] = ["price", "orderbook"]) {
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [orderbooks, setOrderbooks] = useState<Record<string, Orderbook>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const missedPongsRef = useRef(0);

  // Refs to avoid stale closures in connect() without creating dependency cycles
  const retryCountRef = useRef(0);
  const statusRef = useRef<ConnectionStatus>('offline');
  const symbolsRef = useRef(symbols);
  const channelsRef = useRef(channels);

  const MAX_RETRIES = 10;
  const MAX_MISSED_PONGS = 3;

  // Keep refs in sync
  symbolsRef.current = symbols;
  channelsRef.current = channels;

  const setStatus = useCallback((s: ConnectionStatus) => {
    statusRef.current = s;
    setConnectionStatus(s);
  }, []);

  const setRetry = useCallback((n: number) => {
    retryCountRef.current = n;
    setRetryCount(n);
  }, []);

  const getReconnectDelay = useCallback((retries: number) => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    return Math.min(baseDelay * Math.pow(2, retries), maxDelay) + Math.random() * 1000;
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      // Remove listeners before closing to avoid triggering onclose reconnect logic
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'cleanup');
      }
    }
  }, []);

  // connect is stable — does NOT depend on connectionStatus or retryCount
  const connect = useCallback(() => {
    if (!navigator.onLine) {
      setStatus('offline');
      setErrorMessage('네트워크 연결이 없습니다');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    if (retryCountRef.current >= MAX_RETRIES) {
      setStatus('failed');
      setErrorMessage(`최대 재연결 횟수(${MAX_RETRIES})를 초과했습니다`);
      return;
    }

    // Clear previous socket WITHOUT triggering cleanup that would reset the reconnect logic
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (wsRef.current) {
      const old = wsRef.current;
      wsRef.current = null;
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      if (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING) {
        old.close(1000, 'reconnect');
      }
    }

    setStatus('connecting');
    setErrorMessage(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/market`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let heartbeatPongTimeout: NodeJS.Timeout | undefined;

    ws.onopen = () => {
      if (wsRef.current !== ws) { ws.close(1000); return; }

      setStatus('online');
      setRetry(0);
      setErrorMessage(null);
      missedPongsRef.current = 0;

      const currentSymbols = symbolsRef.current;
      const currentChannels = channelsRef.current;
      if (currentSymbols.length > 0) {
        ws.send(JSON.stringify({ type: "subscribe", symbols: currentSymbols, channels: currentChannels }));
      }

      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        heartbeatPongTimeout = setTimeout(() => {
          missedPongsRef.current++;
          if (missedPongsRef.current >= MAX_MISSED_PONGS) {
            setStatus('degraded');
            setErrorMessage('서버 응답이 없습니다');
          }
        }, 5000);
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const message: MarketDataMessage = JSON.parse(event.data);

        if (message.type === "pong") {
          missedPongsRef.current = 0;
          if (heartbeatPongTimeout) { clearTimeout(heartbeatPongTimeout); heartbeatPongTimeout = undefined; }
          if (statusRef.current === 'degraded') {
            setStatus('online');
            setErrorMessage(null);
          }
          return;
        }

        switch (message.type) {
          case "price":
            if (message.symbol && message.payload) {
              setPrices(prev => ({ ...prev, [message.symbol!]: message.payload }));
            }
            break;
          case "orderbook":
            if (message.symbol && message.payload) {
              setOrderbooks(prev => ({ ...prev, [message.symbol!]: message.payload }));
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setStatus('degraded');
      setErrorMessage('WebSocket 연결 오류');
    };

    ws.onclose = (event) => {
      if (heartbeatPongTimeout) { clearTimeout(heartbeatPongTimeout); heartbeatPongTimeout = undefined; }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }

      // Stale socket — ignore
      if (wsRef.current !== ws && wsRef.current !== null) return;
      if (wsRef.current === ws) wsRef.current = null;

      if (event.code === 1000) {
        setStatus('offline');
        return;
      }

      if (!navigator.onLine) {
        setStatus('offline');
        setErrorMessage('네트워크 연결이 끊어졌습니다');
        return;
      }

      const currentRetry = retryCountRef.current;
      if (currentRetry < MAX_RETRIES) {
        const delay = getReconnectDelay(currentRetry);
        setStatus('connecting');
        setErrorMessage(`재연결 중... (${currentRetry + 1}/${MAX_RETRIES})`);
        setRetry(currentRetry + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setStatus('failed');
        setErrorMessage('재연결 실패: 최대 시도 횟수 초과');
      }
    };
  }, [getReconnectDelay, setStatus, setRetry]);
  // NOTE: connect does NOT depend on connectionStatus or retryCount

  const forceReconnect = useCallback(() => {
    setRetry(0);
    cleanup();
    connect();
  }, [cleanup, connect, setRetry]);

  // Network events — stable refs to avoid re-registration
  useEffect(() => {
    const handleOnline = () => { setRetry(0); connect(); };
    const handleOffline = () => { cleanup(); setStatus('offline'); setErrorMessage('네트워크 연결이 끊어졌습니다'); };
    const handleVisibilityChange = () => {
      if (!document.hidden && wsRef.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, cleanup, setStatus, setRetry]);

  // Main connection effect — runs only when symbols change (not on every connect re-render)
  const symbolsKey = symbols.join(',');
  useEffect(() => {
    if (symbols.length > 0 && navigator.onLine) {
      connect();
    }
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  // Update subscriptions without reconnecting when symbols change on an open socket
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", symbols, channels }));
    }
  }, [symbolsKey, channels.join(',')]);

  return {
    prices,
    orderbooks,
    connectionStatus,
    connected: connectionStatus === 'online',
    errorMessage,
    retryCount,
    forceReconnect,
  };
}
