import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { setupAuth } from "./auth";

// 전역 에러 핸들러
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[CRASH] Unhandled Rejection:', reason?.message || reason);
  process.exit(1);
});

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.set('trust proxy', 1);

const sessionSecret = process.env.SESSION_SECRET || 'kiwoom-ai-trading-secret-key-change-in-production';
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: false }));

// 프로덕션: PostgreSQL 세션 저장소
const PgSession = connectPgSimple(session);
const isReplit = !!process.env.REPLIT_DOMAINS;
const cookieSecure = isReplit || isProduction;

const sessionStore = isProduction
  ? new PgSession({
      pool,
      createTableIfMissing: false,
      tableName: 'session',
    })
  : undefined;

const sessionMiddleware = session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: false,
  name: 'connect.sid',
  proxy: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: cookieSecure,
    httpOnly: true,
    sameSite: 'lax',
  },
});

app.use(sessionMiddleware);
setupAuth(app);

// 경량 헬스체크 엔드포인트
app.get('/api/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

const port = parseInt(process.env.PORT || '5000', 10);
const httpServer = createServer(app);

// 프로덕션: process.cwd() 기반 경로 (import.meta.dirname 미사용)
function setupStaticServing() {
  const cwd = process.cwd();
  const publicDir = path.join(cwd, 'dist', 'public');
  const indexFile = path.join(publicDir, 'index.html');

  console.log(`[STATIC] cwd=${cwd}`);
  console.log(`[STATIC] publicDir=${publicDir} exists=${fs.existsSync(publicDir)}`);
  console.log(`[STATIC] indexFile exists=${fs.existsSync(indexFile)}`);

  if (!fs.existsSync(publicDir)) {
    console.error('[STATIC] FATAL: dist/public not found.');
    app.use('*', (_req, res) => {
      res.status(200).send('<html><body><h1>Build error: frontend not found</h1></body></html>');
    });
    return;
  }

  app.use(express.static(publicDir));

  const html = fs.readFileSync(indexFile, 'utf8');
  app.use('*', (_req, res) => {
    res.status(200).contentType('text/html').send(html);
  });

  console.log('[STATIC] Static serving configured ✓');
}

// 포트 열기
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  log(`serving on port ${port}`);
});

(async () => {
  try {
    console.log('[STARTUP] Registering routes...');
    await registerRoutes(app, httpServer, sessionMiddleware);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (res.headersSent) return;
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[ERROR]', status, message);
      res.status(status).json({ message });
    });

    if (!isProduction) {
      console.log('[STARTUP] Vite dev server...');
      await setupVite(app, httpServer);
    } else {
      console.log('[STARTUP] Static file serving...');
      setupStaticServing();
    }

    console.log('[STARTUP] Ready ✓');
  } catch (err: any) {
    console.error('[STARTUP] FATAL:', err.message, err.stack);
    process.exit(1);
  }
})();
