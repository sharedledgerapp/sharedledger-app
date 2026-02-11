type NotificationPrefs = {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyReminderEnabled: boolean;
  monthlyReminderEnabled: boolean;
};

const STORAGE_KEY = "familyledger_last_notifications";

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
        "Don't forget to record today's expenses in Family Ledger!"
      );
      setLastNotification("daily");
    }
  }

  if (prefs.weeklyReminderEnabled && !wasNotifiedThisWeek("weekly")) {
    if (now.getDay() === 0 && currentHour >= 10 && currentHour < 11) {
      showNotification(
        "Weekly Spending Review",
        "Your weekly summary is ready. Check your spending breakdown in Family Ledger!"
      );
      setLastNotification("weekly");
    }
  }

  if (prefs.monthlyReminderEnabled && !wasNotifiedThisMonth("monthly")) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() === lastDay && currentHour >= 10 && currentHour < 11) {
      showNotification(
        "Monthly Spending Review",
        "Your monthly summary is ready. Review your spending in Family Ledger!"
      );
      setLastNotification("monthly");
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
