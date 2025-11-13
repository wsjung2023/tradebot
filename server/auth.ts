import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';
import type { Express } from 'express';

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
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

        if (!user.passwordHash) {
          return done(null, false, { message: 'Please use social login' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
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
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists with this Google ID
          let user = await storage.getUserByAuthProvider('google', profile.id);

          if (!user) {
            // Check if email already exists
            const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
            
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
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName,
                profileImage: profile.photos?.[0]?.value,
                authProvider: 'google',
                authProviderId: profile.id,
                isEmailVerified: true,
              });

              // Create default settings
              await storage.createUserSettings({
                userId: user!.id,
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

if (process.env.KAKAO_CLIENT_ID) {
  passport.use(
    new KakaoStrategy(
      {
        clientID: process.env.KAKAO_CLIENT_ID,
        callbackURL: '/api/auth/kakao/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await storage.getUserByAuthProvider('kakao', profile.id);

          if (!user) {
            const email = profile._json?.kakao_account?.email || `kakao_${profile.id}@placeholder.com`;
            const emailUser = await storage.getUserByEmail(email);

            if (emailUser) {
              user = await storage.updateUser(emailUser.id, {
                authProvider: 'kakao',
                authProviderId: profile.id,
                profileImage: profile._json?.kakao_account?.profile?.profile_image_url,
              });
            } else {
              user = await storage.createUser({
                email,
                name: profile.displayName || profile._json?.kakao_account?.profile?.nickname,
                profileImage: profile._json?.kakao_account?.profile?.profile_image_url,
                authProvider: 'kakao',
                authProviderId: profile.id,
                isEmailVerified: !!profile._json?.kakao_account?.email,
              });

              await storage.createUserSettings({
                userId: user!.id,
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
      if (loginErr) return next(loginErr);
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
  })(req, res, next);
};

export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });
export const googleCallback = passport.authenticate("google", { failureRedirect: "/login" });

export const kakaoAuth = passport.authenticate("kakao");
export const kakaoCallback = passport.authenticate("kakao", { failureRedirect: "/login" });

export const naverAuth = passport.authenticate("naver");
export const naverCallback = passport.authenticate("naver", { failureRedirect: "/login" });
