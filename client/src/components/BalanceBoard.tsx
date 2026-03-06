import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Scale, Handshake } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/currency";
import { useFamily } from "@/hooks/use-data";
import { format } from "date-fns";

interface Balance {
  userId: number;
  userName: string;
  balance: number;
}

interface Settlement {
  id: number;
  fromUserId: number;
  toUserId: number;
  amount: string;
  note: string | null;
  createdAt: string;
  fromUserName: string;
  toUserName: string;
}

export function BalanceBoard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currencySymbol = getCurrencySymbol(user?.currency);
  const [settleDialog, setSettleDialog] = useState(false);
  const [settleToUserId, setSettleToUserId] = useState<string>("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");

  const { data: familyData } = useFamily();
  const members = familyData?.members || [];

  const { data: balances, isLoading } = useQuery<Balance[]>({
    queryKey: ["/api/group/balances"],
  });

  const { data: settlements } = useQuery<Settlement[]>({
    queryKey: ["/api/settlements"],
  });

  const settleMutation = useMutation({
    mutationFn: async (data: { toUserId: number; amount: string; note: string | null }) => {
      const res = await apiRequest("POST", "/api/settlements", data);
      if (!res.ok) throw new Error("Failed to record settlement");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/group/balances"] });
      qc.invalidateQueries({ queryKey: ["/api/settlements"] });
      qc.invalidateQueries({ queryKey: ["/api/family/dashboard"] });
      toast({ title: t("settled"), description: t("changesSaved") });
      setSettleDialog(false);
      setSettleToUserId("");
      setSettleAmount("");
      setSettleNote("");
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const handleSettle = () => {
    if (!settleToUserId || !settleAmount || Number(settleAmount) <= 0) return;
    settleMutation.mutate({
      toUserId: Number(settleToUserId),
      amount: settleAmount,
      note: settleNote || null,
    });
  };

  const otherMembers = members.filter((m: any) => m.id !== user?.id);

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="h-20 animate-pulse bg-muted rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              {t("balanceBoard")}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSettleDialog(true)}
              className="gap-1 text-xs"
              data-testid="button-settle-debt"
            >
              <Handshake className="w-3.5 h-3.5" />
              {t("settleDebt")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {balances && balances.length > 0 ? (
            <div className="space-y-2">
              {balances.map((b) => {
                const isMe = b.userId === user?.id;
                const isPositive = b.balance > 0;
                const isZero = Math.abs(b.balance) < 0.01;
                return (
                  <div
                    key={b.userId}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      isMe ? "border-primary/20 bg-primary/5" : "border-border/50"
                    }`}
                    data-testid={`balance-row-${b.userId}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {b.userName[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">
                        {b.userName}
                        {isMe && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                      </span>
                    </div>
                    <Badge
                      variant={isZero ? "secondary" : "outline"}
                      className={`font-mono font-bold ${
                        isZero ? "" : isPositive ? "text-green-600 border-green-200" : "text-red-500 border-red-200"
                      }`}
                      data-testid={`balance-amount-${b.userId}`}
                    >
                      {isZero ? `${currencySymbol}0.00` : `${isPositive ? "+" : ""}${currencySymbol}${b.balance.toFixed(2)}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">{t("noSharedExpenses")}</p>
          )}

          {settlements && settlements.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Recent Settlements</p>
              <div className="space-y-2">
                {settlements.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1.5" data-testid={`settlement-row-${s.id}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{s.fromUserName}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{s.toUserName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{currencySymbol}{Number(s.amount).toFixed(2)}</span>
                      <span className="text-muted-foreground">{format(new Date(s.createdAt), "MMM d")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={settleDialog} onOpenChange={setSettleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" />
              {t("recordSettlement")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("paidBy")}: {user?.name} (you)</Label>
            </div>
            <div>
              <Label className="mb-1.5 block">To</Label>
              <Select value={settleToUserId} onValueChange={setSettleToUserId}>
                <SelectTrigger data-testid="select-settle-to">
                  <SelectValue placeholder={t("selectMembers")} />
                </SelectTrigger>
                <SelectContent>
                  {otherMembers.map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
                data-testid="input-settle-amount"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Note (optional)</Label>
              <Input
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="e.g. Rent for March"
                data-testid="input-settle-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSettleDialog(false)}>{t("cancel")}</Button>
            <Button
              onClick={handleSettle}
              disabled={settleMutation.isPending || !settleToUserId || !settleAmount}
              data-testid="button-confirm-settle"
            >
              {t("recordSettlement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
