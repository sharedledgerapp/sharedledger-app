import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Plus, Wallet,
  Utensils, Bus, Gamepad2, ShoppingBag,
  Lightbulb, GraduationCap, Package, Home as HomeIcon,
  CheckCircle2, Clock, Trophy, ChevronLeft, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { getCurrencySymbol, toFixedAmount } from "@/lib/currency";
import { Link } from "wouter";

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
}: CouplesDashboardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const currencySymbol = getCurrencySymbol(user?.currency);
  const displayExpenses = recentExpenses.slice(0, 5);
  const totalSpent = Number(summary.totalSpent);

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
        <Link href="/expenses">
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

      <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-white/80 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Household spending · {periodLabel}</span>
          </div>
          <div className="text-4xl font-display font-bold" data-testid="text-couple-total-spent">
            {currencySymbol}{summary.totalSpent}
          </div>
          <div className="mt-2 text-xs text-white/70">
            {summary.expenseCount} shared {summary.expenseCount === 1 ? "expense" : "expenses"}
          </div>
        </CardContent>
      </Card>

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
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Recent Shared Expenses
        </h3>
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
      </section>
    </div>
  );
}
