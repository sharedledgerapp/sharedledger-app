import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RecurringExpense } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Plus, Wallet, Banknote, Repeat,
  Utensils, Bus, Gamepad2, ShoppingBag,
  Lightbulb, GraduationCap, Package, Home as HomeIcon,
  CheckCircle2, Clock, Trophy, ChevronLeft, ChevronRight, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { getCurrencySymbol, toFixedAmount } from "@/lib/currency";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍔", Transport: "🚌", Entertainment: "🎮", Shopping: "🛍️",
  Utilities: "💡", Education: "📚", Health: "🏥", Other: "📦",
};
function getCategoryEmoji(cat: string) { return CATEGORY_EMOJI[cat] ?? "📦"; }

interface CategoryBreakdown {
  category: string;
  amount: string;
  count: number;
  percentage: string;
}

interface Contribution {
  id: number;
  name: string;
  total: string;
}

interface Milestone {
  key: string;
  label: string;
  achieved: boolean;
}

interface RecentExpense {
  id: number;
  amount: string;
  category: string;
  note: string | null;
  date: string;
  paymentSource: string;
  paidByName?: string;
}

interface CouplesDashboardProps {
  summary: {
    totalSpent: string;
    expenseCount: number;
    memberCount: number;
    familyName: string;
  };
  categoryBreakdown: CategoryBreakdown[];
  contributions?: {
    partners: Contribution[];
    difference: string;
  };
  milestones?: Milestone[];
  recentExpenses: RecentExpense[];
  periodType: "month" | "week";
  setPeriodType: (type: "month" | "week") => void;
  navigatePeriod: (direction: "prev" | "next") => void;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb923c", "#4ade80"];

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

export function CouplesDashboardView({
  summary,
  categoryBreakdown,
  contributions,
  milestones,
  recentExpenses,
  periodType,
  setPeriodType,
  navigatePeriod,
  periodLabel,
  periodStart,
  periodEnd,
}: CouplesDashboardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expensesView, setExpensesView] = useState<"everyday" | "recurring">("everyday");
  const currencySymbol = getCurrencySymbol(user?.currency);
  const displayExpenses = recentExpenses.slice(0, 5);
  const totalSpent = Number(summary.totalSpent);

  const { data: sharedRecurring, isLoading: recurringLoading } = useQuery<RecurringExpense[]>({
    queryKey: ["/api/family/shared-recurring-expenses"],
    enabled: !!user?.familyId,
  });

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

  const incomeStartStr = periodStart.toISOString();
  const incomeEndStr = periodEnd.toISOString();
  const { data: familyIncomeEntries } = useQuery<FamilyIncomeEntry[]>({
    queryKey: ["/api/family/income", incomeStartStr, incomeEndStr],
    queryFn: () => fetch(`/api/family/income?startDate=${encodeURIComponent(incomeStartStr)}&endDate=${encodeURIComponent(incomeEndStr)}`).then(r => r.json()),
    enabled: !!user?.familyId,
    staleTime: 10_000,
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-couple-dashboard-title">
            {summary.familyName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="gap-1" data-testid="badge-couple-type">
              <Heart className="w-3 h-3" />
              {t("couple")}
            </Badge>
          </div>
        </div>
        <Link href="/app/expenses">
          <Button size="sm" className="gap-1.5" data-testid="button-add-expense">
            <Plus className="w-4 h-4" />
            + {t("expense")}
          </Button>
        </Link>
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
            className="h-8 w-8"
            onClick={() => navigatePeriod("prev")}
            data-testid="button-prev-period"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm min-w-[140px] text-center" data-testid="text-period-label">{periodLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigatePeriod("next")}
            data-testid="button-next-period"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {(() => {
        const today = new Date().toDateString();
        const todayGroupTotal = recentExpenses
          .filter(e => new Date(e.date).toDateString() === today)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        const groupRecurringTotal = (sharedRecurring || [])
          .reduce((sum, r) => sum + Number(r.amount), 0);
        const groupIncomeTotal = (familyIncomeEntries || [])
          .reduce((sum, e) => sum + Number(e.amount), 0);
        const hasGroupIncome = groupIncomeTotal > 0;
        const netGroupTotal = groupIncomeTotal - totalSpent;
        const totalStr = hasGroupIncome
          ? `${netGroupTotal >= 0 ? "+" : "-"}${currencySymbol}${toFixedAmount(Math.abs(netGroupTotal), user?.currency)}`
          : `${currencySymbol}${toFixedAmount(totalSpent, user?.currency)}`;
        const sizeClass = totalStr.length > 14 ? "text-2xl" : totalStr.length > 11 ? "text-3xl" : totalStr.length > 8 ? "text-4xl" : "text-4xl";
        return (
          <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start gap-2 mb-1">
                <div className="flex items-center gap-2 text-white/80">
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-medium">Household spending · {periodLabel}</span>
                </div>
                {todayGroupTotal > 0 && (
                  <div className="text-right bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm" data-testid="badge-couple-today-total">
                    <div className="text-[10px] uppercase tracking-wider text-white/70">{t("today")}</div>
                    <div className="text-base font-bold">{currencySymbol}{toFixedAmount(todayGroupTotal, user?.currency)}</div>
                  </div>
                )}
              </div>
              <div className={`${sizeClass} font-display font-bold leading-tight ${hasGroupIncome && netGroupTotal < 0 ? "text-red-200" : ""}`} data-testid="text-couple-total-spent">
                {totalStr}
                {hasGroupIncome && <span className="text-sm font-normal text-white/70 ml-2">net</span>}
              </div>
              <div className="mt-3 space-y-1.5 text-[11px] text-white/80">
                {hasGroupIncome ? (
                  <>
                    <div className="flex items-center justify-between" data-testid="badge-couple-income-total">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3 h-3 shrink-0" />
                        Money In
                      </span>
                      <span className="font-semibold text-green-300">+{currencySymbol}{toFixedAmount(groupIncomeTotal, user?.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between" data-testid="badge-couple-spending-total">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 shrink-0" />
                        Money Out
                      </span>
                      <span className="font-semibold text-white">-{currencySymbol}{toFixedAmount(totalSpent, user?.currency)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {totalSpent > 0 && groupRecurringTotal > 0 && (
                      <div className="flex items-center justify-between" data-testid="badge-couple-everyday-total">
                        <span className="flex items-center gap-1">
                          <Wallet className="w-3 h-3 shrink-0" />
                          Everyday
                        </span>
                        <span className="font-semibold text-white">{currencySymbol}{toFixedAmount(Math.max(0, totalSpent - groupRecurringTotal), user?.currency)}</span>
                      </div>
                    )}
                    {groupRecurringTotal > 0 && (
                      <div className="flex items-center justify-between" data-testid="badge-couple-recurring-total">
                        <span className="flex items-center gap-1">
                          <Repeat className="w-3 h-3 shrink-0" />
                          Recurring
                        </span>
                        <span className="font-semibold text-white">{currencySymbol}{toFixedAmount(groupRecurringTotal, user?.currency)}/mo</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {categoryBreakdown.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-display font-bold text-sm mb-4">Shared Spending Breakdown</h3>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {(() => {
                    let cumulative = 0;
                    return categoryBreakdown.map((cat, i) => {
                      const pct = Number(cat.percentage);
                      const dashArray = `${pct} ${100 - pct}`;
                      const dashOffset = -cumulative;
                      cumulative += pct;
                      return (
                        <circle
                          key={cat.category}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth="18"
                          strokeDasharray={dashArray}
                          strokeDashoffset={dashOffset}
                          pathLength="100"
                          data-testid={`pie-segment-${cat.category}`}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold font-display">{currencySymbol}{summary.totalSpent}</span>
                  <span className="text-[10px] text-muted-foreground">total</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map((cat, i) => (
                <div key={cat.category} className="flex items-center justify-between text-sm" data-testid={`category-row-${cat.category}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span>{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{cat.percentage}%</span>
                    <span className="font-medium">{currencySymbol}{cat.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {contributions && contributions.partners.length === 2 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              Household Contributions
            </h3>
            <div className="space-y-3">
              {contributions.partners.map((partner) => {
                const partnerTotal = Number(partner.total);
                const allTimeTotal = contributions.partners.reduce((s, p) => s + Number(p.total), 0);
                const pct = allTimeTotal > 0 ? (partnerTotal / allTimeTotal) * 100 : 50;
                return (
                  <div key={partner.id} data-testid={`contribution-row-${partner.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {partner.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{partner.name}</span>
                      </div>
                      <span className="font-bold text-sm" data-testid={`contribution-amount-${partner.id}`}>
                        {currencySymbol}{partner.total}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary/60 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 text-center">
              <span className="text-sm text-muted-foreground">
                Difference: <span className="font-semibold text-foreground">{currencySymbol}{contributions.difference}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {familyIncomeEntries && familyIncomeEntries.length > 0 && (
        <Card className="border-border/50 shadow-sm" data-testid="section-couple-income">
          <CardContent className="p-5">
            <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" />
              Household Income
            </h3>
            <div className="space-y-3">
              {familyIncomeEntries.map((entry) => {
                const isOwner = entry.userId === user?.id;
                const isHidden = entry.source === null;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-1 border-b last:border-0" data-testid={`couple-income-entry-${entry.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-xs">
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
                      <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                        +{currencySymbol}{toFixedAmount(Number(entry.amount), user?.currency)}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => deleteSharedIncomeMutation.mutate(entry.id)}
                          disabled={deleteSharedIncomeMutation.isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-delete-couple-income-${entry.id}`}
                          aria-label="Delete income"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 flex items-center justify-between text-sm font-semibold border-t border-border/50">
                <span className="text-muted-foreground">Combined</span>
                <span className="text-green-600 dark:text-green-400">
                  +{currencySymbol}{toFixedAmount(familyIncomeEntries.reduce((s, e) => s + Number(e.amount), 0), user?.currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {milestones && milestones.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-display font-bold text-sm mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Shared Milestones
            </h3>
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div
                  key={milestone.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    milestone.achieved
                      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                      : "border-border/50 bg-muted/20"
                  }`}
                  data-testid={`milestone-${milestone.key}`}
                >
                  {milestone.achieved ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${milestone.achieved ? "font-medium" : "text-muted-foreground"}`}>
                    {milestone.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Recent Shared Expenses
          </h3>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={`px-3 py-1 text-xs font-medium transition-colors ${expensesView === "everyday" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              onClick={() => setExpensesView("everyday")}
              data-testid="button-expenses-tab-everyday"
            >Everyday</button>
            <button
              className={`px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${expensesView === "recurring" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              onClick={() => setExpensesView("recurring")}
              data-testid="button-expenses-tab-recurring"
            ><Repeat className="w-3 h-3" />Recurring</button>
          </div>
        </div>
        {expensesView === "everyday" ? (
          <div className="space-y-3">
            {displayExpenses.length > 0 ? (
              displayExpenses.map((expense) => (
                <Card
                  key={expense.id}
                  className="border-border/50 shadow-sm"
                  data-testid={`couple-expense-${expense.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          {getCategoryIcon(expense.category)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {expense.note || expense.category}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{expense.paidByName || "?"}</span>
                            <span>·</span>
                            <span>{format(new Date(expense.date), "MMM d")}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-foreground" data-testid={`couple-expense-amount-${expense.id}`}>
                        {currencySymbol}{toFixedAmount(Number(expense.amount), user?.currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
                No shared expenses yet. Add your first household expense to get started!
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {recurringLoading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted animate-pulse rounded-xl" />
                <div className="h-16 bg-muted animate-pulse rounded-xl" />
              </div>
            ) : (sharedRecurring?.length ?? 0) > 0 ? (
              sharedRecurring!.map((item) => (
                <Card key={item.id} className="border-border/50 shadow-sm" data-testid={`shared-recurring-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-lg">
                          {getCategoryEmoji(item.category)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{currencySymbol}{toFixedAmount(Number(item.amount), user?.currency)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.frequency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
                No shared recurring expenses yet. Share a recurring expense from your Expenses page.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
