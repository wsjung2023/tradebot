// auth.routes.ts — 사용자 인증 라우터 (회원가입/로그인/로그아웃/소셜로그인)
import type { Router } from "express";
import { storage } from "../storage";
import {
  isAuthenticated,
  getCurrentUser,
  hashPassword,
  localAuth,
  googleAuth,
  googleCallback,
  kakaoAuth,
  kakaoCallback,
  naverAuth,
  naverCallback,
} from "../auth";
import { insertUserSchema } from "@shared/schema";

export function registerAuthRoutes(app: Router) {
  // 이메일/비밀번호 회원가입
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      const hashedPassword = await hashPassword(password!);
      const user = await storage.createUser({ email, password: hashedPassword, name, authProvider: "local" });
      await storage.createUserSettings({ userId: user.id, tradingMode: "mock", riskLevel: "medium", aiModel: "gpt-5-mini" });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login failed" });
        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ error: "Session save failed" });
          res.json({ user: { id: user.id, email: user.email, name: user.name } });
        });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // 이메일/비밀번호 로그인
  app.post("/api/auth/login", localAuth);

  // 로그아웃
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // 현재 로그인 사용자 정보
  app.get("/api/auth/me", isAuthenticated, (req, res) => {
    const user = getCurrentUser(req);
    res.json({ user: { id: user!.id, email: user!.email, name: user!.name, profileImage: user!.profileImage, role: user!.role, onboardedAt: user!.onboardedAt } });
  });

  // 온보딩 완료 처리
  app.post("/api/auth/onboard", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      const updated = await storage.updateUser(user.id, { onboardedAt: new Date() });
      res.json({ ok: true, onboardedAt: updated?.onboardedAt });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 회원 탈퇴 — 사용자 데이터 전체 삭제 (PIPA 개인정보보호법)
  app.delete("/api/auth/account", isAuthenticated, async (req, res) => {
    try {
      const user = getCurrentUser(req)!;
      await storage.deleteUser(user.id);
      req.logout((err) => {
        if (err) console.error('[Auth] Logout after delete failed:', err);
        req.session.destroy(() => {
          res.json({ ok: true });
        });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 개발 전용 — 이메일로 바로 세션 생성 (NODE_ENV=development 에서만 동작)
  app.post("/api/auth/dev-login", async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(403).json({ error: "Dev only" });
    }
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Login failed" });
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: "Session save failed" });
        res.json({ user: { id: user.id, email: user.email, name: user.name } });
      });
    });
  });

  // Google OAuth
  app.get("/api/auth/google", googleAuth);
  app.get("/api/auth/google/callback", googleCallback, (_req, res) => res.redirect("/"));

  // Kakao OAuth
  app.get("/api/auth/kakao", kakaoAuth);
  app.get("/api/auth/kakao/callback", kakaoCallback, (_req, res) => res.redirect("/"));

  // Naver OAuth
  app.get("/api/auth/naver", naverAuth);
  app.get("/api/auth/naver/callback", naverCallback, (_req, res) => res.redirect("/"));
}
