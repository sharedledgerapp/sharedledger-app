import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/currency";
import { useCelebration } from "@/hooks/use-celebration";
import { ArrowRight } from "lucide-react";

interface Balance {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: Balance | null;
  groupId: number;
  groupCurrency: string;
}

const settleSchema = z.object({
  amount: z.string().min(1).refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Enter a valid amount"),
  note: z.string().optional(),
});

export function SettleUpDialog({ open, onOpenChange, balance, groupId, groupCurrency }: Props) {
  const { toast } = useToast();
  const { celebrate } = useCelebration();
  const currencySymbol = getCurrencySymbol(groupCurrency);

  const form = useForm<z.infer<typeof settleSchema>>({
    resolver: zodResolver(settleSchema),
    defaultValues: { amount: "", note: "" },
  });

  useEffect(() => {
    if (open && balance) {
      form.reset({ amount: balance.amount, note: "" });
    }
  }, [open, balance]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof settleSchema>) => {
      const res = await apiRequest("POST", `/api/friend-groups/${groupId}/settle`, {
        toUserId: balance!.toUserId,
        amount: values.amount,
        note: values.note || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "expenses"] });
      toast({ title: "Payment recorded!", description: `Settlement of ${currencySymbol}${form.getValues("amount")} recorded.` });

      try {
        const freshRes = await fetch(`/api/friend-groups/${groupId}/balances`, { credentials: "include" });
        if (freshRes.ok) {
          const freshBalances: Balance[] = await freshRes.json();
          queryClient.setQueryData(["/api/friend-groups", groupId, "balances"], freshBalances);
          if (freshBalances.length === 0) {
            celebrate("light");
            toast({ title: "You're all square!", description: "Clean slate, fresh start." });
          }
        }
      } catch (err) {
        console.warn("[SettleUp] Could not check final balances for celebration:", err);
      }

      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!balance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-2">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive font-bold mx-auto">
              {balance.fromName[0]?.toUpperCase()}
            </div>
            <p className="text-sm font-medium mt-1">{balance.fromName}</p>
            <p className="text-xs text-muted-foreground">pays</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-green-600 font-bold mx-auto">
              {balance.toName[0]?.toUpperCase()}
            </div>
            <p className="text-sm font-medium mt-1">{balance.toName}</p>
            <p className="text-xs text-muted-foreground">receives</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">{currencySymbol}</span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-8"
                        data-testid="input-settle-amount"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Venmo, cash" data-testid="input-settle-note" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-confirm-settle">
              {mutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
