
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
import { insertUserSchema, families } from "@shared/schema";
import multer from "multer";
import passport from "passport";
import { db } from "./db";

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Upload setup (Memory storage for prototype, could use disk or S3)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword } = setupAuth(app);

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const { familyCode, familyName, ...userData } = api.auth.register.input.parse(req.body);

      // Check if username exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      let familyId: number;
      let role = userData.role;

      if (familyCode) {
        // Joining existing family
        const family = await storage.getFamilyByCode(familyCode);
        if (!family) {
          return res.status(400).json({ message: "Invalid family invite code. Please check with your parent or try again." });
        }
        familyId = family.id;
      } else if (familyName) {
        // Creating new family
        if (role !== 'parent') {
             return res.status(400).json({ message: "Only parents can create new family groups." });
        }
        const code = `FAM-${Math.floor(1000 + Math.random() * 9000)}`; // Human readable code
        const family = await storage.createFamily({ name: familyName, code });
        familyId = family.id;
      } else {
        return res.status(400).json({ message: "Please provide a family invite code or enter a new family name to get started." });
      }

      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        familyId
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: err.errors[0].message });
        }
        next(err);
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
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
    res.status(200).json(req.user);
  });

  // === FAMILY ROUTES ===

  app.get(api.family.get.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    if (!user.familyId) return res.status(404).json({ message: "No family" });

    const family = await storage.getFamily(user.familyId);
    const members = await storage.getFamilyMembers(user.familyId);
    
    // Calculate totals for each member for the current month
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
  });

  // === EXPENSES ROUTES ===

  app.get(api.expenses.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    
    // Strict backend filtering:
    // Only return expenses belonging to the current user AND their family.
    const filtered = await storage.getExpenses(user.id, user.familyId);

    res.json(filtered);
  });

  app.post(api.expenses.create.path, requireAuth, async (req, res, next) => {
    try {
        const user = req.user as any;
        const body = req.body;
        
        // Transform ISO string date back to Date object for Zod/Drizzle
        if (typeof body.date === 'string') {
          body.date = new Date(body.date);
        }

        const { splits, ...expenseInput } = api.expenses.create.input.parse(body);
        
        // Ensure userId matches current user and familyId is set
        const expense = await storage.createExpense({
          ...expenseInput,
          userId: user.id,
          familyId: user.familyId
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

  app.patch("/api/expenses/splits/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const { isPaid } = z.object({ isPaid: z.boolean() }).parse(req.body);
    const updated = await storage.updateSplitPayment(id, isPaid);
    res.json(updated);
  });

  // === GOALS ROUTES ===

  app.get(api.goals.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const goals = await storage.getGoals(user.id, user.familyId);
    res.json(goals);
  });

  app.post(api.goals.create.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    const input = api.goals.create.input.parse(req.body);
    
    // Auto-link to family if missing but isFamilyGoal is true?
    // Schema expects familyId.
    // If not provided in input, and it's a family goal, link it.
    
    const goal = await storage.createGoal({
        ...input,
        userId: user.id, // Creator
        familyId: user.familyId
    });
    res.status(201).json(goal);
  });

  app.patch(api.goals.update.path, requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.goals.update.input.parse(req.body);
    const goal = await storage.updateGoal(id, input);
    res.json(goal);
  });

  app.delete(api.goals.delete.path, requireAuth, async (req, res) => {
    await storage.deleteGoal(parseInt(req.params.id));
    res.status(204).send();
  });

  // === ALLOWANCES ROUTES ===

  app.get(api.allowances.list.path, requireAuth, async (req, res) => {
    const user = req.user as any;
    // Visible to all? Or just parents and the child?
    // Spec: "Allowance is visible to the child"
    const allowances = await storage.getAllowances(user.familyId);
    // Filter?
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

  // === UPLOAD ROUTE ===
  app.post(api.upload.create.path, requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    // In a real app, upload to S3/Blob storage. 
    // Here we'll just base64 encode it back (not efficient but works for prototype)
    // OR serve it via an endpoint.
    // Let's use a data URI for simplicity in prototype, or pretend we have a URL.
    
    // Better: return a fake URL and rely on client local preview, 
    // OR actually store it in a public folder? We can't write to client/public easily at runtime.
    
    // For this prototype, let's return a data URI.
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const mime = req.file.mimetype;
    const url = `data:${mime};base64,${b64}`;
    
    res.json({ url });
  });

  // No seed data. App starts blank.
  return httpServer;
}
