import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import HomePage from "@/pages/HomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import GoalsPage from "@/pages/GoalsPage";
import FamilyPage from "@/pages/FamilyPage";
import FamilyDashboard from "@/pages/FamilyDashboard";
import SettingsPage from "@/pages/SettingsPage";
import SpendingReflectionsPage from "@/pages/SpendingReflectionsPage";
import ReportsPage from "@/pages/ReportsPage";
import MessagesPage from "@/pages/MessagesPage";
import BudgetPage from "@/pages/BudgetPage";
import FriendGroupsPage from "@/pages/FriendGroupsPage";
import FriendGroupDashboard from "@/pages/FriendGroupDashboard";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { startNotificationScheduler, stopNotificationScheduler, checkBudgetThresholdNotifications, subscribeToPush } from "@/lib/notifications";
import { posthog } from "@/lib/posthog";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      const prefs = {
        dailyReminderEnabled: user.dailyReminderEnabled ?? true,
        dailyReminderTime: user.dailyReminderTime || "19:00",
        weeklyReminderEnabled: user.weeklyReminderEnabled ?? true,
        monthlyReminderEnabled: user.monthlyReminderEnabled ?? true,
      };
      startNotificationScheduler(prefs);
      subscribeToPush().catch(() => {});
    }
    return () => stopNotificationScheduler();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const checkBudgets = async () => {
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ["/api/budget-summary"],
          staleTime: 4 * 60 * 1000,
        });
        const summary = data as any;
        if (summary?.budgets?.length > 0) {
          checkBudgetThresholdNotifications(
            summary.budgets.map((b: any) => ({
              id: b.id,
              category: b.category,
              amount: b.amount,
              percentUsed: b.percentUsed,
              notificationsEnabled: b.notificationsEnabled,
              thresholds: b.thresholds,
              periodType: b.periodType,
              periodStart: b.periodStart,
            }))
          );
        }
      } catch {}
    };
    checkBudgets();
    const interval = setInterval(checkBudgets, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!user.onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function LandingRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    if (!user.onboardingCompleted) {
      return <Redirect to="/onboarding" />;
    }
    return <Redirect to="/app" />;
  }

  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/onboarding" component={OnboardingPage} />

      {/* Specific /app/* routes must come before /app to avoid prefix-match shadowing */}
      <Route path="/app/expenses">
        {() => <ProtectedRoute component={ExpensesPage} />}
      </Route>
      <Route path="/app/goals">
        {() => <ProtectedRoute component={GoalsPage} />}
      </Route>
      <Route path="/app/family-dashboard">
        {() => <ProtectedRoute component={FamilyDashboard} />}
      </Route>
      <Route path="/app/family">
        {() => <ProtectedRoute component={FamilyPage} />}
      </Route>
      <Route path="/app/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      <Route path="/app/spending-reflections">
        {() => <ProtectedRoute component={SpendingReflectionsPage} />}
      </Route>
      <Route path="/app/reports">
        {() => <ProtectedRoute component={ReportsPage} />}
      </Route>
      <Route path="/app/messages">
        {() => <ProtectedRoute component={MessagesPage} />}
      </Route>
      <Route path="/app/budget">
        {() => <ProtectedRoute component={BudgetPage} />}
      </Route>
      <Route path="/app/groups/:id">
        {() => <ProtectedRoute component={FriendGroupDashboard} />}
      </Route>
      <Route path="/app/groups">
        {() => <ProtectedRoute component={FriendGroupsPage} />}
      </Route>
      {/* /app home route comes after all /app/* specifics */}
      <Route path="/app">
        {() => <ProtectedRoute component={HomePage} />}
      </Route>

      {/* Public landing page — must be last to avoid catching /app or /auth */}
      <Route path="/" component={LandingRedirect} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const token = import.meta.env.VITE_POSTHOG_TOKEN;
    const host = import.meta.env.VITE_POSTHOG_HOST;
    console.log("[PostHog] Initializing — token:", token ? token.slice(0, 10) + "..." : "MISSING", "host:", host ?? "MISSING");
    if (token) {
      posthog.init(token, {
        api_host: window.location.origin + "/ingest",
        ui_host: host ?? "https://us.posthog.com",
        capture_pageview: "history_change",
        autocapture: true,
        capture_exceptions: true,
        debug: true,
        person_profiles: "always",
      });
      posthog.capture("app_loaded");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <TutorialProvider>
            <Router />
            <TutorialOverlay />
            <Toaster />
          </TutorialProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
