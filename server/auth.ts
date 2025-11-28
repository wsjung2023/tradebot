import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import type { User } from '@shared/schema';
import type { Express } from 'express';

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string | number, done) => {
  try {
    // user.id is varchar (UUID), use it directly as string
    const userId = String(id);
    console.log(`[DESERIALIZE] Looking up user with ID: ${userId}`);
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[DESERIALIZE] ❌ User not found: ${userId}`);
      return done(null, false);
    }
    console.log(`[DESERIALIZE] ✅ User found: ${user.id} (${user.email})`);
    done(null, user);
  } catch (error) {
    console.error(`[DESERIALIZE] ❌ Error:`, error);
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

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// ==================== Google OAuth Strategy ====================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const baseURL = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS}` 
    : 'http://localhost:5000';
  
  const callbackURL = `${baseURL}/api/auth/google/callback`;
  
  console.log('[OAuth] Google OAuth Configuration:');
  console.log('  - Base URL:', baseURL);
  console.log('  - Callback URL:', callbackURL);
  console.log('  - Client ID (first 20 chars):', process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
      },
      async (accessToken: any, refreshToken: any, profile: any, done: any) => {
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
  const isAuth = req.isAuthenticated();
  const sessionData = req.session ? JSON.stringify({
    id: req.sessionID,
    passport: req.session.passport,
    cookie: req.session.cookie ? { 
      maxAge: req.session.cookie.maxAge,
      secure: req.session.cookie.secure 
    } : null
  }) : 'no session';
  
  // Log cookies for debugging
  const cookies = req.headers.cookie || 'no cookies';
  const origin = req.headers.origin || 'no origin';
  const referer = req.headers.referer || 'no referer';
  
  console.log(`[AUTH] ${req.method} ${req.path}`);
  console.log(`  - isAuthenticated: ${isAuth}`);
  console.log(`  - sessionID: ${req.sessionID}`);
  console.log(`  - user: ${req.user ? `${req.user.id} (${req.user.email})` : 'none'}`);
  console.log(`  - cookies: ${cookies.substring(0, 100)}...`);
  console.log(`  - origin: ${origin}, referer: ${referer}`);
  console.log(`  - session: ${sessionData}`);
  
  if (isAuth) {
    return next();
  }
  console.log(`[AUTH] ❌ 401 Unauthorized for ${req.method} ${req.path}`);
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
        console.log('[LOGIN] ❌ req.login() failed:', loginErr);
        return next(loginErr);
      }
      console.log('[LOGIN] ✅ Login succeeded');
      console.log(`  - sessionID: ${req.sessionID}`);
      console.log(`  - user.id: ${user.id}`);
      console.log(`  - session.passport: ${JSON.stringify(req.session?.passport)}`);
      
      // Explicitly save session before responding to ensure it's persisted
      req.session.save((saveErr: any) => {
        if (saveErr) {
          console.log('[LOGIN] ❌ session.save() failed:', saveErr);
          return next(saveErr);
        }
        console.log('[LOGIN] ✅ Session saved to database');
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
