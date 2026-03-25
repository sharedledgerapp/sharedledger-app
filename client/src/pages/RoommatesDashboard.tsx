import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, Wallet,
  Utensils, Bus, Gamepad2, ShoppingBag,
  Lightbulb, GraduationCap, Heart, Package, Home as HomeIcon
} from "lucide-react";
import { format } from "date-fns";
import { getCurrencySymbol, toFixedAmount } from "@/lib/currency";
import { Link } from "wouter";
import { BalanceBoard } from "@/components/BalanceBoard";

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
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          {t("recentSharedExpenses")}
        </h3>
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
      </section>
    </div>
  );
}
