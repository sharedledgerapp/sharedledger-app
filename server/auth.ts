
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const isProduction = app.get("env") === "production";

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r3pl1t_s3cr3t_k3y",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: isProduction,
      sameSite: "lax",
    },
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.password || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const callbackURL = replitDomain
      ? `https://${replitDomain}/api/auth/google/callback`
      : `/api/auth/google/callback`;

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL,
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            let user = await storage.getUserByGoogleId(profile.id);
            if (user) {
              return done(null, user);
            }

            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await storage.getUserByUsername(email);
              if (user) {
                const [updated] = await db
                  .update(users)
                  .set({ googleId: profile.id })
                  .where(eq(users.id, user.id))
                  .returning();
                return done(null, updated);
              }
            }

            const displayName = profile.displayName || email || "User";
            const username = email || `google_${profile.id}`;

            const newUser = await storage.createUser({
              username,
              password: null as any,
              name: displayName,
              role: "member",
              googleId: profile.id,
              profileImageUrl: profile.photos?.[0]?.value || null,
            } as any);

            return done(null, newUser);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.get("/api/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(501).json({ message: "Google sign-in is not configured" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback",
    (req, res, next) => {
      passport.authenticate("google", { failureRedirect: "/auth?error=google_failed" })(req, res, next);
    },
    (req, res) => {
      const user = req.user as User;
      if (!user.familyId) {
        res.redirect("/auth?setup=group");
      } else {
        res.redirect("/");
      }
    }
  );

  app.get("/api/auth/apple", (_req, res) => {
    return res.status(501).json({ message: "Apple sign-in is not yet configured. Please provide Apple Developer credentials." });
  });

  app.post("/api/auth/apple/callback", (_req, res) => {
    return res.status(501).json({ message: "Apple sign-in is not yet configured." });
  });

  return { hashPassword };
}
