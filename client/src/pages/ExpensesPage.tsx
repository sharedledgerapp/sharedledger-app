import { useState } from "react";
import { useExpenses, useCreateExpense, useUpload } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { Keypad } from "@/components/Keypad";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Food", "Transport", "Entertainment", "Shopping", "Utilities", "Education", "Health", "Other"];

export default function ExpensesPage() {
  const { data: expenses, isLoading } = useExpenses();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-bold text-3xl">Expenses</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-lg shadow-primary/25">
          <Plus className="w-5 h-5 mr-2" /> Add New
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses?.map((expense) => (
            <div key={expense.id} className="bg-white p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  {getCategoryEmoji(expense.category)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{expense.note || expense.category}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(expense.date), "MMM d, h:mm a")}</span>
                    {expense.visibility === "public" && (
                      <span className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px] font-medium">Shared</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="block font-bold text-lg">-${Number(expense.amount).toFixed(2)}</span>
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

      <CreateExpenseDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}

function CreateExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [amount, setAmount] = useState("0");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  const { user } = useAuth();
  const createMutation = useCreateExpense();
  const uploadMutation = useUpload();

  const handleSubmit = async () => {
    console.log("[Expense] handleSubmit called");
    if (amount === "0") {
      console.warn("[Expense] Amount is 0, blocking submission");
      return;
    }
    if (!user?.familyId) {
      console.error("[Expense] familyId missing", { userId: user?.id });
      return;
    }

    let receiptUrl = undefined;
    if (file) {
      try {
        console.log("[Expense] Uploading file", file.name);
        const uploadRes = await uploadMutation.mutateAsync(file);
        receiptUrl = uploadRes.url;
        console.log("[Expense] Upload successful", { receiptUrl });
      } catch (e) {
        console.error("[Expense] Upload failed", e);
      }
    }

    const expenseData = {
      userId: user.id,
      amount,
      category,
      note,
      visibility: (isPublic ? "public" : "private") as "public" | "private",
      receiptUrl,
      date: new Date().toISOString(),
    };

    console.log("[Expense] Attempting to save expense", {
      expenseData,
      currentUserId: user.id,
      currentFamilyId: user.familyId
    });

    createMutation.mutate(expenseData, {
      onSuccess: () => {
        console.log("[Expense] Save successful");
        onOpenChange(false);
        setAmount("0");
        setCategory(CATEGORIES[0]);
        setNote("");
        setFile(null);
      },
      onError: (error) => {
        console.error("[Expense] Save failed", error);
      }
    });
  };

  const isPending = createMutation.isPending || uploadMutation.isPending;
  const canSubmit = amount !== "0" && !!user?.familyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full h-[90vh] md:h-auto overflow-y-auto rounded-t-3xl md:rounded-2xl p-0 gap-0">
        <div className="sticky top-0 bg-background z-10 px-6 py-4 border-b">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {!user?.familyId && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl font-medium">
              You must belong to a family to add expenses.
            </div>
          )}
          {/* Amount Display */}
          <div className="text-center py-4">
            <span className="text-4xl font-bold font-display text-primary">${amount}</span>
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

            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-border/50">
              <div className="flex items-center gap-2">
                <Label htmlFor="public-mode" className="font-medium">Share with Family</Label>
              </div>
              <Switch id="public-mode" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl h-12"
                onClick={() => document.getElementById('receipt-upload')?.click()}
              >
                {file ? <span className="text-primary font-medium truncate">{file.name}</span> : <><Camera className="mr-2 h-4 w-4" /> Add Receipt</>}
              </Button>
              <input 
                id="receipt-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 bg-background border-t">
            <Button 
              type="button"
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20" 
              onClick={(e) => {
                console.log("[Expense] Button clicked");
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={!canSubmit || isPending}
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
