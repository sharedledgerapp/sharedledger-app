import { useState } from "react";
import { useFamily, useExpenses } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Shield, ShieldOff, TrendingDown, ChevronRight, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function FamilyDashboard() {
  const { user } = useAuth();
  const { data: familyData, isLoading } = useFamily();
  const [viewingMember, setViewingMember] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const members = (familyData?.members || []) as any[];
  const familyTotal = members.reduce((sum, m) => sum + (m.total ? Number(m.total) : 0), 0);

  return (
    <div className="space-y-6 pb-20 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-3xl">Family Dashboard</h1>
        <p className="text-muted-foreground">{familyData?.family.name}</p>
      </div>

      <div className="grid gap-4">
        {members.map((member) => (
          <Card 
            key={member.id} 
            onClick={() => !member.isPrivate && setViewingMember(member)}
            className={`overflow-hidden border-border/50 shadow-sm transition-all ${!member.isPrivate ? "cursor-pointer hover:border-primary/30 active:scale-[0.98]" : ""}`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{member.name}</p>
                    {!member.isPrivate && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>
              <div className="text-right">
                {member.isPrivate ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ShieldOff className="w-3 h-3" />
                    <span className="text-sm font-medium italic">Private</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-lg font-bold">${Number(member.total).toFixed(2)}</span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Month</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {viewingMember && (
        <MemberDetailsDialog 
          member={viewingMember} 
          open={!!viewingMember} 
          onOpenChange={(open) => !open && setViewingMember(null)} 
        />
      )}

      <Card className="bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Combined Family Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">${familyTotal.toFixed(2)}</div>
          <p className="text-xs opacity-70 mt-1">Total aggregated spending across all visible members</p>
        </CardContent>
      </Card>

      <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted flex items-start gap-3">
        <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Privacy Protection: Only expenses explicitly shared with the family are visible. 
          Tap on a member to view their shared contributions.
        </p>
      </div>
    </div>
  );
}

function MemberDetailsDialog({ member, open, onOpenChange }: { member: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: expenses, isLoading } = useExpenses(member.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full h-[80vh] overflow-y-auto rounded-t-3xl md:rounded-2xl p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {member.name[0]}
            </div>
            <div>
              <DialogTitle className="text-xl">{member.name}'s Shared Spending</DialogTitle>
              <p className="text-xs text-muted-foreground">Showing public expenses for this month</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {expenses?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>No shared expenses found for this month.</p>
                </div>
              ) : (
                expenses?.map((expense: any) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-lg">
                        {getCategoryEmoji(expense.category)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{expense.note || expense.category}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(expense.date), "MMM d, h:mm a")}</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm">-${Number(expense.amount).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          )}
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
