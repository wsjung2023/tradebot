import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';
import type { Express } from 'express';

// ==================== Access Whitelist ====================
// Only these emails are allowed to use the app
const ALLOWED_EMAILS = ['mainstop3@gmail.com', 'test@test.com'];

function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string | number, done) => {
  try {
    const userId = String(id);
    const user = await storage.getUser(userId);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(null, false);
  }
});

// ==================== Local Strategy (Email/Password) ====================

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.password) {
          return done(null, false, { message: 'Please use social login' });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!isAllowedEmail(user.email)) {
          return done(null, false, { message: 'Access denied' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// ==================== Google OAuth Strategy ====================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // 상대경로 사용 + proxy:true → 요청이 들어온 도메인(ai-stockbot.net 또는 replit.app)
  // 을 자동으로 callback URL에 반영. 두 도메인 모두 Google Console에 등록 필요.
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        proxy: true,
      },
      async (accessToken: any, refreshToken: any, profile: any, done: any) => {
        try {
          const googleEmail = profile.emails?.[0]?.value || '';

          // Whitelist check — only allowed emails can log in
          if (!isAllowedEmail(googleEmail)) {
            return done(null, false, { message: 'Access denied' });
          }

          // Check if user exists with this Google ID
          let user = await storage.getUserByAuthProvider('google', profile.id);

          if (!user) {
            // Check if email already exists
            const emailUser = await storage.getUserByEmail(googleEmail);
            
            if (emailUser) {
              // Update existing user to link Google account
              user = await storage.updateUser(emailUser.id, {
                authProvider: 'google',
                authProviderId: profile.id,
                profileImage: profile.photos?.[0]?.value,
              });
            } else {
              // Create new user
              user = await storage.createUser({
                email: googleEmail,
                name: profile.displayName,
                profileImage: profile.photos?.[0]?.value,
                authProvider: 'google',
                authProviderId: profile.id,
                isEmailVerified: true,
              });

              // Create default settings
              await storage.createUserSettings({
                userId: user!.id,
                tradingMode: 'mock',
                riskLevel: 'medium',
                aiModel: 'gpt-5.1',
              });
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

// ==================== Kakao OAuth Strategy ====================
// Kakao OAuth removed per user request

// ==================== Naver OAuth Strategy ====================
// Note: Naver OAuth temporarily disabled - passport-naver-v2 integration needs configuration

// ==================== Helper Functions ====================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Middleware to get current user
export function getCurrentUser(req: any): User | undefined {
  return req.user;
}

// Setup authentication middleware - must be called after session middleware
export function setupAuth(app: Express) {
  app.use(passport.initialize());
  app.use(passport.session());
}

// Passport authentication middleware helpers for routes
export const localAuth = (req: any, res: any, next: any) => {
  return passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
    req.login(user, (loginErr: any) => {
      if (loginErr) {
        return next(loginErr);
      }
      req.session.save((saveErr: any) => {
        if (saveErr) {
          return next(saveErr);
        }
        // Sanitize user object - never leak password hash
        return res.json({ 
          user: { 
            id: user.id, 
            email: user.email, 
            name: user.name,
            profileImage: user.profileImage 
          } 
        });
      });
    });
  })(req, res, next);
};

export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });
export const googleCallback = passport.authenticate("google", { failureRedirect: "/login" });

export const kakaoAuth = passport.authenticate("kakao");
export const kakaoCallback = passport.authenticate("kakao", { failureRedirect: "/login" });

export const naverAuth = passport.authenticate("naver");
export const naverCallback = passport.authenticate("naver", { failureRedirect: "/login" });
