import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import ExpensesPage from "@/pages/ExpensesPage";
import GoalsPage from "@/pages/GoalsPage";
import FamilyPage from "@/pages/FamilyPage";
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
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
