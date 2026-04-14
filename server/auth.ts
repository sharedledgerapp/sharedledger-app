
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AppleStrategy from "@nicokaiser/passport-apple";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, users } from "@shared/schema";
import { sendWelcomeEmail } from "./email";
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

async function findOrCreateOAuthUser(
  provider: "google" | "apple",
  providerId: string,
  email: string | undefined,
  displayName: string,
  profileImageUrl: string | null
): Promise<User> {
  const lookupFn = provider === "google"
    ? storage.getUserByGoogleId.bind(storage)
    : storage.getUserByAppleId.bind(storage);

  let user = await lookupFn(providerId);
  if (user) {
    if (email && !user.email) {
      const [updated] = await db
        .update(users)
        .set({ email })
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    }
    return user;
  }

  if (email) {
    user = await storage.getUserByUsername(email);
    if (user) {
      const providerField = provider === "google" ? "googleId" : "appleId";
      const updateFields: Record<string, unknown> = { [providerField]: providerId };
      if (!user.email) updateFields.email = email;
      const [updated] = await db
        .update(users)
        .set(updateFields)
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    }
  }

  const username = email || `${provider}_${providerId}`;
  const providerFields = provider === "google"
    ? { googleId: providerId }
    : { appleId: providerId };

  const newUser = await storage.createUser({
    username,
    password: null,
    name: displayName,
    role: "member",
    email: email ?? null,
    profileImageUrl,
    ...providerFields,
  });

  if (email) {
    sendWelcomeEmail(email, displayName).catch(() => {});
  }

  return newUser;
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
    // GOOGLE_CALLBACK_URL can be explicitly set in Replit Secrets to override
    // the auto-detected domain (useful when the production domain differs from
    // what REPLIT_DOMAINS reports).
    let googleCallbackURL: string;
    if (process.env.GOOGLE_CALLBACK_URL) {
      googleCallbackURL = process.env.GOOGLE_CALLBACK_URL;
    } else {
      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
      googleCallbackURL = replitDomain
        ? `https://${replitDomain}/api/auth/google/callback`
        : `/api/auth/google/callback`;
    }

    console.log(`[auth] Google OAuth callback URL: ${googleCallbackURL}`);

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: googleCallbackURL,
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            const displayName = profile.displayName || email || "User";
            const photo = profile.photos?.[0]?.value || null;
            const user = await findOrCreateOAuthUser("google", profile.id, email, displayName, photo);
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    const appleCallbackURL = replitDomain
      ? `https://${replitDomain}/api/auth/apple/callback`
      : `/api/auth/apple/callback`;

    passport.use(
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID,
          teamID: process.env.APPLE_TEAM_ID,
          keyID: process.env.APPLE_KEY_ID,
          privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          callbackURL: appleCallbackURL,
          passReqToCallback: false,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          idToken: { sub: string; email?: string },
          profile: { name?: { firstName?: string; lastName?: string } },
          done: (err: Error | null, user?: User | false) => void
        ) => {
          try {
            const appleId = idToken.sub;
            const email = idToken.email || undefined;
            const firstName = profile?.name?.firstName || "";
            const lastName = profile?.name?.lastName || "";
            const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || "Apple User";

            const existingUser = await storage.getUserByAppleId(appleId);
            if (existingUser) {
              return done(null, existingUser);
            }

            const user = await findOrCreateOAuthUser("apple", appleId, email, displayName, null);
            return done(null, user);
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
      if (!user.onboardingCompleted) {
        res.redirect("/onboarding");
      } else {
        res.redirect("/app");
      }
    }
  );

  app.get("/api/auth/apple", (req, res, next) => {
    if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
      return res.status(501).json({ message: "Apple sign-in is not yet configured. Please provide Apple Developer credentials." });
    }
    passport.authenticate("apple", { scope: ["email", "name"] })(req, res, next);
  });

  app.post("/api/auth/apple/callback",
    (req, res, next) => {
      passport.authenticate("apple", { failureRedirect: "/auth?error=apple_failed" })(req, res, next);
    },
    (req, res) => {
      const user = req.user as User;
      if (!user.onboardingCompleted) {
        res.redirect("/onboarding");
      } else {
        res.redirect("/app");
      }
    }
  );

  return { hashPassword };
}
