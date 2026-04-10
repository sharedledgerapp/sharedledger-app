import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, Wallet, Repeat,
  Utensils, Bus, Gamepad2, ShoppingBag,
  Lightbulb, GraduationCap, Heart, Package, Home as HomeIcon
} from "lucide-react";
import { format } from "date-fns";
import { getCurrencySymbol, toFixedAmount } from "@/lib/currency";
import { Link } from "wouter";
import { BalanceBoard } from "@/components/BalanceBoard";
import { useQuery } from "@tanstack/react-query";
import type { RecurringExpense } from "@shared/schema";

interface RecentExpense {
  id: number;
  amount: string;
  category: string;
  note: string | null;
  date: string;
  paymentSource: string;
  paidByName?: string;
}

interface RoommatesDashboardProps {
  summary: {
    memberCount: number;
    familyName: string;
  };
  recentExpenses: RecentExpense[];
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

export function RoommatesDashboardView({ summary, recentExpenses }: RoommatesDashboardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const currencySymbol = getCurrencySymbol(user?.currency);
  const displayExpenses = recentExpenses.slice(0, 5);
  const [expensesView, setExpensesView] = useState<"everyday" | "recurring">("everyday");

  const { data: sharedRecurring, isLoading: recurringLoading } = useQuery<RecurringExpense[]>({
    queryKey: ["/api/family/shared-recurring-expenses"],
    enabled: !!user?.familyId,
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-roommates-dashboard-title">
            {summary.familyName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="gap-1" data-testid="badge-group-type">
              <Users className="w-3 h-3" />
              {t("roommates")} • {summary.memberCount} {t("members")}
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

      <BalanceBoard />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t("recentSharedExpenses")}
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
                  data-testid={`roommate-expense-${expense.id}`}
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
                            <span>{t("paidBy")} {expense.paidByName || "?"}</span>
                            <span>•</span>
                            <span>{format(new Date(expense.date), "MMM d")}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-foreground" data-testid={`roommate-expense-amount-${expense.id}`}>
                        {currencySymbol}{toFixedAmount(Number(expense.amount), user?.currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
                {t("noSharedExpenses")}
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
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                          <Repeat className="w-4 h-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category} • {item.frequency}</p>
                        </div>
                      </div>
                      <span className="font-bold text-foreground">
                        {currencySymbol}{toFixedAmount(Number(item.amount), user?.currency)}/mo
                      </span>
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
