import { useAuth } from "@/hooks/use-auth";
import { useExpenses, useGoals, useFamily } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Wallet, TrendingUp, Star, ArrowUpRight, ArrowDownLeft, ChevronRight, Flag, Target } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { sortGoalsByPriority } from "@/lib/goals";
import { Badge } from "@/components/ui/badge";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];

export default function HomePage() {
  const { user } = useAuth();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  
  if (expensesLoading || goalsLoading) {
    return <DashboardSkeleton />;
  }

  // Calculate totals
  const totalSpent = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
  
  // Prepare chart data
  const categoryData = expenses?.reduce((acc, curr) => {
    const existing = acc.find(i => i.name === curr.category);
    if (existing) {
      existing.value += Number(curr.amount);
    } else {
      acc.push({ name: curr.category, value: Number(curr.amount) });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Hi, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here's your financial snapshot.</p>
        </div>
        <Link href="/expenses">
          <Button size="icon" className="rounded-full h-12 w-12 shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90">
            <Plus className="w-6 h-6" />
          </Button>
        </Link>
      </div>

      {/* Main Stats Card */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-2 bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-white/80 mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Total Spent</span>
            </div>
            <div className="text-4xl font-display font-bold">
              ${totalSpent.toFixed(2)}
            </div>
            <div className="mt-4 flex gap-3 text-xs font-medium text-white/90">
              <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                <ArrowUpRight className="w-3 h-3" /> +12% this month
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals Progress Mini Card */}
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
                    <Star className="w-4 h-4 text-accent" /> Top Goal
                  </span>
                  {topGoal.priority === "high" && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                      <Flag className="w-2.5 h-2.5 mr-0.5" /> Priority
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="text-lg font-bold truncate">{topGoal.title}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>${Number(topGoal.currentAmount).toLocaleString()} / ${Number(topGoal.targetAmount).toLocaleString()}</span>
                  <span className="font-medium text-primary">{progress.toFixed(0)}%</span>
                </div>
                {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
                  <div className="text-xs text-muted-foreground">
                    {daysUntilDeadline === 0 ? "Due today!" : `${daysUntilDeadline} days left`}
                  </div>
                )}
                <Link href="/goals">
                  <Button variant="outline" size="sm" className="w-full mt-2" data-testid="button-view-all-goals">
                    View All Goals <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })()}

        {/* No Goals State */}
        {goals?.length === 0 && (
          <Card className="col-span-2 md:col-span-1 border-border/50 shadow-sm border-dashed">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">No savings goals yet</p>
              <Link href="/goals">
                <Button variant="outline" size="sm" data-testid="button-create-first-goal">
                  <Plus className="w-4 h-4 mr-1" /> Set a Goal
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Spending Breakdown */}
      <section>
        <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Spending Breakdown
        </h3>
        
        <Card className="border-border/50 shadow-sm">
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
                No spending data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold text-lg">Recent Activity</h3>
          <Link href="/expenses" className="text-sm text-primary font-medium hover:underline">View All</Link>
        </div>
        
        <div className="space-y-3">
          {expenses?.slice(0, 5).map((expense) => (
            <div key={expense.id} className="bg-white p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xl">
                  {getCategoryEmoji(expense.category)}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{expense.note || expense.category}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d")}</p>
                </div>
              </div>
              <span className="font-bold text-foreground">-${Number(expense.amount).toFixed(2)}</span>
            </div>
          ))}
          {!expenses?.length && (
            <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
              No transactions found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getCategoryEmoji(category: string) {
  const map: Record<string, string> = {
    Food: "🍔",
    Transport: "🚌",
    Entertainment: "🎮",
    Shopping: "🛍️",
    Utilities: "💡",
    Education: "📚",
    Health: "🏥",
    Other: "📦"
  };
  return map[category] || "💸";
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
