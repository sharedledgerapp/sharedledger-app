
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}
import { insertUserSchema, families, oauthGroupSetupSchema, type User, type InsertRecurringExpense } from "@shared/schema";
import multer from "multer";
import passport from "passport";
import { db } from "./db";
import { GoogleGenAI } from "@google/genai";
import { startPushScheduler, sendPushToUser, markNotified, wasNotifiedSince } from "./push-scheduler";
import { sendFeedbackEmail, sendWelcomeEmail, sendPasswordResetEmail, sendWhatsNewEmail } from "./email";
import { scheduleWhatsNewEmail, cancelWhatsNewEmail, getWhatsNewStatus } from "./email-scheduler";
import rateLimit from "express-rate-limit";

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "test",
});

const receiptScanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many scan requests, please slow down." },
  skip: () => process.env.NODE_ENV === "test",
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

function sanitizeUser(user: any) {
  const { password, ...safe } = user;
  return safe;
}

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword } = setupAuth(app);

  // === POSTHOG REVERSE PROXY ===
  // Forwards /ingest/* to eu.i.posthog.com so ad-blockers can't intercept events
  app.all("/ingest/*", async (req: Request, res: Response) => {
    const suffix = req.path.slice("/ingest".length);
    const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const targetUrl = `https://eu.i.posthog.com${suffix}${queryString}`;

    try {
      const headers: Record<string, string> = {};
      if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"] as string;
      if (req.headers["user-agent"]) headers["user-agent"] = req.headers["user-agent"] as string;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        let bodyBuffer: Buffer | undefined;
        if (req.rawBody instanceof Buffer && req.rawBody.length > 0) {
          bodyBuffer = req.rawBody;
        } else if (typeof req.body === "string" && req.body.length > 0) {
          bodyBuffer = Buffer.from(req.body, "utf-8");
        } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
          bodyBuffer = Buffer.from(JSON.stringify(req.body), "utf-8");
          if (!headers["content-type"]) headers["content-type"] = "application/json";
        }
        if (bodyBuffer) {
          fetchOptions.body = bodyBuffer;
          headers["content-length"] = String(bodyBuffer.length);
        }
      }

      const upstream = await fetch(targetUrl, fetchOptions);
      const contentType = upstream.headers.get("content-type") || "";
      console.log(`[posthog-proxy] ${req.method} ${suffix} → ${upstream.status}`);
      res.status(upstream.status);
      if (contentType) res.setHeader("Content-Type", contentType);

      const buffer = await upstream.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("[posthog-proxy] error:", err);
      res.status(502).json({ message: "PostHog proxy error" });
    }
  });

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, authLimiter, async (req, res, next) => {
    try {
      const { familyCode, familyName, groupCode, groupName, groupType, ...userData } = api.auth.register.input.parse(req.body);

      if (!userData.password || userData.password.length < 1) {
        return res.status(400).json({ message: "Password is required" });
      }

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Normalise email — coerce empty string to null to avoid unique constraint issues
      if (userData.email !== undefined && userData.email !== null) {
        if (userData.email.trim() === "") {
          userData.email = null;
        } else {
          userData.email = userData.email.toLowerCase().trim();
          const emailTaken = await storage.getUserByEmail(userData.email);
          if (emailTaken) {
            return res.status(400).json({ message: "That email address is already linked to another account." });
          }
        }
      }

      let familyId: number;
      let role = userData.role;

      const inviteCode = groupCode || familyCode;
      const newGroupName = groupName || familyName;
      const newGroupType = groupType || "family";

      if (inviteCode) {
        const family = await storage.getFamilyByCode(inviteCode);
        if (!family) {
          return res.status(400).json({ message: "Invalid invite code. Please check and try again." });
        }
        if (family.groupType === "friends") {
          return res.status(400).json({ message: "This is a Friends group invite code. Use the Friends tab to join." });
        }
        familyId = family.id;
        if (family.groupType === "family") {
          role = "child";
        } else {
          role = "member";
        }
      } else if (newGroupName) {
        if (newGroupType === "family" && role !== 'parent' && role !== 'member') {
             return res.status(400).json({ message: "Only parents can create new family groups." });
        }
        const prefix = newGroupType === "family" ? "FAM" : newGroupType === "roommates" ? "GRP" : newGroupType === "friends" ? "FRD" : "CPL";
        const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        const family = await storage.createFamily({ name: newGroupName, code, groupType: newGroupType });
        familyId = family.id;
        if (newGroupType !== "family") {
          role = "member";
        }
      } else {
        const hashedPassword = await hashPassword(userData.password);
        const user = await storage.createUser({
          ...userData,
          password: hashedPassword,
          role: "member",
          familyId: null,
        });

        if (userData.username.includes("@")) {
          sendWelcomeEmail(userData.username, userData.name).catch(() => {});
        }

        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json(sanitizeUser(user));
        });
        return;
      }

      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        role,
        familyId
      });

      if (userData.username.includes("@")) {
        sendWelcomeEmail(userData.username, userData.name).catch(() => {});
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: err.errors[0].message });
        }
        next(err);
    }
  });

  app.post(api.auth.login.path, authLimiter, passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user));
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json();
    });
  });

  // POST /api/auth/forgot-password — send a password reset link
  app.post("/api/auth/forgot-password", authLimiter, async (req, res, next) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email.toLowerCase().trim());

      // Always respond 200 to avoid confirming whether an email exists
      if (!user || !user.email) {
        return res.status(200).json({ message: "If that email is on file, a reset link is on its way." });
      }
      if (!user.password) {
        // OAuth-only account — no password to reset
        return res.status(200).json({ message: "If that email is on file, a reset link is on its way." });
      }

      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.setPasswordResetToken(user.id, token, expiry);

      const resetUrl = `${process.env.APP_URL || "https://sharedledger.app"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

      res.status(200).json({ message: "If that email is on file, a reset link is on its way." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid email address." });
      next(err);
    }
  });

  // POST /api/auth/reset-password — set a new password using a valid token
  app.post("/api/auth/reset-password", authLimiter, async (req, res, next) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }).parse(req.body);

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.passwordResetExpiry) {
        return res.status(400).json({ message: "Invalid or expired reset link." });
      }
      if (user.passwordResetExpiry < new Date()) {
        await storage.clearPasswordResetToken(user.id);
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      const hashed = await hashPassword(password);
      await storage.updatePassword(user.id, hashed);
      await storage.clearPasswordResetToken(user.id);

      res.status(200).json({ message: "Password updated successfully. You can now sign in." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // Public: look up basic group info by invite code (used by /join landing page)
  app.get("/api/invite/lookup", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.toUpperCase().trim() : null;
    if (!code) return res.status(400).json({ message: "code is required" });
    try {
      const family = await storage.getFamilyByCode(code);
      if (!family) return res.status(404).json({ message: "Invite code not found" });
      res.json({ name: family.name, groupType: family.groupType, code: family.code });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    // Safety net for legacy users: if onboardingCompleted is still false but the user
    // was created before the onboarding feature rollout (2026-03-28), auto-complete it.
    // This covers both group users (familyId set) and solo users (no familyId) who
    // registered before this feature was introduced.
    const featureRolloutDate = new Date("2026-03-28T00:00:00Z");
    if (!user.onboardingCompleted && user.createdAt && user.createdAt < featureRolloutDate) {
      const updated = await storage.updateUser(user.id, { onboardingCompleted: true });
      return res.status(200).json(sanitizeUser(updated));
    }
    res.status(200).json(sanitizeUser(user));
  });

  app.post("/api/auth/setup-group", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.familyId) {
        return res.status(400).json({ message: "You are already in a group" });
      }

      const { groupCode, groupName, groupType } = oauthGroupSetupSchema.parse(req.body);
      let role = req.body.role || "member";

      let familyId: number;

      if (groupCode) {
        const family = await storage.getFamilyByCode(groupCode);
        if (!family) {
          return res.status(400).json({ message: "Invalid invite code. Please check and try again." });
        }
        if (family.groupType === "friends") {
          return res.status(400).json({ message: "This is a Friends group invite code. Use the Friends tab to join." });
        }
        familyId = family.id;
        if (family.groupType === "family") {
          role = "child";
        } else {
          role = "member";
        }
      } else if (groupName) {
        const newGroupType = groupType || "family";
        const prefix = newGroupType === "family" ? "FAM" : newGroupType === "roommates" ? "GRP" : newGroupType === "friends" ? "FRD" : "CPL";
        const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        const family = await storage.createFamily({ name: groupName, code, groupType: newGroupType });
        familyId = family.id;
        if (newGroupType === "family") {
          role = "parent";
        } else {
          role = "member";
        }
      } else {
        return res.status(400).json({ message: "Please provide an invite code or group name." });
      }

      const updated = await storage.updateUser(user.id, { familyId, role });
      const sanitized = sanitizeUser(updated);
      if (groupCode) {
        res.json(sanitized);
      } else {
        const createdFamily = await storage.getFamily(familyId);
        res.json({ ...sanitized, inviteCode: createdFamily?.code ?? null });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  // === USER PROFILE ROUTES ===

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    const user = req.user as any;
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email("Please enter a valid email address").optional().nullable(),
      profileImageUrl: z.string().url().optional().nullable(),
      language: z.enum(["en", "fr", "nl"]).optional(),
      currency: z.string().optional(),
      categories: z.array(z.string().min(1).max(30)).max(20).optional(),
      recurringCategories: z.array(z.string().min(1).max(30)).max(20).optional(),
      incomeSources: z.array(z.string().min(1).max(40)).max(10).optional(),
      dailyReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      dailyReminderEnabled: z.boolean().optional(),
      weeklyReminderEnabled: z.boolean().optional(),
      monthlyReminderEnabled: z.boolean().optional(),
      budgetAlertsEnabled: z.boolean().optional(),
      includeQuickGroupInSummary: z.boolean().optional(),
    });
    
    const updates = updateSchema.parse(req.body);
    const updated = await storage.updateUser(user.id, updates);
    res.json(updated);
  });

  app.post("/api/auth/complete-onboarding", requireAuth, async (req, res) => {
    const user = req.user as any;
    const updated = await storage.updateUser(user.id, { onboardingCompleted: true });
    res.json(sanitizeUser(updated));
  });

  // === DELETE ACCOUNT ===
  app.delete("/api/user/account", requireAuth, async (req, res) => {
    const user = req.user as any;
    try {
      await storage.deleteUser(user.id);
      req.logout((err) => {
        if (err) {
          console.error("Logout error after account deletion:", err);
        }
        res.status(200).json({ message: "Account deleted successfully" });
      });
    } catch (error) {
      console.error("Failed to delete account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // === LEAVE GROUP ===
  app.post("/api/group/leave", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) {
      return res.status(400).json({ message: "You are not in a group" });
    }
    await storage.updateUser(user.id, { familyId: null });
    res.json({ message: "You have left the group" });
  });

  // === RECEIPT OCR ROUTE ===

  const receiptScanCounts = new Map<number, { count: number; date: string }>();
  const RECEIPT_DAILY_LIMIT = 10;

  const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });

  app.post("/api/receipts/scan", requireAuth, receiptScanLimiter, upload.single('receipt'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No receipt image uploaded" });
      }

      const user = req.user as any;
      const today = new Date().toISOString().slice(0, 10);
      const record = receiptScanCounts.get(user.id);
      if (record && record.date === today && record.count >= RECEIPT_DAILY_LIMIT) {
        return res.status(429).json({ message: `Daily scan limit of ${RECEIPT_DAILY_LIMIT} reached. Try again tomorrow.` });
      }
      receiptScanCounts.set(user.id, {
        count: record && record.date === today ? record.count + 1 : 1,
        date: today,
      });

      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mimeType = req.file.mimetype;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          thinkingConfig: { thinkingBudget: 0 },
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: b64,
                },
              },
              {
                text: `Analyze this receipt image and extract the following information in JSON format:
{
  "amount": number (total amount, just the number),
  "category": string (one of: "Food", "Transport", "Entertainment", "Shopping", "Utilities", "Education", "Health", "Other"),
  "note": string (store name or description of purchase),
  "date": string (date in ISO format if visible, otherwise null),
  "items": array of {name: string, price: number} (individual line items if visible)
}

If any field cannot be determined, use null. Be precise with the total amount. Respond ONLY with valid JSON, no markdown.`,
              },
            ],
          },
        ],
      });

      const text = response.text || "";
      
      let extractedData;
      try {
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("Failed to parse OCR response:", text);
        return res.status(500).json({ 
          message: "Failed to parse receipt data", 
          rawText: text 
        });
      }

      const imageUrl = `data:${mimeType};base64,${b64}`;

      res.json({
        extracted: extractedData,
        imageUrl,
      });
    } catch (error) {
      console.error("Receipt scan error:", error);
      res.status(500).json({ message: "Failed to scan receipt" });
    }
  });

  // === CATEGORY ICON SUGGESTION ROUTE ===

  const ALLOWED_LUCIDE_ICONS = [
    "Home", "Car", "Plane", "Train", "Bus", "Bike", "ShoppingCart", "ShoppingBag",
    "Coffee", "Pizza", "Utensils", "Wine", "Music", "Film", "Gamepad", "Book",
    "GraduationCap", "Heart", "HeartPulse", "Stethoscope", "Pill", "Dumbbell",
    "TreePine", "Sun", "Moon", "Star", "Cloud", "Umbrella", "Flame", "Droplets",
    "Smartphone", "Laptop", "Tv", "Wifi", "Phone", "Mail", "Globe",
    "Dog", "Cat", "PawPrint", "Baby", "User", "Users", "Gift", "PartyPopper",
    "Briefcase", "Building", "Store", "Scissors", "Shirt", "Gem", "Watch",
    "Camera", "Palette", "Brush", "Wrench", "Hammer", "Leaf", "Flower", "Banana",
    "Apple", "Fuel", "CreditCard", "DollarSign", "Wallet", "TrendingUp",
    "Package", "Box", "Archive", "Truck", "Ship", "Rocket", "Map", "Compass",
  ];

  app.post("/api/suggest-category-icon", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        category: z.string().min(1).max(50),
        type: z.enum(["emoji", "icon"]),
      });
      const { category, type } = schema.parse(req.body);

      let prompt: string;
      if (type === "emoji") {
        prompt = `You are a JSON API. Given the expense category name "${category}", return a JSON object with a single "value" key containing exactly one relevant emoji character. Example: {"value":"🏋️"}. Respond ONLY with valid JSON, no markdown.`;
      } else {
        const iconList = ALLOWED_LUCIDE_ICONS.join(", ");
        prompt = `You are a JSON API. Given the expense category name "${category}", choose the single most relevant icon name from this list: ${iconList}. Return a JSON object with a single "value" key containing the icon name exactly as written. Example: {"value":"Dumbbell"}. Respond ONLY with valid JSON, no markdown.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const raw = (response.text || "").trim();
      let parsed: { value?: string };
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {};
      }

      if (type === "emoji") {
        const candidate = typeof parsed.value === "string" ? parsed.value.trim() : "";
        const chars = Array.from(candidate);
        const emoji = chars.find((ch: string) => (ch.codePointAt(0) ?? 0) > 127) || "💸";
        res.json({ value: emoji });
      } else {
        const candidate = typeof parsed.value === "string" ? parsed.value.trim() : "";
        const iconName = ALLOWED_LUCIDE_ICONS.find((n) => n.toLowerCase() === candidate.toLowerCase()) || "Package";
        res.json({ value: iconName });
      }
    } catch (error) {
      console.error("Icon suggestion error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to suggest icon" });
    }
  });

  // === SPENDING SUMMARY ROUTES ===

  app.get("/api/spending/summary", requireAuth, async (req, res) => {
    const user = req.user as any;
    const now = new Date();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [allExpenses, friendGroups] = await Promise.all([
      storage.getExpenses(user.id),
      storage.getFriendGroupsForUser(user.id),
    ]);

    // Build a lookup map for friend groups: groupId → group
    const friendGroupMap = new Map<number, typeof friendGroups[0]>(
      friendGroups.map(g => [g.id, g])
    );
    const userCurrency = (user.currency || "EUR") as string;

    // Safety net: look up currencies for orphaned expenses from groups the user has left.
    // These have a familyId but are no longer in the active friendGroupMap.
    const orphanedFamilyIds = [...new Set(
      allExpenses
        .filter(e => e.paymentSource === "personal" && e.familyId != null && !friendGroupMap.has(e.familyId!))
        .map(e => e.familyId as number)
    )];
    const orphanedGroupCurrencies = orphanedFamilyIds.length > 0
      ? await storage.getFriendGroupCurrenciesForIds(orphanedFamilyIds)
      : new Map<number, { currency: string; groupType: string }>();

    // Whether to include quick group (friend group) spending in personal summary.
    // Default is false (excluded) — users must explicitly opt in via Settings > Privacy.
    const includeQuickGroupInSummary = !!(user.includeQuickGroupInSummary);

    // Adjust personal expenses for friend group currency handling:
    // - If includeQuickGroupInSummary is false (default), all friend group expenses are excluded
    // - Cross-currency friend group expenses are always excluded (would corrupt totals)
    // - Same-currency friend group expenses: use the user's tracked split share if set,
    //   otherwise fall back to the full amount (user paid it solo / no split tracked)
    // - Orphaned expenses (from groups the user has left) get the same currency check via
    //   the orphanedGroupCurrencies safety net above
    let crossCurrencyGroupExpenseCount = 0;
    const personalExpenses = allExpenses
      .filter(e => e.paymentSource === "personal")
      .map(e => {
        if (e.familyId != null) {
          if (friendGroupMap.has(e.familyId)) {
            // Expense belongs to an active friend group
            if (!includeQuickGroupInSummary) {
              crossCurrencyGroupExpenseCount++;
              return null;
            }
            const group = friendGroupMap.get(e.familyId)!;
            const groupCurrency = (group.currency || "EUR") as string;
            if (groupCurrency !== userCurrency) {
              crossCurrencyGroupExpenseCount++;
              return null;
            }
            // Use the user's split share if one exists; otherwise count full amount
            const userSplit = (e.splits || []).find(s => s.userId === user.id);
            if (userSplit) {
              return { ...e, amount: userSplit.amount };
            }
            return e;
          } else {
            // familyId exists but is not in the active friend-group map.
            const orphanEntry = orphanedGroupCurrencies.get(e.familyId);
            if (orphanEntry === undefined) {
              // Group row no longer exists — exclude as safe default
              crossCurrencyGroupExpenseCount++;
              return null;
            }
            if (orphanEntry.groupType !== "friends") {
              // Non-friend group expense (family/couple/roommates) — include if same currency,
              // otherwise exclude to avoid corrupting the user-currency total
              if (orphanEntry.currency && orphanEntry.currency !== userCurrency) {
                crossCurrencyGroupExpenseCount++;
                return null;
              }
              return e;
            }
            // Orphaned friend group expense
            if (!includeQuickGroupInSummary) {
              crossCurrencyGroupExpenseCount++;
              return null;
            }
            // Apply currency exclusion
            if (orphanEntry.currency !== userCurrency) {
              crossCurrencyGroupExpenseCount++;
              return null;
            }
            // Same currency: apply split share if available, else full amount
            const userSplit = (e.splits || []).find(s => s.userId === user.id);
            if (userSplit) {
              return { ...e, amount: userSplit.amount };
            }
            return e;
          }
        }
        return e;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const currentMonthTotal = personalExpenses
      .filter(e => new Date(e.date) >= currentMonthStart && new Date(e.date) <= currentMonthEnd)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const prevMonthTotal = personalExpenses
      .filter(e => new Date(e.date) >= prevMonthStart && new Date(e.date) <= prevMonthEnd)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayTotal = personalExpenses
      .filter(e => new Date(e.date) >= todayStart && new Date(e.date) <= todayEnd)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    let percentageChange = 0;
    if (prevMonthTotal > 0) {
      percentageChange = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    }

    const allRecurring = await storage.getRecurringExpenses(user.id);
    const recurringMonthlyTotal = allRecurring
      .filter(r => r.isActive)
      .reduce((sum, r) => {
        const amount = Number(r.amount);
        switch (r.frequency) {
          case "yearly": return sum + amount / 12;
          case "quarterly": return sum + amount / 3;
          default: return sum + amount;
        }
      }, 0);

    const combinedMonthlyTotal = currentMonthTotal + recurringMonthlyTotal;

    const personalMonthlyIncomeTotal = await storage.getMonthlyIncomeTotal(user.id, currentMonthStart, currentMonthEnd);
    const incomeEntriesList = await storage.getIncomeEntries(user.id);

    // For family/couple groups, Money In = combined household shared income (all members' shared entries)
    // For personal-only users (or roommates), Money In = personal income only
    let monthlyIncomeTotal = personalMonthlyIncomeTotal;
    let hasIncomeEntries = incomeEntriesList.length > 0;
    if (user.familyId) {
      const family = await storage.getFamily(user.familyId);
      if (family && (family.groupType === "family" || family.groupType === "couple")) {
        const householdTotal = await storage.getFamilyMonthlyIncomeTotal(user.familyId, currentMonthStart, currentMonthEnd);
        monthlyIncomeTotal = householdTotal;
        // For group users, show income card if there are ANY household shared entries (not just personal)
        if (!hasIncomeEntries) {
          const householdEntries = await storage.getFamilyIncomeEntries(user.familyId);
          hasIncomeEntries = householdEntries.length > 0;
        }
      }
    }

    res.json({
      currentMonthTotal: currentMonthTotal.toFixed(2),
      prevMonthTotal: prevMonthTotal.toFixed(2),
      todayTotal: todayTotal.toFixed(2),
      percentageChange: percentageChange.toFixed(1),
      trend: currentMonthTotal >= prevMonthTotal ? "up" : "down",
      recurringMonthlyTotal: recurringMonthlyTotal.toFixed(2),
      combinedMonthlyTotal: combinedMonthlyTotal.toFixed(2),
      crossCurrencyGroupExpenseCount,
      monthlyIncomeTotal: monthlyIncomeTotal.toFixed(2),
      hasIncomeEntries,
    });
  });

  app.get("/api/spending/activity", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { view = "weekly", year, month, date } = req.query as {
      view?: "weekly" | "monthly";
      year?: string;
      month?: string;
      date?: string;
    };

    let anchor: Date;
    if (date) {
      anchor = new Date(date);
      if (isNaN(anchor.getTime())) anchor = new Date();
    } else if (year && month) {
      anchor = new Date(Number(year), Number(month) - 1, 15);
    } else {
      anchor = new Date();
    }

    const allExpenses = await storage.getExpenses(user.id);

    // Build a currency map so cross-currency group expenses are excluded from the totals
    const friendGroupsList = await storage.getFriendGroupsForUser(user.id);
    const fgCurrencyMap = new Map<number, string>(
      friendGroupsList.map(g => [g.id, g.currency || "EUR"])
    );
    let establishedFamilyCurrency: string | null = null;
    if (user.familyId) {
      const fam = await storage.getFamily(user.familyId);
      if (fam) establishedFamilyCurrency = fam.currency || null;
    }
    const activityUserCurrency = user.currency || "EUR";

    const personalExpenses = allExpenses.filter(e => {
      if (e.paymentSource !== "personal") return false;
      const expFamilyId = (e as any).familyId as number | null | undefined;
      if (expFamilyId != null) {
        const groupCurrency = fgCurrencyMap.get(expFamilyId)
          ?? (expFamilyId === user.familyId ? establishedFamilyCurrency : null);
        if (groupCurrency && groupCurrency !== activityUserCurrency) return false;
      }
      return true;
    });

    if (view === "weekly") {
      const dayOfWeek = anchor.getDay();
      const weekStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(weekStart);
        dayStart.setDate(weekStart.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayTotal = personalExpenses
          .filter(e => {
            const d = new Date(e.date);
            return d >= dayStart && d <= dayEnd;
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);

        days.push({
          label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
          date: dayStart.toISOString().split("T")[0],
          total: Number(dayTotal.toFixed(2)),
        });
      }

      res.json({
        view: "weekly",
        periodLabel: `${days[0].date} – ${days[6].date}`,
        data: days,
      });
    } else {
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);

      const weeks: { label: string; weekStart: string; weekEnd: string; total: number }[] = [];
      let weekNum = 1;
      let currentDay = new Date(monthStart);

      while (currentDay <= monthEnd) {
        const wkStart = new Date(currentDay);
        let wkEnd: Date;
        const daysUntilSat = 6 - currentDay.getDay();
        const potentialEnd = new Date(currentDay);
        potentialEnd.setDate(currentDay.getDate() + daysUntilSat);

        if (potentialEnd > monthEnd) {
          wkEnd = new Date(monthEnd);
        } else {
          wkEnd = potentialEnd;
        }
        wkEnd.setHours(23, 59, 59, 999);

        const weekTotal = personalExpenses
          .filter(e => {
            const d = new Date(e.date);
            return d >= wkStart && d <= wkEnd;
          })
          .reduce((sum, e) => sum + Number(e.amount), 0);

        weeks.push({
          label: `W${weekNum}`,
          weekStart: wkStart.toISOString().split("T")[0],
          weekEnd: wkEnd.toISOString().split("T")[0],
          total: Number(weekTotal.toFixed(2)),
        });

        weekNum++;
        currentDay = new Date(wkEnd);
        currentDay.setDate(currentDay.getDate() + 1);
        currentDay.setHours(0, 0, 0, 0);
      }

      res.json({
        view: "monthly",
        periodLabel: `${anchor.toLocaleString("en", { month: "long" })} ${anchor.getFullYear()}`,
        data: weeks,
      });
    }
  });

  // === GROUP DASHBOARD ROUTE ===

  app.get("/api/family/dashboard", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(404).json({ message: "No group" });

    const { period = "month", startDate, endDate } = req.query as {
      period?: "month" | "week";
      startDate?: string;
      endDate?: string;
    };

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      if (period === "week") {
        const dayOfWeek = now.getUTCDay();
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 6, 23, 59, 59, 999));
      } else {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      }
    }

    const [family, members, sharedGoals] = await Promise.all([
      storage.getFamily(user.familyId),
      storage.getFamilyMembers(user.familyId),
      storage.getSharedGoals(user.familyId),
    ]);

    // Guard: do not aggregate friend/quick groups in the established family dashboard
    if (!family || family.groupType === "friends") {
      return res.status(404).json({ message: "No established group" });
    }

    const sharedExpenses = await storage.getSharedExpenses(user.familyId, start, end);

    const totalSpent = sharedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const expenseCount = sharedExpenses.length;

    const categoryBreakdown = sharedExpenses.reduce((acc, e) => {
      const existing = acc.find((c: any) => c.category === e.category);
      if (existing) {
        existing.amount += Number(e.amount);
        existing.count += 1;
      } else {
        acc.push({ category: e.category, amount: Number(e.amount), count: 1 });
      }
      return acc;
    }, [] as { category: string; amount: number; count: number }[]);

    const familyMoney = sharedExpenses
      .filter(e => e.paymentSource === "family")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const personalMoney = sharedExpenses
      .filter(e => e.paymentSource === "personal")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const balances = await storage.getGroupBalances(user.familyId, { members });

    const memberExpensesMap: Record<number, { id: number; amount: string | number; category: string; note: string | null; date: string | Date; paymentSource: string }[]> = {};
    const memberSpending = members.map(member => {
      const memberExpenses = sharedExpenses.filter(e => {
        const spenderId = e.paidByUserId != null ? e.paidByUserId : e.userId;
        return spenderId === member.id;
      });
      memberExpensesMap[member.id] = memberExpenses.map(e => ({
        id: e.id,
        amount: e.amount,
        category: e.category,
        note: e.note,
        date: e.date,
        paymentSource: e.paymentSource,
      }));
      const memberTotal = memberExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        id: member.id,
        name: member.name,
        role: member.role,
        total: memberTotal.toFixed(2),
        expenseCount: memberExpenses.length,
        isPrivate: false,
      };
    });

    const recentExpenses = sharedExpenses.slice(0, 10).map(e => {
      const payerId = e.paidByUserId ?? e.userId;
      const payer = members.find(m => m.id === payerId);
      return {
        id: e.id,
        amount: e.amount,
        category: e.category,
        note: e.note,
        date: e.date,
        paymentSource: e.paymentSource,
        paidByName: payer?.name || "Unknown",
      };
    });

    let coupleData: { contributions?: any; milestones?: any } = {};
    if (family?.groupType === "couple") {
      const allTimeShared = await storage.getSharedExpenses(user.familyId);
      const allTimeTotal = allTimeShared.reduce((sum, e) => sum + Number(e.amount), 0);

      const contributions = members.map(member => {
        const memberTotal = allTimeShared
          .filter(e => (e.paidByUserId ?? e.userId) === member.id)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        return { id: member.id, name: member.name, total: memberTotal.toFixed(2) };
      });
      const sortedContribs = [...contributions].sort((a, b) => Number(b.total) - Number(a.total));
      const difference = contributions.length === 2
        ? Math.abs(Number(contributions[0].total) - Number(contributions[1].total)).toFixed(2)
        : "0.00";

      const hasFood = allTimeShared.some(e => e.category === "Food");
      const groupAgeDays = family?.createdAt
        ? Math.floor((Date.now() - new Date(family.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const milestones = [
        { key: "first_shared_expense", label: "First shared expense", achieved: allTimeShared.length > 0 },
        { key: "first_grocery_together", label: "First grocery purchase together", achieved: hasFood },
        { key: "first_month_tracking", label: "First month tracking together", achieved: groupAgeDays >= 30 },
        { key: "first_500_shared", label: "First \u20AC500 in shared expenses", achieved: allTimeTotal >= 500 },
      ];

      coupleData = {
        contributions: { partners: sortedContribs, difference },
        milestones,
      };
    }

    res.json({
      period: {
        type: period,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalSpent: totalSpent.toFixed(2),
        expenseCount,
        memberCount: members.length,
        familyName: family?.name,
        groupType: family?.groupType,
        currency: family?.currency || "EUR",
      },
      memberSpending,
      categoryBreakdown: categoryBreakdown.map(c => ({
        ...c,
        amount: c.amount.toFixed(2),
        percentage: totalSpent > 0 ? ((c.amount / totalSpent) * 100).toFixed(1) : "0",
      })),
      moneySourceSplit: {
        familyMoney: familyMoney.toFixed(2),
        personalMoney: personalMoney.toFixed(2),
        familyPercentage: totalSpent > 0 ? ((familyMoney / totalSpent) * 100).toFixed(1) : "0",
        personalPercentage: totalSpent > 0 ? ((personalMoney / totalSpent) * 100).toFixed(1) : "0",
      },
      sharedGoals: sharedGoals.filter(g => (g.visibility === "family" && g.isApproved) || g.visibility === "shared").map(g => ({
        id: g.id,
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        priority: g.priority,
        deadline: g.deadline,
      })),
      recentExpenses,
      memberExpenses: memberExpensesMap,
      balances,
      ...coupleData,
    });
  });

  // === GROUP ROUTES ===

  app.get("/api/friend-groups/currencies", requireAuth, async (req, res) => {
    const user = req.user as any;
    const requestedIds = ((req.query.ids as string) || "")
      .split(",")
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
    if (requestedIds.length === 0) return res.json({});
    // Only return info for groups the caller has access to via membership or expenses
    const userFriendGroups = await storage.getFriendGroupsForUser(user.id);
    const memberGroupIds = new Set(userFriendGroups.map(g => g.id));
    // Also allow orphaned familyIds from user's own expenses (past groups)
    const userExpenses = await storage.getExpenses(user.id);
    const userExpenseFamilyIds = new Set(
      userExpenses.map(e => (e as any).familyId).filter(Boolean)
    );
    const authorizedIds = requestedIds.filter(
      id => memberGroupIds.has(id) || userExpenseFamilyIds.has(id)
    );
    if (authorizedIds.length === 0) return res.json({});
    const map = await storage.getFriendGroupCurrenciesForIds(authorizedIds);
    const result: Record<number, { currency: string; groupType: string }> = {};
    map.forEach((val, key) => { result[key] = val; });
    res.json(result);
  });

  app.get("/api/group/balances", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(404).json({ message: "No group" });
    const balances = await storage.getGroupBalances(user.familyId);
    res.json(balances);
  });

  app.patch("/api/family/members/:id/role", requireAuth, async (req, res) => {
    const user = req.user as any;
    
    if (user.role !== 'parent') {
      return res.status(403).json({ message: "Only admins can change member roles" });
    }
    
    if (!user.familyId) {
      return res.status(400).json({ message: "You must be in a group" });
    }
    
    const memberId = parseInt(req.params.id);
    const { role } = z.object({ role: z.enum(["parent", "child", "member"]) }).parse(req.body);
    
    if (memberId === user.id) {
      return res.status(400).json({ message: "You cannot change your own role" });
    }
    
    const member = await storage.getUser(memberId);
    if (!member || member.familyId !== user.familyId) {
      return res.status(404).json({ message: "Member not found in your group" });
    }

    const family = await storage.getFamily(user.familyId);
    if (family && family.groupType !== "family" && (role === "parent" || role === "child")) {
      return res.status(400).json({ message: "Parent/child roles are only available for family groups" });
    }
    
    if (role === 'parent') {
      const familyMembers = await storage.getFamilyMembers(user.familyId);
      const parentCount = familyMembers.filter(m => m.role === 'parent').length;
      if (parentCount >= 2) {
        return res.status(400).json({ message: "Maximum of 2 admins per group" });
      }
    }
    
    const updated = await storage.updateUser(memberId, { role });
    res.json({ id: updated.id, name: updated.name, role: updated.role });
  });

  const familyGetHandler = async (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(404).json({ message: "No group" });

    const family = await storage.getFamily(user.familyId);
    const members = await storage.getFamilyMembers(user.familyId);
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const memberSummaries = await Promise.all(members.map(async (member) => {
      if (!member.shareTotalsConsent) {
        return {
          id: member.id,
          name: member.name,
          role: member.role,
          total: null,
          isPrivate: true
        };
      }

      const memberExpenses = await storage.getExpenses(member.id, user.familyId);
      const monthlyTotal = memberExpenses
        .filter(e => new Date(e.date) >= startOfMonth)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        total: monthlyTotal.toFixed(2),
        isPrivate: false
      };
    }));
    
    res.json({ family, members: memberSummaries });
  };

  app.get(api.family.get.path, requireAuth, familyGetHandler);
  app.get(api.group.get.path, requireAuth, familyGetHandler);

  // === SETTLEMENT ROUTES ===

  app.get("/api/settlements", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const groupSettlements = await storage.getSettlements(user.familyId);
    res.json(groupSettlements);
  });

  app.post("/api/settlements", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    
    const schema = z.object({
      toUserId: z.number(),
      amount: z.string().or(z.number()).transform(v => String(v)),
      note: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);

    const toUser = await storage.getUser(data.toUserId);
    if (!toUser || toUser.familyId !== user.familyId) {
      return res.status(400).json({ message: "User not in your group" });
    }

    const settlement = await storage.createSettlement({
      fromUserId: user.id,
      toUserId: data.toUserId,
      groupId: user.familyId,
      amount: data.amount,
      note: data.note || null,
    });
    res.status(201).json(settlement);
  });

  // === INCOME ROUTES ===

  app.get("/api/income", requireAuth, async (req, res) => {
    const user = req.user as any;
    const entries = await storage.getIncomeEntries(user.id);
    res.json(entries);
  });

  app.post("/api/income", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const body = req.body;
      if (typeof body.date === "string") {
        body.date = new Date(body.date);
      }
      const schema = z.object({
        amount: z.string().or(z.number()).transform(v => String(v)),
        source: z.enum(["Family / Parents", "Work", "Gift or Unexpected", "Scholarship or Grant", "Other"]),
        note: z.string().optional().nullable(),
        date: z.date().optional(),
        isRecurring: z.boolean().optional().default(false),
        recurringInterval: z.enum(["weekly", "monthly", "tri-monthly"]).optional().nullable(),
        shareDetails: z.boolean().nullable().optional(),
        reminderEnabled: z.boolean().optional().default(false),
        reminderDaysBefore: z.number().int().min(1).max(7).optional().default(3),
      });
      const data = schema.parse(body);
      // null = not shared; false = total only; true = full details
      // Only family/couple groups may share income; roommates/friends excluded
      const shareDetails = data.shareDetails ?? null;
      let isShared = false;
      if (shareDetails !== null && user.familyId) {
        const userFamily = await storage.getFamily(user.familyId);
        isShared = !!(userFamily && (userFamily.groupType === "family" || userFamily.groupType === "couple"));
      }
      const entry = await storage.createIncomeEntry({
        ...data,
        userId: user.id,
        familyId: isShared ? user.familyId : null,
        date: data.date || new Date(),
        isRecurring: data.isRecurring ?? false,
        recurringInterval: data.recurringInterval || null,
        shareDetails: isShared ? shareDetails : null,
      });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  app.patch("/api/income/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      const entries = await storage.getIncomeEntries(user.id);
      const existing = entries.find(e => e.id === id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.userId !== user.id) return res.status(403).json({ message: "Forbidden" });

      const body = req.body;
      if (typeof body.date === "string") {
        body.date = new Date(body.date);
      }
      const schema = z.object({
        amount: z.string().or(z.number()).transform(v => String(v)).optional(),
        source: z.enum(["Family / Parents", "Work", "Gift or Unexpected", "Scholarship or Grant", "Other"]).optional(),
        note: z.string().optional().nullable(),
        date: z.date().optional(),
        isRecurring: z.boolean().optional(),
        recurringInterval: z.enum(["weekly", "monthly", "tri-monthly"]).optional().nullable(),
        shareDetails: z.boolean().nullable().optional(),
        reminderEnabled: z.boolean().optional(),
        reminderDaysBefore: z.number().int().min(1).max(7).optional(),
      });
      const updates = schema.parse(body);
      // Determine shareDetails: use provided value or fall back to existing
      const shareDetails = "shareDetails" in updates ? updates.shareDetails : existing.shareDetails;
      // null = not shared; false = total only; true = full details
      // Only family/couple groups may share income; roommates/friends excluded
      let isShared = false;
      if (shareDetails !== null && shareDetails !== undefined && user.familyId) {
        const userFamily = await storage.getFamily(user.familyId);
        isShared = !!(userFamily && (userFamily.groupType === "family" || userFamily.groupType === "couple"));
      }
      const familyId = isShared ? user.familyId : null;
      const updated = await storage.updateIncomeEntry(id, { ...updates, familyId, shareDetails: isShared ? (shareDetails ?? null) : null });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  app.delete("/api/income/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const entries = await storage.getIncomeEntries(user.id);
    const existing = entries.find(e => e.id === id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteIncomeEntry(id);
    res.status(204).send();
  });

  app.get("/api/family/income", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "No group" });
    const family = await storage.getFamily(user.familyId);
    if (!family || (family.groupType !== "family" && family.groupType !== "couple")) {
      return res.status(400).json({ message: "Household income only available for family and couple groups" });
    }
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const entries = await storage.getFamilyIncomeEntries(user.familyId, start, end);
    res.json(entries);
  });

  // === EXPENSES ROUTES ===

  app.get(api.expenses.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const query = api.expenses.list.input?.parse(req.query);
    const targetUserId = query?.userId || user.id;
    
    if (targetUserId !== user.id) {
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.familyId !== user.familyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const userExpenses = await storage.getExpenses(targetUserId, user.familyId);
      return res.json(userExpenses.filter(e => e.visibility === "public"));
    }

    const filtered = await storage.getExpenses(user.id);
    res.json(filtered);
  });

  app.post(api.expenses.create.path, requireAuth, async (req, res, next) => {
    try {
        const user = req.user as any;
        const body = req.body;
        
        if (typeof body.date === 'string') {
          body.date = new Date(body.date);
        }

        const { splits, ...expenseInput } = api.expenses.create.input.parse(body);
        
        if (splits && splits.length > 0 && expenseInput.amount) {
          const totalAmount = parseFloat(String(expenseInput.amount));
          if (expenseInput.splitType === 'percentage') {
            const totalPct = splits.reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);
            if (Math.abs(totalPct - 100) > 0.01) {
              return res.status(400).json({ message: "Split percentages must add up to 100%" });
            }
          } else if (expenseInput.splitType === 'custom') {
            const totalSplit = splits.reduce((sum: number, s: any) => sum + parseFloat(String(s.amount || 0)), 0);
            if (Math.abs(totalSplit - totalAmount) > 0.01) {
              return res.status(400).json({ message: "Split amounts must add up to the total expense amount" });
            }
          }
        }

        const expense = await storage.createExpense({
          ...expenseInput,
          userId: user.id,
          familyId: user.familyId,
          paidByUserId: expenseInput.paidByUserId || user.id,
        }, splits);
        res.status(201).json(expense);
    } catch (err) {
        if (err instanceof z.ZodError) {
             return res.status(400).json({ message: err.errors[0].message });
        }
        next(err);
    }
  });

  app.delete(api.expenses.delete.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const expense = await storage.getExpense(id);

    if (!expense) return res.status(404).json({ message: "Not found" });
    if (expense.userId !== user.id) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteExpense(id);
    res.status(204).send();
  });

  app.patch("/api/expenses/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const id = parseInt(req.params.id);
      const expense = await storage.getExpense(id);

      if (!expense) return res.status(404).json({ message: "Not found" });
      if (expense.userId !== user.id) return res.status(403).json({ message: "Forbidden" });

      const body = req.body;
      if (typeof body.date === 'string') {
        body.date = new Date(body.date);
      }

      const { splits, ...expenseUpdates } = api.expenses.update.input.parse(body);
      
      if (splits && splits.length > 0 && expenseUpdates.amount) {
        const totalAmount = parseFloat(String(expenseUpdates.amount));
        if (expenseUpdates.splitType === 'percentage') {
          const totalPct = splits.reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);
          if (Math.abs(totalPct - 100) > 0.01) {
            return res.status(400).json({ message: "Split percentages must add up to 100%" });
          }
        } else if (expenseUpdates.splitType === 'custom') {
          const totalSplit = splits.reduce((sum: number, s: any) => sum + parseFloat(String(s.amount || 0)), 0);
          if (Math.abs(totalSplit - totalAmount) > 0.01) {
            return res.status(400).json({ message: "Split amounts must add up to the total expense amount" });
          }
        }
      }

      const updated = await storage.updateExpense(id, expenseUpdates, splits);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      next(err);
    }
  });

  app.patch("/api/expenses/splits/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { isPaid } = z.object({ isPaid: z.boolean() }).parse(req.body);
    const updated = await storage.updateSplitPayment(id, isPaid);
    res.json(updated);
  });

  // === RECURRING EXPENSES ROUTES ===

  app.get("/api/recurring-expenses", requireAuth, async (req, res) => {
    const user = req.user as any;
    const expenses = await storage.getRecurringExpenses(user.id);
    res.json(expenses);
  });

  app.post("/api/recurring-expenses", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1).max(100),
      amount: z.string().or(z.number()).transform(v => String(v)),
      category: z.string().min(1).max(50),
      frequency: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
      note: z.string().max(500).optional().nullable(),
      isActive: z.boolean().default(true),
      isGroupShared: z.boolean().optional().default(false),
      dueDay: z.number().int().min(1).max(28).optional().nullable(),
      reminderEnabled: z.boolean().optional().default(false),
      reminderDaysBefore: z.number().int().min(1).max(7).optional().default(3),
    });
    const data = schema.parse(req.body);
    if (data.isGroupShared && !user.familyId) {
      return res.status(400).json({ message: "You must be in a group to share a recurring expense" });
    }
    const expense = await storage.createRecurringExpense({
      ...data,
      userId: user.id,
      familyId: user.familyId,
    });
    res.status(201).json(expense);

    // When creating as group-shared, notify all other group members (fire-and-forget)
    if (data.isGroupShared && user.familyId && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        const familyMembers = await storage.getFamilyMembers(user.familyId);
        const ownerName = user.name ?? "A member";
        const freqLabel = expense.frequency === "yearly" ? "year" : expense.frequency === "quarterly" ? "quarter" : "month";

        for (const member of familyMembers) {
          if (member.id === user.id) continue;
          try {
            const notifKey = `group_recurring_shared_${expense.id}`;
            if (await wasNotifiedSince(member.id, notifKey, new Date(0))) continue;
            const sent = await sendPushToUser(member.id, {
              title: "New shared expense",
              body: `${ownerName} shared ${expense.name} (${expense.amount}/${freqLabel}) with the group.`,
              tag: `group-shared-${expense.id}`,
              url: "/expenses?view=recurring",
            });
            if (sent) await markNotified(member.id, notifKey);
          } catch (memberErr) {
            console.error(`[Push] group shared expense notification failed for member ${member.id}:`, memberErr);
          }
        }
      } catch (err) {
        console.error(`[Push] group shared expense notification failed for expense ${expense.id}:`, err);
      }
    }
  });

  app.patch("/api/recurring-expenses/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getRecurringExpense(id);
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ message: "Recurring expense not found" });
    }
    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      amount: z.string().or(z.number()).transform(v => String(v)).optional(),
      category: z.string().min(1).max(50).optional(),
      frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
      note: z.string().max(500).optional().nullable(),
      isActive: z.boolean().optional(),
      isGroupShared: z.boolean().optional(),
      dueDay: z.number().int().min(1).max(28).optional().nullable(),
      reminderEnabled: z.boolean().optional(),
      reminderDaysBefore: z.number().int().min(1).max(7).optional(),
    });
    const parsed = schema.parse(req.body);
    // When sharing with group, ensure familyId is stamped server-side
    if (parsed.isGroupShared === true) {
      if (!user.familyId) {
        return res.status(400).json({ message: "You must be in a group to share a recurring expense" });
      }
    }
    const updates: Partial<InsertRecurringExpense> = {
      ...parsed,
      ...(parsed.isGroupShared === true ? { familyId: user.familyId } : {}),
    };
    const updated = await storage.updateRecurringExpense(id, updates);
    res.json(updated);

    // When isGroupShared flips false → true, notify all other group members (fire-and-forget)
    if (parsed.isGroupShared === true && !existing.isGroupShared && user.familyId && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        const familyMembers = await storage.getFamilyMembers(user.familyId);
        const expenseName = parsed.name ?? existing.name;
        const expenseAmount = parsed.amount ?? existing.amount;
        const expenseFreq = parsed.frequency ?? existing.frequency;
        const freqLabel = expenseFreq === "yearly" ? "year" : expenseFreq === "quarterly" ? "quarter" : "month";
        const ownerName = user.name ?? "A member";

        for (const member of familyMembers) {
          if (member.id === user.id) continue;
          try {
            const notifKey = `group_recurring_shared_${id}`;
            if (await wasNotifiedSince(member.id, notifKey, new Date(0))) continue;
            const sent = await sendPushToUser(member.id, {
              title: "New shared expense",
              body: `${ownerName} shared ${expenseName} (${expenseAmount}/${freqLabel}) with the group.`,
              tag: `group-shared-${id}`,
              url: "/expenses?view=recurring",
            });
            if (sent) await markNotified(member.id, notifKey);
          } catch (memberErr) {
            console.error(`[Push] group shared expense notification failed for member ${member.id}:`, memberErr);
          }
        }
      } catch (err) {
        console.error(`[Push] group shared expense notification failed for expense ${id}:`, err);
      }
    }
  });

  app.delete("/api/recurring-expenses/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getRecurringExpense(id);
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ message: "Recurring expense not found" });
    }
    await storage.deleteRecurringExpense(id);
    res.status(200).json({ message: "Deleted" });
  });

  // GET /api/family/shared-recurring-expenses — active recurring expenses shared with group
  app.get("/api/family/shared-recurring-expenses", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.json([]);
    const items = await storage.getSharedRecurringExpenses(user.familyId);
    res.json(items);
  });

  // === GOALS ROUTES ===

  app.get(api.goals.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const goals = await storage.getGoals(user.id, user.familyId);
    res.json(goals);
  });

  app.get("/api/goals/shared", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(404).json({ message: "No group" });
    
    const sharedGoals = await storage.getSharedGoals(user.familyId);
    res.json(sharedGoals);
  });

  app.post(api.goals.create.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const body = { ...req.body };
    if (typeof body.deadline === 'string' && body.deadline) {
      body.deadline = new Date(body.deadline);
    } else if (!body.deadline) {
      body.deadline = null;
    }

    const parsed = api.goals.create.input.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid goal data", errors: parsed.error.errors });
    }
    const input = parsed.data;

    let goal = await storage.createGoal({
        ...input,
        userId: user.id,
        familyId: user.familyId ?? null,
    });

    if (input.visibility === 'family' && user.role === 'parent') {
      await storage.createGoalApproval(goal.id, user.id);
      goal = await storage.approveGoal(goal.id);
    }

    res.status(201).json(goal);
  });

  app.patch(api.goals.update.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const goal = await storage.getGoal(id);
    
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    
    const canEdit = goal.userId === user.id || 
      (user.role === 'parent' && goal.familyId === user.familyId);
    if (!canEdit) return res.status(403).json({ message: "Forbidden" });
    
    const body = req.body;
    if (typeof body.deadline === 'string') {
      body.deadline = new Date(body.deadline);
    }
    const input = api.goals.update.input.parse(body);
    const updated = await storage.updateGoal(id, input);
    res.json(updated);
  });

  app.delete(api.goals.delete.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const goal = await storage.getGoal(id);
    
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    
    const canDelete = goal.userId === user.id || 
      (user.role === 'parent' && goal.familyId === user.familyId);
    if (!canDelete) return res.status(403).json({ message: "Forbidden" });
    
    await storage.deleteGoal(id);
    res.status(204).send();
  });

  // Goal Approvals
  app.post("/api/goals/:id/approve", requireAuth, async (req, res) => {
    const user = req.user as any;
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    if (goal.familyId !== user.familyId) return res.status(403).json({ message: "Forbidden" });
    if (goal.visibility !== 'family') return res.status(400).json({ message: "Only family goals require approval" });
    
    const approvals = await storage.getGoalApprovals(goalId);
    const alreadyApproved = approvals.some(a => a.userId === user.id);
    
    if (alreadyApproved) {
      return res.status(400).json({ message: "You have already approved this goal" });
    }
    
    const approval = await storage.createGoalApproval(goalId, user.id);
    
    if (user.role === 'parent') {
      const updatedGoal = await storage.approveGoal(goalId);
      return res.json({ approval, goal: updatedGoal });
    }
    
    res.json({ approval, goal });
  });

  app.delete("/api/goals/:id/approve", requireAuth, async (req, res) => {
    const user = req.user as any;
    const goalId = parseInt(req.params.id);
    
    await storage.deleteGoalApproval(goalId, user.id);
    res.status(204).send();
  });

  app.get("/api/goals/:id/approvals", requireAuth, async (req, res) => {
    const user = req.user as any;
    const goalId = parseInt(req.params.id);
    const goal = await storage.getGoal(goalId);
    
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    if (goal.familyId !== user.familyId) return res.status(403).json({ message: "Forbidden" });
    
    const approvals = await storage.getGoalApprovals(goalId);
    res.json(approvals);
  });

  // === ALLOWANCES ROUTES ===

  app.get(api.allowances.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const allowances = await storage.getAllowances(user.familyId);
    if (user.role === 'child') {
        const mine = allowances.filter(a => a.childId === user.id);
        return res.json(mine);
    }
    res.json(allowances);
  });

  app.post(api.allowances.upsert.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    if (user.role !== 'parent') return res.status(403).json({ message: "Only parents can set allowances" });
    
    const input = api.allowances.upsert.input.parse(req.body);
    const allowance = await storage.upsertAllowance(input);
    res.json(allowance);
  });

  // === MESSAGES ROUTES ===

  app.get('/api/messages', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const msgs = await storage.getMessages(user.familyId);
    await storage.markMessagesRead(user.id, user.familyId);
    res.json(msgs);
  });

  app.post('/api/messages', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }
    const message = await storage.createMessage({
      familyId: user.familyId,
      userId: user.id,
      content: content.trim(),
    });
    res.status(201).json({ ...message, senderName: user.name });
  });

  app.get('/api/messages/unread', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.json({ count: 0 });
    const count = await storage.getUnreadCount(user.id, user.familyId);
    res.json({ count });
  });

  // === NOTES ROUTES ===

  app.get('/api/notes', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const notesList = await storage.getNotes(user.familyId);
    res.json(notesList);
  });

  app.post('/api/notes', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const { title, content } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ message: "Note title is required" });
    }
    const note = await storage.createNote({
      familyId: user.familyId,
      userId: user.id,
      title: title.trim(),
      content: content || null,
    });
    res.status(201).json({ ...note, creatorName: user.name });
  });

  app.patch('/api/notes/:id', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const noteId = parseInt(req.params.id);
    const note = await storage.getNote(noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.familyId !== user.familyId) return res.status(403).json({ message: "Forbidden" });
    const { title, content, isCompleted } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (isCompleted !== undefined) updates.isCompleted = isCompleted;
    const updated = await storage.updateNote(noteId, updates);
    res.json(updated);
  });

  app.delete('/api/notes/:id', requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(400).json({ message: "Not in a group" });
    const noteId = parseInt(req.params.id);
    const note = await storage.getNote(noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.familyId !== user.familyId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteNote(noteId);
    res.status(204).send();
  });

  // === BUDGET ROUTES ===

  app.get("/api/budgets", requireAuth, async (req, res) => {
    const user = req.user as any;
    const userBudgets = await storage.getBudgets(user.id);
    res.json(userBudgets);
  });

  app.post("/api/budgets", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      category: z.string().min(1).max(50),
      amount: z.string().or(z.number()).transform(v => String(v)),
      periodType: z.enum(["weekly", "monthly"]).default("monthly"),
      startDate: z.string().optional().transform(v => v ? new Date(v) : new Date()),
      notificationsEnabled: z.boolean().default(false),
      thresholds: z.array(z.string()).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
      scope: z.enum(["personal", "shared"]).default("personal"),
    });
    const data = schema.parse(req.body);
    const isShared = data.scope === "shared" && !!user.familyId;
    const budget = await storage.createBudget({
      category: data.category,
      amount: data.amount,
      periodType: data.periodType,
      startDate: data.startDate,
      notificationsEnabled: data.notificationsEnabled,
      thresholds: data.thresholds,
      note: data.note,
      userId: user.id,
      familyId: isShared ? user.familyId : (user.familyId ?? null),
      budgetScope: isShared ? "shared" : "personal",
      createdByUserId: isShared ? user.id : null,
      updatedByUserId: isShared ? user.id : null,
    });
    res.status(201).json(budget);
  });

  app.get("/api/family/shared-budgets", requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.json({ budgets: [] });

    const sharedBudgets = await storage.getSharedBudgets(user.familyId);
    if (sharedBudgets.length === 0) return res.json({ budgets: [] });

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const [sharedExpenses, familyMembers] = await Promise.all([
      storage.getSharedExpenses(user.familyId, periodStart, periodEnd),
      storage.getFamilyMembers(user.familyId),
    ]);
    const memberMap = new Map(familyMembers.map(m => [m.id, m.name]));

    const summaries = sharedBudgets.map(budget => {
      const spent = sharedExpenses
        .filter(e => e.category === budget.category)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const budgetAmount = Number(budget.amount);
      const remaining = budgetAmount - spent;
      const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
      return {
        ...budget,
        spent,
        remaining,
        percentUsed,
        createdByName: budget.createdByUserId ? (memberMap.get(budget.createdByUserId) ?? null) : null,
        updatedByName: budget.updatedByUserId ? (memberMap.get(budget.updatedByUserId) ?? null) : null,
      };
    });

    res.json({ budgets: summaries });
  });

  app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getBudget(id);
    const isSharedMember = existing?.budgetScope === "shared" && existing?.familyId === user.familyId;
    if (!existing || (existing.userId !== user.id && !isSharedMember)) {
      return res.status(404).json({ message: "Budget not found" });
    }
    const schema = z.object({
      amount: z.string().or(z.number()).transform(v => String(v)).optional(),
      periodType: z.enum(["weekly", "monthly"]).optional(),
      startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
      notificationsEnabled: z.boolean().optional(),
      thresholds: z.array(z.string()).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
    });
    const updates = schema.parse(req.body);
    const updated = await storage.updateBudget(id, {
      ...updates,
      ...(isSharedMember ? { updatedByUserId: user.id } : {}),
    });
    res.json(updated);
  });

  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getBudget(id);
    const isSharedMember = existing?.budgetScope === "shared" && existing?.familyId === user.familyId;
    if (!existing || (existing.userId !== user.id && !isSharedMember)) {
      return res.status(404).json({ message: "Budget not found" });
    }
    await storage.deleteBudget(id);
    res.status(204).send();
  });

  app.get("/api/budget-summary", requireAuth, async (req, res) => {
    const user = req.user as any;
    const userBudgets = await storage.getBudgets(user.id);
    const allExpenses = await storage.getExpenses(user.id);

    const now = new Date();
    const summaries = userBudgets.map(budget => {
      const startDate = new Date(budget.startDate);
      let periodStart: Date;
      let periodEnd: Date;

      if (budget.periodType === "weekly") {
        const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentPeriodOffset = daysSinceStart % 7;
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - currentPeriodOffset);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 7);
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      const categoryExpenses = allExpenses.filter(e => {
        const expDate = new Date(e.date);
        return e.category === budget.category && expDate >= periodStart && expDate < periodEnd;
      });
      const spent = categoryExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const budgetAmount = Number(budget.amount);
      const remaining = budgetAmount - spent;
      const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

      return {
        ...budget,
        spent,
        remaining,
        percentUsed,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      };
    });

    const totalBudget = summaries.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalSpent = summaries.reduce((sum, s) => sum + s.spent, 0);

    res.json({
      budgets: summaries,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalPercentUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    });
  });

  app.get("/api/budget-setup", requireAuth, async (req, res) => {
    const user = req.user as any;
    const prompt = await storage.getBudgetSetupPrompt(user.id);
    res.json(prompt || null);
  });

  app.post("/api/budget-setup", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      status: z.enum(["pending", "dismissed", "remind_week", "remind_month", "completed"]),
    });
    const { status } = schema.parse(req.body);

    let remindAt: Date | undefined;
    if (status === "remind_week") {
      remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + 7);
    } else if (status === "remind_month") {
      remindAt = new Date();
      remindAt.setMonth(remindAt.getMonth() + 1);
    }

    const prompt = await storage.upsertBudgetSetupPrompt(user.id, status, remindAt);
    res.json(prompt);
  });

  app.get("/api/budget-averages", requireAuth, async (req, res) => {
    const user = req.user as any;
    const allExpenses = await storage.getExpenses(user.id);

    if (allExpenses.length === 0) {
      return res.json({ averages: [], hasData: false });
    }

    const dates = allExpenses.map(e => new Date(e.date).getTime());
    const oldest = new Date(Math.min(...dates));
    const now = new Date();
    const monthsSpan = Math.max(1, (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth()) + 1);

    const categoryTotals: Record<string, number> = {};
    for (const expense of allExpenses) {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + Number(expense.amount);
    }

    const averages = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      monthlyAverage: Math.round((total / monthsSpan) * 100) / 100,
      weeklyAverage: Math.round((total / (monthsSpan * 4.33)) * 100) / 100,
    }));

    res.json({ averages, hasData: true });
  });

  // === UPLOAD ROUTE ===
  app.post(api.upload.create.path, requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const mime = req.file.mimetype;
    const url = `data:${mime};base64,${b64}`;
    
    res.json({ url });
  });

  // === PUSH NOTIFICATION ROUTES ===
  app.get("/api/push/vapid-public-key", (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(500).json({ message: "VAPID not configured" });
    res.json({ publicKey: key });
  });

  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { endpoint, keys } = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    }).parse(req.body);

    await storage.savePushSubscription(user.id, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    res.json({ message: "Subscribed to push notifications" });
  });

  app.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    await storage.deletePushSubscription(user.id, endpoint);
    res.json({ message: "Unsubscribed from push notifications" });
  });

  // === FRIEND GROUP ROUTES ===

  // POST /api/friend-groups — Create a new friend group
  app.post("/api/friend-groups", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const schema = z.object({
        name: z.string().min(1).max(100),
        currency: z.string().optional().default("EUR"),
      });
      const { name, currency } = schema.parse(req.body);
      const group = await storage.createFriendGroup({ name, currency, creatorId: user.id });
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // GET /api/friend-groups — List all friend groups for the current user
  app.get("/api/friend-groups", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groups = await storage.getFriendGroupsForUser(user.id);
      res.json(groups);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/friend-groups/join — Join a group by invite code
  app.post("/api/friend-groups/join", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const schema = z.object({ code: z.string().min(1) });
      const { code } = schema.parse(req.body);
      const group = await storage.joinFriendGroup(code.toUpperCase().trim(), user.id);
      res.json(group);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && (err.message === "Invalid invite code" || err.message === "Already a member of this group" || err.message === "This group is archived")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  // GET /api/friend-groups/:id — Get a group with members and net balances
  app.get("/api/friend-groups/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const group = await storage.getFriendGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const balances = await storage.getFriendGroupNetBalances(groupId);
      const safeMembers = group.members.map(({ password, ...safe }) => safe);
      res.json({ ...group, members: safeMembers, balances });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/friend-groups/:id/leave — Leave a group
  app.post("/api/friend-groups/:id/leave", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      await storage.leaveFriendGroup(groupId, user.id);
      res.json({ message: "You have left the group" });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/friend-groups/:id/my-expenses — Delete only the current user's expenses in a group
  app.delete("/api/friend-groups/:id/my-expenses", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      // Validate the target is a friend group and the caller is a member
      const group = await storage.getFriendGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.groupType !== "friends") return res.status(400).json({ message: "Not a friend group" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteUserExpensesForGroup(groupId, user.id);
      res.json({ message: "Your expenses in this group have been deleted" });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/friend-groups/:id/archive — Archive a group (admin only)
  app.patch("/api/friend-groups/:id/archive", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const members = await storage.getFriendGroupMembers(groupId);
      const self = members.find(m => m.id === user.id);
      if (!self) return res.status(403).json({ message: "Forbidden" });
      if (self.memberRole !== "admin") return res.status(403).json({ message: "Only group admins can archive the group" });

      const group = await storage.archiveFriendGroup(groupId);
      res.json(group);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/friend-groups/:id/balances — Net simplified balances
  app.get("/api/friend-groups/:id/balances", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const balances = await storage.getFriendGroupNetBalances(groupId);
      res.json(balances);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/friend-groups/:id/expenses — Expense feed
  app.get("/api/friend-groups/:id/expenses", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const members = await storage.getFriendGroupMembers(groupId);
      const memberMap = new Map(members.map(m => [m.id, m.name]));

      const publicExpenses = await storage.getFriendGroupExpenses(groupId);

      const enriched = publicExpenses.map(e => ({
        ...e,
        paidByName: memberMap.get(e.paidByUserId || e.userId) || "Unknown",
        creatorName: memberMap.get(e.userId) || "Unknown",
        participantNames: e.splits.map(s => ({ userId: s.userId, name: memberMap.get(s.userId) || "Unknown", amount: s.amount })),
      }));

      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/friend-groups/:id/expenses — Add a shared expense
  app.post("/api/friend-groups/:id/expenses", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const group = await storage.getFriendGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.archived) return res.status(400).json({ message: "This group is archived" });

      const schema = z.object({
        amount: z.string().or(z.number()).transform(v => String(v)),
        description: z.string().min(1).max(200),
        paidByUserId: z.number(),
        participants: z.array(z.number()).min(1),
        splitType: z.enum(["equal", "custom"]).default("equal"),
        customSplits: z.array(z.object({ userId: z.number(), amount: z.string().or(z.number()).transform(v => String(v)) })).optional(),
      });

      const data = schema.parse(req.body);
      const totalAmount = parseFloat(data.amount);

      // Validate all referenced users are group members
      const groupMembers = group.members.map(m => m.id);
      const memberSet = new Set(groupMembers);
      if (!memberSet.has(data.paidByUserId)) {
        return res.status(400).json({ message: "paidByUserId is not a member of this group" });
      }
      for (const uid of data.participants) {
        if (!memberSet.has(uid)) {
          return res.status(400).json({ message: `Participant user ${uid} is not a member of this group` });
        }
      }
      if (data.customSplits) {
        for (const s of data.customSplits) {
          if (!memberSet.has(s.userId)) {
            return res.status(400).json({ message: `Split user ${s.userId} is not a member of this group` });
          }
        }
      }

      let splits: { userId: number; amount: string }[];
      if (data.splitType === "equal") {
        const perPerson = totalAmount / data.participants.length;
        splits = data.participants.map(uid => ({ userId: uid, amount: perPerson.toFixed(2) }));
      } else {
        if (!data.customSplits || data.customSplits.length === 0) {
          return res.status(400).json({ message: "Custom splits are required when splitType is custom" });
        }
        const totalSplit = data.customSplits.reduce((sum, s) => sum + parseFloat(String(s.amount)), 0);
        if (Math.abs(totalSplit - totalAmount) > 0.01) {
          return res.status(400).json({ message: "Custom split amounts must add up to the total expense amount" });
        }
        splits = data.customSplits.map(s => ({ userId: s.userId, amount: String(s.amount) }));
      }

      const expense = await storage.createExpense({
        userId: user.id,
        familyId: groupId,
        amount: data.amount,
        category: "Other",
        note: data.description,
        visibility: "public",
        splitType: data.splitType === "equal" ? "equal" : "exact",
        paymentSource: "personal",
        paidByUserId: data.paidByUserId,
        date: new Date(),
      }, splits.map(s => ({ userId: s.userId, amount: s.amount, isPaid: false })));

      res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // GET /api/friend-groups/:id/expenses/:expenseId — Get a single expense with splits + member names
  app.get("/api/friend-groups/:id/expenses/:expenseId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      const expenseId = parseInt(req.params.expenseId);
      if (isNaN(groupId) || isNaN(expenseId)) return res.status(400).json({ message: "Invalid ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const expense = await storage.getExpense(expenseId);
      if (!expense || expense.familyId !== groupId) return res.status(404).json({ message: "Expense not found" });

      const members = await storage.getFriendGroupMembers(groupId);
      const memberMap = new Map(members.map(m => [m.id, m.name]));

      res.json({
        ...expense,
        paidByName: memberMap.get(expense.paidByUserId || expense.userId) || "Unknown",
        participantNames: expense.splits.map(s => ({ userId: s.userId, name: memberMap.get(s.userId) || "Unknown", amount: s.amount })),
      });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/friend-groups/:id/expenses/:expenseId — Edit an expense
  app.patch("/api/friend-groups/:id/expenses/:expenseId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      const expenseId = parseInt(req.params.expenseId);
      if (isNaN(groupId) || isNaN(expenseId)) return res.status(400).json({ message: "Invalid ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const expense = await storage.getExpense(expenseId);
      if (!expense || expense.familyId !== groupId) return res.status(404).json({ message: "Expense not found" });

      const group = await storage.getFriendGroup(groupId);
      if (group?.archived) return res.status(400).json({ message: "This group is archived" });

      const schema = z.object({
        amount: z.string().or(z.number()).transform(v => String(v)).optional(),
        description: z.string().min(1).max(200).optional(),
        paidByUserId: z.number().optional(),
        participants: z.array(z.number()).min(1).optional(),
        splitType: z.enum(["equal", "custom"]).optional(),
        customSplits: z.array(z.object({ userId: z.number(), amount: z.string().or(z.number()).transform(v => String(v)) })).optional(),
      });

      const data = schema.parse(req.body);

      // Validate that referenced users are group members
      if (group) {
        const memberSet = new Set(group.members.map(m => m.id));
        if (data.paidByUserId !== undefined && !memberSet.has(data.paidByUserId)) {
          return res.status(400).json({ message: "paidByUserId is not a member of this group" });
        }
        if (data.participants) {
          for (const uid of data.participants) {
            if (!memberSet.has(uid)) {
              return res.status(400).json({ message: `Participant user ${uid} is not a member of this group` });
            }
          }
        }
        if (data.customSplits) {
          for (const s of data.customSplits) {
            if (!memberSet.has(s.userId)) {
              return res.status(400).json({ message: `Split user ${s.userId} is not a member of this group` });
            }
          }
        }
      }

      const updates: Partial<{ note: string; amount: string; paidByUserId: number; splitType: string }> = {};
      if (data.description !== undefined) updates.note = data.description;
      if (data.amount !== undefined) updates.amount = data.amount;
      if (data.paidByUserId !== undefined) updates.paidByUserId = data.paidByUserId;
      if (data.splitType !== undefined) updates.splitType = data.splitType === "equal" ? "equal" : "exact";

      let newSplits: { userId: number; amount: string; isPaid: boolean }[] | undefined;
      const effectiveSplitType = data.splitType ?? expense.splitType;
      const amountChanged = data.amount !== undefined;
      if (data.participants || data.customSplits || (amountChanged && effectiveSplitType === "equal")) {
        const totalAmount = parseFloat(data.amount || String(expense.amount));
        if (effectiveSplitType === "equal") {
          const participants = data.participants || expense.splits.map(s => s.userId);
          const perPerson = totalAmount / participants.length;
          newSplits = participants.map(uid => ({ userId: uid, amount: perPerson.toFixed(2), isPaid: false }));
        } else if (data.customSplits) {
          const totalSplit = data.customSplits.reduce((sum, s) => sum + parseFloat(String(s.amount)), 0);
          if (Math.abs(totalSplit - totalAmount) > 0.01) {
            return res.status(400).json({ message: "Custom split amounts must add up to the total expense amount" });
          }
          newSplits = data.customSplits.map(s => ({ userId: s.userId, amount: String(s.amount), isPaid: false }));
        }
      }

      const updated = await storage.updateExpense(expenseId, updates, newSplits);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // DELETE /api/friend-groups/:id/expenses/:expenseId — Delete an expense
  // Only the expense creator or a group admin may delete (even in archived groups)
  app.delete("/api/friend-groups/:id/expenses/:expenseId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      const expenseId = parseInt(req.params.expenseId);
      if (isNaN(groupId) || isNaN(expenseId)) return res.status(400).json({ message: "Invalid ID" });

      const members = await storage.getFriendGroupMembers(groupId);
      const currentMember = members.find(m => m.id === user.id);
      if (!currentMember) return res.status(403).json({ message: "Forbidden" });

      const expense = await storage.getExpense(expenseId);
      if (!expense || expense.familyId !== groupId) return res.status(404).json({ message: "Expense not found" });

      const isCreator = expense.userId === user.id;
      const isAdmin = currentMember.memberRole === "admin";
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: "Only the expense creator or group admin can delete this expense" });
      }

      await storage.deleteExpense(expenseId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/friend-groups/:id/settle — Record a settlement
  app.post("/api/friend-groups/:id/settle", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ message: "Invalid group ID" });

      const isMember = await storage.isFriendGroupMember(groupId, user.id);
      if (!isMember) return res.status(403).json({ message: "Forbidden" });

      const schema = z.object({
        toUserId: z.number(),
        amount: z.string().or(z.number()).transform(v => String(v)),
        note: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);

      const toUserMember = await storage.isFriendGroupMember(groupId, data.toUserId);
      if (!toUserMember) return res.status(400).json({ message: "User not in this group" });

      const settlement = await storage.createSettlement({
        fromUserId: user.id,
        toUserId: data.toUserId,
        groupId,
        amount: data.amount,
        note: data.note || null,
      });
      res.status(201).json(settlement);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // === FEEDBACK / CONTACT SUPPORT ROUTE ===

  app.post("/api/feedback", requireAuth, async (req, res, next) => {
    try {
      const feedbackSchema = z.object({
        group: z.string().min(1, "Please select a group"),
        message: z.string().min(10, "Message must be at least 10 characters"),
      });

      const { group, message } = feedbackSchema.parse(req.body);
      const user = req.user as any;

      await sendFeedbackEmail({
        group,
        message,
        userEmail: user.email || null,
        userName: user.name || user.username || null,
      });

      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[feedback] Failed to send feedback email:", err);
      next(err);
    }
  });

  // Admin: bulk "What's New" email
  app.post("/api/admin/send-whats-new", async (req, res, next) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
        return res.status(401).json({ message: "Unauthorised" });
      }
      // ?testEmail=someone@example.com sends to just that one address (sample/test mode)
      const testEmail = req.query.testEmail as string | undefined;
      if (testEmail) {
        await sendWhatsNewEmail(testEmail, testEmail.split("@")[0]);
        return res.json({ total: 1, sent: 1, failed: 0, errors: [], test: true });
      }
      const allUsers = await storage.getAllUsersWithEmail();
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const u of allUsers) {
        try {
          await sendWhatsNewEmail(u.email, u.name);
          sent++;
        } catch (err: any) {
          failed++;
          errors.push(`${u.email}: ${err?.message ?? err}`);
          console.error("[admin] Failed to send whats-new email to", u.email, err);
        }
      }
      return res.json({ total: allUsers.length, sent, failed, errors });
    } catch (err) {
      next(err);
    }
  });

  // Admin: check scheduled email status
  app.get("/api/admin/send-whats-new/status", (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
      return res.status(401).json({ message: "Unauthorised" });
    }
    return res.json(getWhatsNewStatus());
  });

  // Admin: cancel scheduled email (before it fires)
  app.post("/api/admin/send-whats-new/cancel", (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
      return res.status(401).json({ message: "Unauthorised" });
    }
    const cancelled = cancelWhatsNewEmail();
    return res.json({ cancelled, message: cancelled ? "Scheduled send cancelled." : "Already sent — cannot cancel." });
  });

  startPushScheduler();
  scheduleWhatsNewEmail(() => storage.getAllUsersWithEmail());

  return httpServer;
}
