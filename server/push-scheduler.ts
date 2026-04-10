import webpush from "web-push";
import { storage } from "./storage";
import { db } from "./db";
import { users, expenses, budgets, pushNotificationLog, recurringExpenses, incomeEntries } from "@shared/schema";
import { eq, and, gte, lte, lt, sql } from "drizzle-orm";

async function wasNotifiedToday(userId: number, type: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [row] = await db.select({ id: pushNotificationLog.id })
    .from(pushNotificationLog)
    .where(and(
      eq(pushNotificationLog.userId, userId),
      eq(pushNotificationLog.type, type),
      gte(pushNotificationLog.sentAt, today)
    ))
    .limit(1);
  return !!row;
}

async function wasNotifiedThisWeek(userId: number, type: string): Promise<boolean> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db.select({ id: pushNotificationLog.id })
    .from(pushNotificationLog)
    .where(and(
      eq(pushNotificationLog.userId, userId),
      eq(pushNotificationLog.type, type),
      gte(pushNotificationLog.sentAt, weekAgo)
    ))
    .limit(1);
  return !!row;
}

async function wasNotifiedThisMonth(userId: number, type: string): Promise<boolean> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [row] = await db.select({ id: pushNotificationLog.id })
    .from(pushNotificationLog)
    .where(and(
      eq(pushNotificationLog.userId, userId),
      eq(pushNotificationLog.type, type),
      gte(pushNotificationLog.sentAt, monthStart)
    ))
    .limit(1);
  return !!row;
}

async function wasNotifiedSince(userId: number, type: string, since: Date): Promise<boolean> {
  const [row] = await db.select({ id: pushNotificationLog.id })
    .from(pushNotificationLog)
    .where(and(
      eq(pushNotificationLog.userId, userId),
      eq(pushNotificationLog.type, type),
      gte(pushNotificationLog.sentAt, since)
    ))
    .limit(1);
  return !!row;
}

async function markNotified(userId: number, type: string): Promise<void> {
  await db.insert(pushNotificationLog).values({
    userId,
    type,
    sentAt: new Date(),
  });
}

async function sendPushToUser(userId: number, payload: { title: string; body: string; tag?: string; url?: string }): Promise<boolean> {
  const subs = await storage.getPushSubscriptionsForUser(userId);
  let delivered = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      delivered = true;
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await storage.deletePushSubscription(userId, sub.endpoint);
      }
    }
  }
  return delivered;
}

async function checkDailyReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const allUsers = await db.select().from(users).where(eq(users.dailyReminderEnabled, true));

  for (const user of allUsers) {
    try {
      if (await wasNotifiedToday(user.id, "daily")) continue;

      const [reminderHour, reminderMinute] = (user.dailyReminderTime || "19:00").split(":").map(Number);
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const reminderTotalMinutes = reminderHour * 60 + reminderMinute;
      if (currentTotalMinutes >= reminderTotalMinutes && currentTotalMinutes < reminderTotalMinutes + 30) {
        const sent = await sendPushToUser(user.id, {
          title: "Time to log expenses",
          body: "Don't forget to record today's expenses in SharedLedger!",
          tag: "daily-reminder",
          url: "/expenses",
        });
        if (sent) await markNotified(user.id, "daily");
      }
    } catch (err) {
      console.error(`[Push] checkDailyReminders failed for user ${user.id}:`, err);
    }
  }
}

async function checkLateReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (currentHour !== 21 || currentMinute >= 30) return;

  const allUsers = await db.select().from(users).where(eq(users.dailyReminderEnabled, true));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const user of allUsers) {
    try {
      const hadPrimaryReminder = await wasNotifiedToday(user.id, "daily");
      if (!hadPrimaryReminder) continue;

      if (await wasNotifiedToday(user.id, "daily_late")) continue;

      const [expenseRow] = await db.select({ id: expenses.id })
        .from(expenses)
        .where(and(
          eq(expenses.userId, user.id),
          gte(expenses.date, today),
          lt(expenses.date, tomorrow)
        ))
        .limit(1);

      if (expenseRow) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Evening Reminder",
        body: "Hey, it's getting late! Remember to log your expenses for the day — but if you haven't spent anything, kudos on the financial discipline 💪",
        tag: "daily-late-reminder",
        url: "/expenses",
      });
      if (sent) await markNotified(user.id, "daily_late");
    } catch (err) {
      console.error(`[Push] checkLateReminders failed for user ${user.id}:`, err);
    }
  }
}

async function checkWeeklyReminders() {
  const now = new Date();
  if (now.getDay() !== 0) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const allUsers = await db.select().from(users).where(eq(users.weeklyReminderEnabled, true));

  for (const user of allUsers) {
    try {
      if (await wasNotifiedThisWeek(user.id, "weekly")) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Weekly Spending Review",
        body: "Your weekly summary is ready. Check your spending breakdown in SharedLedger!",
        tag: "weekly-reminder",
        url: "/reports",
      });
      if (sent) await markNotified(user.id, "weekly");
    } catch (err) {
      console.error(`[Push] checkWeeklyReminders failed for user ${user.id}:`, err);
    }
  }
}

async function checkMonthlyReminders() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() !== lastDay) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const allUsers = await db.select().from(users).where(eq(users.monthlyReminderEnabled, true));

  for (const user of allUsers) {
    try {
      if (await wasNotifiedThisMonth(user.id, "monthly")) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Monthly Spending Review",
        body: "Your monthly summary is ready. Review your spending in SharedLedger!",
        tag: "monthly-reminder",
        url: "/reports",
      });
      if (sent) await markNotified(user.id, "monthly");
    } catch (err) {
      console.error(`[Push] checkMonthlyReminders failed for user ${user.id}:`, err);
    }
  }
}

const ESCALATION_BANDS = [110, 125, 150, 200];

async function checkBudgetAlerts() {
  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const allBudgets = await db.select().from(budgets);

  for (const budget of allBudgets) {
    try {
    if (!budget.notificationsEnabled) continue;

    const user = userMap.get(budget.userId);
    if (!user || user.budgetAlertsEnabled === false) continue;

    const thresholds = budget.thresholds as string[] | null;
    if (!thresholds || thresholds.length === 0) continue;

    const periodStart = budget.startDate
      ? new Date(budget.startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let periodEnd: Date;
    if (budget.periodType === "weekly") {
      periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate());
    }

    const userExpenses = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, budget.userId),
          eq(expenses.category, budget.category),
          gte(expenses.date, periodStart),
          lte(expenses.date, periodEnd)
        )
      );

    const spent = parseFloat(userExpenses[0]?.total || "0");
    const budgetAmount = parseFloat(budget.amount);
    if (budgetAmount <= 0) continue;
    const percentUsed = Math.round((spent / budgetAmount) * 100);

    const periodKey = periodStart.toISOString().slice(0, 10);

    for (const threshold of thresholds) {
      const thresholdNum = Number(threshold);
      if (percentUsed < thresholdNum) continue;

      const notifKey = `budget_${budget.id}_${thresholdNum}_${periodKey}`;
      if (await wasNotifiedSince(budget.userId, notifKey, periodStart)) continue;

      const message =
        percentUsed >= 100
          ? `You've exceeded your ${budget.category} budget for this period!`
          : `You've used ${percentUsed}% of your ${budget.category} budget.`;

      const sent = await sendPushToUser(budget.userId, {
        title: "Budget Alert",
        body: message,
        tag: `budget-${budget.id}`,
        url: "/budget",
      });
      if (sent) await markNotified(budget.userId, notifKey);
    }

    if (percentUsed >= 100) {
      for (const band of ESCALATION_BANDS) {
        if (percentUsed < band) continue;
        const escalationKey = `budget_${budget.id}_escalation_${band}_${periodKey}`;
        if (await wasNotifiedSince(budget.userId, escalationKey, periodStart)) continue;

        const escalationSent = await sendPushToUser(budget.userId, {
          title: "Budget Exceeded",
          body: `Your ${budget.category} spending is now at ${percentUsed}% of your budget. You may want to review your expenses.`,
          tag: `budget-escalation-${budget.id}`,
          url: "/budget",
        });
        if (escalationSent) await markNotified(budget.userId, escalationKey);
      }
    }
    } catch (err) {
      console.error(`[Push] checkBudgetAlerts failed for budget ${budget.id}:`, err);
    }
  }
}

async function checkRecurringReminders() {
  const now = new Date();
  if (now.getHours() < 9 || now.getHours() >= 10) return;

  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const periodKey = `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}`;

  const allRecurring = await db.select().from(recurringExpenses)
    .where(and(
      eq(recurringExpenses.reminderEnabled, true),
      eq(recurringExpenses.isActive, true),
    ));

  for (const expense of allRecurring) {
    try {
      const dueDay = expense.dueDay;
      const daysBefore = expense.reminderDaysBefore ?? 3;
      if (!dueDay) continue;

      const targetDay = dueDay - daysBefore;
      if (targetDay < 1) continue;
      if (todayDay !== targetDay) continue;

      const notifKey = `recurring-expense-reminder-${expense.id}-${periodKey}`;
      const todayStart = new Date(todayYear, todayMonth, todayDay);
      if (await wasNotifiedSince(expense.userId, notifKey, todayStart)) continue;

      const sent = await sendPushToUser(expense.userId, {
        title: `${expense.name} is due soon`,
        body: `Your ${expense.name} payment of ${expense.amount} is due in ${daysBefore} day${daysBefore > 1 ? "s" : ""}.`,
        tag: `recurring-reminder-${expense.id}`,
        url: "/expenses?view=recurring",
      });
      if (sent) await markNotified(expense.userId, notifKey);
    } catch (err) {
      console.error(`[Push] recurring reminder failed for expense ${expense.id}:`, err);
    }
  }

  const allIncome = await db.select().from(incomeEntries)
    .where(and(
      eq(incomeEntries.isRecurring, true),
      eq(incomeEntries.reminderEnabled, true),
    ));

  for (const entry of allIncome) {
    try {
      const daysBefore = entry.reminderDaysBefore ?? 3;
      if (!entry.recurringInterval) continue;

      const today = new Date(todayYear, todayMonth, todayDay);

      // Advance from entry.date by the recurrence interval until nextDate is in the future
      const nextDate = new Date(entry.date);
      let iterations = 0;
      while (nextDate <= today && iterations < 500) {
        switch (entry.recurringInterval) {
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "tri-monthly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        }
        iterations++;
      }

      const reminderDate = new Date(nextDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);

      if (
        todayDay !== reminderDate.getDate() ||
        todayMonth !== reminderDate.getMonth() ||
        todayYear !== reminderDate.getFullYear()
      ) continue;

      // Key is per upcoming payment date so weekly recurrences each get their own dedup slot
      const occurrenceDateKey = nextDate.toISOString().slice(0, 10);
      const notifKey = `income-reminder-${entry.id}-${occurrenceDateKey}`;
      const todayStart = new Date(todayYear, todayMonth, todayDay);
      if (await wasNotifiedSince(entry.userId, notifKey, todayStart)) continue;

      const daysStr = daysBefore === 1 ? "tomorrow" : `in ${daysBefore} days`;
      const sent = await sendPushToUser(entry.userId, {
        title: "Expected income reminder",
        body: `Your ${entry.source} income is expected ${daysStr}. Log it when you receive it!`,
        tag: `income-reminder-${entry.id}`,
        url: "/expenses?tab=in",
      });
      if (sent) await markNotified(entry.userId, notifKey);
    } catch (err) {
      console.error(`[Push] income reminder failed for entry ${entry.id}:`, err);
    }
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let schedulerStarted = false;

export function startPushScheduler() {
  if (schedulerStarted) return;

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log("[Push] VAPID keys not configured, push notifications disabled");
    return;
  }

  schedulerStarted = true;

  webpush.setVapidDetails(
    "mailto:noreply@sharedledger.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  console.log("[Push] Push notification scheduler started");

  async function runChecks() {
    const checks = [
      { name: "dailyReminders", fn: checkDailyReminders },
      { name: "lateReminders", fn: checkLateReminders },
      { name: "weeklyReminders", fn: checkWeeklyReminders },
      { name: "monthlyReminders", fn: checkMonthlyReminders },
      { name: "budgetAlerts", fn: checkBudgetAlerts },
      { name: "recurringReminders", fn: checkRecurringReminders },
    ];
    for (const { name, fn } of checks) {
      try {
        await fn();
      } catch (err) {
        console.error(`[Push] ${name} tick failed:`, err);
      }
    }
  }

  runChecks();
  schedulerInterval = setInterval(runChecks, 60000);
}

export function stopPushScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
