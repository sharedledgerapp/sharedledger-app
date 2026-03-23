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
    description: "This card shows your combined monthly total — everyday spending plus any active recurring costs — alongside today's total and how your spending compares to last month. The breakdown below the main number separates everyday and recurring amounts.",
    target: "home-spending",
    placement: "bottom",
    page: "/",
  },
  {
    id: "add-expense-button",
    title: "Add an Expense",
    description: "This button opens the expense entry form — your one-tap way to record any purchase. Choose the amount, category, date, and whether to share it with your group.",
    target: "add-expense-button",
    placement: "bottom",
    page: "/",
  },
  {
    id: "expenses-list",
    title: "Your Expense List",
    description: "All your everyday transactions appear here. Each entry can be tapped to edit it. You can also search by amount, category, or note.",
    target: "expenses-list",
    placement: "bottom",
    page: "/expenses",
  },
  {
    id: "recurring-tab",
    title: "Recurring Expenses",
    description: "This section tracks fixed costs like subscriptions, rent, and utilities. It shows your total monthly commitments at a glance and lets you pause them when needed.",
    target: "recurring-tab",
    placement: "bottom",
    page: "/expenses",
  },
  {
    id: "budget-card",
    title: "Budget Planning",
    description: "This is where you set spending limits per category. Colour-coded progress bars alert you as you get close to your limit — green is on track, red means over budget.",
    target: "budget-card",
    placement: "bottom",
    page: "/budget",
  },
  {
    id: "goals-list",
    title: "Savings Goals",
    description: "This section lets you create personal or shared savings goals with targets and deadlines. Add funds over time and track your progress toward anything you are saving for.",
    target: "goals-list",
    placement: "bottom",
    page: "/goals",
  },
  {
    id: "group-section",
    title: "Your Group",
    description: "This section shows all members in your group. You can share the invite code or QR code to add new people, and manage who has admin access.",
    target: "group-section",
    placement: "bottom",
    page: "/family",
  },
  {
    id: "shared-dashboard",
    title: "Shared Dashboard",
    description: "This dashboard shows how your group spends together — broken down by member, category, and payment source. Great for staying aligned on shared finances.",
    target: "shared-dashboard",
    placement: "bottom",
    page: "/family-dashboard",
  },
  {
    id: "reports-chart",
    title: "Reports & Insights",
    description: "This chart lets you dive into your spending history interactively. Each bar represents a day — select one to see its expenses. Filter by category for a deeper breakdown.",
    target: "reports-chart",
    placement: "top",
    page: "/reports",
  },
  {
    id: "messages-area",
    title: "Messages & Notes",
    description: "This area lets you chat with your group about finances, or leave shared notes and checklists — great for shopping lists and financial reminders.",
    target: "messages-area",
    placement: "bottom",
    page: "/messages",
  },
  {
    id: "settings-link",
    title: "Settings",
    description: "Settings let you customise your currency, language, expense categories, and notification preferences. You can also reach out via Contact Support for bugs or suggestions, and replay this tour at any time.",
    target: "settings-link",
    placement: "bottom",
    page: "/settings",
  },
];

export const TUTORIAL_STORAGE_KEY = "tutorial_completed";
