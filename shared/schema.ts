
import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // Invite code
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Email
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["parent", "child"] }).notNull(),
  familyId: integer("family_id").references(() => families.id),
  shareTotalsConsent: boolean("share_totals_consent").default(true).notNull(),
  profileImageUrl: text("profile_image_url"),
  language: text("language", { enum: ["en", "fr"] }).default("en").notNull(),
  currency: text("currency").default("EUR").notNull(),
  categories: text("categories").array(),
  recurringCategories: text("recurring_categories").array(),
  dailyReminderTime: text("daily_reminder_time").default("19:00").notNull(),
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(true).notNull(),
  weeklyReminderEnabled: boolean("weekly_reminder_enabled").default(true).notNull(),
  monthlyReminderEnabled: boolean("monthly_reminder_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  amount: numeric("amount").notNull(), // Stored as string, handle as number in app
  category: text("category").notNull(),
  note: text("note"),
  receiptUrl: text("receipt_url"),
  visibility: text("visibility", { enum: ["private", "public"] }).default("private").notNull(),
  splitType: text("split_type", { enum: ["none", "equal", "exact"] }).default("none").notNull(),
  paymentSource: text("payment_source", { enum: ["personal", "family"] }).default("personal").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSplits = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
  userId: integer("user_id").notNull().references(() => users.id), // The person who owes
  amount: numeric("amount").notNull(), // Their share
  isPaid: boolean("is_paid").default(false).notNull(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  title: text("title").notNull(),
  targetAmount: numeric("target_amount").notNull(),
  currentAmount: numeric("current_amount").default("0").notNull(),
  visibility: text("visibility", { enum: ["private", "shared", "family"] }).default("private").notNull(),
  isApproved: boolean("is_approved").default(false).notNull(),
  priority: text("priority", { enum: ["low", "medium", "high"] }).default("medium").notNull(),
  deadline: timestamp("deadline"),
  note: text("note"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goalApprovals = pgTable("goal_approvals", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allowances = pgTable("allowances", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(),
  frequency: text("frequency", { enum: ["weekly", "monthly"] }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => families.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => families.id),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurringExpenses = pgTable("recurring_expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  name: text("name").notNull(),
  amount: numeric("amount").notNull(),
  category: text("category").notNull(),
  frequency: text("frequency", { enum: ["monthly", "quarterly", "yearly"] }).default("monthly").notNull(),
  note: text("note"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReadStatus = pgTable("message_read_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").notNull().references(() => families.id),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
});

// === RELATIONS ===

export const familiesRelations = relations(families, ({ many }) => ({
  users: many(users),
  goals: many(goals),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  family: one(families, {
    fields: [users.familyId],
    references: [families.id],
  }),
  expenses: many(expenses),
  goals: many(goals),
  allowance: one(allowances, {
     fields: [users.id],
     references: [allowances.childId]
  }),
  splits: many(expenseSplits),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [goals.familyId],
    references: [families.id],
  }),
  approvals: many(goalApprovals),
}));

export const goalApprovalsRelations = relations(goalApprovals, ({ one }) => ({
  goal: one(goals, {
    fields: [goalApprovals.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalApprovals.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  family: one(families, {
    fields: [messages.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  family: one(families, {
    fields: [notes.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const recurringExpensesRelations = relations(recurringExpenses, ({ one }) => ({
  user: one(users, {
    fields: [recurringExpenses.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [recurringExpenses.familyId],
    references: [families.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertExpenseSplitSchema = createInsertSchema(expenseSplits).omit({ id: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, isApproved: true });
export const insertGoalApprovalSchema = createInsertSchema(goalApprovals).omit({ id: true, createdAt: true });
export const insertAllowanceSchema = createInsertSchema(allowances).omit({ id: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, isCompleted: true });
export const insertRecurringExpenseSchema = createInsertSchema(recurringExpenses).omit({ id: true, createdAt: true });

// === TYPES ===

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalApproval = typeof goalApprovals.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type MessageReadStatus = typeof messageReadStatus.$inferSelect;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertExpenseSplit = z.infer<typeof insertExpenseSplitSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertGoalApproval = z.infer<typeof insertGoalApprovalSchema>;
export type InsertAllowance = z.infer<typeof insertAllowanceSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;

// Request types
export type CreateExpenseRequest = InsertExpense;
export type CreateGoalRequest = InsertGoal;
export type CreateAllowanceRequest = InsertAllowance;
export type UpdateGoalRequest = Partial<InsertGoal>;
export type UpdateAllowanceRequest = Partial<InsertAllowance>;

// Auth-specific
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = insertUserSchema.extend({
  familyCode: z.string().optional(), // For joining existing
  familyName: z.string().optional(), // For creating new
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
