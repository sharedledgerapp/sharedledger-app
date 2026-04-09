import { useState, useEffect } from "react";
import { X, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const BANNER_KEY = "whats_new_income_v1";

export function WhatsNewBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(BANNER_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, [user]);

  const dismiss = () => {
    localStorage.setItem(BANNER_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 left-0 right-0 z-40 px-4 pb-safe animate-in slide-in-from-bottom-4 duration-300"
      data-testid="banner-whats-new-income"
    >
      <div className="max-w-md mx-auto bg-primary text-primary-foreground rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">New: Income Tracking</p>
          <p className="text-xs text-primary-foreground/80 leading-relaxed mt-0.5">
            Log your salary, freelance income, or one-off payments under <strong className="text-primary-foreground">Money In</strong> on the Expenses page. Families and couples can share income privately.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 mt-0.5 p-1 rounded-lg hover:bg-white/20 transition-colors"
          data-testid="button-dismiss-whats-new-income"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
