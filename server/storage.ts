
import { db } from "./db";
import { 
  users, families, expenses, goals, allowances, expenseSplits, goalApprovals,
  messages, notes, messageReadStatus, recurringExpenses, budgets, budgetSetupPrompts,
  settlements, pushSubscriptions,
  type User, type InsertUser, type Family, type InsertFamily,
  type Expense, type InsertExpense, type Goal, type InsertGoal,
  type GoalApproval, type InsertGoalApproval,
  type Allowance, type InsertAllowance, type ExpenseSplit, type InsertExpenseSplit,
  type UpdateGoalRequest, type UpdateAllowanceRequest,
  type Message, type InsertMessage, type Note, type InsertNote, type MessageReadStatus,
  type RecurringExpense, type InsertRecurringExpense,
  type Budget, type InsertBudget, type BudgetSetupPrompt, type InsertBudgetSetupPrompt,
  type Settlement, type InsertSettlement
} from "@shared/schema";
import { eq, and, desc, or, ne, gte, lte, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Auth & User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { familyId?: number }): Promise<User>;
  updateUser(id: number, updates: Partial<Pick<User, 'name' | 'profileImageUrl' | 'language' | 'currency' | 'role' | 'categories' | 'dailyReminderTime' | 'dailyReminderEnabled' | 'weeklyReminderEnabled' | 'monthlyReminderEnabled' | 'budgetAlertsEnabled' | 'familyId'>>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // Group (formerly Family)
  createFamily(family: InsertFamily): Promise<Family>;
  getFamily(id: number): Promise<Family | undefined>;
  getFamilyByCode(code: string): Promise<Family | undefined>;
  getFamilyMembers(familyId: number): Promise<User[]>;
  
  // Expenses
  createExpense(expense: InsertExpense & { familyId: number }, splits?: Omit<InsertExpenseSplit, 'expenseId'>[]): Promise<Expense & { splits: ExpenseSplit[] }>;
  getExpenses(userId?: number, familyId?: number): Promise<(Expense & { splits: ExpenseSplit[] })[]>;
  getSharedExpenses(familyId: number, startDate?: Date, endDate?: Date): Promise<Expense[]>;
  updateExpense(id: number, updates: Partial<InsertExpense>, splits?: Omit<InsertExpenseSplit, 'expenseId'>[]): Promise<Expense & { splits: ExpenseSplit[] }>;
  deleteExpense(id: number): Promise<void>;
  getExpense(id: number): Promise<(Expense & { splits: ExpenseSplit[] }) | undefined>;

  // Settlements
  createSettlement(settlement: InsertSettlement): Promise<Settlement>;
  getSettlements(groupId: number): Promise<(Settlement & { fromUserName: string; toUserName: string })[]>;
  getGroupBalances(groupId: number): Promise<{ userId: number; userName: string; balance: number }[]>;

  // Goals
  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoals(userId: number, familyId: number): Promise<Goal[]>;
  getSharedGoals(familyId: number): Promise<(Goal & { creatorName: string; approvalCount: number })[]>;
  updateGoal(id: number, updates: UpdateGoalRequest): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;
  getGoal(id: number): Promise<Goal | undefined>;
  
  // Goal Approvals
  createGoalApproval(goalId: number, userId: number): Promise<GoalApproval>;
  getGoalApprovals(goalId: number): Promise<GoalApproval[]>;
  deleteGoalApproval(goalId: number, userId: number): Promise<void>;
  approveGoal(goalId: number): Promise<Goal>;

  // Allowances
  upsertAllowance(allowance: InsertAllowance): Promise<Allowance>;
  getAllowances(familyId: number): Promise<Allowance[]>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(familyId: number, limit?: number): Promise<(Message & { senderName: string })[]>;
  getUnreadCount(userId: number, familyId: number): Promise<number>;
  markMessagesRead(userId: number, familyId: number): Promise<void>;

  // Notes
  createNote(note: InsertNote): Promise<Note>;
  getNote(id: number): Promise<Note | undefined>;
  getNotes(familyId: number): Promise<(Note & { creatorName: string })[]>;
  updateNote(id: number, updates: Partial<Pick<Note, 'title' | 'content' | 'isCompleted'>>): Promise<Note>;
  deleteNote(id: number): Promise<void>;

  // Recurring Expenses
  createRecurringExpense(expense: InsertRecurringExpense): Promise<RecurringExpense>;
  getRecurringExpenses(userId: number): Promise<RecurringExpense[]>;
  getRecurringExpense(id: number): Promise<RecurringExpense | undefined>;
  updateRecurringExpense(id: number, updates: Partial<InsertRecurringExpense>): Promise<RecurringExpense>;
  deleteRecurringExpense(id: number): Promise<void>;

  // Budgets
  createBudget(budget: InsertBudget): Promise<Budget>;
  getBudgets(userId: number): Promise<Budget[]>;
  getBudget(id: number): Promise<Budget | undefined>;
  updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;

  // Budget Setup Prompts
  getBudgetSetupPrompt(userId: number): Promise<BudgetSetupPrompt | undefined>;
  upsertBudgetSetupPrompt(userId: number, status: "pending" | "dismissed" | "remind_week" | "remind_month" | "completed", remindAt?: Date): Promise<BudgetSetupPrompt>;

  // Push Subscriptions
  savePushSubscription(userId: number, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  deletePushSubscription(userId: number, endpoint: string): Promise<void>;
  getPushSubscriptionsForUser(userId: number): Promise<{ endpoint: string; p256dh: string; auth: string }[]>;
  getAllPushSubscriptions(): Promise<{ userId: number; endpoint: string; p256dh: string; auth: string }[]>;

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

  async updateUser(id: number, updates: Partial<Pick<User, 'name' | 'profileImageUrl' | 'language' | 'currency' | 'role' | 'categories' | 'dailyReminderTime' | 'dailyReminderEnabled' | 'weeklyReminderEnabled' | 'monthlyReminderEnabled' | 'budgetAlertsEnabled' | 'familyId'>>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, id));
    
    const userExpenses = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.userId, id));
    for (const expense of userExpenses) {
      await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expense.id));
    }
    await db.delete(expenses).where(eq(expenses.userId, id));
    
    await db.delete(goalApprovals).where(eq(goalApprovals.userId, id));
    
    const userGoals = await db.select({ id: goals.id }).from(goals).where(eq(goals.userId, id));
    for (const goal of userGoals) {
      await db.delete(goalApprovals).where(eq(goalApprovals.goalId, goal.id));
    }
    await db.delete(goals).where(eq(goals.userId, id));
    
    await db.delete(allowances).where(eq(allowances.childId, id));
    
    await db.delete(settlements).where(or(eq(settlements.fromUserId, id), eq(settlements.toUserId, id)));
    await db.delete(messages).where(eq(messages.userId, id));
    await db.delete(notes).where(eq(notes.userId, id));
    await db.delete(messageReadStatus).where(eq(messageReadStatus.userId, id));
    await db.delete(recurringExpenses).where(eq(recurringExpenses.userId, id));
    await db.delete(budgets).where(eq(budgets.userId, id));
    await db.delete(budgetSetupPrompts).where(eq(budgetSetupPrompts.userId, id));
    
    await db.delete(users).where(eq(users.id, id));
  }

  // Group (formerly Family)
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
  async createExpense(insertExpense: InsertExpense & { familyId: number }, splits?: Omit<InsertExpenseSplit, 'expenseId'>[]): Promise<Expense & { splits: ExpenseSplit[] }> {
    return await db.transaction(async (tx) => {
      const [expense] = await tx.insert(expenses).values(insertExpense).returning();
      
      let createdSplits: ExpenseSplit[] = [];
      if (splits && splits.length > 0) {
        createdSplits = await tx.insert(expenseSplits).values(
          splits.map(s => ({ ...s, expenseId: expense.id })) as any
        ).returning();
      }
      
      return { ...expense, splits: createdSplits };
    });
  }

  async getExpenses(userId?: number, familyId?: number): Promise<(Expense & { splits: ExpenseSplit[] })[]> {
    let baseQuery;
    
    if (userId && familyId) {
      baseQuery = db.select().from(expenses).where(and(eq(expenses.userId, userId), eq(expenses.familyId, familyId)));
    } else if (userId) {
      baseQuery = db.select().from(expenses).where(eq(expenses.userId, userId));
    } else if (familyId) {
      baseQuery = db.select({ expenses: expenses })
        .from(expenses)
        .innerJoin(users, eq(expenses.userId, users.id))
        .where(eq(users.familyId, familyId));
    } else {
      return [];
    }

    const results = await baseQuery.orderBy(desc(expenses.date));
    const finalExpenses = results.map((r: any) => r.expenses || r) as Expense[];
    
    const expenseIds = finalExpenses.map(e => e.id);
    if (expenseIds.length === 0) return [];

    const splitsPromises = finalExpenses.map(async (e) => {
      const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, e.id));
      return { ...e, splits: splits.map(s => ({ ...s, amount: s.amount.toString() })) };
    });

    return Promise.all(splitsPromises);
  }

  async updateExpense(id: number, updates: Partial<InsertExpense>, splits?: Omit<InsertExpenseSplit, 'expenseId'>[]): Promise<Expense & { splits: ExpenseSplit[] }> {
    return await db.transaction(async (tx) => {
      const [expense] = await tx.update(expenses).set(updates).where(eq(expenses.id, id)).returning();
      
      if (splits) {
        await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
        if (splits.length > 0) {
          await tx.insert(expenseSplits).values(
            splits.map(s => ({ ...s, amount: s.amount.toString(), expenseId: id })) as any
          );
        }
      }
      
      const createdSplits = await tx.select().from(expenseSplits).where(eq(expenseSplits.expenseId, id));
      return { ...expense, splits: createdSplits.map(s => ({ ...s, amount: s.amount.toString() })) };
    });
  }

  async deleteExpense(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
  }

  async getExpense(id: number): Promise<(Expense & { splits: ExpenseSplit[] }) | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!expense) return undefined;
    const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, id));
    return { ...expense, splits: splits.map(s => ({ ...s, amount: s.amount.toString() })) };
  }

  async getSharedExpenses(familyId: number, startDate?: Date, endDate?: Date): Promise<Expense[]> {
    let conditions = [
      eq(expenses.familyId, familyId),
      eq(expenses.visibility, "public")
    ];
    
    if (startDate) {
      conditions.push(gte(expenses.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(expenses.date, endDate));
    }
    
    const results = await db.select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.date));
    
    return results;
  }

  async updateSplitPayment(splitId: number, isPaid: boolean): Promise<ExpenseSplit> {
    const [updated] = await db.update(expenseSplits)
      .set({ isPaid })
      .where(eq(expenseSplits.id, splitId))
      .returning();
    return updated;
  }

  // Settlements
  async createSettlement(insertSettlement: InsertSettlement): Promise<Settlement> {
    const [settlement] = await db.insert(settlements).values(insertSettlement).returning();
    return settlement;
  }

  async getSettlements(groupId: number): Promise<(Settlement & { fromUserName: string; toUserName: string })[]> {
    const fromUsers = db.select({ id: users.id, name: users.name }).from(users).as('from_users');
    const toUsers = db.select({ id: users.id, name: users.name }).from(users).as('to_users');
    
    const results = await db.select()
      .from(settlements)
      .where(eq(settlements.groupId, groupId))
      .orderBy(desc(settlements.createdAt));

    const enriched = await Promise.all(results.map(async (s) => {
      const [fromUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, s.fromUserId));
      const [toUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, s.toUserId));
      return { ...s, fromUserName: fromUser?.name || 'Unknown', toUserName: toUser?.name || 'Unknown' };
    }));

    return enriched;
  }

  async getGroupBalances(groupId: number): Promise<{ userId: number; userName: string; balance: number }[]> {
    const members = await this.getFamilyMembers(groupId);
    
    const sharedExpenses = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.familyId, groupId),
        eq(expenses.visibility, "public")
      ));

    const allSplits = await Promise.all(
      sharedExpenses.map(async (e) => {
        const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, e.id));
        return { expense: e, splits };
      })
    );

    const groupSettlements = await db.select()
      .from(settlements)
      .where(eq(settlements.groupId, groupId));

    const balances: Record<number, number> = {};
    members.forEach(m => { balances[m.id] = 0; });

    for (const { expense, splits } of allSplits) {
      const paidByUserId = expense.paidByUserId || expense.userId;
      if (splits.length > 0) {
        balances[paidByUserId] = (balances[paidByUserId] || 0) + Number(expense.amount);
        for (const split of splits) {
          balances[split.userId] = (balances[split.userId] || 0) - Number(split.amount);
        }
      }
    }

    for (const s of groupSettlements) {
      balances[s.fromUserId] = (balances[s.fromUserId] || 0) + Number(s.amount);
      balances[s.toUserId] = (balances[s.toUserId] || 0) - Number(s.amount);
    }

    return members.map(m => ({
      userId: m.id,
      userName: m.name,
      balance: Math.round((balances[m.id] || 0) * 100) / 100,
    }));
  }

  // Goals
  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(goals).values(insertGoal).returning();
    return goal;
  }

  async getGoals(userId: number, familyId: number): Promise<Goal[]> {
    const allGoals = await db.select().from(goals).where(eq(goals.familyId, familyId));
    
    return allGoals.filter(goal => {
      if (goal.userId === userId) return true;
      if (goal.visibility === 'family' && goal.isApproved) return true;
      if (goal.visibility === 'shared') return true;
      return false;
    });
  }

  async getSharedGoals(familyId: number): Promise<(Goal & { creatorName: string; approvalCount: number })[]> {
    const sharedGoals = await db.select({
      goal: goals,
      creatorName: users.name,
    })
    .from(goals)
    .innerJoin(users, eq(goals.userId, users.id))
    .where(
      and(
        eq(goals.familyId, familyId),
        or(
          eq(goals.visibility, 'family'),
          eq(goals.visibility, 'shared')
        )
      )
    );

    const goalsWithApprovals = await Promise.all(
      sharedGoals.map(async ({ goal, creatorName }) => {
        const approvals = await db.select().from(goalApprovals).where(eq(goalApprovals.goalId, goal.id));
        return {
          ...goal,
          creatorName,
          approvalCount: approvals.length,
        };
      })
    );

    return goalsWithApprovals.sort((a, b) => {
      if (a.visibility === 'family' && b.visibility !== 'family') return -1;
      if (a.visibility !== 'family' && b.visibility === 'family') return 1;
      return 0;
    });
  }

  async updateGoal(id: number, updates: UpdateGoalRequest): Promise<Goal> {
    const [goal] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
    return goal;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goalApprovals).where(eq(goalApprovals.goalId, id));
    await db.delete(goals).where(eq(goals.id, id));
  }

  async getGoal(id: number): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    return goal;
  }

  // Goal Approvals
  async createGoalApproval(goalId: number, userId: number): Promise<GoalApproval> {
    const [approval] = await db.insert(goalApprovals).values({ goalId, userId }).returning();
    return approval;
  }

  async getGoalApprovals(goalId: number): Promise<GoalApproval[]> {
    return db.select().from(goalApprovals).where(eq(goalApprovals.goalId, goalId));
  }

  async deleteGoalApproval(goalId: number, userId: number): Promise<void> {
    await db.delete(goalApprovals).where(
      and(eq(goalApprovals.goalId, goalId), eq(goalApprovals.userId, userId))
    );
  }

  async approveGoal(goalId: number): Promise<Goal> {
    const [goal] = await db.update(goals)
      .set({ isApproved: true })
      .where(eq(goals.id, goalId))
      .returning();
    return goal;
  }

  // Allowances
  async upsertAllowance(insertAllowance: InsertAllowance): Promise<Allowance> {
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

  // Messages
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async getMessages(familyId: number, limit = 50): Promise<(Message & { senderName: string })[]> {
    const results = await db.select({
      message: messages,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(eq(messages.familyId, familyId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

    return results.map(r => ({ ...r.message, senderName: r.senderName })).reverse();
  }

  async getUnreadCount(userId: number, familyId: number): Promise<number> {
    const [readStatus] = await db.select()
      .from(messageReadStatus)
      .where(and(eq(messageReadStatus.userId, userId), eq(messageReadStatus.familyId, familyId)));

    const lastReadAt = readStatus?.lastReadAt || new Date(0);

    const result = await db.select({ id: messages.id })
      .from(messages)
      .where(and(
        eq(messages.familyId, familyId),
        ne(messages.userId, userId),
        gte(messages.createdAt, lastReadAt)
      ));

    return result.length;
  }

  async markMessagesRead(userId: number, familyId: number): Promise<void> {
    const [existing] = await db.select()
      .from(messageReadStatus)
      .where(and(eq(messageReadStatus.userId, userId), eq(messageReadStatus.familyId, familyId)));

    if (existing) {
      await db.update(messageReadStatus)
        .set({ lastReadAt: new Date() })
        .where(eq(messageReadStatus.id, existing.id));
    } else {
      await db.insert(messageReadStatus).values({ userId, familyId, lastReadAt: new Date() });
    }
  }

  // Notes
  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values(insertNote).returning();
    return note;
  }

  async getNote(id: number): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note;
  }

  async getNotes(familyId: number): Promise<(Note & { creatorName: string })[]> {
    const results = await db.select({
      note: notes,
      creatorName: users.name,
    })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.familyId, familyId))
    .orderBy(desc(notes.createdAt));

    return results.map(r => ({ ...r.note, creatorName: r.creatorName }));
  }

  async updateNote(id: number, updates: Partial<Pick<Note, 'title' | 'content' | 'isCompleted'>>): Promise<Note> {
    const [note] = await db.update(notes).set(updates).where(eq(notes.id, id)).returning();
    return note;
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  // Recurring Expenses
  async createRecurringExpense(expense: InsertRecurringExpense): Promise<RecurringExpense> {
    const [created] = await db.insert(recurringExpenses).values(expense).returning();
    return created;
  }

  async getRecurringExpenses(userId: number): Promise<RecurringExpense[]> {
    return db.select().from(recurringExpenses)
      .where(eq(recurringExpenses.userId, userId))
      .orderBy(desc(recurringExpenses.createdAt));
  }

  async getRecurringExpense(id: number): Promise<RecurringExpense | undefined> {
    const [expense] = await db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id));
    return expense;
  }

  async updateRecurringExpense(id: number, updates: Partial<InsertRecurringExpense>): Promise<RecurringExpense> {
    const [updated] = await db.update(recurringExpenses).set(updates).where(eq(recurringExpenses.id, id)).returning();
    return updated;
  }

  async deleteRecurringExpense(id: number): Promise<void> {
    await db.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
  }

  // Budgets
  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [created] = await db.insert(budgets).values(budget).returning();
    return created;
  }

  async getBudgets(userId: number): Promise<Budget[]> {
    return db.select().from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(budgets.category);
  }

  async getBudget(id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    return budget;
  }

  async updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget> {
    const [updated] = await db.update(budgets).set({ ...updates, updatedAt: new Date() }).where(eq(budgets.id, id)).returning();
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  // Budget Setup Prompts
  async getBudgetSetupPrompt(userId: number): Promise<BudgetSetupPrompt | undefined> {
    const [prompt] = await db.select().from(budgetSetupPrompts)
      .where(eq(budgetSetupPrompts.userId, userId));
    return prompt;
  }

  async upsertBudgetSetupPrompt(userId: number, status: "pending" | "dismissed" | "remind_week" | "remind_month" | "completed", remindAt?: Date): Promise<BudgetSetupPrompt> {
    const existing = await this.getBudgetSetupPrompt(userId);
    if (existing) {
      const [updated] = await db.update(budgetSetupPrompts)
        .set({ status, remindAt: remindAt || null })
        .where(eq(budgetSetupPrompts.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(budgetSetupPrompts)
      .values({ userId, status, remindAt: remindAt || null })
      .returning();
    return created;
  }

  async savePushSubscription(userId: number, subscription: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    if (existing.length > 0) {
      await db.update(pushSubscriptions)
        .set({ userId, p256dh: subscription.p256dh, auth: subscription.auth })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    } else {
      await db.insert(pushSubscriptions).values({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });
    }
  }

  async deletePushSubscription(userId: number, endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(
      and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))
    );
  }

  async getPushSubscriptionsForUser(userId: number): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
    return db.select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getAllPushSubscriptions(): Promise<{ userId: number; endpoint: string; p256dh: string; auth: string }[]> {
    return db.select({
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    }).from(pushSubscriptions);
  }
}

export const storage = new DatabaseStorage();
