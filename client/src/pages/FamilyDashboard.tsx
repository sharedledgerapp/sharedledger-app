import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { 
  Users, Wallet, TrendingUp, ChevronLeft, ChevronRight, 
  Target, Calendar, Utensils, Bus, Gamepad2, ShoppingBag, 
  Lightbulb, GraduationCap, Heart, Package, Home as HomeIcon,
  Flag, PiggyBank, Info, Banknote, Trash2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, subMonths, subWeeks, differenceInDays } from "date-fns";
import { getCurrencySymbol, toFixedAmount } from "@/lib/currency";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BalanceBoard } from "@/components/BalanceBoard";
import { RoommatesDashboardView } from "@/pages/RoommatesDashboard";
import { CouplesDashboardView } from "@/pages/CouplesDashboard";
import { useFamily } from "@/hooks/use-data";
import { InviteSection } from "@/components/InviteSection";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb923c", "#4ade80"];

interface MemberSpending {
  id: number;
  name: string;
  role: string;
  total: string;
  expenseCount: number;
  isPrivate: boolean;
}

interface FamilyDashboardData {
  period: {
    type: "month" | "week";
    start: string;
    end: string;
  };
  summary: {
    totalSpent: string;
    expenseCount: number;
    memberCount: number;
    familyName: string;
    groupType?: string;
    currency?: string;
  };
  memberSpending: MemberSpending[];
  categoryBreakdown: {
    category: string;
    amount: string;
    count: number;
    percentage: string;
  }[];
  moneySourceSplit: {
    familyMoney: string;
    personalMoney: string;
    familyPercentage: string;
    personalPercentage: string;
  };
  sharedGoals: {
    id: number;
    title: string;
    targetAmount: string;
    currentAmount: string;
    priority: string;
    deadline: string | null;
  }[];
  recentExpenses: {
    id: number;
    amount: string;
    category: string;
    note: string | null;
    date: string;
    paymentSource: string;
    paidByName?: string;
  }[];
  memberExpenses: Record<number, {
    id: number;
    amount: string;
    category: string;
    note: string | null;
    date: string;
    paymentSource: string;
  }[]>;
  contributions?: {
    partners: { id: number; name: string; total: string }[];
    difference: string;
  };
  milestones?: { key: string; label: string; achieved: boolean }[];
}

function getCategoryIcon(category: string) {
  const IconMap: Record<string, React.ReactNode> = {
    Food: <Utensils className="w-4 h-4" />,
    Transport: <Bus className="w-4 h-4" />,
    Entertainment: <Gamepad2 className="w-4 h-4" />,
    Shopping: <ShoppingBag className="w-4 h-4" />,
    Utilities: <Lightbulb className="w-4 h-4" />,
    Education: <GraduationCap className="w-4 h-4" />,
    Health: <Heart className="w-4 h-4" />,
    Housing: <HomeIcon className="w-4 h-4" />,
    Other: <Package className="w-4 h-4" />,
  };
  return IconMap[category] || <Package className="w-4 h-4" />;
}

function getGoalStatus(goal: FamilyDashboardData["sharedGoals"][0]) {
  const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
  
  if (!goal.deadline) {
    return progress >= 100 ? "completed" : "on_track";
  }
  
  const daysLeft = differenceInDays(new Date(goal.deadline), new Date());
  const expectedProgress = Math.max(0, 100 - (daysLeft / 30) * 100);
  
  if (progress >= 100) return "completed";
  if (progress >= expectedProgress) return "on_track";
  if (progress >= expectedProgress * 0.8) return "slightly_behind";
  return "behind";
}

export default function FamilyDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: familyData } = useFamily();
  const isRoommates = familyData?.family?.groupType === "roommates";

  const deleteSharedIncomeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/income/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/income"] });
      qc.invalidateQueries({ queryKey: ["/api/spending/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/family/income"] });
      toast({ title: "Income deleted" });
    },
    onError: () => toast({ title: "Failed to delete income", variant: "destructive" }),
  });
  
  const [periodType, setPeriodType] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<MemberSpending | null>(null);
  const [bottomView, setBottomView] = useState<"expenses" | "goals">("expenses");

  const periodStart = periodType === "month" 
    ? startOfMonth(currentDate) 
    : startOfWeek(currentDate, { weekStartsOn: 0 });
  const periodEnd = periodType === "month" 
    ? endOfMonth(currentDate) 
    : endOfWeek(currentDate, { weekStartsOn: 0 });

  const { roommatesStart, roommatesEnd } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    return { roommatesStart: start, roommatesEnd: end };
  }, []);

  const queryStart = isRoommates ? roommatesStart : periodStart;
  const queryEnd = isRoommates ? roommatesEnd : periodEnd;

  const { data, isLoading } = useQuery<FamilyDashboardData>({
    queryKey: ["/api/family/dashboard", isRoommates ? "roommates-90d" : periodType, queryStart.toISOString(), queryEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/family/dashboard?period=${periodType}&startDate=${queryStart.toISOString()}&endDate=${queryEnd.toISOString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load family dashboard");
      return res.json();
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  type SharedBudgetSummary = {
    id: number;
    category: string;
    amount: string;
    periodType: string;
    spent: number;
    remaining: number;
    percentUsed: number;
  };

  const { data: sharedBudgetsData } = useQuery<{ budgets: SharedBudgetSummary[] }>({
    queryKey: ["/api/family/shared-budgets"],
    enabled: !!user?.familyId,
    staleTime: 10_000,
  });

  type FamilyIncomeEntry = {
    id: number;
    userId: number;
    amount: string;
    source: string | null;
    note: string | null;
    date: string;
    isRecurring: boolean;
    shareDetails: boolean | null;
    userName: string;
  };

  const familyIncomeStartStr = periodStart.toISOString();
  const familyIncomeEndStr = periodEnd.toISOString();
  const { data: familyIncomeEntries } = useQuery<FamilyIncomeEntry[]>({
    queryKey: ["/api/family/income", familyIncomeStartStr, familyIncomeEndStr],
    queryFn: () => fetch(`/api/family/income?startDate=${encodeURIComponent(familyIncomeStartStr)}&endDate=${encodeURIComponent(familyIncomeEndStr)}`).then(r => r.json()),
    enabled: !!user?.familyId,
    staleTime: 10_000,
  });

  const currencySymbol = getCurrencySymbol(data?.summary.currency || user?.currency);
  const groupCurrency = data?.summary.currency || user?.currency;

  const navigatePeriod = (direction: "prev" | "next") => {
    if (periodType === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const periodLabel = periodType === "month"
    ? format(currentDate, "MMMM yyyy")
    : `${format(periodStart, "MMM d")} - ${format(periodEnd, "MMM d, yyyy")}`;

  const [, navigate] = useLocation();

  if (!user?.familyId) {
    return (
      <div className="space-y-6 pb-20">
        <div className="text-center py-16 px-6">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">No Group Yet</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            The group dashboard shows shared spending, member breakdowns, and shared goals. Create a group to get started.
          </p>
          <Button
            onClick={() => navigate("/app/family")}
            className="h-12 px-8 rounded-xl shadow-lg shadow-primary/25"
            data-testid="button-create-group-dashboard"
          >
            Create a Group
          </Button>
        </div>
      </div>
    );
  }

  const familyCode = familyData?.family?.code;

  if (isLoading) {
    return <FamilyDashboardSkeleton />;
  }

  if (data?.summary.groupType === "roommates") {
    return (
      <>
        {familyCode && (
          <div className="mb-2">
            <InviteSection familyCode={familyCode} groupName={data.summary.familyName} />
          </div>
        )}
        <RoommatesDashboardView
          summary={data.summary}
          recentExpenses={data.recentExpenses}
        />
      </>
    );
  }

  if (data?.summary.groupType === "couple") {
    return (
      <>
        {familyCode && (
          <div className="mb-2">
            <InviteSection familyCode={familyCode} groupName={data.summary.familyName} />
          </div>
        )}
        <CouplesDashboardView
          summary={data.summary}
          categoryBreakdown={data.categoryBreakdown}
          contributions={data.contributions}
          milestones={data.milestones}
          recentExpenses={data.recentExpenses}
          periodType={periodType}
          setPeriodType={setPeriodType}
          navigatePeriod={navigatePeriod}
          periodLabel={periodLabel}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      </>
    );
  }

  const categoryExpenses = selectedCategory 
    ? data?.recentExpenses.filter(e => e.category === selectedCategory) 
    : null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-family-dashboard-title">
            {t("groupDashboard")}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-family-name">{data?.summary.familyName}</p>
        </div>
        <Badge variant="secondary" className="gap-1" data-testid="badge-member-count">
          <Users className="w-3 h-3" />
          {data?.summary.memberCount} {t("members")}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant={periodType === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodType("month")}
            data-testid="button-period-month"
          >
            {t("month")}
          </Button>
          <Button
            variant={periodType === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodType("week")}
            data-testid="button-period-week"
          >
            {t("week")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigatePeriod("prev")}
            data-testid="button-prev-period"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm min-w-[140px] text-center" data-testid="text-period-label">{periodLabel}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigatePeriod("next")}
            data-testid="button-next-period"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20" data-tutorial="shared-dashboard">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-white/80 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">{t("sharedSpending")}</span>
          </div>
          <div className="text-4xl font-display font-bold" data-testid="text-total-shared-spending">
            {currencySymbol}{toFixedAmount(Number(data?.summary.totalSpent || 0), groupCurrency)}
          </div>
          <div className="mt-4 flex gap-3 text-xs font-medium text-white/90">
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
              <TrendingUp className="w-3 h-3" />
              {data?.summary.expenseCount} {t(data?.summary.expenseCount === 1 ? "expense" : "expensesPlural")}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCategory ? (
        <section>
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedCategory(null)}
              className="gap-1"
              data-testid="button-back-categories"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("backToCategories")}
            </Button>
          </div>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {getCategoryIcon(selectedCategory)}
                {selectedCategory}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {categoryExpenses?.length ? categoryExpenses.map((expense) => (
                <div 
                  key={expense.id} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  data-testid={`expense-item-${expense.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      {getCategoryIcon(expense.category)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{expense.note || expense.category}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={expense.paymentSource === "family" ? "outline" : "secondary"} className="text-xs">
                      {expense.paymentSource === "family" ? t("familyBadge") : t("personal")}
                    </Badge>
                    <span className="font-bold text-sm">-{currencySymbol}{toFixedAmount(Number(expense.amount), groupCurrency)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {t("noExpensesInCategory")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : (
        <section>
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t("spendingByCategory")}
          </h3>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              {data?.categoryBreakdown.length ? (
                <div className="flex flex-col gap-4">
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="amount"
                          nameKey="category"
                        >
                          {data.categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`${currencySymbol}${toFixedAmount(Number(value), groupCurrency)}`, ""]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {data.categoryBreakdown.map((cat, index) => (
                      <button
                        key={cat.category}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedCategory(cat.category)}
                        data-testid={`button-category-${cat.category.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{getCategoryIcon(cat.category)}</span>
                          <span className="text-sm font-medium">{cat.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{cat.percentage}%</span>
                          <span className="text-sm font-bold">{currencySymbol}{toFixedAmount(Number(cat.amount), groupCurrency)}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-center px-6">
                  <TrendingUp className="w-8 h-8 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground font-medium">{t("noSharedExpenses")}</p>
                  <p className="text-xs text-muted-foreground opacity-70">
                    Share expenses with your group to see the breakdown here — use the &ldquo;Share with group&rdquo; toggle when adding an expense.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {data?.memberSpending && data.memberSpending.length > 0 && (
        <section>
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {t("members")}
          </h3>
          <div className="grid gap-3">
            {data.memberSpending.map((member) => (
              <Card
                key={member.id}
                className="border-border/50 shadow-sm cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
                onClick={() => setViewingMember(member)}
                data-testid={`member-card-${member.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{member.name}</p>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{currencySymbol}{toFixedAmount(Number(member.total), groupCurrency)}</span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {member.expenseCount} {t(member.expenseCount === 1 ? "expense" : "expensesPlural")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {familyIncomeEntries && familyIncomeEntries.length > 0 && (
        <section data-testid="section-household-income">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Household Income
          </h3>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3">
              {familyIncomeEntries.map((entry) => {
                const isOwner = entry.userId === user?.id;
                const isHidden = entry.source === null;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`family-income-entry-${entry.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-xs">
                        {entry.userName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{entry.userName}</p>
                          {isOwner && (
                            <Link href="/app/expenses?tab=in">
                              <span className="text-[10px] text-primary underline cursor-pointer" data-testid={`link-edit-income-${entry.id}`}>edit</span>
                            </Link>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isHidden ? <span className="italic">Income</span> : entry.source}
                          {entry.isRecurring && <span className="ml-1.5 text-primary">· recurring</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600 dark:text-green-400">
                        +{currencySymbol}{toFixedAmount(Number(entry.amount), groupCurrency)}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => deleteSharedIncomeMutation.mutate(entry.id)}
                          disabled={deleteSharedIncomeMutation.isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-delete-family-income-${entry.id}`}
                          aria-label="Delete income"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="pt-1 flex items-center justify-between text-sm font-semibold border-t border-border/50 mt-1">
                <span className="text-muted-foreground">Combined household income</span>
                <span className="text-green-600 dark:text-green-400">
                  +{currencySymbol}{toFixedAmount(familyIncomeEntries.reduce((s, e) => s + Number(e.amount), 0), groupCurrency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {user?.familyId && (
        <section data-testid="section-shared-budgets">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-primary" />
            Shared Budgets
          </h3>
          {sharedBudgetsData?.budgets.length ? (
            <div className="space-y-3">
              {sharedBudgetsData.budgets.map((budget) => {
                const pct = Math.min(100, budget.percentUsed);
                const isOver = budget.percentUsed >= 100;
                const isNear = budget.percentUsed >= 80 && !isOver;
                return (
                  <Card key={budget.id} className="border-border/50 shadow-sm" data-testid={`shared-budget-card-${budget.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                            {getCategoryIcon(budget.category)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{budget.category}</p>
                            <p className="text-xs text-muted-foreground capitalize">{budget.periodType}</p>
                          </div>
                        </div>
                        <Badge
                          variant={isOver ? "destructive" : isNear ? "outline" : "secondary"}
                          className={`text-xs ${isNear ? "border-orange-400 text-orange-600" : ""}`}
                        >
                          {pct}%
                        </Badge>
                      </div>
                      <Progress
                        value={pct}
                        className={`h-2 mb-2 ${isOver ? "[&>div]:bg-destructive" : isNear ? "[&>div]:bg-orange-500" : ""}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{currencySymbol}{toFixedAmount(budget.spent, groupCurrency)} spent</span>
                        <span>{currencySymbol}{toFixedAmount(Number(budget.amount), groupCurrency)} limit</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Link href="/app/budget?openCreate=true&shared=true">
              <div className="text-center py-6 bg-muted/30 rounded-xl border border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer" data-testid="shared-budget-empty-cta">
                <PiggyBank className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No shared budgets yet</p>
                <p className="text-xs text-primary mt-1">Tap to set one up</p>
              </div>
            </Link>
          )}
        </section>
      )}

      <section>
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <Button
            variant={bottomView === "expenses" ? "default" : "outline"}
            size="sm"
            onClick={() => setBottomView("expenses")}
            className="gap-1"
            data-testid="button-view-expenses"
          >
            <Calendar className="w-4 h-4" />
            {t("recentSharedExpenses")}
          </Button>
          <Button
            variant={bottomView === "goals" ? "default" : "outline"}
            size="sm"
            onClick={() => setBottomView("goals")}
            className="gap-1"
            data-testid="button-view-goals"
          >
            <Target className="w-4 h-4" />
            {t("groupGoals")}
          </Button>
        </div>

        {bottomView === "goals" ? (
          data?.sharedGoals.length ? (
            <div className="space-y-3">
              {data.sharedGoals.map((goal) => {
                const progress = Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100);
                const status = getGoalStatus(goal);
                const statusColors = {
                  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                  on_track: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                  slightly_behind: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                  behind: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                };
                const statusLabels = {
                  completed: t("statusCompleted"),
                  on_track: t("statusOnTrack"),
                  slightly_behind: t("statusSlightlyBehind"),
                  behind: t("statusBehind"),
                };
                
                const daysLeft = goal.deadline 
                  ? differenceInDays(new Date(goal.deadline), new Date())
                  : null;
                
                return (
                  <Link key={goal.id} href="/app/goals">
                    <Card 
                      className="border-border/50 shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                      data-testid={`goal-card-${goal.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{goal.title}</span>
                            {goal.priority === "high" && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                <Flag className="w-2.5 h-2.5 mr-0.5" /> {t("priorityLabel")}
                              </Badge>
                            )}
                          </div>
                          <Badge className={`text-xs ${statusColors[status]}`}>
                            {statusLabels[status]}
                          </Badge>
                        </div>
                        <Progress value={progress} className="h-2 mb-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{currencySymbol}{toFixedAmount(Number(goal.currentAmount), groupCurrency)} / {currencySymbol}{toFixedAmount(Number(goal.targetAmount), groupCurrency)}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{progress.toFixed(0)}%</span>
                            {daysLeft !== null && daysLeft >= 0 && (
                              <span>{daysLeft} {t("daysLeft")}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
              {t("noGoals")}
            </div>
          )
        ) : (
        <div className="space-y-3">
          {data?.recentExpenses.length ? data.recentExpenses.map((expense) => (
            <div 
              key={expense.id} 
              className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between"
              data-testid={`recent-expense-${expense.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  {getCategoryIcon(expense.category)}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{expense.note || expense.category}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(expense.date), "MMM d")}</span>
                    <Badge variant={expense.paymentSource === "family" ? "outline" : "secondary"} className="gap-1 text-xs">
                      {expense.paymentSource === "family" ? (
                        <><Users className="w-2 h-2" /> {t("familyBadge")}</>
                      ) : (
                        <><Wallet className="w-2 h-2" /> {t("personal")}</>
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
              <span className="font-bold text-foreground">-{currencySymbol}{toFixedAmount(Number(expense.amount), groupCurrency)}</span>
            </div>
          )) : (
            <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
              {t("noSharedExpenses")}
            </div>
          )}
        </div>
        )}
      </section>


      <div className="flex items-start gap-2 px-4 py-3 bg-muted/40 rounded-xl border border-border/30" data-testid="notice-data-accuracy-group">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          These figures reflect what your group has logged so far. The more consistently members record expenses, the more accurate this picture becomes.
        </p>
      </div>

      {familyCode && <InviteSection familyCode={familyCode} groupName={data?.summary.familyName} />}

      {viewingMember && (
        <MemberDetailsDialog
          member={viewingMember}
          open={!!viewingMember}
          onOpenChange={(open) => !open && setViewingMember(null)}
          currencySymbol={currencySymbol}
          groupCurrency={groupCurrency}
          expenses={data?.memberExpenses?.[viewingMember.id] ?? []}
          periodLabel={periodLabel}
        />
      )}
    </div>
  );
}

function MemberDetailsDialog({ 
  member, 
  open, 
  onOpenChange, 
  currencySymbol,
  groupCurrency,
  expenses,
  periodLabel,
}: { 
  member: MemberSpending; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  currencySymbol: string;
  groupCurrency: string | undefined;
  expenses: { id: number; amount: string; category: string; note: string | null; date: string; paymentSource: string }[];
  periodLabel: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full max-h-[80vh] overflow-y-auto rounded-t-3xl md:rounded-2xl p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {member.name[0]?.toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-xl">{member.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{t("sharedSpending")} &middot; {periodLabel}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          {expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>{t("noSharedExpenses")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                      {getCategoryIcon(expense.category)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{expense.note || expense.category}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{format(new Date(expense.date), "MMM d")}</span>
                        <Badge variant={expense.paymentSource === "family" ? "outline" : "secondary"} className="text-[10px] px-1 py-0 h-4">
                          {expense.paymentSource === "family" ? t("familyBadge") : t("personal")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-sm">-{currencySymbol}{toFixedAmount(Number(expense.amount), groupCurrency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FamilyDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
