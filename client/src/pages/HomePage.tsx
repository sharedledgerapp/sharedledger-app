import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useExpenses, useGoals } from "@/hooks/use-data";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Wallet, TrendingUp, Star, ArrowUpRight, ArrowDownRight, ChevronRight, Flag, Target, Utensils, Bus, Gamepad2, ShoppingBag, Lightbulb, GraduationCap, Heart, Package, Repeat, CreditCard, Zap, Building, Shield, MoreVertical, Pencil, Trash2, Pause, Play } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { sortGoalsByPriority } from "@/lib/goals";
import { getCurrencySymbol, formatAmount } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import type { RecurringExpense } from "@shared/schema";

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"];

const RECURRING_CATEGORIES = ["Subscriptions", "Utilities", "Taxes", "Insurance", "Other"] as const;
const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;

type RecurringCategory = typeof RECURRING_CATEGORIES[number];

function getCategoryIcon(category: string) {
  const icons: Record<string, any> = {
    Subscriptions: CreditCard,
    Utilities: Zap,
    Taxes: Building,
    Insurance: Shield,
    Other: Package,
  };
  return icons[category] || Package;
}

function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    Subscriptions: "#818cf8",
    Utilities: "#fbbf24",
    Taxes: "#f472b6",
    Insurance: "#34d399",
    Other: "#60a5fa",
  };
  return colors[category] || "#94a3b8";
}

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: expenses, isLoading: expensesLoading } = useExpenses();
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const currencySymbol = getCurrencySymbol(user?.currency);

  const [view, setView] = useState<"everyday" | "recurring">("everyday");
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recurringForm, setRecurringForm] = useState({
    name: "",
    amount: "",
    category: "Subscriptions" as RecurringCategory,
    frequency: "monthly" as typeof FREQUENCIES[number],
    note: "",
  });

  const { data: recurringExpenses, isLoading: recurringLoading } = useQuery<RecurringExpense[]>({
    queryKey: ["/api/recurring-expenses"],
  });

  const { data: spendingSummary } = useQuery<{
    currentMonthTotal: string;
    prevMonthTotal: string;
    percentageChange: string;
    trend: "up" | "down";
  }>({
    queryKey: ["/api/spending/summary"],
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: typeof recurringForm) => {
      const res = await apiRequest("POST", "/api/recurring-expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringAdded") });
      resetForm();
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof recurringForm & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/recurring-expenses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringUpdated") });
      resetForm();
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringDeleted") });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/recurring-expenses/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
    },
  });

  function resetForm() {
    setShowRecurringDialog(false);
    setEditingRecurring(null);
    setRecurringForm({ name: "", amount: "", category: "Subscriptions", frequency: "monthly", note: "" });
  }

  function openEditDialog(expense: RecurringExpense) {
    setEditingRecurring(expense);
    setRecurringForm({
      name: expense.name,
      amount: String(expense.amount),
      category: expense.category as RecurringCategory,
      frequency: expense.frequency as typeof FREQUENCIES[number],
      note: expense.note || "",
    });
    setShowRecurringDialog(true);
  }

  function handleSubmitRecurring() {
    if (!recurringForm.name || !recurringForm.amount || Number(recurringForm.amount) <= 0) return;
    if (editingRecurring) {
      updateRecurringMutation.mutate({ ...recurringForm, id: editingRecurring.id });
    } else {
      createRecurringMutation.mutate(recurringForm);
    }
  }

  const frequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      monthly: t("perMonth"),
      quarterly: t("perQuarter"),
      yearly: t("perYear"),
    };
    return labels[freq] || "";
  };

  const categoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      Subscriptions: t("subscriptions"),
      Utilities: t("utilities"),
      Taxes: t("taxes"),
      Insurance: t("insurance"),
      Other: t("other"),
    };
    return labels[cat] || cat;
  };

  const frequencyFullLabel = (freq: string) => {
    const labels: Record<string, string> = {
      monthly: t("monthly"),
      quarterly: t("quarterly"),
      yearly: t("yearly"),
    };
    return labels[freq] || freq;
  };

  if (expensesLoading || goalsLoading) {
    return <DashboardSkeleton />;
  }

  const monthlyTotal = spendingSummary ? Number(spendingSummary.currentMonthTotal) : 0;
  const percentageChange = spendingSummary ? Math.abs(Number(spendingSummary.percentageChange)) : 0;
  const trend = spendingSummary?.trend || "up";
  const prevMonthTotal = spendingSummary ? Number(spendingSummary.prevMonthTotal) : 0;

  const categoryData = expenses?.reduce((acc, curr) => {
    const existing = acc.find(i => i.name === curr.category);
    if (existing) {
      existing.value += Number(curr.amount);
    } else {
      acc.push({ name: curr.category, value: Number(curr.amount) });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  const activeRecurring = recurringExpenses?.filter(e => e.isActive) || [];
  const groupedRecurring = RECURRING_CATEGORIES.reduce((acc, cat) => {
    const items = activeRecurring.filter(e => e.category === cat);
    if (items.length > 0) {
      acc.push({
        category: cat,
        items,
        total: items.reduce((sum, e) => sum + toMonthlyAmount(Number(e.amount), e.frequency), 0),
      });
    }
    return acc;
  }, [] as { category: string; items: RecurringExpense[]; total: number }[]);

  const totalRecurringMonthly = groupedRecurring.reduce((sum, g) => sum + g.total, 0);
  const inactiveRecurring = recurringExpenses?.filter(e => !e.isActive) || [];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {t("hi")}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">{t("financialSnapshot")}</p>
        </div>
        <Link href="/expenses">
          <Button size="icon" className="rounded-full h-12 w-12 shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90">
            <Plus className="w-6 h-6" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-2 bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl shadow-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-white/80 mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">{t("totalSpent")}</span>
            </div>
            <div className="text-4xl font-display font-bold" data-testid="text-monthly-total">
              {currencySymbol}{monthlyTotal.toFixed(2)}
            </div>
            <div className="mt-4 flex gap-3 text-xs font-medium text-white/90">
              {prevMonthTotal > 0 ? (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm" data-testid="badge-trend">
                  {trend === "up" ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {trend === "up" ? "+" : "-"}{percentageChange.toFixed(0)}% {t("thisMonth")}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  <Wallet className="w-3 h-3" />
                  {t("thisMonth")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                <Link href="/goals">
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
              <Link href="/goals">
                <Button variant="outline" size="sm" data-testid="button-create-first-goal">
                  <Plus className="w-4 h-4 mr-1" /> {t("setGoal")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <section>
        <Link href="/reports">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group" data-testid="link-reports">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t("spendingBreakdown")}
            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
          </h3>
        </Link>

        <Link href="/reports">
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
        <div className="flex gap-2 mb-4">
          <Button
            variant={view === "everyday" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("everyday")}
            data-testid="button-everyday-view"
            className="flex-1"
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            {t("everydayExpenses")}
          </Button>
          <Button
            variant={view === "recurring" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("recurring")}
            data-testid="button-recurring-view"
            className="flex-1"
          >
            <Repeat className="w-4 h-4 mr-1.5" />
            {t("recurringExpenses")}
          </Button>
        </div>

        {view === "everyday" ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-lg">{t("recentActivity")}</h3>
              <Link href="/expenses" className="text-sm text-primary font-medium hover:underline">{t("viewAll")}</Link>
            </div>

            <div className="space-y-3">
              {expenses?.slice(0, 5).map((expense) => (
                <div key={expense.id} className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      {getCategoryIconComponent(expense.category)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{expense.note || expense.category}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d")}</p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground">-{currencySymbol}{Number(expense.amount).toFixed(2)}</span>
                </div>
              ))}
              {!expenses?.length && (
                <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-xl">
                  {t("noTransactions")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-lg">{t("recurringExpenses")}</h3>
              <Button
                size="sm"
                onClick={() => { resetForm(); setShowRecurringDialog(true); }}
                data-testid="button-add-recurring"
              >
                <Plus className="w-4 h-4 mr-1" /> {t("addRecurring")}
              </Button>
            </div>

            {recurringLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : groupedRecurring.length > 0 ? (
              <>
                <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Repeat className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("totalRecurring")}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{t("perMonth")}</span>
                    </div>
                    <div className="text-3xl font-display font-bold mt-1" data-testid="text-total-recurring">
                      {currencySymbol}{totalRecurringMonthly.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                {groupedRecurring.map((group) => {
                  const CategoryIcon = getCategoryIcon(group.category);
                  return (
                    <div key={group.category} data-testid={`group-${group.category.toLowerCase()}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: getCategoryColor(group.category) + "20" }}
                          >
                            <CategoryIcon className="w-4 h-4" style={{ color: getCategoryColor(group.category) }} />
                          </div>
                          <span className="font-semibold text-sm">{categoryLabel(group.category)}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.items.length}
                          </Badge>
                        </div>
                        <span className="font-bold text-sm" data-testid={`text-group-total-${group.category.toLowerCase()}`}>
                          {currencySymbol}{group.total.toFixed(2)}{t("perMonth")}
                        </span>
                      </div>

                      <div className="space-y-2 ml-10">
                        {group.items.map((expense) => (
                          <div
                            key={expense.id}
                            className="bg-white dark:bg-card p-3 rounded-lg border border-border/50 shadow-sm flex items-center justify-between"
                            data-testid={`recurring-item-${expense.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{expense.name}</p>
                              {expense.note && (
                                <p className="text-xs text-muted-foreground truncate">{expense.note}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <div className="text-right">
                                <span className="font-bold text-sm">
                                  {currencySymbol}{Number(expense.amount).toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-0.5">
                                  {frequencyLabel(expense.frequency)}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditDialog(expense)}
                                  data-testid={`button-edit-recurring-${expense.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => toggleActiveMutation.mutate({ id: expense.id, isActive: false })}
                                  data-testid={`button-pause-recurring-${expense.id}`}
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => deleteRecurringMutation.mutate(expense.id)}
                                  data-testid={`button-delete-recurring-${expense.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {inactiveRecurring.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 mt-4">
                      <span className="text-sm font-medium text-muted-foreground">{t("pausedLabel")}</span>
                      <Badge variant="secondary" className="text-xs">{inactiveRecurring.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {inactiveRecurring.map((expense) => (
                        <div
                          key={expense.id}
                          className="bg-muted/30 p-3 rounded-lg border border-border/30 flex items-center justify-between opacity-60"
                          data-testid={`recurring-paused-${expense.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{expense.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {categoryLabel(expense.category)} - {currencySymbol}{Number(expense.amount).toFixed(2)}{frequencyLabel(expense.frequency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleActiveMutation.mutate({ id: expense.id, isActive: true })}
                              data-testid={`button-resume-recurring-${expense.id}`}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteRecurringMutation.mutate(expense.id)}
                              data-testid={`button-delete-paused-${expense.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <Repeat className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground mb-1">{t("noRecurringExpenses")}</p>
                  <p className="text-xs text-muted-foreground mb-4">{t("addFirstRecurring")}</p>
                  <Button
                    size="sm"
                    onClick={() => { resetForm(); setShowRecurringDialog(true); }}
                    data-testid="button-add-first-recurring"
                  >
                    <Plus className="w-4 h-4 mr-1" /> {t("addRecurring")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      <Dialog open={showRecurringDialog} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-recurring-dialog-title">
              {editingRecurring ? t("editRecurring") : t("addRecurring")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("recurringName")}</Label>
              <Input
                value={recurringForm.name}
                onChange={(e) => setRecurringForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Netflix, Electric bill..."
                data-testid="input-recurring-name"
              />
            </div>
            <div>
              <Label>{t("recurringAmount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={recurringForm.amount}
                onChange={(e) => setRecurringForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-recurring-amount"
              />
            </div>
            <div>
              <Label>{t("recurringCategory")}</Label>
              <Select
                value={recurringForm.category}
                onValueChange={(v) => setRecurringForm(f => ({ ...f, category: v as RecurringCategory }))}
              >
                <SelectTrigger data-testid="select-recurring-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} data-testid={`option-category-${cat.toLowerCase()}`}>
                      {categoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("recurringFrequency")}</Label>
              <Select
                value={recurringForm.frequency}
                onValueChange={(v) => setRecurringForm(f => ({ ...f, frequency: v as typeof FREQUENCIES[number] }))}
              >
                <SelectTrigger data-testid="select-recurring-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq} data-testid={`option-frequency-${freq}`}>
                      {frequencyFullLabel(freq)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("recurringNote")}</Label>
              <Input
                value={recurringForm.note}
                onChange={(e) => setRecurringForm(f => ({ ...f, note: e.target.value }))}
                placeholder=""
                data-testid="input-recurring-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-recurring">
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSubmitRecurring}
              disabled={!recurringForm.name || !recurringForm.amount || Number(recurringForm.amount) <= 0 || createRecurringMutation.isPending || updateRecurringMutation.isPending}
              data-testid="button-save-recurring"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "yearly": return amount / 12;
    case "quarterly": return amount / 3;
    default: return amount;
  }
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
