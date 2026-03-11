
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
import { insertUserSchema, families, oauthGroupSetupSchema } from "@shared/schema";
import multer from "multer";
import passport from "passport";
import { db } from "./db";
import { GoogleGenAI } from "@google/genai";
import { startPushScheduler } from "./push-scheduler";

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

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const { familyCode, familyName, groupCode, groupName, groupType, ...userData } = api.auth.register.input.parse(req.body);

      if (!userData.password || userData.password.length < 1) {
        return res.status(400).json({ message: "Password is required" });
      }

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
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
        const prefix = newGroupType === "family" ? "FAM" : newGroupType === "roommates" ? "GRP" : "CPL";
        const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        const family = await storage.createFamily({ name: newGroupName, code, groupType: newGroupType });
        familyId = family.id;
        if (newGroupType !== "family") {
          role = "member";
        }
      } else {
        return res.status(400).json({ message: "Please provide an invite code or enter a new group name to get started." });
      }

      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        role,
        familyId
      });

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

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user));
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json(sanitizeUser(req.user));
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
        familyId = family.id;
        if (family.groupType === "family") {
          role = "child";
        } else {
          role = "member";
        }
      } else if (groupName) {
        const newGroupType = groupType || "family";
        const prefix = newGroupType === "family" ? "FAM" : newGroupType === "roommates" ? "GRP" : "CPL";
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
      res.json(sanitizeUser(updated));
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
      profileImageUrl: z.string().url().optional().nullable(),
      language: z.enum(["en", "fr"]).optional(),
      currency: z.string().optional(),
      categories: z.array(z.string().min(1).max(30)).max(20).optional(),
      recurringCategories: z.array(z.string().min(1).max(30)).max(20).optional(),
      dailyReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      dailyReminderEnabled: z.boolean().optional(),
      weeklyReminderEnabled: z.boolean().optional(),
      monthlyReminderEnabled: z.boolean().optional(),
      budgetAlertsEnabled: z.boolean().optional(),
    });
    
    const updates = updateSchema.parse(req.body);
    const updated = await storage.updateUser(user.id, updates);
    res.json(updated);
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
    await storage.updateUser(user.id, { familyId: null as any });
    res.json({ message: "You have left the group" });
  });

  // === RECEIPT OCR ROUTE ===
  
  const ai = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    },
  });

  app.post("/api/receipts/scan", requireAuth, upload.single('receipt'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No receipt image uploaded" });
      }

      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mimeType = req.file.mimetype;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

  // === SPENDING SUMMARY ROUTES ===

  app.get("/api/spending/summary", requireAuth, async (req, res) => {
    const user = req.user as any;
    const now = new Date();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const allExpenses = await storage.getExpenses(user.id);
    const personalExpenses = allExpenses.filter(e => e.paymentSource === "personal");

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

    res.json({
      currentMonthTotal: currentMonthTotal.toFixed(2),
      prevMonthTotal: prevMonthTotal.toFixed(2),
      todayTotal: todayTotal.toFixed(2),
      percentageChange: percentageChange.toFixed(1),
      trend: currentMonthTotal >= prevMonthTotal ? "up" : "down",
    });
  });

  app.get("/api/spending/activity", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { view = "weekly" } = req.query as { view?: "weekly" | "monthly" };
    const now = new Date();

    const allExpenses = await storage.getExpenses(user.id);
    const personalExpenses = allExpenses.filter(e => e.paymentSource === "personal");

    if (view === "weekly") {
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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
        periodLabel: `${now.toLocaleString("en", { month: "long" })} ${now.getFullYear()}`,
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

    const family = await storage.getFamily(user.familyId);
    const members = await storage.getFamilyMembers(user.familyId);

    const memberSpending = members.map(member => {
      const memberExpenses = sharedExpenses.filter(e => {
        const spenderId = e.paidByUserId != null ? e.paidByUserId : e.userId;
        return spenderId === member.id;
      });
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

    const sharedGoals = await storage.getSharedGoals(user.familyId);

    const recentExpenses = sharedExpenses.slice(0, 10).map(e => ({
      id: e.id,
      amount: e.amount,
      category: e.category,
      note: e.note,
      date: e.date,
      paymentSource: e.paymentSource,
    }));

    const balances = await storage.getGroupBalances(user.familyId);

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
      balances,
    });
  });

  // === GROUP ROUTES ===

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
        .filter(e => new Date(e.date) >= startOfMonth && e.visibility === "public")
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

    const filtered = await storage.getExpenses(user.id, user.familyId);
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
    });
    const data = schema.parse(req.body);
    const expense = await storage.createRecurringExpense({
      ...data,
      userId: user.id,
      familyId: user.familyId,
    });
    res.status(201).json(expense);
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
    });
    const updates = schema.parse(req.body);
    const updated = await storage.updateRecurringExpense(id, updates);
    res.json(updated);
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
    const body = req.body;
    if (typeof body.deadline === 'string') {
      body.deadline = new Date(body.deadline);
    }
    const input = api.goals.create.input.parse(body);
    
    let goal = await storage.createGoal({
        ...input,
        userId: user.id,
        familyId: user.familyId
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
    });
    const data = schema.parse(req.body);
    const budget = await storage.createBudget({
      ...data,
      userId: user.id,
      familyId: user.familyId,
      budgetScope: "personal",
    });
    res.status(201).json(budget);
  });

  app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getBudget(id);
    if (!existing || existing.userId !== user.id) {
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
    const updated = await storage.updateBudget(id, updates);
    res.json(updated);
  });

  app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const existing = await storage.getBudget(id);
    if (!existing || existing.userId !== user.id) {
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

  startPushScheduler();

  return httpServer;
}
