
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
- Messages page: group chat with members, shared notes and to-do lists, Sage AI chat, personal private notes
- Settings: change currency, language (English/French/Dutch), notifications, daily/weekly/monthly reminders, budget alerts, profile, Sage AI financial profile
- Push notifications: budget alerts at custom thresholds, recurring expense reminders, daily/weekly/monthly summaries, note-taking reminders at month milestones
- Receipt scanning: take a photo of any receipt and Sage automatically extracts amount, category, and item details
- Currency support: dozens of currencies, can be changed anytime in Settings — all past entries update instantly
- Dark mode: toggle in Settings
- Personal Notes: private notes only visible to the owner. Users can allow Sage to read these for better advice (opt-in in Settings)
- Financial Profile: users can describe their financial habits in Settings so Sage understands them better from the start
`;

// ── Context builder ──────────────────────────────────────────────────────────
export async function buildSageContext(userId: number): Promise<string> {
  const now = new Date();
  const threeMonthsAgo = startOfMonth(subMonths(now, 2));

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return "";

  const currency = user.currency || "EUR";

  // ── User permission flags ─────────────────────────────────────────────────
  // Default true for data access (opt-out); default false for notes (opt-in)
  const expenseAllowed = user.sageExpensePermission !== false;
  const incomeAllowed = user.sageIncomePermission !== false;
  const budgetGoalsAllowed = user.sageBudgetGoalsPermission !== false;

  // ── All expenses for the last 3 months (gated) ────────────────────────────
  type ExpenseRow = typeof expenses.$inferSelect;
  let recentExpenses: ExpenseRow[] = [];
  if (expenseAllowed) {
    recentExpenses = await db.select().from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.date, threeMonthsAgo)))
      .orderBy(desc(expenses.date));
  }

  // ── Build per-month breakdowns (3 months) ──────────────────────────────────
  const monthBreakdowns: Array<{ label: string; total: number; cats: string; count: number }> = [];
  for (let i = 2; i >= 0; i--) {
    const mStart = startOfMonth(subMonths(now, i));
    const mEnd = endOfMonth(subMonths(now, i));
    const mExp = recentExpenses.filter(e =>
      e.date >= mStart && e.date <= mEnd && e.category !== '__income__'
    );
    const mTotal = mExp.reduce((s, e) => s + Number(e.amount), 0);
    const catMap: Record<string, number> = {};
    for (const e of mExp) {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    }
    const cats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat}: ${amt.toFixed(2)}`)
      .join(', ');
    monthBreakdowns.push({ label: format(mStart, 'MMM yyyy'), total: mTotal, cats, count: mExp.length });
  }

  // ── Day-of-week breakdown (current month) ──────────────────────────────────
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const curMonthExp = recentExpenses.filter(e =>
    e.date >= mStart && e.date <= mEnd && e.category !== '__income__'
  );
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

  // ── All expense notes across 90 days ──────────────────────────────────────
  const allExpenseNotes = recentExpenses
    .filter(e => e.note && e.note.trim().length > 0 && e.category !== '__income__')
    .slice(0, 20)
    .map(e => `"${e.note}" (${e.category}, ${Number(e.amount).toFixed(2)}, ${format(new Date(e.date), 'MMM d')})`);

  // ── Income history (3 months) (gated) ────────────────────────────────────
  type IncomeRow = typeof incomeEntries.$inferSelect;
  let incomeHistory: IncomeRow[] = [];
  if (incomeAllowed) {
    incomeHistory = await db.select().from(incomeEntries)
      .where(and(eq(incomeEntries.userId, userId), gte(incomeEntries.date, threeMonthsAgo)))
      .orderBy(desc(incomeEntries.date));
  }

  // Per-month income totals
  const incomeByMonth: Record<string, number> = {};
  for (const entry of incomeHistory) {
    const key = format(new Date(entry.date), 'MMM yyyy');
    incomeByMonth[key] = (incomeByMonth[key] || 0) + Number(entry.amount);
  }

  // Income by source (cumulative)
  const incomeBySource: Record<string, number> = {};
  for (const entry of incomeHistory) {
    incomeBySource[entry.source] = (incomeBySource[entry.source] || 0) + Number(entry.amount);
  }
  const incomeSourceLines = Object.entries(incomeBySource)
    .sort((a, b) => b[1] - a[1])
    .map(([src, amt]) => `${src}: ${amt.toFixed(2)}`)
    .join(', ');

  // Income notes (up to 15 across 90 days)
  const incomeNotes = incomeHistory
    .filter(e => e.note && e.note.trim().length > 0)
    .slice(0, 15)
    .map(e => `"${e.note}" (${e.source}, ${Number(e.amount).toFixed(2)}, ${format(new Date(e.date), 'MMM d')})`);

  // Income timing — average day of month income arrives
  const incomeDays = incomeHistory.map(e => new Date(e.date).getDate());
  const avgIncomeDay = incomeDays.length > 0
    ? Math.round(incomeDays.reduce((a, b) => a + b, 0) / incomeDays.length)
    : null;

  // Monthly income per-month summary
  const incomeMonthlyLines = monthBreakdowns.map(m => {
    const total = incomeByMonth[m.label] || 0;
    return `${m.label}: ${total > 0 ? total.toFixed(2) + ' ' + currency : 'not recorded'}`;
  }).join(' | ');

  // ── Budgets (gated) ───────────────────────────────────────────────────────
  let budgetLines = "";
  let budgetBehaviorLines = "";
  let recurringLines = "";
  let recurringTotal = 0;
  if (budgetGoalsAllowed) {
    const userBudgets = await storage.getBudgets(userId);

    // Per-month spending per category for the last 3 months
    const monthKeys = monthBreakdowns.map(m => m.label); // ['Feb 2025', 'Mar 2025', 'Apr 2025']
    const catMonthSpend: Record<string, number[]> = {}; // category -> [m-2 spend, m-1 spend, m0 spend]
    for (let i = 2; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(subMonths(now, i));
      const mExp = recentExpenses.filter(e =>
        e.date >= mStart && e.date <= mEnd && e.category !== '__income__'
      );
      for (const b of userBudgets) {
        const spent = mExp
          .filter(e => e.category === b.category)
          .reduce((s, e) => s + Number(e.amount), 0);
        if (!catMonthSpend[b.category]) catMonthSpend[b.category] = [];
        catMonthSpend[b.category].push(spent);
      }
    }

    // Current month lines (this month's progress)
    budgetLines = userBudgets.map(b => {
      const spent = curMonthExp
        .filter(e => e.category === b.category)
        .reduce((s, e) => s + Number(e.amount), 0);
      const limit = Number(b.amount);
      const pct = limit ? Math.round((spent / limit) * 100) : 0;
      const changeNote = (b.changeCount ?? 0) > 1 ? ` [adjusted ${b.changeCount} times]` : '';
      return `${b.category}: ${spent.toFixed(2)}/${limit.toFixed(2)} (${pct}% used, ${b.periodType}${changeNote})`;
    }).join('\n');

    // Budget behavioral analysis — identify consistently overspent budgets
    const behaviorEntries: string[] = [];
    for (const b of userBudgets) {
      const limit = Number(b.amount);
      if (!limit) continue;
      const monthlySpends = catMonthSpend[b.category] || [];
      const overspentMonths = monthlySpends.filter((s, idx) => {
        // For current month (last entry), only flag if already over
        return s > limit;
      });
      const monthLabels = monthKeys.map((label, idx) => {
        const s = monthlySpends[idx] ?? 0;
        return `${label}: ${s.toFixed(2)}${s > limit ? ' ⚠ OVER' : ''}`;
      }).join(' | ');
      if (overspentMonths.length >= 2) {
        const changeNote = (b.changeCount ?? 0) > 1
          ? ` Budget has been adjusted ${b.changeCount} times already.`
          : '';
        behaviorEntries.push(
          `CONSISTENTLY OVERSPENT — ${b.category} (limit: ${limit.toFixed(2)}/month): ${monthLabels}.${changeNote}`
        );
      } else if (overspentMonths.length === 1 && (b.changeCount ?? 0) > 1) {
        behaviorEntries.push(
          `FREQUENT ADJUSTMENT — ${b.category} (limit: ${limit.toFixed(2)}/month, adjusted ${b.changeCount} times): ${monthLabels}`
        );
      }
    }
    budgetBehaviorLines = behaviorEntries.join('\n');

    const recurring = await storage.getRecurringExpenses(userId);
    recurringTotal = recurring.filter(r => r.isActive && r.frequency === 'monthly')
      .reduce((s, r) => s + Number(r.amount), 0);
    recurringLines = recurring.filter(r => r.isActive).slice(0, 6)
      .map(r => `${r.name}: ${Number(r.amount).toFixed(2)}/${r.frequency}`).join(', ');
  }

  // ── Goals (gated) ─────────────────────────────────────────────────────────
  let goalLines = "";
  if (budgetGoalsAllowed) {
    const userGoals = await storage.getGoals(userId, user.familyId || 0);
    goalLines = userGoals.slice(0, 5).map(g => {
      const pct = g.targetAmount ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0;
      const deadline = g.deadline ? ` — due ${format(new Date(g.deadline), 'MMM yyyy')}` : '';
      return `"${g.title}": ${Number(g.currentAmount).toFixed(2)}/${Number(g.targetAmount).toFixed(2)} (${pct}%${deadline})`;
    }).join('\n');
  }

  // ── Group context ──────────────────────────────────────────────────────────
  let groupContext = "";
  if (user.familyId) {
    const family = await storage.getFamily(user.familyId);
    const members = await storage.getFamilyMembers(user.familyId);
    const sharedBudgets = await storage.getSharedBudgets(user.familyId);
    const sharedGoals = await storage.getSharedGoals(user.familyId);
    const memberIntentions = members
      .filter(m => m.id !== userId && (m as any).onboardingIntention?.trim())
      .map(m => `  - ${m.name}: "${(m as any).onboardingIntention!.trim()}"`)
      .join('\n');
    groupContext = `
GROUP (${family?.groupType || 'family'}: "${family?.name}"):
Members: ${members.map(m => m.name).join(', ')}
Shared budgets: ${sharedBudgets.length > 0 ? sharedBudgets.map(b => `${b.category}: ${b.amount}`).join(', ') : 'none'}
Shared goals: ${sharedGoals.length > 0 ? sharedGoals.map(g => `"${g.title}" ${Number(g.currentAmount).toFixed(2)}/${Number(g.targetAmount).toFixed(2)}`).join(', ') : 'none'}${memberIntentions ? `\nOther members' intentions:\n${memberIntentions}` : ''}`;
  }

  // ── Past analyses ──────────────────────────────────────────────────────────
  const pastAnalyses = await storage.getAiAnalyses(userId);
  const historyContext = pastAnalyses.slice(0, 3).map(a =>
    `[${a.type === 'monthly_review' ? 'Monthly review' : 'Mid-month check'} ${a.periodKey}]: ${a.content.slice(0, 400)}...`
  ).join('\n\n');

  // ── Personal notes (if user granted permission) ────────────────────────────
  let personalNotesContext = "";
  if (user.sageNotesPermission) {
    const personalNotes = await storage.getPersonalNotes(userId);
    const activeNotes = personalNotes
      .filter(n => !n.isCompleted)
      .slice(0, 6)
      .map(n => `"${n.title}"${n.content ? ': ' + n.content.slice(0, 300) : ''}`);
    if (activeNotes.length > 0) {
      personalNotesContext = `
PERSONAL NOTES (user has shared these with you for better advice):
${activeNotes.join('\n')}`;
    }
  }

  // ── Financial profile, life stage & onboarding intention ───────────────────
  const lifeStageArr: string[] = (user as any).lifeStage || [];
  const lifeStageContext = lifeStageArr.length > 0
    ? `\nUSER'S LIFE STAGE: ${lifeStageArr.join(", ")} — factor this into any advice about budgeting, saving, income expectations, and priorities.`
    : "";

  const profileContext = user.financialProfile?.trim()
    ? `\nUSER'S FINANCIAL PROFILE (written by the user to help you understand them):\n${user.financialProfile.trim()}`
    : "";

  const intentionContext = (user as any).onboardingIntention?.trim()
    ? `\nUSER'S ORIGINAL INTENTION (what they said when they first joined — treat this as their north star):\n"${(user as any).onboardingIntention.trim()}"\nReference this in monthly reviews and when their behaviour aligns with or diverges from this intention.`
    : "";

  // ── Trend context ──────────────────────────────────────────────────────────
  const monthTrend = monthBreakdowns.map(m =>
    `${m.label}: ${m.total > 0 ? m.total.toFixed(2) + ' ' + currency + ` (${m.count} expenses)` : 'no data'}`
  ).join(' → ');

  // ── Data access summary for Sage ──────────────────────────────────────────
  const restrictions: string[] = [];
  if (!expenseAllowed) restrictions.push("expense history");
  if (!incomeAllowed) restrictions.push("income data");
  if (!budgetGoalsAllowed) restrictions.push("budgets & goals");
  if (!user.sageNotesPermission) restrictions.push("personal notes (not shared by user)");
  const dataAccessNote = restrictions.length > 0
    ? `\nDATA ACCESS RESTRICTIONS (user has chosen not to share these with Sage): ${restrictions.join(', ')}.\nIf the user asks about restricted data, politely explain they can enable access in Settings > Sage AI.`
    : "\nDATA ACCESS: Full access granted by user.";

  return `
USER FINANCIAL CONTEXT (currency: ${currency}):
Name: ${user.name}
Current date: ${format(now, 'MMMM d, yyyy')} (day ${now.getDate()} of ${endOfMonth(now).getDate()})
${lifeStageContext}
${profileContext}
${intentionContext}
${dataAccessNote}
${expenseAllowed ? `
SPENDING TREND (3 months):
${monthTrend}

MONTH-BY-MONTH BREAKDOWN:
${monthBreakdowns.map(m => `${m.label} — Total: ${m.total.toFixed(2)} ${currency}\n  Categories: ${m.cats || 'none'}`).join('\n')}

TOP SPENDING DAYS THIS MONTH (by day of week):
${dayBreakdown || 'Not enough data'}

EXPENSE NOTES (last 90 days — what users wrote about their spending):
${allExpenseNotes.length > 0 ? allExpenseNotes.join('\n') : 'No noted expenses in the last 90 days'}` : ''}
${incomeAllowed ? `
INCOME:
Monthly income history: ${incomeMonthlyLines}
Income sources (last 3 months): ${incomeSourceLines || 'not recorded'}
${avgIncomeDay ? `Typical income arrival: around day ${avgIncomeDay} of the month` : ''}
${incomeNotes.length > 0 ? `Income notes:\n${incomeNotes.join('\n')}` : ''}` : ''}
${budgetGoalsAllowed ? `
RECURRING EXPENSES (active):
${recurringLines || 'None set up'}
Monthly recurring total: ${recurringTotal.toFixed(2)} ${currency}

BUDGETS (current month progress):
${budgetLines || 'No budgets set up'}
${budgetBehaviorLines ? `
BUDGET BEHAVIORAL PATTERNS (3-month analysis):
${budgetBehaviorLines}` : ''}

SAVINGS GOALS:
${goalLines || 'No goals set up'}` : ''}
${groupContext}
${personalNotesContext}
${historyContext ? `\nPAST ANALYSES (for context, most recent first):\n${historyContext}` : ''}
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
- Reference specific numbers, dates, and notes from the user's data when relevant
- When the user asks about trends (e.g. "my spending habits"), reference the 3-month breakdown you have
- When you see a budget marked CONSISTENTLY OVERSPENT in the data, proactively mention it even if not asked — offer the user the choice: raise the budget to reflect reality, or get advice on reducing that spending
- If a budget has been adjusted many times (changeCount), note it gently — repeated changes signal a habit worth examining, not just a number problem

Your limits (be clear about these if asked):
- You do not give investment advice or recommend specific financial products
- You do not have access to external bank accounts or real-time market data
- You cannot take any actions in the app — you advise only
- Your insights are based on data the user has entered in SharedLedger
- Your expense/income history goes back up to 3 months

Personal notes access:
- If the user has shared personal notes with you, treat them as trusted context about their financial intentions and concerns
- If the user asks about accessing their notes, explain they can control this in Settings > Sage AI
- Never reveal that a user has NOT shared notes — just work with what you have

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

  const BUDGET_BEHAVIOR_INSTRUCTION = `
Budget behavioural patterns — IMPORTANT:
Check the "BUDGET BEHAVIORAL PATTERNS" section in the financial data. For any category marked CONSISTENTLY OVERSPENT (overspent in 2 or more of the last 3 months):
- Name the category and show the actual numbers (spent vs limit, for each relevant month)
- If the budget has been adjusted multiple times (the data says "adjusted X times"), mention it: "You've tweaked this budget X times already — it might be worth committing to a number that truly fits your life, or working on the habit behind it."
- Do NOT ask a question after each individual budget item

After listing ALL consistently overspent categories (if any exist), ask the following question ONCE at the end of that section — not repeatedly per budget:
"For these budgets — would you like to increase the limits to better reflect how you actually spend, or would you prefer some ideas to bring the spending down in any of them?"

IMPORTANT for mid-month checks: Only raise this question if the current month's spending for those categories is also tracking above the budget limit right now. Do NOT ask about increasing budgets for categories where spending is currently within limits this month — that conversation belongs in the end-of-month review.

For categories marked FREQUENT ADJUSTMENT (adjusted multiple times with mixed results): note that repeated changes suggest the limit may not reflect real life, and invite them to think about whether to set a more honest number or work on the behaviour.
Keep this section warm and non-judgmental — the goal is self-awareness, not shame.`;

  let prompt: string;
  if (type === 'monthly_review') {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    prompt = `Write a comprehensive end-of-month financial review for ${format(prevMonth, 'MMMM yyyy')}.

Include:
1. Overall summary — how did they do vs the previous months?
2. Income vs spending — savings rate if income was recorded; note any patterns in when income arrived
3. Top spending categories and what drove them (use any expense notes where relevant)
4. Budget performance — which budgets were met, which were exceeded and by how much
5. Consistently overspent budgets — follow the budget behavioural pattern instruction below
6. Spending pattern insights — notable days or timing patterns
7. Goal progress — are they on track?
8. Recurring expenses — any worth reviewing?
9. 2–3 specific, actionable suggestions for next month

${BUDGET_BEHAVIOR_INSTRUCTION}

Be specific with numbers. Reference expense notes and income notes where relevant. Use the currency from their data. Keep it readable but thorough — this is a monthly sealed record.`;
  } else {
    const now = new Date();
    const daysIn = now.getDate();
    const daysTotal = endOfMonth(now).getDate();
    const daysLeft = daysTotal - daysIn;
    prompt = `Write a mid-month financial check-in for ${format(now, 'MMMM yyyy')} (day ${daysIn} of ${daysTotal}, ${daysLeft} days remaining).

Focus on:
1. Quick status — how is spending tracking vs last month at this point? Reference the 3-month trend if relevant.
2. Budget health — which budgets are at risk of being exceeded? Project end-of-month spend for those.
3. Consistently overspent budgets — follow the budget behavioural pattern instruction below; mid-month is the right time to flag if a pattern is repeating
4. Income check — has income arrived as expected? Any gaps?
5. The 1–2 most important course corrections they can still make this month
6. Anything positive that's going well worth noting

${BUDGET_BEHAVIOR_INSTRUCTION}

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
