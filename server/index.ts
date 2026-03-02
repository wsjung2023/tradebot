import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { appendFileSync, writeFileSync } from "fs";
import * as v8 from "v8";
import { Session } from "node:inspector";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { autoTradingWorker } from "./auto-trading-worker";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

const PgSession = ConnectPgSimple(session);

// Trust proxy for Replit environment (needed for rate limiting)
app.set('trust proxy', 1);

const sessionSecret = process.env.SESSION_SECRET || 'kiwoom-ai-trading-secret-key-change-in-production';

// Security Headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false, // Disable CSP in development for Vite HMR
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // IP당 최대 100 요청
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // IP당 최대 5회 로그인 시도
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session configuration
// In Replit, we're always on HTTPS so secure should be true
const isReplit = !!process.env.REPLIT_DOMAINS;
const isProduction = process.env.NODE_ENV === 'production';

// DIAGNOSTIC: Use MemoryStore to test if PgSession pool is causing OOM
// TODO: Restore PgSession after diagnosing memory issue
const cookieSecure = isReplit || isProduction;

const sessionMiddleware = session({
  // store: pgStore (DISABLED for OOM diagnosis),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  rolling: true,
  proxy: true, // Trust proxy for secure cookie detection in Replit
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: cookieSecure,
    httpOnly: true,
    sameSite: 'lax', // Standard CSRF protection, works for same-site requests
  },
});

app.use(sessionMiddleware);

// Setup Passport authentication
setupAuth(app);

// Diagnostic: count ALL requests and write directly to file (bypasses stdout buffering)
const DIAG_LOG = '/tmp/server-diag.log';
let totalReqs = 0;
try { appendFileSync(DIAG_LOG, `\n=== SERVER START ${new Date().toISOString()} ===\n`); } catch {}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  totalReqs++;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const line = `[REQ] ${req.method} ${path} ${res.statusCode} ${duration}ms total=${totalReqs}\n`;
    try { appendFileSync(DIAG_LOG, line); } catch {}
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app, sessionMiddleware);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // V8 heap sampling profiler - to identify what's consuming memory
    let profileCount = 0;
    let profilerSession: InstanceType<typeof Session> | null = null;
    try {
      profilerSession = new Session();
      profilerSession.connect();
      profilerSession.post('HeapProfiler.startSampling', { samplingInterval: 32768 }, (err) => {
        try { appendFileSync(DIAG_LOG, `[PROF] ${err ? 'start failed: ' + err.message : 'started (32KB intervals)'}\n`); } catch {}
      });
    } catch (e: any) {
      try { appendFileSync(DIAG_LOG, `[PROF-ERR] Session init: ${e?.message}\n`); } catch {}
    }

    // Write heap profile every 60 seconds
    setInterval(() => {
      if (!profilerSession) return;
      profilerSession.post('HeapProfiler.stopSampling', (err: Error | null, result: any) => {
        const profile = result?.profile;
        if (!err && profile) {
          profileCount++;
          const ppath = `/tmp/heap-profile-${profileCount}.json`;
          try {
            writeFileSync(ppath, JSON.stringify(profile));
            appendFileSync(DIAG_LOG, `[PROF] Profile #${profileCount} saved → ${ppath}\n`);
          } catch (we: any) {
            try { appendFileSync(DIAG_LOG, `[PROF-ERR] write: ${we?.message}\n`); } catch {}
          }
        }
        // Restart sampling for next interval
        if (profilerSession) {
          profilerSession.post('HeapProfiler.startSampling', { samplingInterval: 32768 }, () => {});
        }
      });
    }, 60000);

    // Memory monitoring - log every 5s to file (bypasses stdout/stderr buffering)
    let prevHeapMB = 0;
    const startTime = Date.now();
    setInterval(() => {
      try {
        const { heapUsed, heapTotal, rss, external } = process.memoryUsage();
        const heapMB = Math.round(heapUsed / 1024 / 1024);
        const totalMB = Math.round(heapTotal / 1024 / 1024);
        const rssMB = Math.round(rss / 1024 / 1024);
        const extMB = Math.round(external / 1024 / 1024);
        const deltaMB = heapMB - prevHeapMB;
        const elapsedS = Math.round((Date.now() - startTime) / 1000);
        prevHeapMB = heapMB;
        const spaces = v8.getHeapSpaceStatistics().map(s => `${s.space_name.replace('_space','').substring(0,3)}:${Math.round(s.space_used_size/1024/1024)}MB`).join(' ');
        const line = `[MEM t+${elapsedS}s] heap:${heapMB}/${totalMB}MB rss:${rssMB}MB ext:${extMB}MB delta:${deltaMB > 0 ? '+' : ''}${deltaMB}MB reqs:${totalReqs} | ${spaces}\n`;
        appendFileSync(DIAG_LOG, line);
      } catch (e: any) {
        try { appendFileSync(DIAG_LOG, `[MEM-ERR t+${Math.round((Date.now()-startTime)/1000)}s] ${e?.message || e}\n`); } catch {}
      }
    }, 5000);
    
    // Background jobs are OFF by default. Use /api/admin/jobs to enable.
    // autoTradingWorker.start();
    
    // Start data cleanup service (runs daily at 02:00)
    // dataCleanupService.start();
  });
})();
