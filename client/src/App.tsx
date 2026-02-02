import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
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
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <Router />
          <Toaster />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
