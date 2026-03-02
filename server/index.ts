import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

// 전역 에러 핸들러 — 배포 환경에서 silent crash 방지
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[CRASH] Unhandled Rejection:', reason?.message || reason, reason?.stack || '');
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

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
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
  max: 100,
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: false }));

const isReplit = !!process.env.REPLIT_DOMAINS;
const isProduction = process.env.NODE_ENV === 'production';
const cookieSecure = isReplit || isProduction;

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  rolling: true,
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

// 모든 요청 로깅 (배포 디버깅 포함)
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

// 프로덕션: index.html 미리 메모리에 로드
let cachedIndexHtml: string | null = null;
if (isProduction) {
  const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');
  console.log(`[STARTUP] Checking index.html at: ${indexPath}`);
  if (fs.existsSync(indexPath)) {
    cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
    console.log('[STARTUP] index.html cached in memory ✓');
  } else {
    console.error('[STARTUP] WARNING: index.html not found at', indexPath);
    console.error('[STARTUP] dist/public contents:', fs.existsSync(path.join(process.cwd(), 'dist', 'public'))
      ? fs.readdirSync(path.join(process.cwd(), 'dist', 'public'))
      : 'directory not found');
  }
}

// 포트를 즉시 열어 헬스체크 통과
httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  log(`serving on port ${port}`);
});

// 비동기 초기화
(async () => {
  try {
    console.log('[STARTUP] Registering API routes...');
    await registerRoutes(app, httpServer, sessionMiddleware);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    if (!isProduction) {
      console.log('[STARTUP] Setting up Vite dev server...');
      await setupVite(app, httpServer);
    } else {
      console.log('[STARTUP] Setting up static file serving...');
      serveStatic(app);
    }
    console.log('[STARTUP] Initialization complete ✓');
  } catch (err: any) {
    console.error('[STARTUP] FATAL initialization error:', err.message, err.stack);
    process.exit(1);
  }
})();
