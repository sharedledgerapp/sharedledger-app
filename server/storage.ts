
import { db } from "./db";
import { 
  users, families, expenses, goals, allowances, expenseSplits, goalApprovals,
  messages, notes, messageReadStatus, recurringExpenses, budgets, budgetSetupPrompts,
  settlements, pushSubscriptions, pushNotificationLog, friendGroupMembers,
  type User, type InsertUser, type Family, type InsertFamily,
  type Expense, type InsertExpense, type Goal, type InsertGoal,
  type GoalApproval, type InsertGoalApproval,
  type Allowance, type InsertAllowance, type ExpenseSplit, type InsertExpenseSplit,
  type UpdateGoalRequest, type UpdateAllowanceRequest,
  type Message, type InsertMessage, type Note, type InsertNote, type MessageReadStatus,
  type RecurringExpense, type InsertRecurringExpense,
  type Budget, type InsertBudget, type BudgetSetupPrompt, type InsertBudgetSetupPrompt,
  type Settlement, type InsertSettlement, type FriendGroupMember
} from "@shared/schema";
import { eq, and, desc, or, ne, gte, lte, sql, inArray, aliasedTable } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Auth & User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByAppleId(appleId: string): Promise<User | undefined>;
  createUser(user: InsertUser & { familyId?: number; googleId?: string | null; appleId?: string | null }): Promise<User>;
  updateUser(id: number, updates: Partial<Pick<User, 'name' | 'profileImageUrl' | 'language' | 'currency' | 'role' | 'categories' | 'recurringCategories' | 'dailyReminderTime' | 'dailyReminderEnabled' | 'weeklyReminderEnabled' | 'monthlyReminderEnabled' | 'budgetAlertsEnabled' | 'familyId'>>): Promise<User>;
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
  getGroupBalances(groupId: number, prefetched?: { members?: User[]; sharedExpenses?: Expense[] }): Promise<{ userId: number; userName: string; balance: number }[]>;

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

  // Friend Groups
  getFriendGroupExpenses(groupId: number): Promise<(Expense & { splits: ExpenseSplit[] })[]>;
  createFriendGroup(data: { name: string; currency?: string; creatorId: number }): Promise<Family>;
  getFriendGroupsForUser(userId: number): Promise<(Family & { memberCount: number; memberRole: string })[]>;
  getFriendGroup(groupId: number): Promise<(Family & { members: (User & { memberRole: string })[] }) | undefined>;
  joinFriendGroup(code: string, userId: number): Promise<Family>;
  leaveFriendGroup(groupId: number, userId: number): Promise<void>;
  archiveFriendGroup(groupId: number): Promise<Family>;
  isFriendGroupMember(groupId: number, userId: number): Promise<boolean>;
  getFriendGroupMembers(groupId: number): Promise<(User & { memberRole: string })[]>;
  getFriendGroupNetBalances(groupId: number): Promise<{ fromUserId: number; fromName: string; toUserId: number; toName: string; amount: number }[]>;

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

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId));
    return user;
  }

  async createUser(insertUser: InsertUser & { familyId?: number; googleId?: string | null; appleId?: string | null }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<Pick<User, 'name' | 'profileImageUrl' | 'language' | 'currency' | 'role' | 'categories' | 'dailyReminderTime' | 'dailyReminderEnabled' | 'weeklyReminderEnabled' | 'monthlyReminderEnabled' | 'budgetAlertsEnabled' | 'familyId'>>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(friendGroupMembers).where(eq(friendGroupMembers.userId, id));
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
    await db.delete(pushNotificationLog).where(eq(pushNotificationLog.userId, id));
    
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

    const allSplits = await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds));
    const splitsByExpenseId = new Map<number, ExpenseSplit[]>();
    for (const split of allSplits) {
      const list = splitsByExpenseId.get(split.expenseId) || [];
      list.push({ ...split, amount: split.amount.toString() });
      splitsByExpenseId.set(split.expenseId, list);
    }

    return finalExpenses.map(e => ({
      ...e,
      splits: splitsByExpenseId.get(e.id) || [],
    }));
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
    const conditions = [
      eq(users.familyId, familyId),
      eq(expenses.visibility, "public")
    ];

    if (startDate) {
      conditions.push(gte(expenses.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(expenses.date, endDate));
    }

    const results = await db.select({ expenses: expenses })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.date));

    return results.map((r) => r.expenses);
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
    const fromUsers = aliasedTable(users, 'from_users');
    const toUsers = aliasedTable(users, 'to_users');

    const results = await db.select({
      id: settlements.id,
      fromUserId: settlements.fromUserId,
      toUserId: settlements.toUserId,
      groupId: settlements.groupId,
      amount: settlements.amount,
      note: settlements.note,
      createdAt: settlements.createdAt,
      fromUserName: fromUsers.name,
      toUserName: toUsers.name,
    })
      .from(settlements)
      .leftJoin(fromUsers, eq(settlements.fromUserId, fromUsers.id))
      .leftJoin(toUsers, eq(settlements.toUserId, toUsers.id))
      .where(eq(settlements.groupId, groupId))
      .orderBy(desc(settlements.createdAt));

    return results.map(r => ({
      ...r,
      fromUserName: r.fromUserName || 'Unknown',
      toUserName: r.toUserName || 'Unknown',
    }));
  }

  async getGroupBalances(groupId: number, prefetched?: { members?: User[]; sharedExpenses?: Expense[] }): Promise<{ userId: number; userName: string; balance: number }[]> {
    const [members, sharedExpenses, groupSettlements] = await Promise.all([
      prefetched?.members ?? this.getFamilyMembers(groupId),
      prefetched?.sharedExpenses ?? db.select()
        .from(expenses)
        .where(and(
          eq(expenses.familyId, groupId),
          eq(expenses.visibility, "public")
        )),
      db.select()
        .from(settlements)
        .where(eq(settlements.groupId, groupId)),
    ]);

    const expenseIds = sharedExpenses.map(e => e.id);
    const allSplitRows = expenseIds.length > 0
      ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
      : [];
    const splitsByExpenseId = new Map<number, typeof allSplitRows>();
    for (const split of allSplitRows) {
      const list = splitsByExpenseId.get(split.expenseId) || [];
      list.push(split);
      splitsByExpenseId.set(split.expenseId, list);
    }

    const balances: Record<number, number> = {};
    members.forEach(m => { balances[m.id] = 0; });

    for (const expense of sharedExpenses) {
      const splits = splitsByExpenseId.get(expense.id) || [];
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

    const goalIds = sharedGoals.map(({ goal }) => goal.id);
    const allApprovals = goalIds.length > 0
      ? await db.select().from(goalApprovals).where(inArray(goalApprovals.goalId, goalIds))
      : [];
    const approvalCountByGoalId = new Map<number, number>();
    for (const approval of allApprovals) {
      approvalCountByGoalId.set(approval.goalId, (approvalCountByGoalId.get(approval.goalId) || 0) + 1);
    }

    const goalsWithApprovals = sharedGoals.map(({ goal, creatorName }) => ({
      ...goal,
      creatorName,
      approvalCount: approvalCountByGoalId.get(goal.id) || 0,
    }));

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

  // Friend Groups
  async getFriendGroupExpenses(groupId: number): Promise<(Expense & { splits: ExpenseSplit[] })[]> {
    const groupExpenses = await db.select().from(expenses)
      .where(and(eq(expenses.familyId, groupId), eq(expenses.visibility, "public")))
      .orderBy(desc(expenses.date));

    if (groupExpenses.length === 0) return [];

    const expenseIds = groupExpenses.map(e => e.id);
    const allSplits = await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds));
    const splitMap = new Map<number, ExpenseSplit[]>();
    for (const s of allSplits) {
      const list = splitMap.get(s.expenseId) || [];
      list.push({ ...s, amount: s.amount.toString() });
      splitMap.set(s.expenseId, list);
    }
    return groupExpenses.map(e => ({ ...e, splits: splitMap.get(e.id) || [] }));
  }

  async createFriendGroup(data: { name: string; currency?: string; creatorId: number }): Promise<Family> {
    // Retry until unique code is found
    let code: string;
    let attempts = 0;
    while (true) {
      attempts++;
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `FRD-${rand}`;
      const existing = await db.select({ id: families.id }).from(families).where(eq(families.code, code));
      if (existing.length === 0) break;
      if (attempts > 10) throw new Error("Failed to generate unique invite code");
    }
    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(families).values({
        name: data.name,
        code,
        groupType: "friends",
        currency: data.currency || "EUR",
        archived: false,
      }).returning();

      await tx.insert(friendGroupMembers).values({
        groupId: created.id,
        userId: data.creatorId,
        role: "admin",
      });

      return created;
    });

    return group;
  }

  async getFriendGroupsForUser(userId: number): Promise<(Family & { memberCount: number; memberRole: string })[]> {
    const memberships = await db.select({
      groupId: friendGroupMembers.groupId,
      role: friendGroupMembers.role,
    }).from(friendGroupMembers).where(eq(friendGroupMembers.userId, userId));

    if (memberships.length === 0) return [];

    const groupIds = memberships.map(m => m.groupId);
    const roleMap = new Map(memberships.map(m => [m.groupId, m.role]));

    const groupList = await db.select().from(families)
      .where(and(
        inArray(families.id, groupIds),
        eq(families.groupType, "friends")
      ));

    const allMemberCounts = await db.select({
      groupId: friendGroupMembers.groupId,
    }).from(friendGroupMembers).where(inArray(friendGroupMembers.groupId, groupIds));

    const countMap = new Map<number, number>();
    for (const m of allMemberCounts) {
      countMap.set(m.groupId, (countMap.get(m.groupId) || 0) + 1);
    }

    return groupList.map(g => ({
      ...g,
      memberCount: countMap.get(g.id) || 0,
      memberRole: roleMap.get(g.id) || "member",
    }));
  }

  async getFriendGroup(groupId: number): Promise<(Family & { members: (User & { memberRole: string })[] }) | undefined> {
    const [group] = await db.select().from(families)
      .where(and(eq(families.id, groupId), eq(families.groupType, "friends")));
    if (!group) return undefined;

    const members = await this.getFriendGroupMembers(groupId);
    return { ...group, members };
  }

  async getFriendGroupMembers(groupId: number): Promise<(User & { memberRole: string })[]> {
    const results = await db.select({
      user: users,
      role: friendGroupMembers.role,
    })
      .from(friendGroupMembers)
      .innerJoin(users, eq(friendGroupMembers.userId, users.id))
      .where(eq(friendGroupMembers.groupId, groupId));

    return results.map(r => ({ ...r.user, memberRole: r.role }));
  }

  async isFriendGroupMember(groupId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ id: friendGroupMembers.id })
      .from(friendGroupMembers)
      .where(and(eq(friendGroupMembers.groupId, groupId), eq(friendGroupMembers.userId, userId)));
    return !!row;
  }

  async joinFriendGroup(code: string, userId: number): Promise<Family> {
    const [group] = await db.select().from(families)
      .where(and(eq(families.code, code), eq(families.groupType, "friends")));
    if (!group) throw new Error("Invalid invite code");
    if (group.archived) throw new Error("This group is archived");

    const alreadyMember = await this.isFriendGroupMember(group.id, userId);
    if (alreadyMember) throw new Error("Already a member of this group");

    await db.insert(friendGroupMembers).values({
      groupId: group.id,
      userId,
      role: "member",
    });

    return group;
  }

  async leaveFriendGroup(groupId: number, userId: number): Promise<void> {
    await db.delete(friendGroupMembers).where(
      and(eq(friendGroupMembers.groupId, groupId), eq(friendGroupMembers.userId, userId))
    );
  }

  async archiveFriendGroup(groupId: number): Promise<Family> {
    const [updated] = await db.update(families)
      .set({ archived: true })
      .where(eq(families.id, groupId))
      .returning();
    return updated;
  }

  async getFriendGroupNetBalances(groupId: number): Promise<{ fromUserId: number; fromName: string; toUserId: number; toName: string; amount: number }[]> {
    const members = await this.getFriendGroupMembers(groupId);

    const [sharedExpenses, groupSettlements] = await Promise.all([
      db.select().from(expenses).where(and(
        eq(expenses.familyId, groupId),
        eq(expenses.visibility, "public")
      )),
      db.select().from(settlements).where(eq(settlements.groupId, groupId)),
    ]);

    const expenseIds = sharedExpenses.map(e => e.id);
    const allSplitRows = expenseIds.length > 0
      ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
      : [];

    const splitsByExpenseId = new Map<number, typeof allSplitRows>();
    for (const split of allSplitRows) {
      const list = splitsByExpenseId.get(split.expenseId) || [];
      list.push(split);
      splitsByExpenseId.set(split.expenseId, list);
    }

    const balances: Record<number, number> = {};
    members.forEach(m => { balances[m.id] = 0; });

    for (const expense of sharedExpenses) {
      const splits = splitsByExpenseId.get(expense.id) || [];
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

    const nameMap = new Map(members.map(m => [m.id, m.name]));

    // Greedy debt-minimization (simplify net bilateral balances)
    type Entry = { userId: number; balance: number };
    const creditors: Entry[] = [];
    const debtors: Entry[] = [];

    for (const [userIdStr, bal] of Object.entries(balances)) {
      const userId = Number(userIdStr);
      const rounded = Math.round(bal * 100) / 100;
      if (rounded > 0.005) creditors.push({ userId, balance: rounded });
      else if (rounded < -0.005) debtors.push({ userId, balance: rounded });
    }

    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => a.balance - b.balance);

    const result: { fromUserId: number; fromName: string; toUserId: number; toName: string; amount: number }[] = [];

    let ci = 0;
    let di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];
      const amount = Math.min(creditor.balance, -debtor.balance);
      const roundedAmount = Math.round(amount * 100) / 100;
      if (roundedAmount > 0.005) {
        result.push({
          fromUserId: debtor.userId,
          fromName: nameMap.get(debtor.userId) || "Unknown",
          toUserId: creditor.userId,
          toName: nameMap.get(creditor.userId) || "Unknown",
          amount: roundedAmount,
        });
      }
      creditor.balance -= amount;
      debtor.balance += amount;
      if (creditor.balance < 0.005) ci++;
      if (debtor.balance > -0.005) di++;
    }

    return result;
  }
}

export const storage = new DatabaseStorage();
