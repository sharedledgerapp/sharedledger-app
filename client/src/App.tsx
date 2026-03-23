import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { TutorialProvider, useTutorial } from "@/contexts/TutorialContext";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { Layout } from "@/components/Layout";
import { FamilyOnboardingModal } from "@/components/FamilyOnboardingModal";
import NotFound from "@/pages/not-found";
import OnboardingPage, { hasSeenOnboarding } from "@/pages/OnboardingPage";
import AuthPage from "@/pages/AuthPage";
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
import { useEffect, useRef } from "react";
import { startNotificationScheduler, stopNotificationScheduler, checkBudgetThresholdNotifications, subscribeToPush } from "@/lib/notifications";
import { TUTORIAL_STORAGE_KEY } from "@/lib/tutorial-steps";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      const prefs = {
        dailyReminderEnabled: (user as any).dailyReminderEnabled ?? true,
        dailyReminderTime: (user as any).dailyReminderTime || "19:00",
        weeklyReminderEnabled: (user as any).weeklyReminderEnabled ?? true,
        monthlyReminderEnabled: (user as any).monthlyReminderEnabled ?? true,
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

  if (!user.familyId) {
    return <Redirect to="/auth" />;
  }

  return (
    <Layout>
      <Component />
      <FamilyOnboardingModal userId={user.id} />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/auth">
        {() => {
          if (!hasSeenOnboarding()) {
            return <Redirect to="/onboarding" />;
          }
          return <AuthPage />;
        }}
      </Route>
      
      {/* Protected Routes */}
      <Route path="/">
        {() => <ProtectedRoute component={HomePage} />}
      </Route>
      <Route path="/expenses">
        {() => <ProtectedRoute component={ExpensesPage} />}
      </Route>
      <Route path="/goals">
        {() => <ProtectedRoute component={GoalsPage} />}
      </Route>
      <Route path="/family">
        {() => <ProtectedRoute component={FamilyPage} />}
      </Route>
      <Route path="/family-dashboard">
        {() => <ProtectedRoute component={FamilyDashboard} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      <Route path="/spending-reflections">
        {() => <ProtectedRoute component={SpendingReflectionsPage} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={ReportsPage} />}
      </Route>
      <Route path="/messages">
        {() => <ProtectedRoute component={MessagesPage} />}
      </Route>
      <Route path="/budget">
        {() => <ProtectedRoute component={BudgetPage} />}
      </Route>
      <Route path="/groups">
        {() => <ProtectedRoute component={FriendGroupsPage} />}
      </Route>
      <Route path="/groups/:id">
        {() => <ProtectedRoute component={FriendGroupDashboard} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function TutorialAutoStart() {
  const { user } = useAuth();
  const { startTutorial } = useTutorial();
  const started = useRef(false);

  useEffect(() => {
    if (user && user.familyId && !started.current) {
      const completed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!completed) {
        started.current = true;
        const timer = setTimeout(() => startTutorial(), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user, startTutorial]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <TutorialProvider>
            <Router />
            <TutorialAutoStart />
            <TutorialOverlay />
            <Toaster />
          </TutorialProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
