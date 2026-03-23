export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  placement?: "top" | "bottom" | "center";
  page?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to SharedLedger!",
    description: "Let's take a quick tour of everything you can do. This takes about a minute. You can skip at any time.",
    placement: "center",
  },
  {
    id: "home-spending",
    title: "Your Spending Overview",
    description: "This card shows your total personal spending for the month alongside today's total and how you compare to last month.",
    target: "home-spending",
    placement: "bottom",
    page: "/",
  },
  {
    id: "add-expense-button",
    title: "Add an Expense",
    description: "Tap here to log a new expense. Choose the amount, category, date, and whether to share it with your group.",
    target: "add-expense-button",
    placement: "bottom",
    page: "/",
  },
  {
    id: "expenses-list",
    title: "Your Expense List",
    description: "All your everyday transactions appear here. Tap any entry to edit it. You can also search by amount, category, or note.",
    target: "expenses-list",
    placement: "bottom",
    page: "/expenses",
  },
  {
    id: "recurring-tab",
    title: "Recurring Expenses",
    description: "Track fixed costs like subscriptions, rent, and utilities here. See your total monthly commitments at a glance and pause them when needed.",
    target: "recurring-tab",
    placement: "bottom",
    page: "/expenses",
  },
  {
    id: "budget-card",
    title: "Budget Planning",
    description: "Set spending limits per category. Colour-coded progress bars alert you as you get close to your limit — green is on track, red means over budget.",
    target: "budget-card",
    placement: "bottom",
    page: "/budget",
  },
  {
    id: "goals-list",
    title: "Savings Goals",
    description: "Create personal or shared savings goals with targets and deadlines. Add funds over time and track your progress toward anything you are saving for.",
    target: "goals-list",
    placement: "bottom",
    page: "/goals",
  },
  {
    id: "group-section",
    title: "Your Group",
    description: "View all members in your group. Share the invite code or QR code to add new people, and manage who has admin access.",
    target: "group-section",
    placement: "bottom",
    page: "/family",
  },
  {
    id: "shared-dashboard",
    title: "Shared Dashboard",
    description: "See how your group spends together — broken down by member, category, and payment source. Great for staying aligned on shared finances.",
    target: "shared-dashboard",
    placement: "bottom",
    page: "/family-dashboard",
  },
  {
    id: "reports-chart",
    title: "Reports & Insights",
    description: "Dive into your spending history with interactive charts. Tap any bar to see the expenses for that day. Filter by category for a deeper breakdown.",
    target: "reports-chart",
    placement: "top",
    page: "/reports",
  },
  {
    id: "messages-area",
    title: "Messages & Notes",
    description: "Chat with your group about finances, or leave shared notes and checklists — great for shopping lists and financial reminders.",
    target: "messages-area",
    placement: "bottom",
    page: "/messages",
  },
  {
    id: "settings-link",
    title: "Settings",
    description: "Customise your currency, language, expense categories, and notification preferences. You can also replay this tour here at any time.",
    target: "settings-link",
    placement: "bottom",
    page: "/settings",
  },
];

export const TUTORIAL_STORAGE_KEY = "tutorial_completed";
