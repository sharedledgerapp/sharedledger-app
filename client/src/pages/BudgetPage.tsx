import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { checkBudgetThresholdNotifications } from "@/lib/notifications";
import { getCurrencySymbol, formatAmount } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Bell, BellOff, StickyNote,
  TrendingUp, Wallet, PiggyBank, ChevronDown, ChevronUp,
  Utensils, Bus, Gamepad2, ShoppingBag, Lightbulb, GraduationCap, Heart, Package, CreditCard,
  Users, UserCircle2
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Budget } from "@shared/schema";
import { DEFAULT_CATEGORIES } from "@/pages/SettingsPage";

type BudgetSummary = Budget & {
  spent: number;
  remaining: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
};

type SharedBudgetSummary = Budget & {
  spent: number;
  remaining: number;
  percentUsed: number;
  createdByName: string | null;
  updatedByName: string | null;
};

type SummaryResponse = {
  budgets: BudgetSummary[];
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  totalPercentUsed: number;
};

function getCategoryIcon(category: string) {
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
  return <Icon className="w-5 h-5" />;
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-destructive";
  if (percent >= 80) return "bg-orange-500";
  if (percent >= 60) return "bg-yellow-500";
  return "bg-primary";
}

export default function BudgetPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol(user?.currency);

  const userCategories = (user as any)?.categories as string[] | null;
  const categories = userCategories || DEFAULT_CATEGORIES;

  const [showDialog, setShowDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetSummary | SharedBudgetSummary | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSharedBudgetId, setExpandedSharedBudgetId] = useState<number | null>(null);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    periodType: "monthly" as "weekly" | "monthly",
    notificationsEnabled: false,
    thresholds: [] as string[],
    note: "",
    scope: "personal" as "personal" | "shared",
  });

  const { data: summary, isLoading } = useQuery<SummaryResponse>({
    queryKey: ["/api/budget-summary"],
  });

  const { data: sharedBudgetData, isLoading: sharedLoading } = useQuery<{ budgets: SharedBudgetSummary[] }>({
    queryKey: ["/api/family/shared-budgets"],
    enabled: !!(user as any)?.familyId,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCreate") === "true") {
      const isShared = params.get("shared") === "true";
      setForm(f => ({ ...f, scope: isShared ? "shared" : "personal" }));
      setShowDialog(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (summary?.budgets) {
      checkBudgetThresholdNotifications(
        summary.budgets.map(b => ({
          id: b.id,
          category: b.category,
          amount: b.amount,
          percentUsed: b.percentUsed,
          notificationsEnabled: b.notificationsEnabled,
          thresholds: b.thresholds,
          periodType: b.periodType,
          periodStart: b.periodStart,
        }))
      );
    }
  }, [summary]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/budgets", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family/shared-budgets"] });
      toast({ title: t("budgetAdded") });
      captureEvent("budget_created", { category: variables.category, limit_amount: Number(variables.amount), scope: variables.scope ?? "personal" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/budgets/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family/shared-budgets"] });
      toast({ title: t("budgetUpdated") });
      captureEvent("budget_edited", { category: variables.data.category });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family/shared-budgets"] });
      toast({ title: t("budgetDeleted") });
    },
  });

  function resetForm() {
    setShowDialog(false);
    setEditingBudget(null);
    setForm({
      category: "",
      amount: "",
      periodType: "monthly",
      notificationsEnabled: false,
      thresholds: [],
      note: "",
      scope: "personal",
    });
  }

  function openEditDialog(budget: BudgetSummary | SharedBudgetSummary) {
    setEditingBudget(budget);
    setForm({
      category: budget.category,
      amount: String(budget.amount),
      periodType: budget.periodType as "weekly" | "monthly",
      notificationsEnabled: budget.notificationsEnabled,
      thresholds: budget.thresholds || [],
      note: budget.note || "",
      scope: budget.budgetScope as "personal" | "shared",
    });
    setShowDialog(true);
  }

  function openAddGroupBudgetDialog(category?: string) {
    resetForm();
    setForm(f => ({ ...f, scope: "shared", ...(category ? { category } : {}) }));
    setShowDialog(true);
  }

  function openAddDialog(category?: string) {
    resetForm();
    if (category) {
      setForm(f => ({ ...f, category }));
    }
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.amount || Number(form.amount) <= 0 || !form.category) return;
    const payload = {
      category: form.category,
      amount: form.amount,
      periodType: form.periodType,
      notificationsEnabled: form.notificationsEnabled,
      thresholds: form.thresholds.length > 0 ? form.thresholds : null,
      note: form.note || null,
    };
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, scope: form.scope });
    }
  }

  function toggleThreshold(value: string) {
    const enabled = !form.thresholds.includes(value);
    setForm(f => ({
      ...f,
      thresholds: f.thresholds.includes(value)
        ? f.thresholds.filter(t => t !== value)
        : [...f.thresholds, value],
    }));
    captureEvent("budget_threshold_toggled", { threshold: value, enabled });
  }

  const budgetedCategories = summary?.budgets.map(b => b.category) || [];
  const groupBudgetedCategories = sharedBudgetData?.budgets.map(b => b.category) || [];
  const unbudgetedCategories = categories.filter(c => !budgetedCategories.includes(c));

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/app">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-display font-bold text-2xl">{t("budgetPlanning")}</h1>
      </div>

      <Card className="border-border/50 shadow-sm" data-testid="card-budget-overview" data-tutorial="budget-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t("budgetOverview")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && summary.budgets.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalBudget")}</p>
                  <p className="text-xl font-bold" data-testid="text-total-budget">
                    {formatAmount(summary.totalBudget, user?.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("spent")}</p>
                  <p className="text-xl font-bold" data-testid="text-total-spent">
                    {formatAmount(summary.totalSpent, user?.currency)}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">
                    {t("remaining")}: {formatAmount(summary.totalRemaining, user?.currency)}
                  </span>
                  <span className={summary.totalPercentUsed > 100 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                    {summary.totalPercentUsed}% {t("percentUsed")}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getProgressColor(summary.totalPercentUsed)}`}
                    style={{ width: `${Math.min(summary.totalPercentUsed, 100)}%` }}
                    data-testid="progress-total-budget"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <PiggyBank className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">{t("noBudgets")}</p>
              <Button onClick={() => openAddDialog()} variant="outline" size="sm" data-testid="button-setup-first-budget">
                <Plus className="w-4 h-4 mr-1" /> {t("setupFirstBudget")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {summary && summary.budgets.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-bold text-lg">{t("categoryBudgets")}</h2>
            <Button onClick={() => openAddDialog()} size="sm" variant="outline" data-testid="button-add-budget">
              <Plus className="w-4 h-4 mr-1" /> {t("addBudget")}
            </Button>
          </div>

          <div className="space-y-3">
            {summary.budgets.map((budget) => {
              const isExpanded = expandedCategory === budget.category;
              return (
                <Card key={budget.id} className="border-border/50 shadow-sm" data-testid={`card-budget-${budget.category.toLowerCase()}`}>
                  <CardContent className="p-4">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        setExpandedCategory(isExpanded ? null : budget.category);
                        if (!isExpanded) {
                          captureEvent("budget_category_expanded", { category: budget.category, was_over_budget: budget.percentUsed >= 100 });
                        }
                      }}
                      data-testid={`toggle-budget-${budget.category.toLowerCase()}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                        {getCategoryIcon(budget.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{budget.category}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={budget.percentUsed >= 100 ? "destructive" : "secondary"} className="text-xs">
                              {budget.percentUsed}%
                            </Badge>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1 gap-2">
                          <span>{formatAmount(budget.spent, user?.currency)} / {formatAmount(Number(budget.amount), user?.currency)}</span>
                          <span>{budget.periodType === "weekly" ? t("weekly") : t("monthly")}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(budget.percentUsed)}`}
                            style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">{t("spent")}</p>
                            <p className="font-semibold">{formatAmount(budget.spent, user?.currency)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">{t("remaining")}</p>
                            <p className={`font-semibold ${budget.remaining < 0 ? 'text-destructive' : ''}`}>
                              {formatAmount(budget.remaining, user?.currency)}
                            </p>
                          </div>
                        </div>

                        {budget.thresholds && budget.thresholds.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                            {budget.thresholds.map(th => (
                              <Badge key={th} variant="outline" className="text-xs">{th}%</Badge>
                            ))}
                          </div>
                        )}

                        {budget.note && (
                          <div className="flex items-start gap-2 text-sm">
                            <StickyNote className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-muted-foreground text-xs">{budget.note}</p>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(budget)}
                            data-testid={`button-edit-budget-${budget.category.toLowerCase()}`}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" /> {t("edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              deleteMutation.mutate(budget.id, {
                                onSuccess: () => captureEvent("budget_deleted", { category: budget.category }),
                              });
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-budget-${budget.category.toLowerCase()}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> {t("delete")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!!(user as any)?.familyId && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Group Budgets
            </h2>
            <Button onClick={() => openAddGroupBudgetDialog()} size="sm" variant="outline" data-testid="button-add-group-budget">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {sharedLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (sharedBudgetData?.budgets.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {sharedBudgetData!.budgets.map((budget) => {
                const isExpanded = expandedSharedBudgetId === budget.id;
                return (
                  <Card key={budget.id} className="border-border/50 shadow-sm" data-testid={`card-shared-budget-${budget.id}`}>
                    <CardContent className="p-4">
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setExpandedSharedBudgetId(isExpanded ? null : budget.id)}
                        data-testid={`toggle-shared-budget-${budget.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                          {getCategoryIcon(budget.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{budget.category}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={budget.percentUsed >= 100 ? "destructive" : "secondary"} className="text-xs">
                                {budget.percentUsed}%
                              </Badge>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1 gap-2">
                            <span>{formatAmount(budget.spent, user?.currency)} / {formatAmount(Number(budget.amount), user?.currency)}</span>
                            <span>{budget.periodType === "weekly" ? t("weekly") : t("monthly")}</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${getProgressColor(budget.percentUsed)}`}
                              style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">{t("spent")}</p>
                              <p className="font-semibold">{formatAmount(budget.spent, user?.currency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">{t("remaining")}</p>
                              <p className={`font-semibold ${budget.remaining < 0 ? 'text-destructive' : ''}`}>
                                {formatAmount(budget.remaining, user?.currency)}
                              </p>
                            </div>
                          </div>

                          {(budget.createdByName || budget.updatedByName) && (
                            <div className="space-y-1 text-xs text-muted-foreground border-t border-border/30 pt-2">
                              {budget.createdByName && (
                                <div className="flex items-center gap-1.5">
                                  <UserCircle2 className="w-3 h-3" />
                                  <span>Created by {budget.createdByName}</span>
                                  {budget.createdAt && <span>· {format(new Date(budget.createdAt), "MMM d, yyyy")}</span>}
                                </div>
                              )}
                              {budget.updatedByName && budget.updatedByName !== budget.createdByName && (
                                <div className="flex items-center gap-1.5">
                                  <Pencil className="w-3 h-3" />
                                  <span>Last edited by {budget.updatedByName}</span>
                                  {budget.updatedAt && <span>· {format(new Date(budget.updatedAt), "MMM d, yyyy")}</span>}
                                </div>
                              )}
                            </div>
                          )}

                          {budget.note && (
                            <div className="flex items-start gap-2 text-sm">
                              <StickyNote className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-muted-foreground text-xs">{budget.note}</p>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(budget)}
                              data-testid={`button-edit-shared-budget-${budget.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" /> {t("edit")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("Delete this group budget?")) {
                                  deleteMutation.mutate(budget.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-shared-budget-${budget.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> {t("delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
              <PiggyBank className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">No group budgets yet</p>
              <Button onClick={() => openAddGroupBudgetDialog()} variant="outline" size="sm" data-testid="button-add-first-group-budget">
                <Plus className="w-4 h-4 mr-1" /> Add group budget
              </Button>
            </div>
          )}
        </section>
      )}

      {unbudgetedCategories.length > 0 && summary && summary.budgets.length > 0 && (
        <section>
          <h3 className="font-display font-semibold text-sm text-muted-foreground mb-3">{t("noBudgetSet")}</h3>
          <div className="space-y-2">
            {unbudgetedCategories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    {getCategoryIcon(cat)}
                  </div>
                  <span className="text-sm">{cat}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openAddDialog(cat)}
                  data-testid={`button-add-budget-${cat.toLowerCase()}`}
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("addBudgetForCategory")}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBudget ? t("editBudget") : t("addBudget")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingBudget && form.scope === "shared" && "createdByName" in editingBudget && (editingBudget.createdByName || editingBudget.updatedByName) && (
              <div className="text-xs text-muted-foreground space-y-0.5 px-1">
                {editingBudget.createdByName && (
                  <p data-testid="text-budget-created-by">
                    Created by <span className="font-medium text-foreground">{editingBudget.createdByName}</span>
                    {editingBudget.createdAt && <> · {format(new Date(editingBudget.createdAt), "MMM d, yyyy")}</>}
                  </p>
                )}
                {editingBudget.updatedByName && editingBudget.updatedByName !== editingBudget.createdByName && (
                  <p data-testid="text-budget-updated-by">
                    Last edited by <span className="font-medium text-foreground">{editingBudget.updatedByName}</span>
                    {editingBudget.updatedAt && <> · {format(new Date(editingBudget.updatedAt), "MMM d, yyyy")}</>}
                  </p>
                )}
              </div>
            )}

            {!editingBudget && (
              <div>
                <Label>{t("categories")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm(f => ({ ...f, category: v }))}
                >
                  <SelectTrigger data-testid="select-budget-category">
                    <SelectValue placeholder={t("categories")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => form.scope === "shared" ? !groupBudgetedCategories.includes(c) : !budgetedCategories.includes(c)).map(cat => (
                      <SelectItem key={cat} value={cat} data-testid={`option-budget-category-${cat.toLowerCase()}`}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>{t("budgetAmount")}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="pl-8"
                  placeholder="0.00"
                  data-testid="input-budget-amount"
                />
              </div>
            </div>

            <div>
              <Label>{t("periodType")}</Label>
              <Select
                value={form.periodType}
                onValueChange={(v) => setForm(f => ({ ...f, periodType: v as "weekly" | "monthly" }))}
              >
                <SelectTrigger data-testid="select-budget-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scope === "shared" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">This budget is shared with your group</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  {form.notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  {t("thresholds")}
                </Label>
                <Switch
                  checked={form.notificationsEnabled}
                  onCheckedChange={(v) => setForm(f => ({ ...f, notificationsEnabled: v }))}
                  data-testid="switch-budget-notifications"
                />
              </div>

              {form.notificationsEnabled && (
                <div className="flex flex-wrap gap-2">
                  {["50", "60", "80", "100"].map(th => (
                    <Badge
                      key={th}
                      variant={form.thresholds.includes(th) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleThreshold(th)}
                      data-testid={`badge-threshold-${th}`}
                    >
                      {th}%
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>{t("budgetNote")}</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t("budgetNotePlaceholder")}
                className="resize-none"
                rows={2}
                data-testid="textarea-budget-note"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-budget">
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.amount || Number(form.amount) <= 0 || !form.category || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-budget"
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
