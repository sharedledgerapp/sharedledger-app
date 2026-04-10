import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useExpenses, useGoals, useFamily } from "@/hooks/use-data";
import { captureEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Wallet, TrendingUp, Star, ArrowUpRight, ArrowDownRight, ChevronRight, Flag, Target, Utensils, Bus, Gamepad2, ShoppingBag, Lightbulb, GraduationCap, Heart, Package, PiggyBank, Clock, Globe, Bell, Sparkles, X, Banknote, ArrowDownLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { sortGoalsByPriority } from "@/lib/goals";
import { getCurrencySymbol, formatAmount, toFixedAmount } from "@/lib/currency";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTutorial } from "@/contexts/TutorialContext";
import { TUTORIAL_STORAGE_KEY } from "@/lib/tutorial-steps";
import { subscribeToPush } from "@/lib/notifications";

const PUSH_PROMPT_KEY = "sharedledger_push_prompted";
const TOUR_DISMISSED_KEY = TUTORIAL_STORAGE_KEY;

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];

interface FriendGroupSummary {
  id: number;
  name: string;
  currency: string;
  archived: boolean;
  memberCount: number;
  memberRole: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: familyData } = useFamily();
  const { startTutorial } = useTutorial();

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(false);

  useEffect(() => {
    if (!user) return;
    const promptKey = `${PUSH_PROMPT_KEY}_${user.id}`;
    const alreadyPrompted = localStorage.getItem(promptKey);
    if (!alreadyPrompted && typeof Notification !== "undefined" && Notification.permission === "default") {
      const timer = setTimeout(() => setShowPushPrompt(true), 1000);
      return () => clearTimeout(timer);
    } else {
      const tourCompleted = localStorage.getItem(TOUR_DISMISSED_KEY);
      if (!tourCompleted) {
        const timer = setTimeout(() => setShowTourPrompt(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const handlePushEnable = async () => {
    if (user) {
      localStorage.setItem(`${PUSH_PROMPT_KEY}_${user.id}`, "true");
    }
    setShowPushPrompt(false);
    try {
      await subscribeToPush();
    } catch {}
    const tourCompleted = localStorage.getItem(TOUR_DISMISSED_KEY);
    if (!tourCompleted) {
      setTimeout(() => setShowTourPrompt(true), 500);
    }
  };

  const handlePushDismiss = () => {
    if (user) {
      localStorage.setItem(`${PUSH_PROMPT_KEY}_${user.id}`, "true");
    }
    setShowPushPrompt(false);
    const tourCompleted = localStorage.getItem(TOUR_DISMISSED_KEY);
    if (!tourCompleted) {
      setTimeout(() => setShowTourPrompt(true), 500);
    }
  };

  const handleStartTour = () => {
    setShowTourPrompt(false);
    startTutorial();
  };

  const handleDismissTour = () => {
    setShowTourPrompt(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, "true");
  };

  const { data: friendGroups } = useQuery<FriendGroupSummary[]>({
    queryKey: ["/api/friend-groups"],
    queryFn: async () => {
      const res = await fetch("/api/friend-groups", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const currencySymbol = getCurrencySymbol(user?.currency);
  const [showBudgetPrompt, setShowBudgetPrompt] = useState(false);

  const { data: spendingSummary } = useQuery<{
    currentMonthTotal: string;
    prevMonthTotal: string;
    todayTotal: string;
    percentageChange: string;
    trend: "up" | "down";
    recurringMonthlyTotal: string;
    combinedMonthlyTotal: string;
    crossCurrencyGroupExpenseCount: number;
    monthlyIncomeTotal: string;
    hasIncomeEntries: boolean;
  }>({
    queryKey: ["/api/spending/summary"],
  });

  const { data: budgetSummary } = useQuery<{
    budgets: any[];
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    totalPercentUsed: number;
  }>({
    queryKey: ["/api/budget-summary"],
  });

  const { data: budgetSetup } = useQuery<any>({
    queryKey: ["/api/budget-setup"],
  });

  const { data: budgetAverages } = useQuery<{ averages: { category: string; monthlyAverage: number; weeklyAverage: number }[]; hasData: boolean }>({
    queryKey: ["/api/budget-averages"],
    enabled: showBudgetPrompt,
  });

  const setupMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("POST", "/api/budget-setup", { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-setup"] });
      setShowBudgetPrompt(false);
    },
  });

  useEffect(() => {
    if (budgetSummary && budgetSummary.budgets.length === 0 && budgetSetup !== undefined) {
      const shouldPrompt = !budgetSetup ||
        (budgetSetup.status === "remind_week" && budgetSetup.remindAt && new Date(budgetSetup.remindAt) <= new Date()) ||
        (budgetSetup.status === "remind_month" && budgetSetup.remindAt && new Date(budgetSetup.remindAt) <= new Date());
      if (shouldPrompt) {
        const timer = setTimeout(() => setShowBudgetPrompt(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [budgetSummary, budgetSetup]);

  if (expensesLoading || goalsLoading) {
    return <DashboardSkeleton />;
  }

  const monthlyTotal = spendingSummary ? Number(spendingSummary.currentMonthTotal) : 0;
  const todayTotal = spendingSummary ? Number(spendingSummary.todayTotal) : 0;
  const percentageChange = spendingSummary ? Math.abs(Number(spendingSummary.percentageChange)) : 0;
  const trend = spendingSummary?.trend || "up";
  const prevMonthTotal = spendingSummary ? Number(spendingSummary.prevMonthTotal) : 0;
  const recurringTotal = spendingSummary ? Number(spendingSummary.recurringMonthlyTotal) : 0;
  const combinedTotal = spendingSummary ? Number(spendingSummary.combinedMonthlyTotal) : 0;
  const monthlyIncomeTotal = spendingSummary ? Number(spendingSummary.monthlyIncomeTotal) : 0;
  const hasIncomeEntries = spendingSummary?.hasIncomeEntries ?? false;
  const netTotal = monthlyIncomeTotal - combinedTotal;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const friendGroupCurrencyMap = new Map<number, string>(
    (friendGroups || []).map(g => [g.id, g.currency || "EUR"])
  );
  const establishedFamilyCurrency = familyData?.family?.currency || null;
  const userCurrency = user?.currency || "EUR";

  const personalExpenses = expenses?.filter(e => {
    if (e.paymentSource !== "personal") return false;
    const expDate = new Date(e.date);
    if (expDate < monthStart || expDate > monthEnd) return false;
    const expFamilyId = (e as any).familyId as number | null | undefined;
    if (expFamilyId != null) {
      const groupCurrency = friendGroupCurrencyMap.get(expFamilyId)
        ?? (expFamilyId === user?.familyId ? establishedFamilyCurrency : null);
      if (groupCurrency && groupCurrency !== userCurrency) return false;
    }
    return true;
  }) || [];
  const categoryData = personalExpenses.reduce((acc, curr) => {
    const existing = acc.find(i => i.name === curr.category);
    if (existing) {
      existing.value += Number(curr.amount);
    } else {
      acc.push({ name: curr.category, value: Number(curr.amount) });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {t("hi")}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">{t("financialSnapshot")}</p>
        </div>
        <DropdownMenu>
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-primary dark:bg-white animate-ring-pulse pointer-events-none" />
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="rounded-full shadow-lg shadow-primary/25 relative" data-tutorial="add-expense-button" data-testid="button-quick-add">
                <Plus className="w-6 h-6" />
              </Button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => navigate("/app/expenses?openCreate=true")}
              data-testid="dropdown-item-expense"
            >
              <ArrowDownLeft className="w-4 h-4 mr-2 text-destructive" />
              Expense
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/app/expenses?tab=in&openCreate=true")}
              data-testid="dropdown-item-income"
            >
              <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
              Income
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {hasIncomeEntries ? (
          <Link href="/app/expenses?tab=in" className="col-span-2">
            <Card className="col-span-2 bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20 cursor-pointer hover:shadow-primary/30 transition-shadow" data-tutorial="home-spending">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2 text-white/80">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium">This month</span>
                  </div>
                  {todayTotal > 0 && (
                    <div className="text-right bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm" data-testid="badge-today-total">
                      <div className="text-[10px] uppercase tracking-wider text-white/70">{t("today")}</div>
                      <div className="text-base font-bold">{currencySymbol}{toFixedAmount(todayTotal, user?.currency)}</div>
                    </div>
                  )}
                </div>

                {/* Net figure — headline, font shrinks for large numbers */}
                {(() => {
                  const netStr = `${netTotal >= 0 ? "+" : "-"}${currencySymbol}${toFixedAmount(Math.abs(netTotal), user?.currency)}`;
                  const sizeClass = netStr.length > 14 ? "text-2xl" : netStr.length > 11 ? "text-3xl" : netStr.length > 8 ? "text-4xl" : "text-5xl";
                  return (
                    <div className={`${sizeClass} font-display font-bold mb-4 leading-tight ${netTotal < 0 ? "text-red-200" : ""}`} data-testid="text-net-total">
                      {netStr}
                      <span className="text-sm font-normal text-white/70 ml-2">net</span>
                    </div>
                  );
                })()}

                <div className="space-y-1.5 text-[11px] text-white/80">
                  <div className="flex items-center justify-between" data-testid="badge-income-total">
                    <span className="flex items-center gap-1">
                      <Banknote className="w-3 h-3 shrink-0" />
                      Money In
                    </span>
                    <span className="font-semibold text-green-300">+{currencySymbol}{toFixedAmount(monthlyIncomeTotal, user?.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="badge-spending-total">
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3 h-3 shrink-0" />
                      Money Out
                    </span>
                    <span className="font-semibold text-white">-{currencySymbol}{toFixedAmount(combinedTotal, user?.currency)}</span>
                  </div>
                </div>

                {prevMonthTotal > 0 && (
                  <div className="mt-3 flex gap-3 text-xs font-medium text-white/90">
                    <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm" data-testid="badge-trend">
                      {trend === "up" ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {trend === "up" ? "+" : "-"}{percentageChange.toFixed(0)}% spending {t("vsLastMonth")}
                    </div>
                  </div>
                )}
                {(spendingSummary?.crossCurrencyGroupExpenseCount ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-white/60 text-[10px]" data-testid="badge-cross-currency-note">
                    <Globe className="w-3 h-3 shrink-0" />
                    <span>{spendingSummary!.crossCurrencyGroupExpenseCount} group expense{spendingSummary!.crossCurrencyGroupExpenseCount !== 1 ? "s" : ""} in other currencies not counted</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="col-span-2 bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20" data-tutorial="home-spending">
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2 text-white/80 mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("personalSpending")}</span>
                  </div>
                  {(() => {
                    const totalStr = `${currencySymbol}${toFixedAmount(combinedTotal, user?.currency)}`;
                    const sizeClass = totalStr.length > 13 ? "text-2xl" : totalStr.length > 10 ? "text-3xl" : "text-4xl";
                    return (
                      <div className={`${sizeClass} font-display font-bold leading-tight`} data-testid="text-monthly-total">
                        {totalStr}
                      </div>
                    );
                  })()}
                </div>
                {todayTotal > 0 && (
                  <div className="text-right bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm" data-testid="badge-today-total">
                    <div className="text-[10px] uppercase tracking-wider text-white/70">{t("today")}</div>
                    <div className="text-base font-bold">{currencySymbol}{toFixedAmount(todayTotal, user?.currency)}</div>
                  </div>
                )}
              </div>

              {(monthlyTotal > 0 || recurringTotal > 0) && (
                <div className="mt-3 space-y-1 text-[11px] text-white/80">
                  {monthlyTotal > 0 && (
                    <div className="flex items-center justify-between" data-testid="badge-everyday-total">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 shrink-0" />
                        Everyday
                      </span>
                      <span className="font-semibold text-white">{currencySymbol}{toFixedAmount(monthlyTotal, user?.currency)}</span>
                    </div>
                  )}
                  {recurringTotal > 0 && (
                    <div className="flex items-center justify-between" data-testid="badge-recurring-total">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        Recurring
                      </span>
                      <span className="font-semibold text-white">{currencySymbol}{toFixedAmount(recurringTotal, user?.currency)}/mo</span>
                    </div>
                  )}
                </div>
              )}

              {prevMonthTotal > 0 && (
                <div className="mt-3 flex gap-3 text-xs font-medium text-white/90">
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm" data-testid="badge-trend">
                    {trend === "up" ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {trend === "up" ? "+" : "-"}{percentageChange.toFixed(0)}% {t("vsLastMonth")}
                  </div>
                </div>
              )}
              {(spendingSummary?.crossCurrencyGroupExpenseCount ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-1 text-white/60 text-[10px]" data-testid="badge-cross-currency-note">
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>{spendingSummary!.crossCurrencyGroupExpenseCount} group expense{spendingSummary!.crossCurrencyGroupExpenseCount !== 1 ? "s" : ""} in other currencies not counted</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(() => {
          const sortedGoals = sortGoalsByPriority(goals || []);
          const topGoal = sortedGoals[0];
          if (!topGoal) return null;

          const progress = Math.min(100, (Number(topGoal.currentAmount) / Number(topGoal.targetAmount)) * 100);
          const daysUntilDeadline = topGoal.deadline
            ? differenceInDays(new Date(topGoal.deadline), new Date())
            : null;

          return (
            <Card className="col-span-2 md:col-span-1 border-border/50 shadow-sm overflow-hidden relative">
              <div
                className="absolute top-0 left-0 h-1 bg-accent"
                style={{ width: `${progress}%` }}
              />
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" /> {t("topGoal")}
                  </span>
                  {topGoal.priority === "high" && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                      <Flag className="w-2.5 h-2.5 mr-0.5" /> {t("priority")}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="text-lg font-bold truncate">{topGoal.title}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{currencySymbol}{Number(topGoal.currentAmount).toLocaleString()} / {currencySymbol}{Number(topGoal.targetAmount).toLocaleString()}</span>
                  <span className="font-medium text-primary">{progress.toFixed(0)}%</span>
                </div>
                {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
                  <div className="text-xs text-muted-foreground">
                    {daysUntilDeadline === 0 ? t("dueToday") : `${daysUntilDeadline} ${t("daysLeft")}`}
                  </div>
                )}
                <Link href="/app/goals">
                  <Button variant="outline" size="sm" className="w-full mt-2" data-testid="button-view-all-goals">
                    {t("viewAllGoals")} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })()}

        {goals?.length === 0 && (
          <Card className="col-span-2 md:col-span-1 border-border/50 shadow-sm border-dashed">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">{t("noGoalsYet")}</p>
              <Link href="/app/goals">
                <Button variant="outline" size="sm" data-testid="button-create-first-goal">
                  <Plus className="w-4 h-4 mr-1" /> {t("setGoal")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <section>
        <Link href="/app/reports">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group" data-testid="link-reports">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t("spendingBreakdown")}
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
          </h3>
        </Link>

        <Link href="/app/reports">
          <Card className="border-border/50 shadow-sm cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4 h-[250px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("noData")}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <Link href="/app/budget">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group" data-testid="link-budget-planning">
            <PiggyBank className="w-5 h-5 text-primary" />
            {t("budgetPlanning")}
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
          </h3>
        </Link>

        <Link href="/app/budget">
          <Card className="border-border/50 shadow-sm cursor-pointer hover:border-primary/50 transition-colors" data-testid="card-budget-summary-home">
            <CardContent className="p-4">
              {budgetSummary && budgetSummary.budgets.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline gap-2 flex-wrap">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("spent")}</p>
                      <p className="text-lg font-bold">{formatAmount(budgetSummary.totalSpent, user?.currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("totalBudget")}</p>
                      <p className="text-lg font-bold">{formatAmount(budgetSummary.totalBudget, user?.currency)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{t("remaining")}: {formatAmount(budgetSummary.totalRemaining, user?.currency)}</span>
                      <span className={budgetSummary.totalPercentUsed > 100 ? "text-destructive font-semibold" : ""}>
                        {budgetSummary.totalPercentUsed}% {t("percentUsed")}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          budgetSummary.totalPercentUsed >= 100 ? 'bg-destructive' :
                          budgetSummary.totalPercentUsed >= 80 ? 'bg-orange-500' :
                          budgetSummary.totalPercentUsed >= 60 ? 'bg-yellow-500' :
                          'bg-primary'
                        }`}
                        style={{ width: `${Math.min(budgetSummary.totalPercentUsed, 100)}%` }}
                        data-testid="progress-budget-home"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <PiggyBank className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("noBudgets")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("setupFirstBudget")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* My Groups section — hidden from users, infrastructure intact */}
      {/* <CreateFriendGroupDialog open={showCreateGroup} onOpenChange={setShowCreateGroup} /> */}

      {/* Push notification opt-in prompt */}
      {showPushPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <Card className="border-primary/20 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Stay on top of your finances</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enable notifications to get budget alerts and spending reminders.</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handlePushEnable} className="h-8 text-xs" data-testid="button-enable-notifications">
                      Enable notifications
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handlePushDismiss} className="h-8 text-xs text-muted-foreground" data-testid="button-maybe-later-notifications">
                      Maybe later
                    </Button>
                  </div>
                </div>
                <button onClick={handlePushDismiss} className="text-muted-foreground hover:text-foreground" data-testid="button-dismiss-push-prompt">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Take a tour prompt */}
      {showTourPrompt && !showPushPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <Card className="border-primary/20 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Take a quick tour?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">We'll show you the key features in about a minute.</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleStartTour} className="h-8 text-xs" data-testid="button-start-tour">
                      Take a tour
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleDismissTour} className="h-8 text-xs text-muted-foreground" data-testid="button-dismiss-tour">
                      Maybe later
                    </Button>
                  </div>
                </div>
                <button onClick={handleDismissTour} className="text-muted-foreground hover:text-foreground" data-testid="button-close-tour-prompt">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showBudgetPrompt} onOpenChange={setShowBudgetPrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary" />
              {t("planYourBudget")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("budgetSetupMessage")}</p>

            {budgetAverages?.hasData && budgetAverages.averages.length > 0 && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{t("averageSpending")}</p>
                {budgetAverages.averages.slice(0, 5).map(avg => (
                  <div key={avg.category} className="flex justify-between text-sm">
                    <span>{avg.category}</span>
                    <span className="text-muted-foreground">{formatAmount(avg.monthlyAverage, user?.currency)}/{t("monthly").toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  setupMutation.mutate("completed");
                  navigate("/app/budget");
                }}
                data-testid="button-setup-now"
              >
                {t("setupNow")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setupMutation.mutate("remind_week"); captureEvent("home_payment_reminder_set", { timing: "week" }); }}
                disabled={setupMutation.isPending}
                data-testid="button-remind-week"
              >
                <Clock className="w-4 h-4 mr-2" />
                {t("remindWeek")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setupMutation.mutate("remind_month"); captureEvent("home_payment_reminder_set", { timing: "month" }); }}
                disabled={setupMutation.isPending}
                data-testid="button-remind-month"
              >
                <Clock className="w-4 h-4 mr-2" />
                {t("remindMonth")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getCategoryIconComponent(category: string) {
  const icons: Record<string, any> = {
    Food: Utensils,
    Transport: Bus,
    Entertainment: Gamepad2,
    Shopping: ShoppingBag,
    Utilities: Lightbulb,
    Education: GraduationCap,
    Health: Heart,
    Other: Package,
  };
  const Icon = icons[category] || Package;
  return <Icon className="w-5 h-5 text-muted-foreground" />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  );
}
