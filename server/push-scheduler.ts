import webpush from "web-push";
import { storage } from "./storage";
import { db } from "./db";
import { users, expenses, budgets, pushNotificationLog, recurringExpenses, incomeEntries, messages, families } from "@shared/schema";
import { eq, and, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { generateAnalysis } from "./sage";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

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

export async function wasNotifiedSince(userId: number, type: string, since: Date): Promise<boolean> {
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

export async function markNotified(userId: number, type: string): Promise<void> {
  await db.insert(pushNotificationLog).values({
    userId,
    type,
    sentAt: new Date(),
  });
}

// Supported deep link URLs for push notifications:
//   /app/expenses                  - Opens Expenses page (everyday view)
//   /app/expenses?tab=in           - Opens Expenses page on the income tab
//   /app/expenses?view=recurring   - Opens Expenses page on the recurring view
//   /app/expenses?openCreate=true  - Opens the create-expense dialog (add ?tab=in for income)
//   /app/budget                    - Opens Budget page
//   /app/reports                   - Opens Reports page
//   /app/messages                  - Opens Messages/chat page
//   /app/messages?tab=notes        - Opens Messages page on the Notes tab
export async function sendPushToUser(userId: number, payload: { title: string; body: string; tag?: string; url?: string }): Promise<boolean> {
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

  const allUsers = await db.select().from(users).where(and(eq(users.dailyReminderEnabled, true), eq(users.onboardingCompleted, true)));

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
          url: "/app/expenses",
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

  const allUsers = await db.select().from(users).where(and(eq(users.dailyReminderEnabled, true), eq(users.onboardingCompleted, true)));

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
        url: "/app/expenses",
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

  const allUsers = await db.select().from(users).where(and(eq(users.weeklyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      if (await wasNotifiedThisWeek(user.id, "weekly")) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Weekly Financial Review",
        body: "Your weekly spending breakdown is ready — check your charts in SharedLedger!",
        tag: "weekly-reminder",
        url: "/app/reports",
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
  const isLastDay = now.getDate() === lastDay;
  const isFirstDay = now.getDate() === 1;
  if (!isLastDay && !isFirstDay) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const allUsers = await db.select().from(users).where(and(eq(users.monthlyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      if (await wasNotifiedThisMonth(user.id, "monthly")) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Another month, another step forward",
        body: "Your review is ready — come see what you've built this month.",
        tag: "monthly-reminder",
        url: "/app/budget",
      });
      if (sent) await markNotified(user.id, "monthly");
    } catch (err) {
      console.error(`[Push] checkMonthlyReminders failed for user ${user.id}:`, err);
    }
  }
}

const ESCALATION_BANDS = [110, 125, 150, 200];

async function checkBudgetAlerts() {
  const allUsers = await db.select().from(users).where(eq(users.onboardingCompleted, true));
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const allBudgets = await db.select().from(budgets);

  for (const budget of allBudgets) {
    try {
      if (!budget.notificationsEnabled) continue;

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

      const periodKey = periodStart.toISOString().slice(0, 10);

      let spent: number;
      let membersToNotify: Array<typeof allUsers[0]>;

      if (budget.budgetScope === "shared" && budget.familyId) {
        // For group budgets: sum expenses across ALL family members
        const familyUserIds = allUsers
          .filter(u => u.familyId === budget.familyId)
          .map(u => u.id);
        if (familyUserIds.length === 0) continue;

        const [familyExpenses] = await db
          .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
          .from(expenses)
          .where(
            and(
              inArray(expenses.userId, familyUserIds),
              eq(expenses.category, budget.category),
              gte(expenses.date, periodStart),
              lte(expenses.date, periodEnd)
            )
          );
        spent = parseFloat(familyExpenses?.total || "0");
        // Notify all family members who have budget alerts enabled
        membersToNotify = allUsers.filter(
          u => u.familyId === budget.familyId && u.budgetAlertsEnabled !== false
        );
      } else {
        // Personal budget: original single-user logic
        const user = userMap.get(budget.userId);
        if (!user || user.budgetAlertsEnabled === false) continue;

        const [userExpenses] = await db
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
        spent = parseFloat(userExpenses?.total || "0");
        membersToNotify = [user];
      }

      const budgetAmount = parseFloat(budget.amount);
      if (budgetAmount <= 0) continue;
      const percentUsed = Math.round((spent / budgetAmount) * 100);

      for (const member of membersToNotify) {
        // Shared budgets get per-member dedup keys; personal budgets keep the original key format
        const memberSuffix = budget.budgetScope === "shared" ? `_u${member.id}` : "";

        for (const threshold of thresholds) {
          const thresholdNum = Number(threshold);
          if (percentUsed < thresholdNum) continue;

          const notifKey = `budget_${budget.id}_${thresholdNum}_${periodKey}${memberSuffix}`;
          if (await wasNotifiedSince(member.id, notifKey, periodStart)) continue;

          const body = budget.budgetScope === "shared"
            ? (percentUsed >= 100
                ? `The group ${budget.category} budget has been exceeded!`
                : `The group ${budget.category} budget is at ${percentUsed}%.`)
            : (percentUsed >= 100
                ? `You've exceeded your ${budget.category} budget for this period!`
                : `You've used ${percentUsed}% of your ${budget.category} budget.`);

          const sent = await sendPushToUser(member.id, {
            title: budget.budgetScope === "shared" ? "Group Budget Alert" : "Budget Alert",
            body,
            tag: `budget-${budget.id}`,
            url: "/app/budget",
          });
          if (sent) await markNotified(member.id, notifKey);
        }

        if (percentUsed >= 100) {
          for (const band of ESCALATION_BANDS) {
            if (percentUsed < band) continue;
            const escalationKey = `budget_${budget.id}_escalation_${band}_${periodKey}${memberSuffix}`;
            if (await wasNotifiedSince(member.id, escalationKey, periodStart)) continue;

            const escalationBody = budget.budgetScope === "shared"
              ? `The group ${budget.category} spending is now at ${percentUsed}% of the group budget.`
              : `Your ${budget.category} spending is now at ${percentUsed}% of your budget. You may want to review your expenses.`;

            const escalationSent = await sendPushToUser(member.id, {
              title: budget.budgetScope === "shared" ? "Group Budget Exceeded" : "Budget Exceeded",
              body: escalationBody,
              tag: `budget-escalation-${budget.id}`,
              url: "/app/budget",
            });
            if (escalationSent) await markNotified(member.id, escalationKey);
          }
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

  const onboardedUserIds = new Set(
    (await db.select({ id: users.id }).from(users).where(eq(users.onboardingCompleted, true))).map(u => u.id)
  );

  // Only monthly expenses have a predictable dueDay within each calendar month
  const allRecurring = await db.select().from(recurringExpenses)
    .where(and(
      eq(recurringExpenses.reminderEnabled, true),
      eq(recurringExpenses.isActive, true),
      eq(recurringExpenses.frequency, "monthly"),
    ));

  for (const expense of allRecurring) {
    try {
      if (!onboardedUserIds.has(expense.userId)) continue;
      const dueDay = expense.dueDay;
      const daysBefore = expense.reminderDaysBefore ?? 3;
      if (!dueDay) continue;

      // Check this month's and next month's occurrence — handles cross-month reminder
      // dates (e.g. dueDay=2, daysBefore=5 → reminder date = March 28)
      const dueDateCandidates = [
        new Date(todayYear, todayMonth, dueDay),
        new Date(todayYear, todayMonth + 1, dueDay),
      ];

      // Track which due date matched so we can notify group members after
      let matchedDueDate: Date | null = null;

      for (const dueDate of dueDateCandidates) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);

        if (
          reminderDate.getFullYear() === todayYear &&
          reminderDate.getMonth() === todayMonth &&
          reminderDate.getDate() === todayDay
        ) {
          matchedDueDate = dueDate;
          const dueDateKey = dueDate.toISOString().slice(0, 10);
          const notifKey = `recurring-expense-reminder-${expense.id}-${dueDateKey}`;
          const todayStart = new Date(todayYear, todayMonth, todayDay);
          if (await wasNotifiedSince(expense.userId, notifKey, todayStart)) break;

          const sent = await sendPushToUser(expense.userId, {
            title: `${expense.name} is due soon`,
            body: `Your ${expense.name} payment of ${expense.amount} is due in ${daysBefore} day${daysBefore > 1 ? "s" : ""}.`,
            tag: `recurring-reminder-${expense.id}`,
            url: "/app/expenses?view=recurring",
          });
          if (sent) await markNotified(expense.userId, notifKey);
          break;
        }
      }

      // For group-shared recurring expenses, also notify all other family members
      if (matchedDueDate && expense.isGroupShared && expense.familyId) {
        const dueDateKey = matchedDueDate.toISOString().slice(0, 10);
        const todayStart = new Date(todayYear, todayMonth, todayDay);

        const familyMembers = await db.select({ id: users.id })
          .from(users)
          .where(and(eq(users.familyId, expense.familyId), eq(users.onboardingCompleted, true)));

        for (const member of familyMembers) {
          if (member.id === expense.userId) continue; // owner already handled above
          try {
            const memberNotifKey = `recurring-group-reminder-${expense.id}-${dueDateKey}-${member.id}`;
            if (await wasNotifiedSince(member.id, memberNotifKey, todayStart)) continue;

            const sent = await sendPushToUser(member.id, {
              title: `${expense.name} is due soon`,
              body: `The ${expense.name} payment (${expense.amount}) is due in ${daysBefore} day${daysBefore > 1 ? "s" : ""}.`,
              tag: `recurring-group-reminder-${expense.id}`,
              url: "/app/expenses?view=recurring",
            });
            if (sent) await markNotified(member.id, memberNotifKey);
          } catch (memberErr) {
            console.error(`[Push] group recurring reminder failed for member ${member.id}:`, memberErr);
          }
        }
      }
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
      if (!onboardedUserIds.has(entry.userId)) continue;
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
        url: "/app/expenses?view=recurring",
      });
      if (sent) await markNotified(entry.userId, notifKey);
    } catch (err) {
      console.error(`[Push] income reminder failed for entry ${entry.id}:`, err);
    }
  }
}

async function checkSageAnalyses() {
  const now = new Date();
  const dayOfMonth = now.getDate();

  const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.onboardingCompleted, true));

  for (const { id: userId } of allUsers) {
    try {
      // Monthly review: generate on day 1 or 2 of the month for the previous month
      if (dayOfMonth === 1 || dayOfMonth === 2) {
        const prevMonth = subMonths(now, 1);
        const periodKey = format(prevMonth, 'yyyy-MM');
        const dedupeKey = `sage_monthly_${periodKey}`;
        const alreadyDone = await wasNotifiedSince(userId, dedupeKey, startOfMonth(now));
        if (!alreadyDone) {
          const content = await generateAnalysis(userId, 'monthly_review');
          await storage.upsertAiAnalysis(userId, 'monthly_review', periodKey, content);
          await markNotified(userId, dedupeKey);
          await sendPushToUser(userId, {
            title: `Your ${format(prevMonth, 'MMMM')} review is ready`,
            body: "Sage has prepared your monthly financial review. Tap to read it.",
            url: "/app/reports",
          });
        }
      }

      // Mid-month check: generate on day 14, 15, or 16
      if (dayOfMonth >= 14 && dayOfMonth <= 16) {
        const periodKey = `${format(now, 'yyyy-MM')}-mid`;
        const dedupeKey = `sage_midmonth_${periodKey}`;
        const monthStart = startOfMonth(now);
        const alreadyDone = await wasNotifiedSince(userId, dedupeKey, monthStart);
        if (!alreadyDone) {
          const content = await generateAnalysis(userId, 'mid_month_check');
          await storage.upsertAiAnalysis(userId, 'mid_month_check', periodKey, content);
          await markNotified(userId, dedupeKey);
          await sendPushToUser(userId, {
            title: "Mid-month check from Sage",
            body: "You're halfway through the month. Sage has a quick update on how you're tracking.",
            url: "/app/reports",
          });
        }
      }
    } catch (err) {
      console.error(`[Sage] Analysis generation failed for user ${userId}:`, err);
    }
  }
}

async function checkGroupIdleNudge() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const allFamilies = await db.select().from(families);

  for (const family of allFamilies) {
    try {
      const members = await storage.getFamilyMembers(family.id);
      if (members.length < 2) continue;

      const [recentMsg] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.familyId, family.id), gte(messages.createdAt, threeDaysAgo)))
        .limit(1);

      if (recentMsg) continue;

      const nudgeType = `group_idle_nudge_${family.id}`;
      for (const member of members) {
        if (!member.onboardingCompleted) continue;
        if (await wasNotifiedSince(member.id, nudgeType, threeDaysAgo)) continue;
        const sent = await sendPushToUser(member.id, {
          title: "Check in with your group 💬",
          body: "Nothing new from your group in a while — how's everyone tracking this month?",
          tag: `group-idle-${family.id}`,
          url: "/app/messages",
        });
        if (sent) await markNotified(member.id, nudgeType);
      }
    } catch (err) {
      console.error(`[Push] Group idle nudge failed for family ${family.id}:`, err);
    }
  }
}

async function checkNoteReminders() {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = endOfMonth(now).getDate();
  const yearMonth = format(now, 'yyyy-MM');
  const mStart = startOfMonth(now);

  let milestoneKey: string | null = null;
  let title = '';
  let body = '';
  let tag = '';

  if (day === 1) {
    milestoneKey = `note_reminder_start_${yearMonth}`;
    title = "New month, fresh start \uD83D\uDCDD";
    body = `What are your financial goals for ${format(now, 'MMMM')}? Jot a note — Sage can help you plan.`;
    tag = `note-reminder-start-${yearMonth}`;
  } else if (day >= 14 && day <= 16) {
    milestoneKey = `note_reminder_mid_${yearMonth}`;
    title = "Half-month check-in \uD83D\uDCDD";
    body = "How's your spending tracking? Take a note on what you want to adjust in the second half.";
    tag = `note-reminder-mid-${yearMonth}`;
  } else if (day >= daysInMonth - 1) {
    milestoneKey = `note_reminder_end_${yearMonth}`;
    title = "Month wrapping up \uD83D\uDCDD";
    body = "Jot down your financial takeaways — Sage can use them to plan next month with you.";
    tag = `note-reminder-end-${yearMonth}`;
  }

  if (!milestoneKey) return;

  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    if (!user.onboardingCompleted || !user.monthlyReminderEnabled) continue;
    if (await wasNotifiedSince(user.id, milestoneKey, mStart)) continue;
    const sent = await sendPushToUser(user.id, {
      title,
      body,
      tag,
      url: '/app/messages?tab=notes',
    });
    if (sent) await markNotified(user.id, milestoneKey);
  }
}

async function checkIncomeStartOfMonthPrompt() {
  const now = new Date();
  const day = now.getDate();
  if (day !== 1 && day !== 2) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const yearMonth = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);

  const allUsers = await db.select().from(users).where(and(eq(users.monthlyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      const notifKey = `income_start_of_month_${yearMonth}`;
      if (await wasNotifiedSince(user.id, notifKey, monthStart)) continue;

      const sent = await sendPushToUser(user.id, {
        title: "New month — log your income",
        body: "A new month has started! Once your paycheck arrives, don't forget to log it in SharedLedger.",
        tag: `income-start-${yearMonth}`,
        url: "/app/expenses?tab=in",
      });
      if (sent) await markNotified(user.id, notifKey);
    } catch (err) {
      console.error(`[Push] checkIncomeStartOfMonthPrompt failed for user ${user.id}:`, err);
    }
  }
}

async function checkNoIncomeLoggedNudge() {
  const now = new Date();
  if (now.getDate() !== 10) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const yearMonth = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const allUsers = await db.select().from(users).where(and(eq(users.monthlyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      const notifKey = `income_no_logged_nudge_${yearMonth}`;
      if (await wasNotifiedSince(user.id, notifKey, monthStart)) continue;

      const [incomeRow] = await db.select({ id: incomeEntries.id })
        .from(incomeEntries)
        .where(and(
          eq(incomeEntries.userId, user.id),
          gte(incomeEntries.date, monthStart),
          lte(incomeEntries.date, monthEnd)
        ))
        .limit(1);

      if (incomeRow) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Have you logged your income?",
        body: "You haven't recorded any income yet this month. Don't forget to log what you've earned!",
        tag: `income-nudge-${yearMonth}`,
        url: "/app/expenses?tab=in",
      });
      if (sent) await markNotified(user.id, notifKey);
    } catch (err) {
      console.error(`[Push] checkNoIncomeLoggedNudge failed for user ${user.id}:`, err);
    }
  }
}

async function checkPaydayFollowUpReminder() {
  const now = new Date();
  if (now.getHours() < 9 || now.getHours() >= 10) return;

  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const today = new Date(todayYear, todayMonth, todayDay);

  const onboardedUserIds = new Set(
    (await db.select({ id: users.id }).from(users).where(eq(users.onboardingCompleted, true))).map(u => u.id)
  );

  const allIncome = await db.select().from(incomeEntries).where(and(
    eq(incomeEntries.isRecurring, true),
    eq(incomeEntries.reminderEnabled, true),
  ));

  for (const entry of allIncome) {
    try {
      if (!onboardedUserIds.has(entry.userId)) continue;
      if (!entry.recurringInterval) continue;

      // Advance from entry.date to find the next future occurrence
      const nextDate = new Date(entry.date);
      let iterations = 0;
      while (nextDate <= today && iterations < 500) {
        switch (entry.recurringInterval) {
          case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
          case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
          case "tri-monthly": nextDate.setMonth(nextDate.getMonth() + 3); break;
        }
        iterations++;
      }

      // Step back one interval to get the most recent past occurrence
      const prevDate = new Date(nextDate);
      switch (entry.recurringInterval) {
        case "weekly": prevDate.setDate(prevDate.getDate() - 7); break;
        case "monthly": prevDate.setMonth(prevDate.getMonth() - 1); break;
        case "tri-monthly": prevDate.setMonth(prevDate.getMonth() - 3); break;
      }

      // Only fire on day +1 or +2 after the expected payday
      const daysSincePrev = Math.round((today.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSincePrev !== 1 && daysSincePrev !== 2) continue;

      const prevDateKey = prevDate.toISOString().slice(0, 10);
      const notifKey = `income_payday_followup_${entry.id}_${prevDateKey}`;
      if (await wasNotifiedSince(entry.userId, notifKey, prevDate)) continue;

      // Check if user logged any income from this source around the expected date
      const windowStart = new Date(prevDate);
      windowStart.setDate(windowStart.getDate() - 1);
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + 1);

      const logsInWindow = await db.select({ id: incomeEntries.id })
        .from(incomeEntries)
        .where(and(
          eq(incomeEntries.userId, entry.userId),
          eq(incomeEntries.source, entry.source),
          gte(incomeEntries.date, windowStart),
          lte(incomeEntries.date, windowEnd),
        ));

      const hasLogged = logsInWindow.some(r => r.id !== entry.id);
      if (hasLogged) continue;

      const sent = await sendPushToUser(entry.userId, {
        title: "Did you receive your income?",
        body: `Your expected ${entry.source} income was due recently. Have you logged it yet?`,
        tag: `income-payday-followup-${entry.id}`,
        url: "/app/expenses?tab=in",
      });
      if (sent) await markNotified(entry.userId, notifKey);
    } catch (err) {
      console.error(`[Push] checkPaydayFollowUpReminder failed for entry ${entry.id}:`, err);
    }
  }
}

async function checkSpendingExceedsIncome() {
  const now = new Date();
  const yearMonth = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const allUsers = await db.select().from(users).where(and(eq(users.monthlyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      const notifKey = `spending_exceeds_income_${yearMonth}`;
      if (await wasNotifiedSince(user.id, notifKey, monthStart)) continue;

      const [incomeRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(incomeEntries)
        .where(and(
          eq(incomeEntries.userId, user.id),
          gte(incomeEntries.date, monthStart),
          lte(incomeEntries.date, monthEnd)
        ));
      const totalIncome = parseFloat(incomeRow?.total || "0");
      if (totalIncome <= 0) continue;

      const [expenseRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(expenses)
        .where(and(
          eq(expenses.userId, user.id),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd)
        ));
      const totalExpenses = parseFloat(expenseRow?.total || "0");

      if (totalExpenses <= totalIncome) continue;

      const sent = await sendPushToUser(user.id, {
        title: "Spending is outpacing income",
        body: "Your tracked expenses this month have exceeded your logged income. It might be time to review your spending.",
        tag: `spending-exceeds-income-${yearMonth}`,
        url: "/app/expenses?tab=in",
      });
      if (sent) await markNotified(user.id, notifKey);
    } catch (err) {
      console.error(`[Push] checkSpendingExceedsIncome failed for user ${user.id}:`, err);
    }
  }
}

async function checkEndOfMonthIncomeRecap() {
  const now = new Date();
  const day = now.getDate();
  if (day < 28) return;
  if (now.getHours() < 10 || now.getHours() >= 11) return;

  const yearMonth = format(now, 'yyyy-MM');
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const allUsers = await db.select().from(users).where(and(eq(users.monthlyReminderEnabled, true), eq(users.onboardingCompleted, true)));

  for (const user of allUsers) {
    try {
      const notifKey = `income_end_of_month_recap_${yearMonth}`;
      if (await wasNotifiedSince(user.id, notifKey, monthStart)) continue;

      const [incomeRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(incomeEntries)
        .where(and(
          eq(incomeEntries.userId, user.id),
          gte(incomeEntries.date, monthStart),
          lte(incomeEntries.date, monthEnd)
        ));
      const totalIncome = parseFloat(incomeRow?.total || "0");

      const [expenseRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), '0')` })
        .from(expenses)
        .where(and(
          eq(expenses.userId, user.id),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd)
        ));
      const totalExpenses = parseFloat(expenseRow?.total || "0");

      const currency = user.currency || "EUR";
      let body: string;
      if (totalIncome <= 0) {
        body = `You spent ${totalExpenses.toFixed(2)} ${currency} this month. Log your income to see the full picture next month!`;
      } else {
        const diff = totalIncome - totalExpenses;
        body = diff >= 0
          ? `You earned ${totalIncome.toFixed(2)} ${currency} and spent ${totalExpenses.toFixed(2)} ${currency} — a ${diff.toFixed(2)} ${currency} surplus this month!`
          : `You earned ${totalIncome.toFixed(2)} ${currency} but spent ${totalExpenses.toFixed(2)} ${currency} — ${Math.abs(diff).toFixed(2)} ${currency} over this month.`;
      }

      const sent = await sendPushToUser(user.id, {
        title: "Your month in review",
        body,
        tag: `income-recap-${yearMonth}`,
        url: "/app/expenses?tab=in",
      });
      if (sent) await markNotified(user.id, notifKey);
    } catch (err) {
      console.error(`[Push] checkEndOfMonthIncomeRecap failed for user ${user.id}:`, err);
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
      { name: "sageAnalyses", fn: checkSageAnalyses },
      { name: "groupIdleNudge", fn: checkGroupIdleNudge },
      { name: "noteReminders", fn: checkNoteReminders },
      { name: "incomeStartOfMonthPrompt", fn: checkIncomeStartOfMonthPrompt },
      { name: "noIncomeLoggedNudge", fn: checkNoIncomeLoggedNudge },
      { name: "paydayFollowUpReminder", fn: checkPaydayFollowUpReminder },
      { name: "spendingExceedsIncome", fn: checkSpendingExceedsIncome },
      { name: "endOfMonthIncomeRecap", fn: checkEndOfMonthIncomeRecap },
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
