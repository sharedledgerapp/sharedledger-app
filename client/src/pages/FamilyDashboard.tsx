import { useState } from "react";
import { useFamily, useExpenses, useSharedGoals, useApproveGoal } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, ShieldOff, TrendingDown, ChevronRight, Wallet, Trophy, Target, Globe, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getCurrencySymbol } from "@/lib/currency";

export default function FamilyDashboard() {
  const { user } = useAuth();
  const { data: familyData, isLoading } = useFamily();
  const [viewingMember, setViewingMember] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"expenses" | "goals">("expenses");
  const currencySymbol = getCurrencySymbol(user?.currency);

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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "expenses" | "goals")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-expenses">
            <Wallet className="w-4 h-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="goals" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-goals">
            <Target className="w-4 h-4 mr-2" />
            Shared Goals
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="expenses" className="mt-4 space-y-4">
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
                        <span className="text-lg font-bold">{currencySymbol}{Number(member.total).toFixed(2)}</span>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Month</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Combined Family Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{currencySymbol}{familyTotal.toFixed(2)}</div>
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
        </TabsContent>
        
        <TabsContent value="goals" className="mt-4">
          <SharedGoalsView />
        </TabsContent>
      </Tabs>

      {viewingMember && (
        <MemberDetailsDialog 
          member={viewingMember} 
          open={!!viewingMember} 
          onOpenChange={(open) => !open && setViewingMember(null)} 
        />
      )}
    </div>
  );
}

function SharedGoalsView() {
  const { user } = useAuth();
  const { data: sharedGoals, isLoading } = useSharedGoals();
  const approveGoalMutation = useApproveGoal();
  const currencySymbol = getCurrencySymbol(user?.currency);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  const familyGoals = sharedGoals?.filter((g: any) => g.visibility === "family") || [];
  const personalSharedGoals = sharedGoals?.filter((g: any) => g.visibility === "shared") || [];

  if (sharedGoals?.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
        <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-lg">No shared goals yet</h3>
        <p className="text-muted-foreground text-sm">Family members can share their goals or create family goals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {familyGoals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Family Goals</h3>
          </div>
          <div className="grid gap-3">
            {familyGoals.map((goal: any) => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                isParent={user?.role === "parent"}
                onApprove={() => approveGoalMutation.mutate(goal.id)}
                isApproving={approveGoalMutation.isPending}
                currencySymbol={currencySymbol}
              />
            ))}
          </div>
        </div>
      )}

      {personalSharedGoals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Personal Goals Shared</h3>
          </div>
          <div className="grid gap-3">
            {personalSharedGoals.map((goal: any) => (
              <GoalCard key={goal.id} goal={goal} currencySymbol={currencySymbol} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted flex items-start gap-3">
        <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Family goals need approval from a parent before they become active. 
          Personal shared goals are visible to the family but don't require approval.
        </p>
      </div>
    </div>
  );
}

function GoalCard({ 
  goal, 
  isParent, 
  onApprove,
  isApproving,
  currencySymbol 
}: { 
  goal: any; 
  isParent?: boolean;
  onApprove?: () => void;
  isApproving?: boolean;
  currencySymbol: string;
}) {
  const progress = Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100);
  const needsApproval = goal.visibility === "family" && !goal.isApproved;

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{goal.title}</h3>
              <p className="text-xs text-muted-foreground">by {goal.creatorName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {goal.visibility === "family" && (
              <Badge 
                variant={goal.isApproved ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {goal.isApproved ? (
                  <><Check className="w-2.5 h-2.5 mr-0.5" /> Approved</>
                ) : (
                  "Pending Approval"
                )}
              </Badge>
            )}
            {goal.visibility === "shared" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                <Globe className="w-2.5 h-2.5 mr-0.5" /> Personal
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">{currencySymbol}{Number(goal.currentAmount).toLocaleString()}</span>
            <span className="text-muted-foreground">of {currencySymbol}{Number(goal.targetAmount).toLocaleString()}</span>
          </div>
          <Progress value={progress} className="h-2 rounded-full bg-secondary" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-primary">{progress.toFixed(0)}%</span>
            {goal.deadline && (
              <span className="text-[10px] text-muted-foreground">
                Due: {format(new Date(goal.deadline), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>

        {needsApproval && isParent && onApprove && (
          <Button 
            onClick={onApprove}
            disabled={isApproving}
            className="w-full mt-3 h-8 text-xs"
            size="sm"
            data-testid={`button-approve-goal-${goal.id}`}
          >
            {isApproving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Approve Family Goal
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MemberDetailsDialog({ member, open, onOpenChange }: { member: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { data: expenses, isLoading } = useExpenses(member.id);
  const currencySymbol = getCurrencySymbol(user?.currency);

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
                  <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-lg">
                        {getCategoryEmoji(expense.category)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{expense.note || expense.category}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(expense.date), "MMM d, h:mm a")}</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm">-{currencySymbol}{Number(expense.amount).toFixed(2)}</span>
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
