import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Eye, Lock, RefreshCw } from "lucide-react";

const ONBOARDING_SEEN_KEY = "sharedledger_onboarding_seen";

interface FamilyOnboardingModalProps {
  userId: number | undefined;
}

export function FamilyOnboardingModal({ userId }: FamilyOnboardingModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const seenKey = `${ONBOARDING_SEEN_KEY}_${userId}`;
    const hasSeen = localStorage.getItem(seenKey);
    
    if (!hasSeen) {
      setOpen(true);
    }
  }, [userId]);

  const handleClose = () => {
    if (userId) {
      const seenKey = `${ONBOARDING_SEEN_KEY}_${userId}`;
      localStorage.setItem(seenKey, "true");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="dialog-onboarding">
        <DialogHeader className="text-center pb-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-display">Welcome to SharedLedger</DialogTitle>
          <DialogDescription className="text-base">
            Here's how privacy and sharing work in your group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-secondary/50 flex-shrink-0 flex items-center justify-center">
              <Lock className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Your dashboard is private</h4>
              <p className="text-sm text-muted-foreground">
                Your personal expenses and goals are only visible to you by default.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-secondary/50 flex-shrink-0 flex items-center justify-center">
              <Eye className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Group dashboard shows shared totals</h4>
              <p className="text-sm text-muted-foreground">
                Only expenses you choose to share will appear in the group view.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-secondary/50 flex-shrink-0 flex items-center justify-center">
              <Shield className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Details are never shared without consent</h4>
              <p className="text-sm text-muted-foreground">
                Expense details only appear when you explicitly share them with your group.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-secondary/50 flex-shrink-0 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Change your choices anytime</h4>
              <p className="text-sm text-muted-foreground">
                You can update sharing settings on any expense whenever you want.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleClose} 
          className="w-full h-12 rounded-xl text-md font-semibold shadow-lg shadow-primary/25"
          data-testid="button-got-it"
        >
          Got it, let's go!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
