import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { captureEvent } from "@/lib/analytics";

const BANNER_KEY = "sl_sage_intro_v1";

export function SageIntroBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) return;
    if (!localStorage.getItem(BANNER_KEY)) {
      const timer = setTimeout(() => {
        setVisible(true);
        captureEvent("sage_intro_banner_shown");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(BANNER_KEY, "1");
    setVisible(false);
    captureEvent("sage_intro_banner_dismissed");
  };

  const trySage = () => {
    localStorage.setItem(BANNER_KEY, "1");
    setVisible(false);
    captureEvent("sage_intro_banner_try_tapped");
    setLocation("/app/messages");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-safe animate-in slide-in-from-bottom-4 duration-400"
      data-testid="banner-sage-intro"
    >
      <div className="max-w-md mx-auto rounded-2xl shadow-2xl shadow-violet-500/30 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 to-primary p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-white animate-sparkle" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                Meet Sage — your in-house accountant
              </p>
              <p className="text-xs text-white/80 leading-relaxed mt-1">
                Sage reads your real expenses, income, and budgets to give you personalised insights — monthly reviews, mid-month check-ins, and answers to any question about your money.
              </p>
              <p className="text-xs text-white/65 mt-1.5">
                Find it in <strong className="text-white/90">Messages → Sage tab</strong>
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 mt-0.5 p-1 rounded-lg hover:bg-white/20 transition-colors"
              data-testid="button-dismiss-sage-intro"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 pl-12">
            <Button
              size="sm"
              onClick={trySage}
              className="bg-white text-primary hover:bg-white/90 h-8 text-xs font-semibold px-4 rounded-xl shadow-sm"
              data-testid="button-sage-intro-try"
            >
              <Sparkles className="w-3 h-3 mr-1.5" />
              Try Sage
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              className="text-white/70 hover:text-white hover:bg-white/15 h-8 text-xs px-3 rounded-xl"
              data-testid="button-sage-intro-got-it"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
