import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Member {
  id: number;
  name: string;
  memberRole: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  groupCurrency: string;
  members: Member[];
  currentUserId: number;
  initialExpense?: any;
}

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.string().min(1, "Amount is required").refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Enter a valid amount"),
  paidByUserId: z.number(),
  splitType: z.enum(["equal", "custom"]),
});

export function AddFriendExpenseDialog({ open, onOpenChange, groupId, groupCurrency, members, currentUserId, initialExpense }: Props) {
  const { toast } = useToast();
  const currencySymbol = getCurrencySymbol(groupCurrency);
  const [participants, setParticipants] = useState<number[]>(members.map((m) => m.id));
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: initialExpense?.note || "",
      amount: initialExpense ? String(initialExpense.amount) : "",
      paidByUserId: initialExpense?.paidByUserId || currentUserId,
      splitType: "equal",
    },
  });

  useEffect(() => {
    if (open) {
      if (initialExpense) {
        form.reset({
          description: initialExpense.note || "",
          amount: String(initialExpense.amount),
          paidByUserId: initialExpense.paidByUserId || currentUserId,
          splitType: initialExpense.splitType === "equal" ? "equal" : "custom",
        });
        setSplitType(initialExpense.splitType === "equal" ? "equal" : "custom");
        const existingParticipants = initialExpense.splits?.map((s: any) => s.userId) || members.map((m) => m.id);
        setParticipants(existingParticipants);
        const existingSplits: Record<number, string> = {};
        if (initialExpense.splitType !== "equal") {
          initialExpense.splits?.forEach((s: any) => { existingSplits[s.userId] = String(s.amount); });
        }
        setCustomSplits(existingSplits);
      } else {
        form.reset({ description: "", amount: "", paidByUserId: currentUserId, splitType: "equal" });
        setSplitType("equal");
        setParticipants(members.map((m) => m.id));
        setCustomSplits({});
      }
    }
  }, [open, initialExpense]);

  const isEditing = !!initialExpense;

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof expenseSchema>) => {
      const body: any = {
        description: values.description,
        amount: values.amount,
        paidByUserId: values.paidByUserId,
        participants,
        splitType,
      };
      if (splitType === "custom") {
        body.customSplits = Object.entries(customSplits)
          .filter(([uid]) => participants.includes(Number(uid)))
          .map(([uid, amount]) => ({ userId: Number(uid), amount }));
      }
      if (isEditing) {
        const res = await apiRequest("PATCH", `/api/friend-groups/${groupId}/expenses/${initialExpense.id}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/friend-groups/${groupId}/expenses`, body);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId, "balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups", groupId] });
      toast({ title: isEditing ? "Expense updated" : "Expense added" });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const amount = parseFloat(form.watch("amount") || "0");
  const customTotal = participants.reduce((sum, uid) => sum + parseFloat(customSplits[uid] || "0"), 0);
  const customDiff = Math.abs(customTotal - amount);
  const customValid = customDiff < 0.01;

  function toggleParticipant(uid: number) {
    setParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  function onSubmit(values: z.infer<typeof expenseSchema>) {
    if (participants.length === 0) {
      toast({ title: "Select at least one participant", variant: "destructive" });
      return;
    }
    if (splitType === "custom" && !customValid) {
      toast({ title: `Custom splits must sum to ${currencySymbol}${amount.toFixed(2)}`, variant: "destructive" });
      return;
    }
    mutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        placeholder="0.00"
                        className="pl-8"
                        data-testid="input-expense-amount"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Dinner, Hotel, Taxi" data-testid="input-expense-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paidByUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid by</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger data-testid="select-paid-by">
                        <SelectValue placeholder="Who paid?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-2">
              <Label>Split</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={splitType === "equal" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setSplitType("equal"); form.setValue("splitType", "equal"); }}
                  data-testid="button-split-equal"
                >
                  Equal
                </Button>
                <Button
                  type="button"
                  variant={splitType === "custom" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setSplitType("custom"); form.setValue("splitType", "custom"); }}
                  data-testid="button-split-custom"
                >
                  Custom
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Participants</Label>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`participant-${m.id}`}
                      checked={participants.includes(m.id)}
                      onCheckedChange={() => toggleParticipant(m.id)}
                      data-testid={`checkbox-participant-${m.id}`}
                    />
                    <Label htmlFor={`participant-${m.id}`} className="flex-1 cursor-pointer font-normal">
                      {m.name}
                    </Label>
                    {splitType === "custom" && participants.includes(m.id) && (
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{currencySymbol}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customSplits[m.id] || ""}
                          onChange={(e) => setCustomSplits((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          className="pl-6 h-8 text-sm"
                          data-testid={`input-custom-split-${m.id}`}
                        />
                      </div>
                    )}
                    {splitType === "equal" && participants.includes(m.id) && amount > 0 && (
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {currencySymbol}{(amount / participants.length).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {splitType === "custom" && amount > 0 && (
                <div className={cn(
                  "text-xs px-2 py-1 rounded-lg",
                  customValid ? "text-green-600 bg-green-50 dark:bg-green-950/30" : "text-destructive bg-destructive/10"
                )}>
                  Total: {currencySymbol}{customTotal.toFixed(2)} / {currencySymbol}{amount.toFixed(2)}
                  {!customValid && ` (${currencySymbol}${customDiff.toFixed(2)} off)`}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              data-testid="button-submit-expense"
            >
              {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Expense"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
