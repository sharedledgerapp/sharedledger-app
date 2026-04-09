import { useState, useEffect, useRef, useMemo } from "react";
import { useCategoryEmoji as useAICategoryEmoji, useCategoryIconName, getLucideIcon } from "@/hooks/use-category-icon";
import { useExpenses, useCreateExpense, useUpdateExpense, useUpload, useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, Image as ImageIcon, Loader2, Pencil, Users, ScanLine, Check, X, DollarSign, Trash2, Wallet, Repeat, Pause, Play, Settings, Search, Globe, ChevronDown, ChevronRight, Archive, TrendingUp, Banknote, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Keypad } from "@/components/Keypad";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDeleteExpense } from "@/hooks/use-data";
import { getCurrencySymbol, CURRENCIES, toFixedAmount } from "@/lib/currency";
import { DEFAULT_CATEGORIES, DEFAULT_RECURRING_CATEGORIES } from "@/pages/SettingsPage";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { RecurringExpense, IncomeEntry } from "@shared/schema";

const INCOME_SOURCES = ["Family / Parents", "Work", "Gift or Unexpected", "Scholarship or Grant", "Other"] as const;
type IncomeSource = typeof INCOME_SOURCES[number];

const sourceEmoji: Record<IncomeSource, string> = {
  "Family / Parents": "👨‍👩‍👧",
  "Work": "💼",
  "Gift or Unexpected": "🎁",
  "Scholarship or Grant": "🎓",
  "Other": "💰",
};

const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;


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

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "yearly": return amount / 12;
    case "quarterly": return amount / 3;
    default: return amount;
  }
}

function CategoryEmojiDisplay({ category }: { category: string }) {
  const emoji = useAICategoryEmoji(category);
  return <>{emoji}</>;
}

function RecurringCategoryIconDisplay({
  category,
  className,
  style,
}: {
  category: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const iconName = useCategoryIconName(category);
  const Icon = getLucideIcon(iconName);
  return <Icon className={className} style={style} />;
}

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const deleteMutation = useDeleteExpense();
  const [, navigate] = useLocation();
  
  const currencySymbol = getCurrencySymbol(user?.currency);
  const { data: familyData } = useFamily();

  const userRecurringCategories = (user as any)?.recurringCategories as string[] | null;
  const RECURRING_CATEGORIES = userRecurringCategories || DEFAULT_RECURRING_CATEGORIES;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const initialTab = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "in" ? "in" : "out";
  const [moneyTab, setMoneyTab] = useState<"out" | "in">(initialTab);
  const [view, setView] = useState<"everyday" | "recurring">("everyday");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCreate") === "true") {
      const tab = params.get("tab");
      if (tab === "in") {
        setMoneyTab("in");
        setShowIncomeDialog(true);
      } else {
        setMoneyTab("out");
        setIsCreateOpen(true);
      }
      params.delete("openCreate");
      params.delete("tab");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  // Income state
  const { data: incomeEntries, isLoading: incomeLoading } = useQuery<IncomeEntry[]>({
    queryKey: ["/api/income"],
  });

  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  // shareDetails: null = not shared; false = total only; true = full details
  const [incomeForm, setIncomeForm] = useState<{
    amount: string;
    source: IncomeSource;
    note: string;
    date: string;
    isRecurring: boolean;
    recurringInterval: "weekly" | "monthly" | "tri-monthly";
    shareDetails: boolean | null;
  }>({
    amount: "",
    source: "Work",
    note: "",
    date: new Date().toISOString().split("T")[0],
    isRecurring: false,
    recurringInterval: "monthly",
    shareDetails: null,
  });

  const isGroupMember = !!(familyData?.family && familyData.family.groupType !== "roommates");

  function resetIncomeForm() {
    setShowIncomeDialog(false);
    setEditingIncome(null);
    setIncomeForm({
      amount: "",
      source: "Work",
      note: "",
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
      recurringInterval: "monthly",
      shareDetails: null,
    });
  }

  function openEditIncomeDialog(entry: IncomeEntry) {
    setEditingIncome(entry);
    setIncomeForm({
      amount: String(entry.amount),
      source: entry.source as IncomeSource,
      note: entry.note || "",
      date: new Date(entry.date).toISOString().split("T")[0],
      isRecurring: entry.isRecurring,
      recurringInterval: (entry.recurringInterval as "weekly" | "monthly" | "tri-monthly") || "monthly",
      shareDetails: entry.shareDetails,
    });
    setShowIncomeDialog(true);
  }

  const createIncomeMutation = useMutation({
    mutationFn: async (data: typeof incomeForm) => {
      const res = await apiRequest("POST", "/api/income", {
        amount: data.amount,
        source: data.source,
        note: data.note || null,
        date: data.date,
        isRecurring: data.isRecurring,
        recurringInterval: data.isRecurring ? data.recurringInterval : null,
        shareDetails: data.shareDetails,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/income"] });
      qc.invalidateQueries({ queryKey: ["/api/spending/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/family/income"] });
      if (variables.shareDetails !== null) {
        captureEvent("income_shared", { shareDetails: variables.shareDetails, source: variables.source, isRecurring: variables.isRecurring });
      }
      toast({ title: "Income added" });
      resetIncomeForm();
    },
    onError: () => toast({ title: "Failed to add income", variant: "destructive" }),
  });

  const updateIncomeMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof incomeForm & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/income/${id}`, {
        amount: data.amount,
        source: data.source,
        note: data.note || null,
        date: data.date,
        isRecurring: data.isRecurring,
        recurringInterval: data.isRecurring ? data.recurringInterval : null,
        shareDetails: data.shareDetails,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/income"] });
      qc.invalidateQueries({ queryKey: ["/api/spending/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/family/income"] });
      toast({ title: "Income updated" });
      resetIncomeForm();
    },
    onError: () => toast({ title: "Failed to update income", variant: "destructive" }),
  });

  const deleteIncomeMutation = useMutation({
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

  function handleSubmitIncome() {
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) return;
    if (editingIncome) {
      updateIncomeMutation.mutate({ ...incomeForm, id: editingIncome.id });
    } else {
      createIncomeMutation.mutate(incomeForm);
    }
  }
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recurringForm, setRecurringForm] = useState({
    name: "",
    amount: "",
    category: RECURRING_CATEGORIES[0] || "Subscriptions",
    frequency: "monthly" as typeof FREQUENCIES[number],
    note: "",
  });

  const { data: recurringExpenses, isLoading: recurringLoading } = useQuery<RecurringExpense[]>({
    queryKey: ["/api/recurring-expenses"],
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: typeof recurringForm) => {
      const res = await apiRequest("POST", "/api/recurring-expenses", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringAdded") });
      captureEvent("recurring_expense_created", { category: variables.category, frequency: variables.frequency });
      resetRecurringForm();
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: async ({ id, ...data }: typeof recurringForm & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/recurring-expenses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringUpdated") });
      captureEvent("recurring_expense_edited");
      resetRecurringForm();
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-expenses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      toast({ title: t("recurringDeleted") });
      captureEvent("recurring_expense_deleted");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/recurring-expenses/${id}`, { isActive });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      captureEvent("recurring_expense_toggled", { is_active: variables.isActive });
    },
  });

  function resetRecurringForm() {
    setShowRecurringDialog(false);
    setEditingRecurring(null);
    setRecurringForm({ name: "", amount: "", category: RECURRING_CATEGORIES[0] || "Subscriptions", frequency: "monthly", note: "" });
  }

  function openEditRecurringDialog(expense: RecurringExpense) {
    setEditingRecurring(expense);
    setRecurringForm({
      name: expense.name,
      amount: String(expense.amount),
      category: expense.category,
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
    const builtInLabels: Record<string, string> = {
      Subscriptions: t("subscriptions"),
      Utilities: t("utilities"),
      Taxes: t("taxes"),
      Insurance: t("insurance"),
      Other: t("other"),
    };
    return builtInLabels[cat] || cat;
  };

  const frequencyFullLabel = (freq: string) => {
    const labels: Record<string, string> = {
      monthly: t("monthly"),
      quarterly: t("quarterly"),
      yearly: t("yearly"),
    };
    return labels[freq] || freq;
  };

  const activeRecurring = recurringExpenses?.filter(e => e.isActive) || [];
  const allGroupNames = [...new Set([...RECURRING_CATEGORIES, ...activeRecurring.map(e => e.category)])];
  const groupedRecurring = allGroupNames.reduce((acc, cat) => {
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

  const filteredExpenses = useMemo(() => {
    if (!expenses || !searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter((expense) => {
      const note = (expense.note || "").toLowerCase();
      const category = (expense.category || "").toLowerCase();
      const amount = String(Number(expense.amount).toFixed(2));
      return note.includes(q) || category.includes(q) || amount.includes(q);
    });
  }, [expenses, searchQuery]);

  const [expandedArchivedGroups, setExpandedArchivedGroups] = useState<Set<number>>(new Set());

  const { data: friendGroups } = useQuery<Array<{
    id: number;
    name: string;
    currency: string;
    archived: boolean;
  }>>({
    queryKey: ["/api/friend-groups"],
  });

  const friendGroupMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string; currency: string; archived: boolean }>();
    (friendGroups || []).forEach(g => map.set(g.id, g));
    return map;
  }, [friendGroups]);

  const { regularExpenses, archivedGroupedExpenses, deletedGroupExpenses } = useMemo(() => {
    const regular: NonNullable<typeof filteredExpenses> = [];
    const archivedMap = new Map<number, {
      group: { id: number; name: string; currency: string; archived: boolean };
      expenses: NonNullable<typeof filteredExpenses>;
    }>();
    const deleted: NonNullable<typeof filteredExpenses> = [];

    const establishedFamilyId: number | null | undefined = user?.familyId;

    (filteredExpenses || []).forEach(e => {
      const expFamilyId = (e as any).familyId as number | null | undefined;
      if (expFamilyId != null) {
        // If this expense belongs to the user's established family group, treat it as regular
        if (establishedFamilyId && expFamilyId === establishedFamilyId) {
          regular.push(e);
          return;
        }
        const group = friendGroupMap.get(expFamilyId);
        if (group) {
          if (group.archived) {
            if (!archivedMap.has(group.id)) {
              archivedMap.set(group.id, { group, expenses: [] });
            }
            archivedMap.get(group.id)!.expenses.push(e);
            return;
          }
          // Active friend group expense — shown normally in regularExpenses
        } else {
          // familyId not found in friendGroupMap and not established family — group was deleted or user left it
          deleted.push(e);
          return;
        }
      }
      regular.push(e);
    });

    return {
      regularExpenses: regular,
      archivedGroupedExpenses: [...archivedMap.values()],
      deletedGroupExpenses: deleted,
    };
  }, [filteredExpenses, friendGroupMap, user?.familyId]);

  // Fetch currencies for orphaned/deleted group expenses so they display correctly
  const orphanedFamilyIds = useMemo(() => {
    return [...new Set(deletedGroupExpenses.map(e => (e as any).familyId as number).filter(Boolean))];
  }, [deletedGroupExpenses]);

  const { data: orphanedGroupCurrencies } = useQuery<Record<number, { currency: string; groupType: string }>>({
    queryKey: ["/api/friend-groups/currencies", orphanedFamilyIds.join(",")],
    queryFn: async () => {
      if (orphanedFamilyIds.length === 0) return {};
      const res = await fetch(`/api/friend-groups/currencies?ids=${orphanedFamilyIds.join(",")}`, { credentials: "include" });
      return res.json();
    },
    enabled: orphanedFamilyIds.length > 0,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center gap-2">
        {searchOpen && moneyTab === "out" && view === "everyday" ? (
          <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-right-4 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchExpenses") || "Search expenses..."}
                className="pl-9 pr-9 rounded-full"
                data-testid="input-search-expenses"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              data-testid="button-close-search"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display font-bold text-3xl">Money</h1>
            <div className="flex items-center gap-2">
              {moneyTab === "out" && view === "everyday" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                  data-testid="button-open-search"
                >
                  <Search className="w-5 h-5" />
                </Button>
              )}
              {moneyTab === "out" && view === "everyday" && (
                <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-lg shadow-primary/25" data-testid="button-add-expense">
                  <Plus className="w-5 h-5 mr-2" /> Add New
                </Button>
              )}
              {moneyTab === "out" && view === "recurring" && (
                <Button
                  onClick={() => { resetRecurringForm(); setShowRecurringDialog(true); }}
                  className="rounded-full shadow-lg shadow-primary/25"
                  data-testid="button-add-recurring"
                >
                  <Plus className="w-5 h-5 mr-2" /> {t("addRecurring")}
                </Button>
              )}
              {moneyTab === "in" && (
                <Button
                  onClick={() => { resetIncomeForm(); setShowIncomeDialog(true); }}
                  className="rounded-full shadow-lg shadow-primary/25"
                  data-testid="button-add-income"
                >
                  <Plus className="w-5 h-5 mr-2" /> Add Income
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top-level Money In / Money Out toggle */}
      <div className="flex gap-2">
        <Button
          variant={moneyTab === "out" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMoneyTab("out"); captureEvent("money_tab_switched", { tab: "out" }); }}
          data-testid="button-money-out-tab"
          className="flex-1"
        >
          <Wallet className="w-4 h-4 mr-1.5" />
          Money Out
        </Button>
        <Button
          variant={moneyTab === "in" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMoneyTab("in"); captureEvent("money_tab_switched", { tab: "in" }); }}
          data-testid="button-money-in-tab"
          className="flex-1"
        >
          <TrendingUp className="w-4 h-4 mr-1.5" />
          Money In
        </Button>
      </div>

      {moneyTab === "in" ? (
        <>
          <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/40 rounded-xl border border-border/30" data-testid="notice-data-accuracy-money">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your net position is only as accurate as what you log. Regular entries give you the clearest picture of where you stand.
            </p>
          </div>
          <MoneyInSection
            incomeEntries={incomeEntries || []}
            incomeLoading={incomeLoading}
            currencySymbol={currencySymbol}
            user={user}
            onEdit={openEditIncomeDialog}
            onDelete={(id) => {
              if (confirm("Delete this income entry?")) {
                deleteIncomeMutation.mutate(id);
              }
            }}
            onAdd={() => { resetIncomeForm(); setShowIncomeDialog(true); }}
          />
        </>
      ) : (
        <>
      {/* Money Out: Everyday / Recurring sub-tabs */}
      <div className="flex gap-2">
        <Button
          variant={view === "everyday" ? "default" : "outline"}
          size="sm"
          onClick={() => { setView("everyday"); captureEvent("expenses_tab_switched", { tab: "everyday" }); }}
          data-testid="button-everyday-view"
          className="flex-1"
        >
          <Wallet className="w-4 h-4 mr-1.5" />
          {t("everydayExpenses")}
        </Button>
        <Button
          variant={view === "recurring" ? "default" : "outline"}
          size="sm"
          onClick={() => { setView("recurring"); captureEvent("expenses_tab_switched", { tab: "recurring" }); }}
          data-testid="button-recurring-view"
          data-tutorial="recurring-tab"
          className="flex-1"
        >
          <Repeat className="w-4 h-4 mr-1.5" />
          {t("recurringExpenses")}
        </Button>
      </div>

      {view === "everyday" ? (
        <>
          <p className="text-sm font-medium text-muted-foreground" data-testid="text-privacy-note">
            Only expenses you choose to share with your group will appear in the group dashboard.
          </p>

          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3" data-tutorial="expenses-list">
              {searchQuery && filteredExpenses?.length === 0 && (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-muted" data-testid="text-no-search-results">
                  <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-results-message">{t("noSearchResults")} "{searchQuery}"</p>
                </div>
              )}
              {regularExpenses?.map((expense) => {
                const expFamilyId = (expense as any).familyId as number | null | undefined;
                const friendGroup = expFamilyId != null ? friendGroupMap.get(expFamilyId) : undefined;
                const establishedFamilyCurrencyCode = (expFamilyId != null && expFamilyId === user?.familyId)
                  ? (familyData?.family?.currency || user?.currency)
                  : user?.currency;
                const expCurrencyCode = friendGroup ? friendGroup.currency : establishedFamilyCurrencyCode;
                const expCurrencySymbol = getCurrencySymbol(expCurrencyCode);
                const expCurrency = expCurrencyCode;
                return (
                  <div
                    key={expense.id}
                    className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => {
                        if (friendGroup) {
                          navigate(`/app/groups/${friendGroup.id}`);
                        } else {
                          setEditingExpense(expense);
                        }
                      }}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                        <CategoryEmojiDisplay category={expense.category} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{expense.note || expense.category}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{format(new Date(expense.date), "MMM d, h:mm a")}</span>
                          {friendGroup ? (
                            <Badge variant="outline" className="gap-1 border-muted-foreground/30">
                              <Users className="w-3 h-3" />
                              {friendGroup.name}
                            </Badge>
                          ) : (expense as any).paymentSource === "family" ? (
                            <Badge variant="outline" className="gap-1">
                              <Users className="w-3 h-3" />
                              {t("familyBadge")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Wallet className="w-3 h-3" />
                              {t("personal")}
                            </Badge>
                          )}
                          {expense.visibility === "public" && !friendGroup && (
                            <Badge variant="outline" className="gap-1 border-primary text-primary">
                              {t("shared")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="block font-bold text-lg">-{expCurrencySymbol}{toFixedAmount(Number(expense.amount), expCurrency)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingExpense(expense);
                        }}
                        data-testid={`button-edit-expense-${expense.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this expense?")) {
                            deleteMutation.mutate(expense.id, {
                              onSuccess: () => captureEvent("expense_deleted"),
                            });
                          }
                        }}
                        data-testid={`button-delete-expense-${expense.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Archived friend group expense rollup */}
              {archivedGroupedExpenses.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closed Groups</span>
                  </div>
                  <div className="space-y-2">
                    {archivedGroupedExpenses.map(({ group, expenses: groupExpenses }) => {
                      const isExpanded = expandedArchivedGroups.has(group.id);
                      const groupSymbol = getCurrencySymbol(group.currency);
                      const groupTotal = groupExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
                      return (
                        <div key={group.id} className="rounded-xl border border-border/50 overflow-hidden" data-testid={`archived-group-${group.id}`}>
                          <button
                            className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                            onClick={() => setExpandedArchivedGroups(prev => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(group.id) : next.add(group.id);
                              return next;
                            })}
                            data-testid={`button-toggle-archived-group-${group.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{group.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">{groupExpenses.length}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-muted-foreground">{groupSymbol}{toFixedAmount(groupTotal, group.currency)}</span>
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="divide-y divide-border/30">
                              {groupExpenses.map(expense => (
                                <div key={expense.id} className="flex items-center justify-between px-3 py-2.5 bg-background" data-testid={`archived-expense-${expense.id}`}>
                                  <div>
                                    <p className="text-sm font-medium">{expense.note || expense.category}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d, yyyy")}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-semibold">{groupSymbol}{toFixedAmount(Number(expense.amount), group.currency)}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                                      onClick={() => setEditingExpense(expense)}
                                      data-testid={`button-edit-archived-expense-${expense.id}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        if (confirm("Delete this expense from the archived group?")) {
                                          deleteMutation.mutate(expense.id, {
                                            onSuccess: () => captureEvent("expense_deleted"),
                                          });
                                        }
                                      }}
                                      data-testid={`button-delete-archived-expense-${expense.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Deleted group expenses — only show confirmed friend/quick groups */}
              {(() => {
                const confirmedDeletedExpenses = orphanedGroupCurrencies
                  ? deletedGroupExpenses.filter(e => {
                      const expFamilyId = (e as any).familyId as number | undefined;
                      const info = expFamilyId ? orphanedGroupCurrencies[expFamilyId] : undefined;
                      return info?.groupType === "friends";
                    })
                  : [];
                return confirmedDeletedExpenses.length > 0 ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deleted Groups</span>
                  </div>
                  <div className="space-y-2">
                    {confirmedDeletedExpenses.map(expense => {
                      const expFamilyId = (expense as any).familyId as number | undefined;
                      const orphanInfo = expFamilyId ? orphanedGroupCurrencies?.[expFamilyId] : undefined;
                      const expCurrency = orphanInfo?.currency || user?.currency;
                      return (
                        <div key={expense.id} className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between" data-testid={`deleted-group-expense-${expense.id}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-xl">
                              <CategoryEmojiDisplay category={expense.category} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{expense.note || expense.category}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>{format(new Date(expense.date), "MMM d, yyyy")}</span>
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                  <Archive className="w-2.5 h-2.5" />
                                  Deleted group
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <span className="font-bold text-sm">-{getCurrencySymbol(expCurrency)}{toFixedAmount(Number(expense.amount), expCurrency)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingExpense(expense)}
                              data-testid={`button-edit-deleted-expense-${expense.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this expense?")) {
                                  deleteMutation.mutate(expense.id, {
                                    onSuccess: () => captureEvent("expense_deleted"),
                                  });
                                }
                              }}
                              data-testid={`button-delete-deleted-expense-${expense.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                ) : null;
              })()}

              {!searchQuery && filteredExpenses?.length === 0 && (
                <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                  <p className="text-muted-foreground">{t("noTransactions")}</p>
                  <Button variant="ghost" onClick={() => setIsCreateOpen(true)}>Add your first expense</Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
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
                    {currencySymbol}{toFixedAmount(totalRecurringMonthly, user?.currency)}
                  </div>
                </CardContent>
              </Card>

              {groupedRecurring.map((group) => {
                return (
                  <div key={group.category} data-testid={`group-${group.category.toLowerCase()}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: getCategoryColor(group.category) + "20" }}
                        >
                          <RecurringCategoryIconDisplay category={group.category} className="w-4 h-4" style={{ color: getCategoryColor(group.category) }} />
                        </div>
                        <span className="font-semibold text-sm">{categoryLabel(group.category)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {group.items.length}
                        </Badge>
                      </div>
                      <span className="font-bold text-sm" data-testid={`text-group-total-${group.category.toLowerCase()}`}>
                        {currencySymbol}{toFixedAmount(group.total, user?.currency)}{t("perMonth")}
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
                                {currencySymbol}{toFixedAmount(Number(expense.amount), user?.currency)}
                              </span>
                              <span className="text-xs text-muted-foreground ml-0.5">
                                {frequencyLabel(expense.frequency)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditRecurringDialog(expense)}
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
                            {categoryLabel(expense.category)} - {currencySymbol}{toFixedAmount(Number(expense.amount), user?.currency)}{frequencyLabel(expense.frequency)}
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
                  onClick={() => { resetRecurringForm(); setShowRecurringDialog(true); }}
                  data-testid="button-add-first-recurring"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("addRecurring")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
        </>
      )}

      {/* Income Entry Dialog */}
      <Dialog open={showIncomeDialog} onOpenChange={(open) => { if (!open) resetIncomeForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-income-dialog-title">
              {editingIncome ? "Edit Income" : "Add Income"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-income-amount"
              />
            </div>
            <div>
              <Label>Source</Label>
              <Select
                value={incomeForm.source}
                onValueChange={(v) => setIncomeForm(f => ({ ...f, source: v as IncomeSource }))}
              >
                <SelectTrigger data-testid="select-income-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_SOURCES.map((src) => (
                    <SelectItem key={src} value={src} data-testid={`option-source-${src.toLowerCase().replace(/\s+/g, "-")}`}>
                      {sourceEmoji[src]} {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm(f => ({ ...f, date: e.target.value }))}
                data-testid="input-income-date"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Note (optional)</Label>
              <Input
                value={incomeForm.note}
                onChange={(e) => setIncomeForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Add a note..."
                data-testid="input-income-note"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Recurring</Label>
              <Switch
                checked={incomeForm.isRecurring}
                onCheckedChange={(v) => setIncomeForm(f => ({ ...f, isRecurring: v }))}
                data-testid="switch-income-recurring"
              />
            </div>
            {incomeForm.isRecurring && (
              <div>
                <Label>Interval</Label>
                <Select
                  value={incomeForm.recurringInterval}
                  onValueChange={(v) => setIncomeForm(f => ({ ...f, recurringInterval: v as "weekly" | "monthly" | "tri-monthly" }))}
                >
                  <SelectTrigger data-testid="select-income-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="tri-monthly">Every 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isGroupMember && (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {familyData?.family?.groupType === "couple" ? "Share with partner" : "Share with household"}
                    </p>
                    <p className="text-xs text-muted-foreground">Visible on your group dashboard</p>
                  </div>
                  <Switch
                    checked={incomeForm.shareDetails !== null}
                    onCheckedChange={(v) => setIncomeForm(f => ({ ...f, shareDetails: v ? true : null }))}
                    data-testid="switch-income-share"
                  />
                </div>
                {incomeForm.shareDetails !== null && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Privacy level</p>
                    <button
                      type="button"
                      onClick={() => setIncomeForm(f => ({ ...f, shareDetails: true }))}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${incomeForm.shareDetails === true ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:bg-muted/50"}`}
                      data-testid="button-privacy-full"
                    >
                      <span className="text-base">📋</span>
                      <div className="text-left">
                        <p className="font-medium">Full details</p>
                        <p className="text-xs text-muted-foreground">Amount, source, and note visible</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeForm(f => ({ ...f, shareDetails: false }))}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${incomeForm.shareDetails === false ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:bg-muted/50"}`}
                      data-testid="button-privacy-total-only"
                    >
                      <span className="text-base">🔒</span>
                      <div className="text-left">
                        <p className="font-medium">Total only</p>
                        <p className="text-xs text-muted-foreground">Only your amount is visible</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={resetIncomeForm} data-testid="button-cancel-income">Cancel</Button>
            <Button
              onClick={handleSubmitIncome}
              disabled={!incomeForm.amount || Number(incomeForm.amount) <= 0 || createIncomeMutation.isPending || updateIncomeMutation.isPending}
              data-testid="button-save-income"
            >
              {(createIncomeMutation.isPending || updateIncomeMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingIncome ? "Update" : "Add Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecurringDialog} onOpenChange={(open) => { if (!open) resetRecurringForm(); }}>
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
                onValueChange={(v) => setRecurringForm(f => ({ ...f, category: v }))}
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
              <Link href="/app/settings" className="text-xs text-muted-foreground hover:underline mt-1 inline-block" data-testid="link-customize-recurring-groups">
                {t("customizeRecurringCategoriesHint")}
              </Link>
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
            <Button variant="outline" onClick={resetRecurringForm} data-testid="button-cancel-recurring">
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

      <CreateExpenseDialog 
        open={isCreateOpen || !!editingExpense} 
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingExpense(null);
        }} 
        editingExpense={editingExpense}
        isFirstExpense={!expenses || expenses.length === 0}
      />
    </div>
  );
}

interface ExtractedReceiptData {
  amount: number | null;
  category: string | null;
  note: string | null;
  date: string | null;
  items: Array<{ name: string; price: number }> | null;
}

function CreateExpenseDialog({ 
  open, 
  onOpenChange, 
  editingExpense,
  isFirstExpense = false
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  editingExpense?: any;
  isFirstExpense?: boolean;
}) {
  const [amount, setAmount] = useState("0");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [paymentSource, setPaymentSource] = useState<"personal" | "family">("personal");
  const [splitType, setSplitType] = useState<"none" | "equal" | "exact" | "percentage">("none");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [showReceiptConfirm, setShowReceiptConfirm] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [showCurrencyPrompt, setShowCurrencyPrompt] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  
  const { user } = useAuth();
  const { data: familyData } = useFamily();
  const { t } = useLanguage();
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const uploadMutation = useUpload();
  
  const CATEGORIES = (user as any)?.categories || DEFAULT_CATEGORIES;
  
  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency }),
      });
      if (!res.ok) throw new Error('Failed to update currency');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  useEffect(() => {
    if (open && isFirstExpense && !editingExpense && !(user as any)?.currency) {
      setShowCurrencyPrompt(true);
    }
  }, [open, isFirstExpense, editingExpense, user]);

  const scanReceiptMutation = useMutation({
    mutationFn: async (receiptFile: File) => {
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      const res = await fetch('/api/receipts/scan', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to scan receipt');
      return res.json();
    },
    onSuccess: (data) => {
      setExtractedData(data.extracted);
      setReceiptPreviewUrl(data.imageUrl);
      setShowReceiptConfirm(true);
      captureEvent("receipt_scan_succeeded", {
        has_amount: !!data.extracted?.amount,
        has_category: !!data.extracted?.category,
        has_date: !!data.extracted?.date,
        has_merchant: !!data.extracted?.note,
      });
    },
    onError: () => {
      captureEvent("receipt_scan_failed");
    },
  });

  const resizeReceiptImage = (file: File, maxPx = 1024): Promise<File> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      captureEvent("receipt_scan_started");
      const resized = await resizeReceiptImage(uploadedFile);
      scanReceiptMutation.mutate(resized);
      setFile(uploadedFile);
    }
  };

  const handleConfirmExtractedData = () => {
    if (extractedData) {
      if (extractedData.amount) {
        setAmount(extractedData.amount.toString());
      }
      if (extractedData.category && CATEGORIES.includes(extractedData.category)) {
        setCategory(extractedData.category);
      }
      if (extractedData.note) {
        setNote(extractedData.note);
      }
    }
    captureEvent("receipt_data_confirmed");
    setShowReceiptConfirm(false);
  };

  const handleCancelExtractedData = () => {
    captureEvent("receipt_data_cancelled");
    setShowReceiptConfirm(false);
    setExtractedData(null);
    setReceiptPreviewUrl(null);
  };

  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setCategory(editingExpense.category);
      setNote(editingExpense.note || "");
      setIsPublic(editingExpense.visibility === "public");
      setPaymentSource(editingExpense.paymentSource || "personal");
      setSplitType(editingExpense.splitType || "none");
      setSelectedMembers([]);
      setCustomSplits({});
    } else {
      setAmount("0");
      setCategory(CATEGORIES[0]);
      setNote("");
      setIsPublic(false);
      setPaymentSource("personal");
      setSplitType("none");
      setSelectedMembers([]);
      setCustomSplits({});
    }
  }, [editingExpense, open]);

  const handleSubmit = async () => {
    if (amount === "0") return;

    let receiptUrl = editingExpense?.receiptUrl;
    if (file) {
      try {
        const uploadRes = await uploadMutation.mutateAsync(file);
        receiptUrl = uploadRes.url;
      } catch (e) {
        console.error("[Expense] Upload failed", e);
      }
    }

    let splits: { userId: number; amount: string }[] | undefined;
    if (paymentSource === "family" && splitType !== "none" && selectedMembers.length > 0) {
      const total = Number(amount);
      if (splitType === "equal") {
        const share = (total / selectedMembers.length).toFixed(2);
        splits = selectedMembers.map(uid => ({ userId: uid, amount: share }));
      } else if (splitType === "exact") {
        splits = selectedMembers.map(uid => ({ userId: uid, amount: customSplits[uid] || "0" }));
      } else if (splitType === "percentage") {
        splits = selectedMembers.map(uid => ({
          userId: uid,
          amount: ((total * Number(customSplits[uid] || 0)) / 100).toFixed(2),
        }));
      }
    }

    const effectivePaymentSource = user.familyId ? paymentSource : "personal";
    const effectiveIsPublic = user.familyId ? (isPublic || paymentSource === "family") : false;
    const effectiveVisibility = effectiveIsPublic ? "public" : "private";

    const expenseData: any = {
      userId: user.id,
      amount,
      category,
      note,
      visibility: effectiveVisibility as "public" | "private",
      paymentSource: effectivePaymentSource,
      splitType: effectivePaymentSource === "family" ? splitType : "none",
      paidByUserId: user.id,
      receiptUrl,
      date: editingExpense ? editingExpense.date : new Date().toISOString(),
      ...(splits ? { splits } : {}),
    };

    if (editingExpense) {
      updateMutation.mutate({ ...expenseData, id: editingExpense.id }, {
        onSuccess: () => {
          captureEvent("expense_edited", { category, payment_source: paymentSource });
          onOpenChange(false);
        }
      });
    } else {
      createMutation.mutate(expenseData as any, {
        onSuccess: () => {
          captureEvent("expense_added", {
            category,
            amount: Number(amount),
            payment_source: paymentSource,
            is_shared: isPublic || paymentSource === "family",
            has_note: !!note,
          });
          onOpenChange(false);
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || uploadMutation.isPending;
  const canSubmit = amount !== "0";

  const handleCurrencyConfirm = async () => {
    await updateCurrencyMutation.mutateAsync(selectedCurrency);
    setShowCurrencyPrompt(false);
  };

  const userCurrencyCode = (user as any)?.currency || selectedCurrency;

  const getCurrencySymbolLocal = () => {
    const curr = CURRENCIES.find(c => c.code === userCurrencyCode);
    return curr?.symbol || '$';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0">
        <div className="sticky top-0 bg-background z-10 px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {showCurrencyPrompt && (
            <Card className="border-primary/30 bg-primary/5" data-testid="card-currency-prompt">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold">{t("selectCurrency")}</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("currencyPromptMessage")}
                </p>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-full" data-testid="select-currency-prompt">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code} data-testid={`option-currency-${curr.code}`}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono w-6">{curr.symbol}</span>
                          <span>{curr.code} - {curr.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  className="w-full" 
                  onClick={handleCurrencyConfirm}
                  disabled={updateCurrencyMutation.isPending}
                  data-testid="button-confirm-currency"
                >
                  {updateCurrencyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("confirmCurrency")
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="text-center py-4">
            <span className="text-4xl font-bold font-display text-primary">{getCurrencySymbolLocal()}{amount}</span>
          </div>

          <div className="bg-muted/30 rounded-3xl p-2">
            <Keypad value={amount} onValueChange={(val) => {
              if (val.startsWith("0") && val.length > 1 && !val.startsWith("0.")) {
                setAmount(val.substring(1));
              } else if (val === "") {
                setAmount("0");
              } else {
                setAmount(val);
              }
            }} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl text-xs font-medium transition-all gap-1 border",
                    category === cat 
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" 
                      : "bg-background border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span className="text-xl"><CategoryEmojiDisplay category={cat} /></span>
                  <span className="truncate w-full text-center">{cat}</span>
                </button>
              ))}
            </div>
            
            <Link href="/app/settings" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Settings className="w-3 h-3" />
              <span>{t("customizeCategoriesHint")}</span>
            </Link>

            <Input 
              placeholder="Add a note (optional)..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />

            <div className="space-y-3">
              <Label className="text-sm font-semibold">{t("paidWith")}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource("personal")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                    paymentSource === "personal"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted text-muted-foreground"
                  )}
                  data-testid="button-payment-personal"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="font-medium">{t("myMoney")}</span>
                </button>
                {user?.familyId && (
                  <button
                    type="button"
                    onClick={() => setPaymentSource("family")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                      paymentSource === "family"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    )}
                    data-testid="button-payment-family"
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{familyData?.family?.groupType === "couple" ? "Our Wallet" : t("familyMoney")}</span>
                  </button>
                )}
              </div>
            </div>

            {user?.familyId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="public-mode" className="font-medium">{familyData?.family?.groupType === "couple" ? "Shared with Partner" : "Share with Group"}</Label>
                  </div>
                  <Switch id="public-mode" checked={isPublic || paymentSource === "family"} onCheckedChange={setIsPublic} disabled={paymentSource === "family"} data-testid="switch-share-family" />
                </div>
                {paymentSource !== "family" && (
                  <p className="text-xs text-muted-foreground px-1">
                    {familyData?.family?.groupType === "couple"
                      ? "Only expenses you choose to share will appear on the household dashboard."
                      : "Only expenses you choose to share with your group will appear in the group dashboard."}
                  </p>
                )}
              </div>
            )}

            {user?.familyId && paymentSource === "family" && (
              <div className="space-y-3 border border-primary/20 rounded-xl p-4 bg-primary/5" data-testid="section-split-options">
                <Label className="text-sm font-semibold">{t("splitMethod")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["equal", "exact", "percentage"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSplitType(method)}
                      className={cn(
                        "py-2 px-2 rounded-xl border text-xs font-medium transition-all",
                        splitType === method
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-background border-border hover:bg-muted"
                      )}
                      data-testid={`button-split-${method}`}
                    >
                      {method === "equal" ? t("splitEqual") : method === "exact" ? t("splitCustom") : t("splitPercentage")}
                    </button>
                  ))}
                </div>

                {splitType !== "none" && familyData?.members && (
                  <div className="space-y-2">
                    <Label className="text-xs">{t("splitBetween")}</Label>
                    <div className="space-y-1.5">
                      {(familyData.members as any[]).map((member: any) => {
                        const isSelected = selectedMembers.includes(member.id);
                        return (
                          <div key={member.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMembers(prev => prev.filter(id => id !== member.id));
                                } else {
                                  setSelectedMembers(prev => [...prev, member.id]);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 flex-1 p-2 rounded-lg border text-xs font-medium transition-all text-left",
                                isSelected ? "bg-primary/10 border-primary/30" : "bg-background border-border/50 hover:bg-muted"
                              )}
                              data-testid={`button-select-member-${member.id}`}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              )}>
                                {member.name?.[0]?.toUpperCase()}
                              </div>
                              <span>{member.name}</span>
                              {member.id === user?.id && <span className="text-muted-foreground">(you)</span>}
                            </button>
                            {isSelected && splitType !== "equal" && (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={splitType === "percentage" ? "%" : "0.00"}
                                value={customSplits[member.id] || ""}
                                onChange={(e) => setCustomSplits(prev => ({ ...prev, [member.id]: e.target.value }))}
                                className="w-20 h-8 text-xs font-mono"
                                data-testid={`input-split-amount-${member.id}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {splitType === "equal" && selectedMembers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Each person pays: <span className="font-bold">{getCurrencySymbolLocal()}{toFixedAmount(Number(amount) / selectedMembers.length, userCurrencyCode)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl h-12"
                onClick={() => document.getElementById('receipt-upload')?.click()}
                disabled={scanReceiptMutation.isPending}
              >
                {scanReceiptMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("scanning")}</>
                ) : file ? (
                  <span className="text-primary font-medium truncate">{file.name}</span>
                ) : (
                  <><ScanLine className="mr-2 h-4 w-4" /> {t("scanReceipt")}</>
                )}
              </Button>
              <input 
                id="receipt-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleReceiptUpload}
              />
            </div>

            {showReceiptConfirm && extractedData && (
              <Card className="border-primary/30 bg-primary/5" data-testid="card-receipt-confirm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      {t("extractedFromReceipt")}
                    </h4>
                  </div>
                  
                  {receiptPreviewUrl && (
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                      <img src={receiptPreviewUrl} alt="Receipt" className="w-full h-full object-contain" data-testid="img-receipt-preview" />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-background p-2 rounded-lg">
                      <span className="text-muted-foreground text-xs">Amount</span>
                      <p className="font-bold text-primary" data-testid="text-extracted-amount">${extractedData.amount || '0.00'}</p>
                    </div>
                    <div className="bg-background p-2 rounded-lg">
                      <span className="text-muted-foreground text-xs">Category</span>
                      <p className="font-medium" data-testid="text-extracted-category">{extractedData.category || 'Other'}</p>
                    </div>
                    {extractedData.note && (
                      <div className="col-span-2 bg-background p-2 rounded-lg">
                        <span className="text-muted-foreground text-xs">Store/Note</span>
                        <p className="font-medium truncate" data-testid="text-extracted-note">{extractedData.note}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={handleConfirmExtractedData}
                      data-testid="button-use-extracted-data"
                    >
                      <Check className="w-4 h-4 mr-1" /> {t("useThisData")}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleCancelExtractedData}
                      data-testid="button-cancel-extracted-data"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 p-6 bg-background border-t z-20">
            <Button 
              type="button"
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={!canSubmit || isPending}
              data-testid="button-save-expense"
            >
              {isPending ? <Loader2 className="animate-spin" /> : "Save Expense"}
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MoneyInSectionProps {
  incomeEntries: IncomeEntry[];
  incomeLoading: boolean;
  currencySymbol: string;
  user: any;
  onEdit: (entry: IncomeEntry) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}

function MoneyInSection({ incomeEntries, incomeLoading, currencySymbol, user, onEdit, onDelete, onAdd }: MoneyInSectionProps) {
  if (incomeLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (incomeEntries.length === 0) {
    return (
      <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
        <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground font-medium mb-1">No income logged yet</p>
        <p className="text-xs text-muted-foreground mb-4">Track money you receive to see your net position</p>
        <Button variant="ghost" onClick={onAdd} data-testid="button-add-first-income">
          <Plus className="w-4 h-4 mr-1" /> Add your first income
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="income-list">
      {incomeEntries.map((entry) => (
        <div
          key={entry.id}
          className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-colors"
          data-testid={`income-entry-${entry.id}`}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
              {sourceEmoji[entry.source as IncomeSource] || "💰"}
            </div>
            <div>
              <p className="font-semibold text-foreground">{entry.source}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{format(new Date(entry.date), "MMM d, yyyy")}</span>
                {entry.isRecurring && (
                  <Badge variant="secondary" className="gap-1">
                    <Repeat className="w-3 h-3" />
                    {entry.recurringInterval || "recurring"}
                  </Badge>
                )}
                {entry.note && <span className="text-muted-foreground truncate max-w-[120px]">{entry.note}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-lg text-green-600 dark:text-green-400">+{currencySymbol}{toFixedAmount(Number(entry.amount), user?.currency)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(entry)}
              data-testid={`button-edit-income-${entry.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(entry.id)}
              data-testid={`button-delete-income-${entry.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

