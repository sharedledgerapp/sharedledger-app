import { useState } from "react";
import { useExpenses } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChevronLeft, ChevronRight, Calendar, TrendingDown, ArrowLeft, Users, Wallet, BarChart3, Utensils, Bus, Gamepad2, ShoppingBag, Lightbulb, GraduationCap, Heart, Package } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, addMonths, subWeeks, addWeeks, isWithinInterval } from "date-fns";
import { getCurrencySymbol, formatAmount } from "@/lib/currency";
import { cn } from "@/lib/utils";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb7185", "#4ade80"];

type ViewMode = "overview" | "category";

export default function ReportsPage() {
  const { data: expenses, isLoading } = useExpenses();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodType, setPeriodType] = useState<"month" | "week">("month");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const currencySymbol = getCurrencySymbol(user?.currency);

  const activityView = periodType === "month" ? "monthly" : "weekly";
  const activityYear = currentDate.getFullYear();
  const activityMonth = currentDate.getMonth() + 1;
  const activityDate = currentDate.toISOString().split("T")[0];

  const { data: activityData } = useQuery<{
    view: string;
    periodLabel: string;
    data: { label: string; total: number; date?: string; weekStart?: string; weekEnd?: string }[];
  }>({
    queryKey: ["/api/spending/activity", activityView, activityYear, activityMonth, activityDate],
    queryFn: async () => {
      const params = new URLSearchParams({ view: activityView });
      if (periodType === "week") {
        params.set("date", activityDate);
      } else {
        params.set("year", String(activityYear));
        params.set("month", String(activityMonth));
      }
      const res = await fetch(`/api/spending/activity?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const getPeriodRange = () => {
    if (periodType === "month") {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    } else {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
  };

  const { start, end } = getPeriodRange();

  const personalExpenses = expenses?.filter(e => e.paymentSource === "personal") || [];

  const filteredExpenses = personalExpenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    return isWithinInterval(expenseDate, { start, end });
  });

  const categoryExpenses = selectedCategory 
    ? filteredExpenses.filter(e => e.category === selectedCategory)
    : filteredExpenses;

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  const categoryData = filteredExpenses.reduce((acc, curr) => {
    const existing = acc.find(i => i.name === curr.category);
    if (existing) {
      existing.value += Number(curr.amount);
      existing.count += 1;
    } else {
      acc.push({ name: curr.category, value: Number(curr.amount), count: 1 });
    }
    return acc;
  }, [] as { name: string; value: number; count: number }[]).sort((a, b) => b.value - a.value);

  const navigatePeriod = (direction: "prev" | "next") => {
    if (periodType === "month") {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const formatPeriodLabel = () => {
    if (periodType === "month") {
      return format(currentDate, "MMMM yyyy");
    } else {
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setViewMode("category");
  };

  const handleBackToOverview = () => {
    setSelectedCategory(null);
    setViewMode("overview");
  };

  const getCategoryIcon = (category: string) => {
    const map: Record<string, React.ReactNode> = {
      Food: <Utensils className="w-5 h-5" />,
      Transport: <Bus className="w-5 h-5" />,
      Entertainment: <Gamepad2 className="w-5 h-5" />,
      Shopping: <ShoppingBag className="w-5 h-5" />,
      Utilities: <Lightbulb className="w-5 h-5" />,
      Education: <GraduationCap className="w-5 h-5" />,
      Health: <Heart className="w-5 h-5" />,
      Other: <Package className="w-5 h-5" />
    };
    return map[category] || <Package className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="h-8 bg-muted animate-pulse rounded-xl w-1/3" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {viewMode === "overview" ? (
        <>
          <div className="flex justify-between items-center">
            <h1 className="font-display font-bold text-3xl">{t("reports")}</h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant={periodType === "month" ? "default" : "outline"}
              onClick={() => setPeriodType("month")}
              className="flex-1"
              data-testid="button-period-month"
            >
              {t("monthlyReport")}
            </Button>
            <Button
              variant={periodType === "week" ? "default" : "outline"}
              onClick={() => setPeriodType("week")}
              className="flex-1"
              data-testid="button-period-week"
            >
              {t("weeklyReport")}
            </Button>
          </div>

          <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod("prev")}
              data-testid="button-prev-period"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold" data-testid="text-period-label">{formatPeriodLabel()}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod("next")}
              data-testid="button-next-period"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">{t("totalSpent")}</span>
              </div>
              <div className="text-4xl font-display font-bold" data-testid="text-total-spent">
                {currencySymbol}{totalSpent.toFixed(2)}
              </div>
              <div className="mt-2 text-sm text-white/80">
                {filteredExpenses.length} {filteredExpenses.length === 1 ? t("expense") : t("expensesPlural")}
              </div>
            </CardContent>
          </Card>

          {filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">{t("noExpensesInPeriod")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("spendingBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${currencySymbol}${value.toFixed(2)}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-2 mt-4">
                  {categoryData.map((cat, index) => (
                    <button
                      key={cat.name}
                      onClick={() => handleCategoryClick(cat.name)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                      data-testid={`button-category-${cat.name.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-primary">{getCategoryIcon(cat.name)}</span>
                        <span className="font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {cat.count}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {currencySymbol}{cat.value.toFixed(2)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {t("spendingActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityData?.data && activityData.data.length > 0 ? (
                <div className="h-52" data-testid="chart-spending-activity">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData.data} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                        tickFormatter={(v) => `${currencySymbol}${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--card))',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        formatter={(value: number) => [`${currencySymbol}${formatAmount(value)}`, t("spent")]}
                        labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="total"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                  {t("noData")}
                </div>
              )}

              {activityData?.periodLabel && (
                <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-activity-period">
                  {activityData.periodLabel}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToOverview}
              data-testid="button-back-to-reports"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-2xl">
                {t("expensesInCategory")} {selectedCategory}
              </h1>
              <p className="text-sm text-muted-foreground">{formatPeriodLabel()}</p>
            </div>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-primary">{getCategoryIcon(selectedCategory || "Other")}</span>
                  <span className="font-semibold">{selectedCategory}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {currencySymbol}{categoryExpenses.reduce((acc, e) => acc + Number(e.amount), 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {categoryExpenses.length} {categoryExpenses.length === 1 ? t("expense") : t("expensesPlural")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {categoryExpenses.map((expense) => (
              <Card key={expense.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{expense.note || expense.category}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(new Date(expense.date), "MMM d, h:mm a")}</span>
                        {(expense as any).paymentSource === "family" && (
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            {t("familyBadge")}
                          </Badge>
                        )}
                        {(expense as any).paymentSource === "personal" && (
                          <Badge variant="secondary" className="gap-1">
                            <Wallet className="w-3 h-3" />
                            {t("personal")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-lg">
                      -{currencySymbol}{Number(expense.amount).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {categoryExpenses.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">{t("noExpensesInPeriod")}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
