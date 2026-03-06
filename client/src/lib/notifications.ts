type NotificationPrefs = {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyReminderEnabled: boolean;
  monthlyReminderEnabled: boolean;
};

const STORAGE_KEY = "sharedledger_last_notifications";

function getLastNotifications(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setLastNotification(type: string) {
  const last = getLastNotifications();
  last[type] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(last));
}

function wasNotifiedToday(type: string): boolean {
  const last = getLastNotifications();
  if (!last[type]) return false;
  const lastDate = new Date(last[type]);
  const today = new Date();
  return lastDate.toDateString() === today.toDateString();
}

function wasNotifiedThisWeek(type: string): boolean {
  const last = getLastNotifications();
  if (!last[type]) return false;
  const lastDate = new Date(last[type]);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays < 7;
}

function wasNotifiedThisMonth(type: string): boolean {
  const last = getLastNotifications();
  if (!last[type]) return false;
  const lastDate = new Date(last[type]);
  const now = new Date();
  return lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
}

function showNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
      });
    } else {
      new Notification(title, { body, icon: "/icons/icon-192.png" });
    }
  } catch {
    new Notification(title, { body });
  }
}

export function checkAndSendNotifications(prefs: NotificationPrefs) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (prefs.dailyReminderEnabled && !wasNotifiedToday("daily")) {
    const [reminderHour, reminderMinute] = prefs.dailyReminderTime.split(":").map(Number);
    if (currentHour === reminderHour && currentMinute >= reminderMinute && currentMinute < reminderMinute + 30) {
      showNotification(
        "Time to log expenses",
        "Don't forget to record today's expenses in SharedLedger!"
      );
      setLastNotification("daily");
    }
  }

  if (prefs.weeklyReminderEnabled && !wasNotifiedThisWeek("weekly")) {
    if (now.getDay() === 0 && currentHour >= 10 && currentHour < 11) {
      showNotification(
        "Weekly Spending Review",
        "Your weekly summary is ready. Check your spending breakdown in SharedLedger!"
      );
      setLastNotification("weekly");
    }
  }

  if (prefs.monthlyReminderEnabled && !wasNotifiedThisMonth("monthly")) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() === lastDay && currentHour >= 10 && currentHour < 11) {
      showNotification(
        "Monthly Spending Review",
        "Your monthly summary is ready. Review your spending in SharedLedger!"
      );
      setLastNotification("monthly");
    }
  }
}

const BUDGET_THRESHOLD_KEY = "sharedledger_budget_thresholds";

function getBudgetThresholdsFired(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_THRESHOLD_KEY) || "{}");
  } catch {
    return {};
  }
}

function setBudgetThresholdFired(budgetId: number, threshold: string, periodKey: string) {
  const fired = getBudgetThresholdsFired();
  const key = `${budgetId}_${periodKey}`;
  if (!fired[key]) fired[key] = [];
  if (!fired[key].includes(threshold)) fired[key].push(threshold);
  localStorage.setItem(BUDGET_THRESHOLD_KEY, JSON.stringify(fired));
}

function wasBudgetThresholdFired(budgetId: number, threshold: string, periodKey: string): boolean {
  const fired = getBudgetThresholdsFired();
  const key = `${budgetId}_${periodKey}`;
  return fired[key]?.includes(threshold) || false;
}

export type BudgetSummaryForNotification = {
  id: number;
  category: string;
  amount: string;
  percentUsed: number;
  notificationsEnabled: boolean;
  thresholds: string[] | null;
  periodType: string;
  periodStart: string;
};

export function checkBudgetThresholdNotifications(budgets: BudgetSummaryForNotification[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  for (const budget of budgets) {
    if (!budget.notificationsEnabled || !budget.thresholds || budget.thresholds.length === 0) continue;

    const periodKey = `${budget.periodType}_${budget.periodStart}`;
    const sortedThresholds = [...budget.thresholds].sort((a, b) => Number(a) - Number(b));

    for (const threshold of sortedThresholds) {
      const thresholdNum = Number(threshold);
      if (budget.percentUsed >= thresholdNum && !wasBudgetThresholdFired(budget.id, threshold, periodKey)) {
        const message = budget.percentUsed >= 100
          ? `You've exceeded your ${budget.category} budget!`
          : `You've used ${budget.percentUsed}% of your ${budget.category} budget.`;
        showNotification("Budget Alert", message);
        setBudgetThresholdFired(budget.id, threshold, periodKey);
      }
    }
  }
}

let notificationInterval: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler(prefs: NotificationPrefs) {
  stopNotificationScheduler();
  
  checkAndSendNotifications(prefs);
  
  notificationInterval = setInterval(() => {
    checkAndSendNotifications(prefs);
  }, 60000);
}

export function stopNotificationScheduler() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Push messaging is not supported');
    return false;
  }

  try {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      console.log('[Push] Notification permission not granted, skipping auto-subscribe');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing);
      return true;
    }

    const response = await fetch('/api/push/vapid-public-key');
    if (!response.ok) {
      console.error('[Push] Failed to get VAPID key');
      return false;
    }
    const { publicKey } = await response.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await sendSubscriptionToServer(subscription);
    return true;
  } catch (err) {
    console.error('[Push] Failed to subscribe:', err);
    return false;
  }
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const subJson = subscription.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    }),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('[Push] Failed to unsubscribe:', err);
  }
}
