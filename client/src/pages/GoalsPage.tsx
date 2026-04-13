import { useState, useEffect } from "react";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useUpload } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { useCelebration } from "@/hooks/use-celebration";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trophy, Target, Trash2, Loader2, Save, Calendar, FileText, Camera, Flag, Lock, Users, Globe, PartyPopper } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { InsertGoal } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortGoalsByPriority, type GoalPriority } from "@/lib/goals";
import { getCurrencySymbol } from "@/lib/currency";

export default function GoalsPage() {
  const { user } = useAuth();
  const { data: goals, isLoading } = useGoals();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [completedGoal, setCompletedGoal] = useState<{ title: string } | null>(null);

  const deleteMutation = useDeleteGoal();
  const updateMutation = useUpdateGoal();
  const { celebrate } = useCelebration();
  const currencySymbol = getCurrencySymbol(user?.currency);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-bold text-3xl">Goals</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-lg shadow-primary/25">
          <Plus className="w-5 h-5 mr-2" /> New Goal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-tutorial="goals-list">
        {isLoading ? (
          <p className="text-muted-foreground">Loading goals...</p>
        ) : sortGoalsByPriority(goals || []).map((goal) => {
          const progress = Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100);
          
          return (
            <Card 
              key={goal.id} 
              onClick={() => setEditingGoal(goal)}
              className="overflow-hidden border-border/50 shadow-md hover:shadow-lg transition-all cursor-pointer hover:border-primary/30"
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{goal.title}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {goal.priority === "high" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            <Flag className="w-2.5 h-2.5 mr-0.5" /> Priority
                          </Badge>
                        )}
                        {goal.visibility === "private" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            <Lock className="w-2.5 h-2.5 mr-0.5" /> Private
                          </Badge>
                        )}
                        {goal.visibility === "shared" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            <Globe className="w-2.5 h-2.5 mr-0.5" /> Shared
                          </Badge>
                        )}
                        {goal.visibility === "family" && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                            <Users className="w-2.5 h-2.5 mr-0.5" /> Family Goal
                            {!goal.isApproved && <span className="ml-1 text-yellow-600">(Pending)</span>}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(goal.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{currencySymbol}{Number(goal.currentAmount).toLocaleString()} saved</span>
                    <span className="text-muted-foreground">of {currencySymbol}{Number(goal.targetAmount).toLocaleString()}</span>
                  </div>
                  <Progress value={progress} className="h-3 rounded-full bg-secondary" />
                  <div className="flex justify-end">
                    <span className="text-xs font-bold text-primary">{progress.toFixed(0)}%</span>
                  </div>
                </div>

                {(goal.deadline || goal.note || goal.photoUrl) && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    {goal.deadline && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>Target date: {format(new Date(goal.deadline), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {goal.note && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary mt-0.5" />
                        <p className="line-clamp-2 italic">{goal.note}</p>
                      </div>
                    )}
                    {goal.photoUrl && (
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                        <img 
                          src={goal.photoUrl} 
                          alt={goal.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/20 p-3" onClick={(e) => e.stopPropagation()}>
                 <div className="flex gap-2 w-full">
                   <Button 
                     variant="outline" 
                     className="flex-1 h-9 text-xs"
                     onClick={() => {
                        const amount = prompt("Enter amount to add:");
                        if (amount && !isNaN(Number(amount))) {
                          const newAmount = Number(goal.currentAmount) + Number(amount);
                          const willComplete = newAmount >= Number(goal.targetAmount);
                          const goalKey = `celebration_goal_completed_${goal.id}`;
                          updateMutation.mutate({ id: goal.id, currentAmount: newAmount.toString() }, {
                            onSuccess: () => {
                              captureEvent("goal_funds_added", { amount_added: Number(amount) });
                              if (willComplete && !localStorage.getItem(goalKey)) {
                                localStorage.setItem(goalKey, "1");
                                celebrate("full");
                                setCompletedGoal({ title: goal.title });
                              }
                            },
                          });
                        }
                     }}
                   >
                     <Plus className="w-3 h-3 mr-1" /> Add Funds
                   </Button>
                 </div>
              </CardFooter>
            </Card>
          );
        })}

        {goals?.length === 0 && (
          <div className="col-span-full text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-lg">No goals yet</h3>
            <p className="text-muted-foreground mb-4">Start saving for something special.</p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Create Goal</Button>
          </div>
        )}
      </div>

      <CreateGoalDialog 
        open={isCreateOpen || !!editingGoal} 
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingGoal(null);
        }} 
        editingGoal={editingGoal}
      />

      <Dialog open={!!completedGoal} onOpenChange={(open) => { if (!open) setCompletedGoal(null); }}>
        <DialogContent className="max-w-sm rounded-2xl text-center" data-testid="dialog-goal-completed">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/25">
              <PartyPopper className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-bold text-2xl" data-testid="text-goal-completed-title">You did it!</h2>
              {completedGoal && (
                <p className="text-muted-foreground text-base">
                  You've fully saved for <span className="font-semibold text-foreground">{completedGoal.title}</span>. That took real commitment.
                </p>
              )}
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={() => setCompletedGoal(null)}
              data-testid="button-goal-completed-close"
            >
              Keep going!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateGoalDialog({ 
  open, 
  onOpenChange, 
  editingGoal 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  editingGoal?: any;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [visibility, setVisibility] = useState<"private" | "shared" | "family">("private");
  const [file, setFile] = useState<File | null>(null);
  const { user } = useAuth();
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const uploadMutation = useUpload();
  const currencySymbol = getCurrencySymbol(user?.currency);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTarget(editingGoal.targetAmount.toString());
      setDeadline(editingGoal.deadline ? format(new Date(editingGoal.deadline), "yyyy-MM-dd") : "");
      setNote(editingGoal.note || "");
      setPriority(editingGoal.priority || "medium");
      setVisibility(editingGoal.visibility || "private");
    } else {
      setTitle("");
      setTarget("");
      setDeadline("");
      setNote("");
      setPriority("medium");
      setVisibility("private");
    }
    setFile(null);
  }, [editingGoal, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !target) return;

    let photoUrl = editingGoal?.photoUrl;
    if (file) {
      try {
        const uploadRes = await uploadMutation.mutateAsync(file);
        photoUrl = uploadRes.url;
      } catch (e) {
        console.error("[Goal] Upload failed", e);
      }
    }

    const goalData = {
      title,
      targetAmount: target,
      deadline: deadline ? new Date(deadline) : null,
      note,
      priority,
      visibility,
      photoUrl,
    };

    if (editingGoal) {
      updateMutation.mutate({
        ...goalData,
        id: editingGoal.id,
      } as any, {
        onSuccess: () => {
          captureEvent("goal_edited");
          onOpenChange(false);
        }
      });
    } else {
      createMutation.mutate({
        ...goalData,
        currentAmount: "0",
        userId: 1,
      } as any, {
        onSuccess: () => {
          captureEvent("goal_created", {
            has_deadline: !!deadline,
            has_photo: !!file,
            target_amount: Number(target),
          });
          onOpenChange(false);
          setTitle("");
          setTarget("");
          setDeadline("");
          setNote("");
          setVisibility("private");
          setFile(null);
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingGoal ? "Edit Goal" : "Set a New Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Goal Title</Label>
            <Input 
              placeholder="e.g. New Bike" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Amount ({currencySymbol})</Label>
            <Input 
              type="number" 
              placeholder="500" 
              value={target} 
              onChange={(e) => setTarget(e.target.value)} 
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as GoalPriority)}>
              <SelectTrigger className="rounded-xl" data-testid="select-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High (Top Priority)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "private" | "shared" | "family")}>
              <SelectTrigger className="rounded-xl" data-testid="select-visibility">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="private">
                  <span className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Private - Only you can see</span>
                  </span>
                </SelectItem>
                <SelectItem value="shared">
                  <span className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Shared - Visible to family</span>
                  </span>
                </SelectItem>
                <SelectItem value="family">
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Family Goal - Needs approval</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {visibility === "private" && "This goal is private and only visible to you."}
              {visibility === "shared" && "Your family can see this goal but it remains personal."}
              {visibility === "family" && "This becomes a collaborative family goal. Requires approval from a parent."}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Deadline (Optional)</Label>
            <Input 
              type="date" 
              value={deadline} 
              onChange={(e) => setDeadline(e.target.value)} 
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input 
              placeholder="Add a note..." 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Photo (Optional)</Label>
            <div className="flex items-center gap-4">
              <Button 
                type="button"
                variant="outline" 
                className="flex-1 rounded-xl h-12"
                onClick={() => document.getElementById('goal-photo-upload')?.click()}
              >
                {file ? <span className="text-primary font-medium truncate">{file.name}</span> : <><Camera className="mr-2 h-4 w-4" /> Add Photo</>}
              </Button>
              <input 
                id="goal-photo-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f) captureEvent("goal_photo_uploaded");
                }}
              />
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl h-12 text-lg font-bold" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : (editingGoal ? "Save Changes" : "Create Goal")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

