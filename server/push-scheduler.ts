import webpush from "web-push";
import { storage } from "./storage";
import { db } from "./db";
import { users, expenses, budgets } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const lastNotified: Map<string, string> = new Map();

function getNotificationKey(userId: number, type: string): string {
  return `${userId}_${type}`;
}

function wasNotifiedToday(userId: number, type: string): boolean {
  const key = getNotificationKey(userId, type);
  const last = lastNotified.get(key);
  if (!last) return false;
  return new Date(last).toDateString() === new Date().toDateString();
}

function wasNotifiedThisWeek(userId: number, type: string): boolean {
  const key = getNotificationKey(userId, type);
  const last = lastNotified.get(key);
  if (!last) return false;
  const diff = Date.now() - new Date(last).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

function wasNotifiedThisMonth(userId: number, type: string): boolean {
  const key = getNotificationKey(userId, type);
  const last = lastNotified.get(key);
  if (!last) return false;
  const lastDate = new Date(last);
  const now = new Date();
  return lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
}

function wasNotifiedSince(userId: number, type: string, since: Date): boolean {
  const key = getNotificationKey(userId, type);
  const last = lastNotified.get(key);
  if (!last) return false;
  return new Date(last) >= since;
}

function markNotified(userId: number, type: string) {
  const key = getNotificationKey(userId, type);
  lastNotified.set(key, new Date().toISOString());
}

async function sendPushToUser(userId: number, payload: { title: string; body: string; tag?: string; url?: string }) {
  const subs = await storage.getPushSubscriptionsForUser(userId);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await storage.deletePushSubscription(userId, sub.endpoint);
      }
    }
  }
}

async function checkDailyReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const allUsers = await db.select().from(users).where(eq(users.dailyReminderEnabled, true));

  for (const user of allUsers) {
    if (wasNotifiedToday(user.id, "daily")) continue;

    const [reminderHour, reminderMinute] = (user.dailyReminderTime || "19:00").split(":").map(Number);
    if (currentHour === reminderHour && currentMinute >= reminderMinute && currentMinute < reminderMinute + 5) {
      await sendPushToUser(user.id, {
        title: "Time to log expenses",
        body: "Don't forget to record today's expenses in SharedLedger!",
        tag: "daily-reminder",
        url: "/expenses",
      });
      markNotified(user.id, "daily");
    }
  }
}

async function checkWeeklyReminders() {
  const now = new Date();
  if (now.getDay() !== 0) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const allUsers = await db.select().from(users).where(eq(users.weeklyReminderEnabled, true));

  for (const user of allUsers) {
    if (wasNotifiedThisWeek(user.id, "weekly")) continue;

    await sendPushToUser(user.id, {
      title: "Weekly Spending Review",
      body: "Your weekly summary is ready. Check your spending breakdown in SharedLedger!",
      tag: "weekly-reminder",
      url: "/reports",
    });
    markNotified(user.id, "weekly");
  }
}

async function checkMonthlyReminders() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() !== lastDay) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const allUsers = await db.select().from(users).where(eq(users.monthlyReminderEnabled, true));

  for (const user of allUsers) {
    if (wasNotifiedThisMonth(user.id, "monthly")) continue;

    await sendPushToUser(user.id, {
      title: "Monthly Spending Review",
      body: "Your monthly summary is ready. Review your spending in SharedLedger!",
      tag: "monthly-reminder",
      url: "/reports",
    });
    markNotified(user.id, "monthly");
  }
}

const ESCALATION_BANDS = [110, 125, 150, 200];

async function checkBudgetAlerts() {
  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const allBudgets = await db.select().from(budgets);

  for (const budget of allBudgets) {
    if (!budget.notificationsEnabled) continue;

    const user = userMap.get(budget.userId);
    if (!user || user.budgetAlertsEnabled === false) continue;

    const thresholds = budget.thresholds as string[] | null;
    if (!thresholds || thresholds.length === 0) continue;

    const periodStart = budget.periodStart
      ? new Date(budget.periodStart)
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
      if (wasNotifiedSince(budget.userId, notifKey, periodStart)) continue;

      const message =
        percentUsed >= 100
          ? `You've exceeded your ${budget.category} budget for this period!`
          : `You've used ${percentUsed}% of your ${budget.category} budget.`;

      await sendPushToUser(budget.userId, {
        title: "Budget Alert",
        body: message,
        tag: `budget-${budget.id}`,
        url: "/budget",
      });
      markNotified(budget.userId, notifKey);
    }

    if (percentUsed >= 100) {
      for (const band of ESCALATION_BANDS) {
        if (percentUsed < band) continue;
        const escalationKey = `budget_${budget.id}_escalation_${band}_${periodKey}`;
        if (wasNotifiedSince(budget.userId, escalationKey, periodStart)) continue;

        await sendPushToUser(budget.userId, {
          title: "Budget Exceeded",
          body: `Your ${budget.category} spending is now at ${percentUsed}% of your budget. You may want to review your expenses.`,
          tag: `budget-escalation-${budget.id}`,
          url: "/budget",
        });
        markNotified(budget.userId, escalationKey);
      }
    }
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startPushScheduler() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log("[Push] VAPID keys not configured, push notifications disabled");
    return;
  }

  webpush.setVapidDetails(
    "mailto:noreply@sharedledger.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  console.log("[Push] Push notification scheduler started");

  async function runChecks() {
    try {
      await checkDailyReminders();
      await checkWeeklyReminders();
      await checkMonthlyReminders();
      await checkBudgetAlerts();
    } catch (err) {
      console.error("[Push] Scheduler error:", err);
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
