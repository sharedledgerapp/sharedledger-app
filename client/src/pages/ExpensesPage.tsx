import { useState, useEffect } from "react";
import { useExpenses, useCreateExpense, useUpdateExpense, useUpload, useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, Image as ImageIcon, Loader2, Pencil, Users, Split, ScanLine, Check, X, DollarSign, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Keypad } from "@/components/Keypad";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useDeleteExpense } from "@/hooks/use-data";
import { getCurrencySymbol, CURRENCIES } from "@/lib/currency";

const CATEGORIES = ["Food", "Transport", "Entertainment", "Shopping", "Utilities", "Education", "Health", "Other"];

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const { user } = useAuth();
  const deleteMutation = useDeleteExpense();
  
  const currencySymbol = getCurrencySymbol(user?.currency);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-bold text-3xl">Expenses</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-lg shadow-primary/25">
          <Plus className="w-5 h-5 mr-2" /> Add New
        </Button>
      </div>

      <p className="text-sm font-medium text-muted-foreground" data-testid="text-privacy-note">
        Only expenses you choose to share with your family will appear in the family dashboard.
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses?.map((expense) => (
            <div 
              key={expense.id} 
              className="bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-colors"
            >
              <div 
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => setEditingExpense(expense)}
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  {getCategoryEmoji(expense.category)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{expense.note || expense.category}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(expense.date), "MMM d, h:mm a")}</span>
                    {(expense as any).splitType !== "none" && (
                      <Badge variant="outline">
                        <Split className="w-3 h-3" />
                        Split
                      </Badge>
                    )}
                    {expense.visibility === "public" && (expense as any).splitType === "none" && (
                      <Badge variant="secondary">
                        <Users className="w-3 h-3" />
                        Shared
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="block font-bold text-lg">-{currencySymbol}{Number(expense.amount).toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this expense?")) {
                      deleteMutation.mutate(expense.id);
                    }
                  }}
                  data-testid={`button-delete-expense-${expense.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {expenses?.length === 0 && (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
              <p className="text-muted-foreground">No expenses yet.</p>
              <Button variant="ghost" onClick={() => setIsCreateOpen(true)}>Add your first expense</Button>
            </div>
          )}
        </div>
      )}

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
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [splitType, setSplitType] = useState<"none" | "equal" | "exact">("none");
  const [splitWith, setSplitWith] = useState<number[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<number, string>>({});
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
    },
  });

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      scanReceiptMutation.mutate(uploadedFile);
      setFile(uploadedFile);
    }
  };

  const handleConfirmExtractedData = () => {
    if (extractedData) {
      if (extractedData.amount) setAmount(extractedData.amount.toString());
      if (extractedData.category && CATEGORIES.includes(extractedData.category)) {
        setCategory(extractedData.category);
      }
      if (extractedData.note) setNote(extractedData.note);
    }
    setShowReceiptConfirm(false);
  };

  const handleCancelExtractedData = () => {
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
      setSplitType(editingExpense.splitType);
      const splitUserIds = editingExpense.splits?.map((s: any) => s.userId) || [];
      setSplitWith(splitUserIds);
      const exacts: Record<number, string> = {};
      editingExpense.splits?.forEach((s: any) => {
        exacts[s.userId] = s.amount.toString();
      });
      setExactAmounts(exacts);
    } else {
      setAmount("0");
      setCategory(CATEGORIES[0]);
      setNote("");
      setIsPublic(false);
      setSplitType("none");
      setSplitWith([]);
      setExactAmounts({});
    }
  }, [editingExpense, open]);

  const familyMembers = familyData?.members.filter(m => m.id !== user?.id) || [];

  const handleSubmit = async () => {
    console.log("[Expense] handleSubmit called, amount:", amount, "familyId:", user?.familyId);
    if (amount === "0") {
      console.log("[Expense] Rejected: amount is 0");
      return;
    }
    if (!user?.familyId) {
      console.log("[Expense] Rejected: no familyId");
      return;
    }

    let receiptUrl = editingExpense?.receiptUrl;
    if (file) {
      try {
        const uploadRes = await uploadMutation.mutateAsync(file);
        receiptUrl = uploadRes.url;
      } catch (e) {
        console.error("[Expense] Upload failed", e);
      }
    }

    const splits = splitType === "none" ? undefined : familyMembers
      .filter(m => splitWith.includes(m.id))
      .map(m => ({
        userId: m.id,
        amount: splitType === "equal" 
          ? (Number(amount) / (splitWith.length + 1)).toFixed(2)
          : exactAmounts[m.id] || "0"
      }));

    const expenseData = {
      userId: user.id,
      amount,
      category,
      note,
      visibility: (isPublic || splitType !== "none" ? "public" : "private") as "public" | "private",
      splitType,
      receiptUrl,
      date: editingExpense ? editingExpense.date : new Date().toISOString(),
      splits
    };

    if (editingExpense) {
      updateMutation.mutate({ ...expenseData, id: editingExpense.id }, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    } else {
      createMutation.mutate(expenseData as any, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || uploadMutation.isPending;
  const canSubmit = amount !== "0" && !!user?.familyId;

  const handleCurrencyConfirm = async () => {
    await updateCurrencyMutation.mutateAsync(selectedCurrency);
    setShowCurrencyPrompt(false);
  };

  const getCurrencySymbol = () => {
    const userCurrency = (user as any)?.currency || selectedCurrency;
    const curr = CURRENCIES.find(c => c.code === userCurrency);
    return curr?.symbol || '$';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full h-[90vh] md:h-auto overflow-y-auto rounded-t-3xl md:rounded-2xl p-0 gap-0">
        <div className="sticky top-0 bg-background z-10 px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Currency Selection Prompt for First Expense */}
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

          {!user?.familyId && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl font-medium">
              You must belong to a family to add expenses.
            </div>
          )}
          {/* Amount Display */}
          <div className="text-center py-4">
            <span className="text-4xl font-bold font-display text-primary">{getCurrencySymbol()}{amount}</span>
          </div>

          {/* Keypad */}
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
              {CATEGORIES.map(cat => (
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
                  <span className="text-xl">{getCategoryEmoji(cat)}</span>
                  <span className="truncate w-full text-center">{cat}</span>
                </button>
              ))}
            </div>

            <Input 
              placeholder="Add a note (optional)..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl"
            />

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Expense Splitting</Label>
              <Select value={splitType} onValueChange={(val: any) => setSplitType(val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="No splitting" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">No splitting (Personal)</SelectItem>
                  <SelectItem value="equal">Split Equally</SelectItem>
                  <SelectItem value="exact">Exact Amounts</SelectItem>
                </SelectContent>
              </Select>

              {splitType !== "none" && (
                <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Select family members to split with:</p>
                  {familyMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={splitWith.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSplitWith([...splitWith, member.id]);
                            else setSplitWith(splitWith.filter(id => id !== member.id));
                          }}
                        />
                        <span className="text-sm font-medium">{member.name}</span>
                      </div>
                      {splitType === "exact" && splitWith.includes(member.id) && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-sm px-2" 
                            placeholder="0.00"
                            value={exactAmounts[member.id] || ""}
                            onChange={(e) => setExactAmounts({...exactAmounts, [member.id]: e.target.value})}
                          />
                        </div>
                      )}
                      {splitType === "equal" && splitWith.includes(member.id) && (
                        <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                          ${(Number(amount) / (splitWith.length + 1)).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                  {splitWith.length > 0 && (
                    <div className="pt-2 border-t border-border/50 flex justify-between text-xs font-semibold">
                      <span>Your share:</span>
                      <span>${(Number(amount) - splitWith.reduce((acc, id) => acc + (splitType === "equal" ? Number(amount) / (splitWith.length + 1) : Number(exactAmounts[id] || 0)), 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-2">
                  <Label htmlFor="public-mode" className="font-medium">Share with Family</Label>
                </div>
                <Switch id="public-mode" checked={isPublic || splitType !== "none"} disabled={splitType !== "none"} onCheckedChange={setIsPublic} />
              </div>
              <p className="text-xs text-muted-foreground px-1">
                Only expenses you choose to share with your family will appear in the family dashboard.
              </p>
            </div>
            
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

            {/* Receipt Confirmation Dialog */}
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
                console.log("[Expense] Button clicked, amount:", amount, "canSubmit:", canSubmit);
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
