
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(), // Stored as string, handle as number in app
  category: text("category").notNull(),
  note: text("note"),
  receiptUrl: text("receipt_url"),
  visibility: text("visibility", { enum: ["private", "public"] }).default("private").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Nullable if family goal? Spec says "Family Goals created by parent"
  familyId: integer("family_id").references(() => families.id),
  title: text("title").notNull(),
  targetAmount: numeric("target_amount").notNull(),
  currentAmount: numeric("current_amount").default("0").notNull(),
  isFamilyGoal: boolean("is_family_goal").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allowances = pgTable("allowances", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => users.id),
  amount: numeric("amount").notNull(),
  frequency: text("frequency", { enum: ["weekly", "monthly"] }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  })
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [goals.familyId],
    references: [families.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true });
export const insertAllowanceSchema = createInsertSchema(allowances).omit({ id: true, updatedAt: true });

// === TYPES ===

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertAllowance = z.infer<typeof insertAllowanceSchema>;

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
