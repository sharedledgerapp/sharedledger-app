
import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  groupType: text("group_type", { enum: ["family", "roommates", "couple", "friends"] }).default("family").notNull(),
  currency: text("currency").default("EUR"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groups = families;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  role: text("role", { enum: ["parent", "child", "member"] }).notNull(),
  familyId: integer("family_id").references(() => families.id),
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),
  email: text("email").unique(),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  shareTotalsConsent: boolean("share_totals_consent").default(true).notNull(),
  profileImageUrl: text("profile_image_url"),
  language: text("language", { enum: ["en", "fr", "nl"] }).default("en").notNull(),
  currency: text("currency").default("EUR").notNull(),
  categories: text("categories").array(),
  recurringCategories: text("recurring_categories").array(),
  dailyReminderTime: text("daily_reminder_time").default("19:00").notNull(),
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(true).notNull(),
  weeklyReminderEnabled: boolean("weekly_reminder_enabled").default(true).notNull(),
  monthlyReminderEnabled: boolean("monthly_reminder_enabled").default(true).notNull(),
  budgetAlertsEnabled: boolean("budget_alerts_enabled").default(true).notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  includeQuickGroupInSummary: boolean("include_quick_group_in_summary").default(false).notNull(),
  incomeSources: text("income_sources").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  amount: numeric("amount").notNull(),
  category: text("category").notNull(),
  note: text("note"),
  receiptUrl: text("receipt_url"),
  visibility: text("visibility", { enum: ["private", "public"] }).default("private").notNull(),
  splitType: text("split_type", { enum: ["none", "equal", "exact", "percentage"] }).default("none").notNull(),
  paymentSource: text("payment_source", { enum: ["personal", "family"] }).default("personal").notNull(),
  paidByUserId: integer("paid_by_user_id").references(() => users.id),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSplits = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
});

export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull().references(() => users.id),
  toUserId: integer("to_user_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => families.id),
  amount: numeric("amount").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  isGroupShared: boolean("is_group_shared").default(false).notNull(),
  dueDay: integer("due_day"),
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderDaysBefore: integer("reminder_days_before").default(3),
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  budgetScope: text("budget_scope", { enum: ["personal", "shared"] }).default("personal").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount").notNull(),
  periodType: text("period_type", { enum: ["weekly", "monthly"] }).default("monthly").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(false).notNull(),
  thresholds: text("thresholds").array(),
  note: text("note"),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const budgetSetupPrompts = pgTable("budget_setup_prompts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "dismissed", "remind_week", "remind_month", "completed"] }).default("pending").notNull(),
  remindAt: timestamp("remind_at"),
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
  settlements: many(settlements),
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
  paidByUser: one(users, {
    fields: [expenses.paidByUserId],
    references: [users.id],
    relationName: "paidByExpenses",
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

export const settlementsRelations = relations(settlements, ({ one }) => ({
  fromUser: one(users, {
    fields: [settlements.fromUserId],
    references: [users.id],
    relationName: "settlementsFrom",
  }),
  toUser: one(users, {
    fields: [settlements.toUserId],
    references: [users.id],
    relationName: "settlementsTo",
  }),
  group: one(families, {
    fields: [settlements.groupId],
    references: [families.id],
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

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [budgets.familyId],
    references: [families.id],
  }),
}));

export const budgetSetupPromptsRelations = relations(budgetSetupPrompts, ({ one }) => ({
  user: one(users, {
    fields: [budgetSetupPrompts.userId],
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

export const friendGroupMembers = pgTable("friend_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => families.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["admin", "member"] }).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pushNotificationLog = pgTable("push_notification_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const incomeEntries = pgTable("income_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  familyId: integer("family_id").references(() => families.id),
  amount: numeric("amount").notNull(),
  source: text("source", { enum: ["Family / Parents", "Work", "Gift or Unexpected", "Scholarship or Grant", "Other"] }).notNull(),
  note: text("note"),
  date: timestamp("date").defaultNow().notNull(),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurringInterval: text("recurring_interval", { enum: ["weekly", "monthly", "tri-monthly"] }),
  shareDetails: boolean("share_details"),
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderDaysBefore: integer("reminder_days_before").default(3),
  createdAt: timestamp("created_at").defaultNow(),
});

export const friendGroupMembersRelations = relations(friendGroupMembers, ({ one }) => ({
  group: one(families, {
    fields: [friendGroupMembers.groupId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [friendGroupMembers.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const pushNotificationLogRelations = relations(pushNotificationLog, ({ one }) => ({
  user: one(users, {
    fields: [pushNotificationLog.userId],
    references: [users.id],
  }),
}));

export const incomeEntriesRelations = relations(incomeEntries, ({ one }) => ({
  user: one(users, {
    fields: [incomeEntries.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [incomeEntries.familyId],
    references: [families.id],
  }),
}));

export const sageConversations = pgTable("sage_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sageMessages = pgTable("sage_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => sageConversations.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  feedback: integer("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiAnalyses = pgTable("ai_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["monthly_review", "mid_month_check"] }).notNull(),
  periodKey: text("period_key").notNull(),
  content: text("content").notNull(),
  dataSnapshot: text("data_snapshot"),
  feedback: integer("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sageConversationsRelations = relations(sageConversations, ({ one, many }) => ({
  user: one(users, { fields: [sageConversations.userId], references: [users.id] }),
  messages: many(sageMessages),
}));

export const sageMessagesRelations = relations(sageMessages, ({ one }) => ({
  conversation: one(sageConversations, { fields: [sageMessages.conversationId], references: [sageConversations.id] }),
}));

export const aiAnalysesRelations = relations(aiAnalyses, ({ one }) => ({
  user: one(users, { fields: [aiAnalyses.userId], references: [users.id] }),
}));

// === ZOD SCHEMAS ===

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true });
export const insertGroupSchema = insertFamilySchema;
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertExpenseSplitSchema = createInsertSchema(expenseSplits).omit({ id: true });
export const insertSettlementSchema = createInsertSchema(settlements).omit({ id: true, createdAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, isApproved: true });
export const insertGoalApprovalSchema = createInsertSchema(goalApprovals).omit({ id: true, createdAt: true });
export const insertAllowanceSchema = createInsertSchema(allowances).omit({ id: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, isCompleted: true });
export const insertRecurringExpenseSchema = createInsertSchema(recurringExpenses).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBudgetSetupPromptSchema = createInsertSchema(budgetSetupPrompts).omit({ id: true, createdAt: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export const insertFriendGroupMemberSchema = createInsertSchema(friendGroupMembers).omit({ id: true, joinedAt: true });
export const insertIncomeEntrySchema = createInsertSchema(incomeEntries).omit({ id: true, createdAt: true });
export const insertSageConversationSchema = createInsertSchema(sageConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSageMessageSchema = createInsertSchema(sageMessages).omit({ id: true, createdAt: true });
export const insertAiAnalysisSchema = createInsertSchema(aiAnalyses).omit({ id: true, createdAt: true });

// === TYPES ===

export type Family = typeof families.$inferSelect;
export type Group = Family;
export type User = typeof users.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalApproval = typeof goalApprovals.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type MessageReadStatus = typeof messageReadStatus.$inferSelect;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type BudgetSetupPrompt = typeof budgetSetupPrompts.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type PushNotificationLog = typeof pushNotificationLog.$inferSelect;
export type FriendGroupMember = typeof friendGroupMembers.$inferSelect;
export type IncomeEntry = typeof incomeEntries.$inferSelect;
export type SageConversation = typeof sageConversations.$inferSelect;
export type SageMessage = typeof sageMessages.$inferSelect;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertGroup = InsertFamily;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertExpenseSplit = z.infer<typeof insertExpenseSplitSchema>;
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertGoalApproval = z.infer<typeof insertGoalApprovalSchema>;
export type InsertAllowance = z.infer<typeof insertAllowanceSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertBudgetSetupPrompt = z.infer<typeof insertBudgetSetupPromptSchema>;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type InsertFriendGroupMember = z.infer<typeof insertFriendGroupMemberSchema>;
export type InsertIncomeEntry = z.infer<typeof insertIncomeEntrySchema>;
export type InsertSageConversation = z.infer<typeof insertSageConversationSchema>;
export type InsertSageMessage = z.infer<typeof insertSageMessageSchema>;
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;

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
  familyCode: z.string().optional(),
  familyName: z.string().optional(),
  groupCode: z.string().optional(),
  groupName: z.string().optional(),
  groupType: z.enum(["family", "roommates", "couple", "friends"]).optional(),
});

export const oauthGroupSetupSchema = z.object({
  groupCode: z.string().optional(),
  groupName: z.string().optional(),
  groupType: z.enum(["family", "roommates", "couple", "friends"]).optional(),
  role: z.enum(["parent", "child", "member"]).optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
