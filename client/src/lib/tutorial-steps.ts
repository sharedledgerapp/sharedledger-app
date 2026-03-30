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
    description: "Let's take a quick tour of the key features. This takes about a minute. You can skip at any time.",
    placement: "center",
  },
  {
    id: "add-expense-button",
    title: "Add an Expense",
    description: "Tap this button to record any purchase. Choose the amount, category, date, and whether to share it with your group.",
    target: "add-expense-button",
    placement: "bottom",
    page: "/app",
  },
  {
    id: "budget-card",
    title: "Budget Planning",
    description: "Set spending limits per category here. Colour-coded progress bars alert you as you get close to your limit — green is on track, red means over budget.",
    target: "budget-card",
    placement: "bottom",
    page: "/app/budget",
  },
  {
    id: "goals-list",
    title: "Savings Goals",
    description: "Create personal savings goals with targets and deadlines. Add funds over time and track your progress toward anything you are saving for.",
    target: "goals-list",
    placement: "bottom",
    page: "/app/goals",
  },
  {
    id: "group-invite",
    title: "Invite Your Group",
    description: "On the Group tab, tap \"Share invite\" to send a join link directly via WhatsApp, iMessage, Snapchat, SMS, or email. Or show the QR code and let someone scan it — they land straight in the join flow.",
    target: "share-invite",
    placement: "top",
    page: "/app/family",
  },
  {
    id: "settings-currency",
    title: "Change Your Currency",
    description: "You can change your currency here at any time. SharedLedger supports dozens of currencies — pick the one that matches your location.",
    target: "settings-currency",
    placement: "bottom",
    page: "/app/settings",
  },
];

export const TUTORIAL_STORAGE_KEY = "tutorial_completed";
