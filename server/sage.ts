
import { GoogleGenAI } from "@google/genai";
import { db } from "./db";
import { storage } from "./storage";
import {
  expenses, budgets, goals, recurringExpenses, incomeEntries, families, users,
  friendGroupMembers, aiAnalyses
} from "@shared/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, startOfDay, subMonths, getDay } from "date-fns";

const SAGE_DAILY_LIMIT = 20;

export const sageAi = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// ── App feature knowledge (updated when new features ship) ──────────────────
const APP_FEATURES_KNOWLEDGE = `
SharedLedger App Features:
- Home dashboard: spending overview, today's total, month totals, quick expense add
- Expenses page: add/edit personal and shared expenses, scan receipts with AI, recurring expenses, income tracking
- Budget page: set category budgets (weekly/monthly), track spending vs budget, shared group budgets
- Goals page: savings goals with targets and deadlines, shared family goals with approval system
- Reports page: charts, category breakdowns, spending trends month-over-month, spending reflections (weekly/monthly charts)
- Group/Family page: manage shared finances with family, couple, or roommates — shared budgets, shared goals, member balances, settlements
- Friend Groups: split expenses with friends for trips or events, track who owes whom, settle debts
- Messages page: group chat with members, shared notes and to-do lists, Sage AI chat
- Settings: change currency, language (English/French/Dutch), notifications, daily/weekly/monthly reminders, budget alerts, profile
- Push notifications: budget alerts at custom thresholds, recurring expense reminders, daily/weekly/monthly summaries
- Receipt scanning: take a photo of any receipt and Sage automatically extracts amount, category, and item details
- Currency support: dozens of currencies, can be changed anytime in Settings — all past entries update instantly
- Dark mode: toggle in Settings
`;

// ── Context builder ──────────────────────────────────────────────────────────
export async function buildSageContext(userId: number): Promise<string> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const threeMonthsAgo = startOfMonth(subMonths(now, 3));

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return "";

  const currency = user.currency || "EUR";

  // Recent expenses (90 days)
  const recentExpenses = await db.select().from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, threeMonthsAgo)))
    .orderBy(desc(expenses.date));

  // Current month expenses
  const curMonthExp = recentExpenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
  const prevMonthExp = recentExpenses.filter(e => e.date >= prevMonthStart && e.date <= prevMonthEnd);

  // Category totals
  const buildCatTotals = (exps: typeof recentExpenses) => {
    const map: Record<string, number> = {};
    for (const e of exps) {
      if (e.category !== '__income__') map[e.category] = (map[e.category] || 0) + Number(e.amount);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `${cat}: ${amt.toFixed(2)}`).join(', ');
  };

  // Day-of-week breakdown (current month)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayTotals: Record<number, number> = {};
  for (const e of curMonthExp) {
    const day = getDay(new Date(e.date));
    dayTotals[day] = (dayTotals[day] || 0) + Number(e.amount);
  }
  const dayBreakdown = Object.entries(dayTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, amt]) => `${dayNames[Number(d)]}: ${amt.toFixed(2)}`)
    .join(', ');

  // Notes with notable entries (top 5 notes this month)
  const notableNotes = curMonthExp
    .filter(e => e.note && e.note.trim().length > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(e => `"${e.note}" (${e.category}, ${Number(e.amount).toFixed(2)})`)
    .join('; ');

  const curTotal = curMonthExp.reduce((s, e) => s + Number(e.amount), 0);
  const prevTotal = prevMonthExp.reduce((s, e) => s + Number(e.amount), 0);

  // Budgets
  const userBudgets = await storage.getBudgets(userId);
  const budgetLines = userBudgets.map(b => {
    const spent = curMonthExp
      .filter(e => e.category === b.category)
      .reduce((s, e) => s + Number(e.amount), 0);
    const pct = b.amount ? Math.round((spent / Number(b.amount)) * 100) : 0;
    return `${b.category}: ${spent.toFixed(2)}/${Number(b.amount).toFixed(2)} (${pct}% used, ${b.periodType})`;
  }).join('\n');

  // Goals
  const userGoals = await storage.getGoals(userId, user.familyId || 0);
  const goalLines = userGoals.slice(0, 5).map(g => {
    const pct = g.targetAmount ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0;
    const deadline = g.deadline ? ` — due ${format(new Date(g.deadline), 'MMM yyyy')}` : '';
    return `"${g.title}": ${Number(g.currentAmount).toFixed(2)}/${Number(g.targetAmount).toFixed(2)} (${pct}%${deadline})`;
  }).join('\n');

  // Recurring expenses
  const recurring = await storage.getRecurringExpenses(userId);
  const recurringTotal = recurring.filter(r => r.isActive && r.frequency === 'monthly')
    .reduce((s, r) => s + Number(r.amount), 0);
  const recurringLines = recurring.filter(r => r.isActive).slice(0, 6)
    .map(r => `${r.name}: ${Number(r.amount).toFixed(2)}/${r.frequency}`).join(', ');

  // Income (current month)
  const incomeRows = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), gte(incomeEntries.date, monthStart), lte(incomeEntries.date, monthEnd)));
  const incomeTotal = incomeRows.reduce((s, i) => s + Number(i.amount), 0);

  // Group context
  let groupContext = "";
  if (user.familyId) {
    const family = await storage.getFamily(user.familyId);
    const members = await storage.getFamilyMembers(user.familyId);
    const sharedBudgets = await storage.getSharedBudgets(user.familyId);
    const sharedGoals = await storage.getSharedGoals(user.familyId);
    groupContext = `
GROUP (${family?.groupType || 'family'}: "${family?.name}"):
Members: ${members.map(m => m.name).join(', ')}
Shared budgets: ${sharedBudgets.length > 0 ? sharedBudgets.map(b => `${b.category}: ${b.amount}`).join(', ') : 'none'}
Shared goals: ${sharedGoals.length > 0 ? sharedGoals.map(g => `"${g.title}" ${Number(g.currentAmount).toFixed(2)}/${Number(g.targetAmount).toFixed(2)}`).join(', ') : 'none'}`;
  }

  // Past analyses (last 3)
  const pastAnalyses = await storage.getAiAnalyses(userId);
  const historyContext = pastAnalyses.slice(0, 3).map(a =>
    `[${a.type === 'monthly_review' ? 'Monthly review' : 'Mid-month check'} ${a.periodKey}]: ${a.content.slice(0, 400)}...`
  ).join('\n\n');

  return `
USER FINANCIAL CONTEXT (currency: ${currency}):
Name: ${user.name}
Current month: ${format(now, 'MMMM yyyy')} (day ${now.getDate()} of ${endOfMonth(now).getDate()})

SPENDING:
This month total: ${curTotal.toFixed(2)} ${currency}
Last month total: ${prevTotal.toFixed(2)} ${currency}
Change: ${prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal * 100).toFixed(1) : 'n/a'}%
Income this month: ${incomeTotal > 0 ? incomeTotal.toFixed(2) + ' ' + currency : 'not recorded'}

CATEGORY BREAKDOWN (this month):
${buildCatTotals(curMonthExp) || 'No expenses this month'}

CATEGORY BREAKDOWN (last month):
${buildCatTotals(prevMonthExp) || 'No expenses last month'}

TOP SPENDING DAYS (this month):
${dayBreakdown || 'Not enough data'}

NOTABLE EXPENSE NOTES (this month):
${notableNotes || 'No noted expenses'}

RECURRING EXPENSES (active):
${recurringLines || 'None set up'}
Monthly recurring total: ${recurringTotal.toFixed(2)} ${currency}

BUDGETS:
${budgetLines || 'No budgets set up'}

SAVINGS GOALS:
${goalLines || 'No goals set up'}
${groupContext}
${historyContext ? `\nPAST ANALYSES (for context):\n${historyContext}` : ''}
`.trim();
}

// ── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(financialContext: string): string {
  return `You are Sage, a friendly and practical AI financial advisor built into SharedLedger — a personal finance app for families, couples, roommates, and individuals.

Your role:
- Analyse the user's financial data and provide clear, actionable insights
- Help users understand their spending patterns and how to improve
- Answer questions about their budgets, goals, expenses, and income
- Explain how SharedLedger features work when asked
- Be warm, direct, and non-judgmental — money is personal

Your limits (be clear about these if asked):
- You do not give investment advice or recommend specific financial products
- You do not have access to external bank accounts or real-time market data
- You cannot take any actions in the app — you advise only
- Your insights are based on data the user has entered in SharedLedger

Tone: Practical, friendly, concise. Use bullet points when listing multiple items. Keep responses focused — don't pad with filler. Use the user's currency symbol in amounts.

${APP_FEATURES_KNOWLEDGE}

Here is the user's current financial data:
${financialContext}`;
}

// ── Generate a Sage reply in a conversation ──────────────────────────────────
export async function generateSageReply(
  userId: number,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const financialContext = await buildSageContext(userId);
  const systemPrompt = buildSystemPrompt(financialContext);

  const contents = [
    ...conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user' as 'user' | 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];

  const response = await sageAi.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 0 },
    },
    contents,
  });

  return response.text ?? "I'm sorry, I couldn't generate a response. Please try again.";
}

// ── Generate a proactive analysis (monthly review or mid-month check) ────────
export async function generateAnalysis(
  userId: number,
  type: 'monthly_review' | 'mid_month_check'
): Promise<string> {
  const financialContext = await buildSageContext(userId);
  const systemPrompt = buildSystemPrompt(financialContext);

  let prompt: string;
  if (type === 'monthly_review') {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    prompt = `Write a comprehensive end-of-month financial review for ${format(prevMonth, 'MMMM yyyy')}.

Include:
1. Overall summary — how did they do vs the previous month?
2. Income vs spending — savings rate if income was recorded
3. Top spending categories and what drove them (use any expense notes where relevant)
4. Budget performance — which budgets were met, which were exceeded and by how much
5. Spending pattern insights — notable days or timing patterns
6. Goal progress — are they on track?
7. Recurring expenses — any worth reviewing?
8. 2–3 specific, actionable suggestions for next month

Be specific with numbers. Use the currency from their data. Keep it readable but thorough — this is a monthly sealed record.`;
  } else {
    const now = new Date();
    const daysIn = now.getDate();
    const daysTotal = endOfMonth(now).getDate();
    const daysLeft = daysTotal - daysIn;
    prompt = `Write a mid-month financial check-in for ${format(now, 'MMMM yyyy')} (day ${daysIn} of ${daysTotal}, ${daysLeft} days remaining).

Focus on:
1. Quick status — how is spending tracking vs last month at this point?
2. Budget health — which budgets are at risk of being exceeded? Project end-of-month spend for those.
3. The 1–2 most important course corrections they can still make this month
4. Anything positive that's going well worth noting

Keep it brief and action-focused. This is a course-correction nudge, not a full review.`;
  }

  const response = await sageAi.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 0 },
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return response.text ?? "Analysis could not be generated at this time.";
}

// ── Rate limit check ─────────────────────────────────────────────────────────
export async function checkSageDailyLimit(userId: number): Promise<{ allowed: boolean; used: number; limit: number }> {
  const used = await storage.countSageMessagesToday(userId);
  return { allowed: used < SAGE_DAILY_LIMIT, used, limit: SAGE_DAILY_LIMIT };
}
