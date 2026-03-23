import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getCurrencySymbol } from "@/lib/currency";
import { format } from "date-fns";
import { MoreVertical, Plus, ArrowLeft, CheckCircle2, Archive, Copy, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddFriendExpenseDialog } from "@/components/AddFriendExpenseDialog";
import { FriendExpenseDetailSheet } from "@/components/FriendExpenseDetailSheet";
import { SettleUpDialog } from "@/components/SettleUpDialog";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Balance {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: string;
}

interface GroupMember {
  id: number;
  name: string;
  memberRole: string;
}

interface GroupExpense {
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

interface FriendGroup {
  id: number;
  name: string;
  code: string;
  currency: string;
  archived: boolean;
  members: GroupMember[];
  balances: Balance[];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function FriendGroupDashboard() {
  const { id } = useParams<{ id: string }>();
  const groupId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  const newGroupCode = new URLSearchParams(location.split("?")[1] || "").get("code");
  const [showInviteCode, setShowInviteCode] = useState(!!newGroupCode);
  const [codeCopied, setCodeCopied] = useState(false);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery<FriendGroup>({
    queryKey: ["/api/friend-groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/friend-groups/${groupId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load group");
      return res.json();
    },
    enabled: !isNaN(groupId) && groupId > 0,
  });

  const { data: expenses, isLoading: expensesLoading, isError: expensesError } = useQuery<GroupExpense[]>({
    queryKey: ["/api/friend-groups", groupId, "expenses"],
    queryFn: async () => {
      const res = await fetch(`/api/friend-groups/${groupId}/expenses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
    enabled: !isNaN(groupId) && groupId > 0,
  });

  const { data: balances, isError: balancesError } = useQuery<Balance[]>({
    queryKey: ["/api/friend-groups", groupId, "balances"],
    queryFn: async () => {
      const res = await fetch(`/api/friend-groups/${groupId}/balances`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load balances");
      return res.json();
    },
    enabled: !isNaN(groupId) && groupId > 0,
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/friend-groups/${groupId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups"] });
      toast({ title: "Left group" });
      navigate("/groups");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/friend-groups/${groupId}/archive`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups"] });
      toast({ title: "Group archived" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const currencySymbol = getCurrencySymbol(group?.currency);
  const currentUserId = (user as { id: number })?.id;
  const myBalances = (balances || group?.balances || []).filter(
    (b) => b.fromUserId === currentUserId || b.toUserId === currentUserId
  );
  const allBalances = balances || group?.balances || [];

  const totalSpent = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

  if (groupLoading) {
    return (
      <div className="space-y-4 pb-20">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Group not found.</p>
        <Link href="/groups">
          <Button variant="outline" className="mt-4">Back to Groups</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/groups">
            <Button variant="ghost" size="icon" data-testid="button-back-to-groups">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-group-name">{group.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{group.members.length} members</span>
              {group.archived && (
                <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-archived">
                  <Archive className="w-3 h-3" /> Archived
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-group-menu">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!group.archived && (
              <DropdownMenuItem onClick={() => setShowArchiveConfirm(true)} data-testid="menu-item-archive">
                <Archive className="w-4 h-4 mr-2" /> Archive Group
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowLeaveConfirm(true)}
              data-testid="menu-item-leave"
            >
              Leave Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Invite Code Banner (shown right after group creation) */}
      {showInviteCode && newGroupCode && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-invite-code">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium">Share this invite code with friends</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground flex-shrink-0"
                onClick={() => setShowInviteCode(false)}
                data-testid="button-dismiss-invite-code"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 bg-background rounded-xl p-3">
              <span className="flex-1 text-lg font-mono font-bold tracking-widest text-center" data-testid="text-invite-code">{newGroupCode}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(newGroupCode).then(() => {
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  });
                }}
                data-testid="button-copy-invite-code"
              >
                {codeCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member Avatars */}
      <div className="flex items-center gap-1">
        {group.members.map((m) => (
          <div
            key={m.id}
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-background -ml-2 first:ml-0"
            title={m.name}
            data-testid={`avatar-member-${m.id}`}
          >
            {getInitials(m.name)}
          </div>
        ))}
        <span className="ml-3 text-sm text-muted-foreground">{currencySymbol}{totalSpent.toFixed(2)} total</span>
      </div>

      {/* Balances */}
      <section>
        <h3 className="font-display font-bold text-base mb-3">Balances</h3>
        {balancesError ? (
          <Card className="border-destructive/30">
            <CardContent className="p-4 text-sm text-destructive">
              Could not load balances. Please refresh.
            </CardContent>
          </Card>
        ) : allBalances.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3 text-green-600">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">All settled up! 🎉</span>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {allBalances.map((b, i) => {
              const isMyDebt = b.fromUserId === currentUserId;
              const isMyCredit = b.toUserId === currentUserId;
              const canSettle = isMyDebt && !group.archived;
              return (
                <Card
                  key={i}
                  className={cn(
                    "border-border/50 transition-all",
                    canSettle && "cursor-pointer hover:border-primary/30 active:scale-[0.99]"
                  )}
                  onClick={() => canSettle && setSelectedBalance(b)}
                  data-testid={`balance-card-${b.fromUserId}-${b.toUserId}`}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isMyDebt ? "bg-destructive" : isMyCredit ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                      <div className="text-sm">
                        {isMyDebt ? (
                          <span>You owe <span className="font-semibold">{b.toName}</span></span>
                        ) : isMyCredit ? (
                          <span><span className="font-semibold">{b.fromName}</span> owes you</span>
                        ) : (
                          <span><span className="font-semibold">{b.fromName}</span> owes <span className="font-semibold">{b.toName}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold text-sm",
                        isMyDebt ? "text-destructive" : isMyCredit ? "text-green-600" : ""
                      )}>
                        {currencySymbol}{Number(b.amount).toFixed(2)}
                      </span>
                      {canSettle && <span className="text-xs text-muted-foreground">Tap to settle</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Expense Feed */}
      <section>
        <h3 className="font-display font-bold text-base mb-3">Expenses</h3>
        {expensesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : expensesError ? (
          <Card className="border-destructive/30">
            <CardContent className="p-4 text-sm text-destructive">
              Could not load expenses. Please refresh.
            </CardContent>
          </Card>
        ) : !expenses || expenses.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
              {!group.archived && (
                <p className="text-xs text-muted-foreground mt-1">Tap "+ Add Expense" to get started.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => {
              const participants = expense.participantNames || [];
              return (
                <Card
                  key={expense.id}
                  className="border-border/50 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99]"
                  onClick={() => setSelectedExpense(expense)}
                  data-testid={`expense-card-${expense.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{expense.note || "Expense"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Paid by {expense.paidByName} · {format(new Date(expense.date), "MMM d")}
                        </p>
                        {participants.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {participants.slice(0, 4).map((p) => (
                              <div
                                key={p.userId}
                                className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold -ml-1 first:ml-0 border border-background"
                                title={p.name}
                              >
                                {getInitials(p.name)}
                              </div>
                            ))}
                            {participants.length > 4 && (
                              <span className="text-xs text-muted-foreground ml-1">+{participants.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-bold">{currencySymbol}{Number(expense.amount).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* FAB */}
      {!group.archived && (
        <Button
          className="fixed bottom-20 right-4 rounded-full shadow-lg shadow-primary/25 h-14 w-14"
          size="icon"
          onClick={() => setShowAddExpense(true)}
          data-testid="button-add-expense-fab"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

      {/* Dialogs */}
      <AddFriendExpenseDialog
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        groupId={groupId}
        groupCurrency={group.currency}
        members={group.members}
        currentUserId={currentUserId}
      />

      <FriendExpenseDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(o) => { if (!o) setSelectedExpense(null); }}
        groupId={groupId}
        groupCurrency={group.currency}
        members={group.members}
        currentUserId={currentUserId}
        isArchived={group.archived}
      />

      <SettleUpDialog
        open={!!selectedBalance}
        onOpenChange={(o) => { if (!o) setSelectedBalance(null); }}
        balance={selectedBalance}
        groupId={groupId}
        groupCurrency={group.currency}
      />

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to this group's expenses and balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-leave"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Group?</AlertDialogTitle>
            <AlertDialogDescription>
              The group will become read-only. No new expenses can be added. You can still view history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate()} data-testid="button-confirm-archive">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
