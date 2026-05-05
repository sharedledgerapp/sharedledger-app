import { useState } from "react";
import type { RecurringExpense } from "@shared/schema";
import { Banknote, Wallet, Repeat, ChevronDown, ChevronUp, Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toFixedAmount } from "@/lib/currency";

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "yearly": return amount / 12;
    case "quarterly": return amount / 3;
    default: return amount;
  }
}

interface IncomeSummaryCardProps {
  incomeTotal: number;
  spentTotal: number;
  recurringExpenses: RecurringExpense[];
  currencySymbol: string;
  currency?: string;
  periodLabel?: string;
  expenses?: any[];
}

export function IncomeSummaryCard({
  incomeTotal,
  spentTotal,
  recurringExpenses,
  currencySymbol,
  currency,
  periodLabel,
  expenses,
}: IncomeSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const now = new Date();
  const defaultLabel = now.toLocaleString("default", { month: "long" }) + " Overview";
  const label = periodLabel ?? defaultLabel;

  const remaining = incomeTotal - spentTotal;
  const activeRecurring = recurringExpenses.filter(r => r.isActive);
  const hasRecurring = activeRecurring.length > 0;

  const withPaidStatus = expenses !== undefined;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const currentMonthExpenses = expenses?.filter(e => {
    const d = new Date(e.date);
    return (e as any).paymentSource === "personal" && d >= monthStart && d <= monthEnd;
  }) ?? [];

  const recurringWithStatus = activeRecurring.map(r => ({
    ...r,
    isPaid: withPaidStatus
      ? currentMonthExpenses.some(e => e.category === r.category)
      : false,
    monthlyAmount: toMonthlyAmount(Number(r.amount), r.frequency),
  }));

  const committed = withPaidStatus
    ? recurringWithStatus.filter(r => !r.isPaid).reduce((sum, r) => sum + r.monthlyAmount, 0)
    : recurringWithStatus.reduce((sum, r) => sum + r.monthlyAmount, 0);

  const freeToSpend = remaining - committed;

  return (
    <div className="rounded-2xl border border-border/50 shadow-sm overflow-hidden bg-card" data-testid="card-income-summary">
      <div className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between" data-testid="summary-row-income">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Banknote className="w-4 h-4" />
              Income
            </span>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              +{currencySymbol}{toFixedAmount(incomeTotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="summary-row-spent">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              Spent
            </span>
            <span className="text-sm font-semibold text-foreground">
              -{currencySymbol}{toFixedAmount(spentTotal, currency)}
            </span>
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex items-center justify-between" data-testid="summary-row-remaining">
            <span className="text-sm font-semibold text-foreground">Remaining</span>
            <span className={`text-sm font-bold ${remaining >= 0 ? "text-foreground" : "text-destructive"}`}>
              {remaining < 0 ? "-" : ""}{currencySymbol}{toFixedAmount(Math.abs(remaining), currency)}
            </span>
          </div>
        </div>

        {hasRecurring && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
            data-testid="button-toggle-recurring-summary"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Repeat className="w-4 h-4" />
              Recurring this month
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground text-xs">
                {currencySymbol}{toFixedAmount(committed, currency)}{withPaidStatus ? " upcoming" : "/mo"}
              </span>
              {expanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
              }
            </div>
          </button>
        )}
      </div>

      {expanded && hasRecurring && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 bg-muted/20">
          <div className="space-y-2.5">
            {recurringWithStatus.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm" data-testid={`recurring-summary-item-${r.id}`}>
                <span className="flex items-center gap-2">
                  {withPaidStatus ? (
                    r.isPaid ? (
                      <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted border border-border/60 flex items-center justify-center shrink-0">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted border border-border/60 flex items-center justify-center shrink-0">
                      <Repeat className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className={withPaidStatus && r.isPaid ? "text-muted-foreground" : "text-foreground"}>
                    {r.name}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${withPaidStatus && r.isPaid ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                    {currencySymbol}{toFixedAmount(r.monthlyAmount, currency)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      withPaidStatus && r.isPaid
                        ? "text-green-600 border-green-300 dark:border-green-800"
                        : "text-muted-foreground"
                    }`}
                  >
                    {withPaidStatus
                      ? (r.isPaid ? "paid" : r.dueDay ? `due ${r.dueDay}${getDaySuffix(r.dueDay)}` : "due")
                      : (r.dueDay ? `due ${r.dueDay}${getDaySuffix(r.dueDay)}` : "monthly")
                    }
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {withPaidStatus ? (
            <div className="rounded-xl bg-card border border-border/50 p-3 space-y-1.5" data-testid="section-free-to-spend">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{currencySymbol}{toFixedAmount(remaining, currency)} remaining</span>
                <span>−</span>
                <span>{currencySymbol}{toFixedAmount(committed, currency)} committed</span>
                <span>=</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Free to spend</span>
                <span className={`text-base font-bold ${freeToSpend >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {freeToSpend < 0 ? "-" : ""}{currencySymbol}{toFixedAmount(Math.abs(freeToSpend), currency)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center">
              These recurring expenses may already be reflected in your spent total
            </p>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Figures reflect what you've logged in the app
          </p>
        </div>
      )}
    </div>
  );
}
