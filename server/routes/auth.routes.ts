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
      await storage.createUserSettings({ userId: user.id, tradingMode: "mock", riskLevel: "medium", aiModel: "gpt-5.1" });
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
    res.json({ user: { id: user!.id, email: user!.email, name: user!.name, profileImage: user!.profileImage } });
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
