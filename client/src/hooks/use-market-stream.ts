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
  const MAX_RETRIES = 10;
  const MAX_MISSED_PONGS = 3;

  const getReconnectDelay = useCallback((retries: number) => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    if (!navigator.onLine) {
      setConnectionStatus('offline');
      setErrorMessage('네트워크 연결이 없습니다');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (retryCount >= MAX_RETRIES) {
      setConnectionStatus('failed');
      setErrorMessage(`최대 재연결 횟수(${MAX_RETRIES})를 초과했습니다`);
      return;
    }

    cleanup();
    setConnectionStatus('connecting');
    setErrorMessage(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/ws/market`;
    
    const ws = new WebSocket(wsUrl);
    let heartbeatTimeout: NodeJS.Timeout;

    ws.onopen = () => {
      setConnectionStatus('online');
      setRetryCount(0);
      setErrorMessage(null);
      missedPongsRef.current = 0;
      
      if (symbols.length > 0) {
        ws.send(JSON.stringify({
          type: "subscribe",
          symbols,
          channels,
        }));
      }

      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          
          heartbeatTimeout = setTimeout(() => {
            missedPongsRef.current++;
            if (missedPongsRef.current >= MAX_MISSED_PONGS) {
              setConnectionStatus('degraded');
              setErrorMessage('서버 응답이 없습니다');
              ws.close();
            }
          }, 5000);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: MarketDataMessage = JSON.parse(event.data);

        if (message.type === "pong") {
          missedPongsRef.current = 0;
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          if (connectionStatus === 'degraded') {
            setConnectionStatus('online');
            setErrorMessage(null);
          }
          return;
        }

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
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        setErrorMessage('메시지 파싱 오류');
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus('degraded');
      setErrorMessage('WebSocket 연결 오류');
    };

    ws.onclose = (event) => {
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }

      if (event.code === 1000) {
        setConnectionStatus('offline');
        return;
      }

      if (!navigator.onLine) {
        setConnectionStatus('offline');
        setErrorMessage('네트워크 연결이 끊어졌습니다');
        return;
      }

      if (retryCount < MAX_RETRIES) {
        const delay = getReconnectDelay(retryCount);
        setConnectionStatus('connecting');
        setErrorMessage(`재연결 중... (${retryCount + 1}/${MAX_RETRIES})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          connect();
        }, delay);
      } else {
        setConnectionStatus('failed');
        setErrorMessage(`재연결 실패: 최대 시도 횟수 초과`);
      }
    };

    wsRef.current = ws;
  }, [symbols.join(','), channels.join(','), retryCount, connectionStatus, cleanup, getReconnectDelay]);

  const forceReconnect = useCallback(() => {
    setRetryCount(0);
    cleanup();
    connect();
  }, [cleanup, connect]);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('connecting');
      setRetryCount(0);
      connect();
    };

    const handleOffline = () => {
      cleanup();
      setConnectionStatus('offline');
      setErrorMessage('네트워크 연결이 끊어졌습니다');
    };

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
  }, [connect, cleanup]);

  useEffect(() => {
    if (symbols.length > 0 && navigator.onLine) {
      connect();
    }

    return cleanup;
  }, [connect, cleanup, symbols.length]);

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
    connectionStatus,
    connected: connectionStatus === 'online',
    errorMessage,
    retryCount,
    forceReconnect,
  };
}
