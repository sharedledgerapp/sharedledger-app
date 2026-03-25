import { useAuth } from "@/hooks/use-auth";
import { useExpenses } from "@/hooks/use-data";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, TrendingUp, Calendar, PieChart } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format } from "date-fns";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb7185"];

export default function SpendingReflectionsPage() {
  const { user } = useAuth();
  const { data: expenses, isLoading } = useExpenses();
  const { t, language } = useLanguage();

  if (isLoading) {
    return <ReflectionsSkeleton />;
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeklyExpenses = expenses?.filter(e => 
    isWithinInterval(new Date(e.date), { start: weekStart, end: weekEnd })
  ) || [];

  const monthlyExpenses = expenses?.filter(e => 
    isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd })
  ) || [];

  const weeklyTotal = weeklyExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const monthlyTotal = monthlyExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  const getTopCategory = (expenseList: typeof expenses) => {
    if (!expenseList?.length) return null;
    const categoryTotals = expenseList.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  };

  const getCategoryBreakdown = (expenseList: typeof expenses) => {
    if (!expenseList?.length) return [];
    const categoryTotals = expenseList.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const weeklyTopCategory = getTopCategory(weeklyExpenses);
  const monthlyTopCategory = getTopCategory(monthlyExpenses);
  const weeklyCategoryData = getCategoryBreakdown(weeklyExpenses);
  const monthlyCategoryData = getCategoryBreakdown(monthlyExpenses);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/app">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-display font-bold">{t("spendingReflections")}</h1>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly" data-testid="tab-weekly">
            {t("weeklyReflections")}
          </TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">
            {t("monthlyReflections")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4 mt-4">
          <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{t("spentThisWeek")}</span>
              </div>
              <div className="text-4xl font-display font-bold" data-testid="text-weekly-total">
                ${weeklyTotal.toFixed(2)}
              </div>
              <div className="mt-2 text-sm text-white/70">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
              </div>
            </CardContent>
          </Card>

          {weeklyTopCategory && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("topCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{weeklyTopCategory.name}</span>
                  <span className="text-lg font-bold text-primary">${weeklyTopCategory.amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                {t("spendingBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              {weeklyCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={weeklyCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {weeklyCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("noData")}
                </div>
              )}
            </CardContent>
          </Card>

          {weeklyCategoryData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {t("categoryDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {weeklyCategoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold">${cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          <Card className="bg-gradient-to-br from-accent to-accent/80 border-none text-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{t("spentThisMonth")}</span>
              </div>
              <div className="text-4xl font-display font-bold" data-testid="text-monthly-total">
                ${monthlyTotal.toFixed(2)}
              </div>
              <div className="mt-2 text-sm text-white/70">
                {format(monthStart, "MMMM yyyy")}
              </div>
            </CardContent>
          </Card>

          {monthlyTopCategory && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("topCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{monthlyTopCategory.name}</span>
                  <span className="text-lg font-bold text-primary">${monthlyTopCategory.amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                {t("spendingBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              {monthlyCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={monthlyCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {monthlyCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("noData")}
                </div>
              )}
            </CardContent>
          </Card>

          {monthlyCategoryData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {t("categoryDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthlyCategoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold">${cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReflectionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
