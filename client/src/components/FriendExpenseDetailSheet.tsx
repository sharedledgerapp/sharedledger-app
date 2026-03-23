import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/currency";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { AddFriendExpenseDialog } from "./AddFriendExpenseDialog";

interface Member {
  id: number;
  name: string;
  memberRole: string;
}

interface Expense {
  id: number;
  amount: string;
  note: string | null;
  date: string;
  paidByUserId: number;
  paidByName?: string;
  splitType: string;
  splits: { userId: number; amount: string }[];
  participantNames?: { userId: number; name: string; amount: string }[];
}

interface Props {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  groupCurrency: string;
  members: Member[];
  currentUserId: number;
  isArchived?: boolean;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function FriendExpenseDetailSheet({ expense, open, onOpenChange, groupId, groupCurrency, members, currentUserId, isArchived }: Props) {
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol(groupCurrency);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/friend-groups/${groupId}/expenses/${expense!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId] });
      toast({ title: "Expense deleted" });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!expense) return null;

  const participants = expense.participantNames || expense.splits.map((s) => {
    const m = members.find((mb) => mb.id === s.userId);
    return { userId: s.userId, name: m?.name || "Unknown", amount: s.amount };
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-left">{expense.note || "Expense"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold">{currencySymbol}{Number(expense.amount).toFixed(2)}</span>
              </div>
              <Badge variant="outline">{expense.splitType === "equal" ? "Equal split" : "Custom split"}</Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              {format(new Date(expense.date), "EEEE, MMMM d, yyyy")}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paid by</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {getInitials(expense.paidByName || "?")}
                </div>
                <span className="font-medium">{expense.paidByName}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Split between</p>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between" data-testid={`split-row-${p.userId}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                        {getInitials(p.name)}
                      </div>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{currencySymbol}{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {!isArchived && (
              <>
                <Separator />
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowEdit(true)}
                    data-testid="button-edit-expense"
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-delete-expense"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{expense.note || "this expense"}" and update all balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFriendExpenseDialog
        open={showEdit}
        onOpenChange={(o) => { setShowEdit(o); if (!o) onOpenChange(false); }}
        groupId={groupId}
        groupCurrency={groupCurrency}
        members={members}
        currentUserId={currentUserId}
        initialExpense={expense}
      />
    </>
  );
}
