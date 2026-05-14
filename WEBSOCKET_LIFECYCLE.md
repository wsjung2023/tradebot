# WebSocket Lifecycle Documentation

## Current Implementation Analysis (WS-1 Audit)

### Client Hook: `use-market-stream.ts`

**Lifecycle States:**
1. **Initialization**
   - Creates WebSocket with auto-detected URL (ws:// or wss://)
   - Supports symbols[] and channels[] subscription
   
2. **Connection** (ws.onopen)
   - Sets connected=true
   - Sends subscribe message with symbols+channels
   - Starts heartbeat (ping every 30s)
   
3. **Message Handling** (ws.onmessage)
   - Parses JSON message
   - Updates React state: prices{}, orderbooks{}
   - Handles: "price", "orderbook", "pong"
   
4. **Error** (ws.onerror)
   - Console.error only
   - No state update
   - No user notification
   
5. **Disconnection** (ws.onclose)
   - Sets connected=false
   - Clears heartbeat interval
   - **Automatic reconnect after 3s**
   
6. **Cleanup** (useEffect cleanup)
   - Closes WebSocket
   - Clears reconnect timeout
   - Clears heartbeat interval

**Detected Gaps:**
- ❌ No exponential backoff (fixed 3s)
- ❌ No max retry limit (infinite reconnects)
- ❌ No offline detection (navigator.onLine)
- ❌ No visibility change handling (page hidden)
- ❌ No error classification (network vs protocol)
- ❌ No connection status granularity (only boolean)
- ❌ No graceful resubscribe on symbol changes
- ❌ No jitter in reconnect timing

### Server Hub: `market-data-hub.ts`

**Lifecycle:**
1. **Client Addition** (addClient)
   - Stores client with empty symbols/channels
   - Registers message, close, error handlers
   - Sends initial pong
   
2. **Subscription** (handleSubscribe)
   - Adds symbols to client set
   - Updates symbolSubscribers map
   - Sends initial snapshot (price + orderbook)
   
3. **Price Updates** (startPriceUpdates)
   - Interval: 1000ms (1s)
   - Fetches Kiwoom data for all subscribed symbols
   - Broadcasts to all subscribers
   
4. **Heartbeat** (ping/pong)
   - Client sends ping every 30s
   - Server responds with pong
   - **No validation of stale clients**
   
5. **Unsubscription** (handleUnsubscribe)
   - Removes symbols from client
   - Cleans up empty subscribers
   
6. **Cleanup** (removeClient)
   - Removes from all maps
   - No explicit ws.close()

**Detected Gaps:**
- ❌ No idle timeout (stale connections accumulate)
- ❌ No heartbeat validation (no disconnect on missed pings)
- ❌ No backpressure limits (slow clients block)
- ❌ No error event recovery
- ❌ No structured error logging
- ❌ No connection quality metrics

## Proposed Enhancements

### WS-2: Client Resilience
1. **Exponential Backoff with Jitter**
   ```typescript
   const delay = Math.min(1000 * (2 ** retries) + Math.random() * 1000, 30000);
   ```
   
2. **Max Retry Limit**
   - Max retries: 10
   - Then: show "Connection Failed" UI
   
3. **Offline Detection**
   ```typescript
   window.addEventListener('online', () => reconnect());
   window.addEventListener('offline', () => setStatus('offline'));
   ```
   
4. **Visibility Change**
   ```typescript
   document.addEventListener('visibilitychange', () => {
     if (!document.hidden) reconnect();
   });
   ```
   
5. **Connection Status Enum**
   - connecting, online, degraded, offline, failed
   
6. **Status Context Provider**
   - Global connection status
   - Reconnect button
   - Error messages

### WS-3: Server Hardening
1. **Heartbeat Enforcement**
   ```typescript
   // Track last pong timestamp per client
   // Disconnect clients without pong in 60s
   ```
   
2. **Idle Timeout**
   - Disconnect clients without messages in 5 minutes
   
3. **Backpressure Limits**
   - Max pending messages per client: 100
   - Drop messages if queue full
   
4. **Error Classification**
   ```typescript
   enum ErrorType {
     NETWORK, PROTOCOL, RATE_LIMIT, INTERNAL
   }
   ```
   
5. **Structured Logging**
   ```typescript
   logger.error('ws_error', { type, client_id, symbol, details });
   ```

## Success Criteria

### WS-2 Acceptance:
- [ ] Reconnect attempts increase exponentially
- [ ] Max 10 retries, then show error UI
- [ ] Offline status shown when navigator.onLine=false
- [ ] Reconnect triggered on tab focus/online event
- [ ] Connection status visible in UI
- [ ] All timers cleared on cleanup

### WS-3 Acceptance:
- [ ] Clients disconnected after 60s without pong
- [ ] Idle clients (5min no message) disconnected
- [ ] Simulated slow client doesn't block others
- [ ] Errors logged with structured data
- [ ] Memory usage stable under client churn
