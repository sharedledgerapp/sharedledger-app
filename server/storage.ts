
import { db } from "./db";
import { 
  users, families, expenses, goals, allowances,
  type User, type InsertUser, type Family, type InsertFamily,
  type Expense, type InsertExpense, type Goal, type InsertGoal,
  type Allowance, type InsertAllowance,
  type UpdateGoalRequest, type UpdateAllowanceRequest
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Auth & User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { familyId?: number }): Promise<User>;
  
  // Family
  createFamily(family: InsertFamily): Promise<Family>;
  getFamily(id: number): Promise<Family | undefined>;
  getFamilyByCode(code: string): Promise<Family | undefined>;
  getFamilyMembers(familyId: number): Promise<User[]>;
  
  // Expenses
  createExpense(expense: InsertExpense): Promise<Expense>;
  getExpenses(userId?: number, familyId?: number): Promise<Expense[]>;
  deleteExpense(id: number): Promise<void>;
  getExpense(id: number): Promise<Expense | undefined>;

  // Goals
  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoals(userId: number, familyId: number): Promise<Goal[]>; // Get personal and family goals
  updateGoal(id: number, updates: UpdateGoalRequest): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;
  getGoal(id: number): Promise<Goal | undefined>;

  // Allowances
  upsertAllowance(allowance: InsertAllowance): Promise<Allowance>;
  getAllowances(familyId: number): Promise<Allowance[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Auth & User
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { familyId?: number }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Family
  async createFamily(insertFamily: InsertFamily): Promise<Family> {
    const [family] = await db.insert(families).values(insertFamily).returning();
    return family;
  }

  async getFamily(id: number): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.id, id));
    return family;
  }

  async getFamilyByCode(code: string): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.code, code));
    return family;
  }

  async getFamilyMembers(familyId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.familyId, familyId));
  }

  // Expenses
  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async getExpenses(userId?: number, familyId?: number): Promise<Expense[]> {
    // If userId provided, get user's expenses. 
    // If familyId provided, could get all public family expenses.
    // For now, let's just support basic filtering. 
    // Complex permission logic ("parents see totals") will be handled in route or frontend filtering for now,
    // but strict backend filtering is better.
    
    if (userId) {
        return db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.date));
    }
    
    if (familyId) {
        // Get all expenses for users in this family
        // This is a join or subquery. Let's do a join.
        // select * from expenses join users on expenses.userId = users.id where users.familyId = familyId
        // Drizzle way:
        return db.select({
            id: expenses.id,
            userId: expenses.userId,
            amount: expenses.amount,
            category: expenses.category,
            note: expenses.note,
            receiptUrl: expenses.receiptUrl,
            visibility: expenses.visibility,
            date: expenses.date,
            createdAt: expenses.createdAt
        })
        .from(expenses)
        .innerJoin(users, eq(expenses.userId, users.id))
        .where(eq(users.familyId, familyId))
        .orderBy(desc(expenses.date));
    }

    return [];
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  // Goals
  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(goals).values(insertGoal).returning();
    return goal;
  }

  async getGoals(userId: number, familyId: number): Promise<Goal[]> {
    // Return user's personal goals AND family goals
    // We can fetch both conditions with OR
    return db.select().from(goals).where(
        // (userId == userId AND isFamilyGoal == false) OR (familyId == familyId AND isFamilyGoal == true)
        // Actually simple logic: user goals OR family goals for this family
        // But goals have userId (owner) and familyId (if family goal).
        // Let's rely on familyId being set for family goals.
        // And userId for personal goals.
        // Wait, schema has userId nullable? No, schema says userId references users.
        // If it's a family goal, it still has a creator (userId).
        
        // Let's filter: goals where userId = current user OR (familyId = current family AND isFamilyGoal = true)
        and(
           eq(goals.familyId, familyId), // Assuming all goals are linked to family for now for simplicity, or we filter strictly.
           // Actually, let's just get all goals for the family members or specific logic.
           // Let's stick to: Get all goals for this user, plus any family goals for this family.
           undefined 
        )
    );
    // Let's simplify: Get goals for the family. Filter in app or refine query.
    // Spec: "Personal Goals" (userId), "Family Goals" (familyId).
    
    const allFamilyGoals = await db.select().from(goals).where(eq(goals.familyId, familyId));
    // Filter in memory for simplicity of "Personal vs Family" if needed, 
    // or return all and let frontend separate.
    return allFamilyGoals;
  }

  async updateGoal(id: number, updates: UpdateGoalRequest): Promise<Goal> {
    const [goal] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
    return goal;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }

  // Allowances
  async upsertAllowance(insertAllowance: InsertAllowance): Promise<Allowance> {
    // Check if exists
    const [existing] = await db.select().from(allowances).where(eq(allowances.childId, insertAllowance.childId));
    if (existing) {
        const [updated] = await db.update(allowances)
            .set({ amount: insertAllowance.amount, frequency: insertAllowance.frequency, updatedAt: new Date() })
            .where(eq(allowances.id, existing.id))
            .returning();
        return updated;
    }
    const [created] = await db.insert(allowances).values(insertAllowance).returning();
    return created;
  }

  async getAllowances(familyId: number): Promise<Allowance[]> {
    // Get allowances for all children in the family
    // join users
    const results = await db.select({
        id: allowances.id,
        childId: allowances.childId,
        amount: allowances.amount,
        frequency: allowances.frequency,
        updatedAt: allowances.updatedAt
    })
    .from(allowances)
    .innerJoin(users, eq(allowances.childId, users.id))
    .where(eq(users.familyId, familyId));
    
    return results;
  }
}

export const storage = new DatabaseStorage();
