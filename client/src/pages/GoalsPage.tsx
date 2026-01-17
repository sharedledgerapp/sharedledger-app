import { useState, useEffect } from "react";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useUpload } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trophy, Target, Trash2, Loader2, Save, Calendar, FileText, Camera } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { InsertGoal } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);

  const deleteMutation = useDeleteGoal();
  const updateMutation = useUpdateGoal();

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-bold text-3xl">Goals</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full shadow-lg shadow-primary/25">
          <Plus className="w-5 h-5 mr-2" /> New Goal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <p className="text-muted-foreground">Loading goals...</p>
        ) : goals?.map((goal) => {
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
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{goal.title}</h3>
                      {goal.isFamilyGoal && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Family Goal</span>
                      )}
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
                    <span>${Number(goal.currentAmount).toLocaleString()} saved</span>
                    <span className="text-muted-foreground">of ${Number(goal.targetAmount).toLocaleString()}</span>
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
                          updateMutation.mutate({ id: goal.id, currentAmount: newAmount.toString() });
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
  const [file, setFile] = useState<File | null>(null);
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const uploadMutation = useUpload();

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTarget(editingGoal.targetAmount.toString());
      setDeadline(editingGoal.deadline ? format(new Date(editingGoal.deadline), "yyyy-MM-dd") : "");
      setNote(editingGoal.note || "");
    } else {
      setTitle("");
      setTarget("");
      setDeadline("");
      setNote("");
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
      photoUrl,
    };

    if (editingGoal) {
      updateMutation.mutate({
        ...goalData,
        id: editingGoal.id,
      } as any, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    } else {
      createMutation.mutate({
        ...goalData,
        currentAmount: "0",
        userId: 1, // Ignored by backend/schema default
        isFamilyGoal: false, // Could add checkbox
      } as any, {
        onSuccess: () => {
          onOpenChange(false);
          setTitle("");
          setTarget("");
          setDeadline("");
          setNote("");
          setFile(null);
        }
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
            <Label>Target Amount ($)</Label>
            <Input 
              type="number" 
              placeholder="500" 
              value={target} 
              onChange={(e) => setTarget(e.target.value)} 
              className="rounded-xl"
            />
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
                onChange={(e) => setFile(e.target.files?.[0] || null)}
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

