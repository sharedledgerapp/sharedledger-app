import { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { captureEvent } from "@/lib/analytics";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currency";
import { TUTORIAL_STORAGE_KEY } from "@/lib/tutorial-steps";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Html5Qrcode } from "html5-qrcode";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  PiggyBank,
  Bell,
  PartyPopper,
  Globe,
  DollarSign,
  User,
  BarChart3,
  Wallet,
  Loader2,
  Camera,
} from "lucide-react";

const TOTAL_STEPS = 11;

function extractInviteCode(raw: string): string {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("code");
    if (code) return code.toUpperCase().trim();
  } catch {}
  return raw.toUpperCase().trim();
}

function ProgressBar({ current }: { current: number }) {
  const pct = Math.round((current / TOTAL_STEPS) * 100);
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Step {current} of {TOTAL_STEPS}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  description?: string;
  testId?: string;
}

function OptionCard({ selected, onClick, icon, label, description, testId }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/8 shadow-md"
          : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      {icon && (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${selected ? "text-primary" : "text-foreground"}`}>{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</div>
        )}
      </div>
      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
    </button>
  );
}

interface StepWrapperProps {
  children: React.ReactNode;
  direction: number;
  stepKey: number;
}

function StepWrapper({ children, direction, stepKey }: StepWrapperProps) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [language, setLanguage] = useState<"en" | "fr" | "nl">(
    (user?.language as "en" | "fr" | "nl") || "en"
  );
  const [goal, setGoal] = useState<string>("");
  const [userName, setUserName] = useState(
    user?.name && user.name !== user?.username ? user.name : ""
  );
  const [currency, setCurrency] = useState(user?.currency || "EUR");
  const [personality, setPersonality] = useState<string>("");
  const [spendingInsights, setSpendingInsights] = useState<boolean | null>(null);
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState<"create" | "join" | "solo">("solo");
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupType, setGroupType] = useState<"family" | "roommates" | "couple">("family");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifTime, setNotifTime] = useState("19:00");
  const [currencySearch, setCurrencySearch] = useState("");
  const [assignedUserNumber, setAssignedUserNumber] = useState<number | null>(null);
  const [intention, setIntention] = useState<string>("");

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (user.onboardingCompleted) {
        setLocation("/app");
      }
    } else {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData([api.auth.me.path], updatedUser);
    },
  });

  const setupGroupMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/auth/setup-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to set up group");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData([api.auth.me.path], updatedUser);
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to complete onboarding");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData([api.auth.me.path], updatedUser);
      localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
      if (updatedUser.userNumber) {
        setAssignedUserNumber(updatedUser.userNumber);
      }
    },
  });

  const createBudgetsMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      await Promise.all(
        categories.map((category) =>
          fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category,
              amount: "500",
              periodType: "monthly",
              budgetScope: "personal",
              notificationsEnabled: false,
              thresholds: [],
            }),
            credentials: "include",
          })
        )
      );
    },
  });

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goPrev = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const goTo = (s: number) => {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const budgetSuggestions: Record<string, string[]> = {
    save: ["Groceries", "Dining Out", "Entertainment"],
    track: ["Food", "Transport", "Shopping"],
    split: ["Shared Meals", "Utilities", "Rent"],
    all: ["Groceries", "Transport", "Entertainment"],
  };
  const suggestedBudgets = budgetSuggestions[goal] || ["Groceries", "Dining Out", "Transport"];

  const handleStep1Continue = async () => {
    await updateProfileMutation.mutateAsync({ language });
    captureEvent("onboarding_language_selected", { language });
    goNext();
  };

  const handleStep2Continue = () => {
    captureEvent("onboarding_goal_selected", { goal });
    goNext();
  };

  const handleStep3Continue = async () => {
    await updateProfileMutation.mutateAsync({ name: userName });
    goNext();
  };

  const handleStep4Continue = async () => {
    await updateProfileMutation.mutateAsync({ currency });
    captureEvent("onboarding_currency_selected", { currency });
    goNext();
  };

  const handleStep5Continue = () => {
    captureEvent("onboarding_personality_selected", { personality });
    goNext();
  };

  const handleStep6Continue = (accepted: boolean) => {
    setSpendingInsights(accepted);
    captureEvent("onboarding_spending_insights_accepted", { accepted });
    goNext();
  };

  const handleStep7Continue = async () => {
    if (selectedBudgets.length > 0) {
      await createBudgetsMutation.mutateAsync(selectedBudgets);
    }
    captureEvent("onboarding_budgets_selected", { budgets: selectedBudgets, count: selectedBudgets.length });
    goNext();
  };

  const handleStep8Continue = async () => {
    if (groupMode === "create" && groupName) {
      try {
        await setupGroupMutation.mutateAsync({ groupName, groupType, role: groupType === "family" ? "parent" : "member" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to set up group";
        if (!message.includes("already in a group")) {
          toast({ title: "Group setup failed", description: message, variant: "destructive" });
          return;
        }
      }
    } else if (groupMode === "join" && groupCode) {
      try {
        await setupGroupMutation.mutateAsync({ groupCode });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not join group";
        if (!message.includes("already in a group")) {
          toast({ title: "Could not join group", description: message, variant: "destructive" });
          return;
        }
      }
    }
    const groupEventProps: Record<string, unknown> = { mode: groupMode };
    if (groupMode === "create") groupEventProps.group_type = groupType;
    captureEvent("onboarding_group_setup", groupEventProps);
    goNext();
  };

  const handleStep9Continue = async () => {
    await updateProfileMutation.mutateAsync({
      dailyReminderEnabled: notifEnabled,
      dailyReminderTime: notifTime,
    });
    if (notifEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    const notifEventProps: Record<string, unknown> = { enabled: notifEnabled };
    if (notifEnabled) notifEventProps.reminder_time = notifTime;
    captureEvent("onboarding_notifications_configured", notifEventProps);
    goNext();
  };

  const handleStep10Continue = async () => {
    if (intention.trim()) {
      await updateProfileMutation.mutateAsync({ onboardingIntention: intention.trim() });
      await fetch("/api/intention-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
        credentials: "include",
      });
    }
    captureEvent("onboarding_intention_set", { has_intention: !!intention.trim() });
    goNext();
  };

  const handleFinish = (destination: "/app" | "/app/goals") => {
    captureEvent("onboarding_completed", { destination: destination === "/app" ? "expense_log" : "goals" });
    setLocation(destination);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/8 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/8 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-6">
        <div className="space-y-3">
          <ProgressBar current={step} />
          {step === 1 && (
            <p className="text-xs text-center text-muted-foreground">Takes about 2 minutes</p>
          )}
        </div>

        <div className="overflow-hidden">
          <StepWrapper direction={direction} stepKey={step}>
            {step === 1 && (
              <Step1Language
                language={language}
                setLanguage={setLanguage}
                onSelect={(l) => updateProfileMutation.mutate({ language: l })}
                onContinue={handleStep1Continue}
                isPending={updateProfileMutation.isPending}
              />
            )}
            {step === 2 && (
              <Step2Goal
                goal={goal}
                setGoal={setGoal}
                onContinue={handleStep2Continue}
                onBack={goPrev}
              />
            )}
            {step === 3 && (
              <Step3Name
                userName={userName}
                setUserName={setUserName}
                onContinue={handleStep3Continue}
                onBack={goPrev}
                isPending={updateProfileMutation.isPending}
              />
            )}
            {step === 4 && (
              <Step4Currency
                currency={currency}
                setCurrency={setCurrency}
                currencySearch={currencySearch}
                setCurrencySearch={setCurrencySearch}
                filteredCurrencies={filteredCurrencies}
                onSelect={(c) => updateProfileMutation.mutate({ currency: c })}
                onContinue={handleStep4Continue}
                onBack={goPrev}
                isPending={updateProfileMutation.isPending}
              />
            )}
            {step === 5 && (
              <Step5Personality
                personality={personality}
                setPersonality={setPersonality}
                onContinue={handleStep5Continue}
                onBack={goPrev}
              />
            )}
            {step === 6 && (
              <Step6SpendingInsights
                onAccept={() => handleStep6Continue(true)}
                onSkip={() => handleStep6Continue(false)}
                onBack={goPrev}
              />
            )}
            {step === 7 && (
              <Step7Budget
                suggestedBudgets={suggestedBudgets}
                selectedBudgets={selectedBudgets}
                setSelectedBudgets={setSelectedBudgets}
                onContinue={handleStep7Continue}
                onBack={goPrev}
                isPending={createBudgetsMutation.isPending}
                currency={currency}
              />
            )}
            {step === 8 && (
              <Step8Group
                groupMode={groupMode}
                setGroupMode={setGroupMode}
                groupName={groupName}
                setGroupName={setGroupName}
                groupCode={groupCode}
                setGroupCode={setGroupCode}
                groupType={groupType}
                setGroupType={setGroupType}
                onContinue={handleStep8Continue}
                onBack={goPrev}
                isPending={setupGroupMutation.isPending}
                alreadyInGroup={!!user?.familyId}
              />
            )}
            {step === 9 && (
              <Step9Notifications
                notifEnabled={notifEnabled}
                setNotifEnabled={setNotifEnabled}
                notifTime={notifTime}
                setNotifTime={setNotifTime}
                onContinue={handleStep9Continue}
                onBack={goPrev}
                isPending={updateProfileMutation.isPending}
              />
            )}
            {step === 10 && (
              <Step10Intention
                intention={intention}
                setIntention={setIntention}
                groupMode={groupMode}
                onContinue={handleStep10Continue}
                onBack={goPrev}
                isPending={updateProfileMutation.isPending}
              />
            )}
            {step === 11 && (
              <Step11Celebration
                userName={userName}
                userNumber={assignedUserNumber}
                onLogExpense={() => handleFinish("/app")}
                onSetGoal={() => handleFinish("/app/goals")}
                onMount={() => completeOnboardingMutation.mutate()}
                isPending={completeOnboardingMutation.isPending}
                isError={completeOnboardingMutation.isError}
                onRetry={() => completeOnboardingMutation.mutate()}
              />
            )}
          </StepWrapper>
        </div>
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle, note }: { title: string; subtitle?: string; note?: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h2 className="font-display font-bold text-2xl text-foreground">{title}</h2>
      {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      {note && (
        <p className="text-xs text-muted-foreground italic mt-2">
          {note}
        </p>
      )}
    </div>
  );
}

function NavButtons({
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Continue",
  isPending,
  showBack = true,
}: {
  onBack?: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  isPending?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {showBack && onBack && (
        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 w-12 rounded-xl p-0 shrink-0"
          data-testid="button-onboarding-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      )}
      <Button
        onClick={onContinue}
        disabled={continueDisabled || isPending}
        className="flex-1 h-12 rounded-xl font-semibold shadow-lg shadow-primary/20"
        data-testid="button-onboarding-continue"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            {continueLabel}
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </div>
  );
}

function Step1Language({
  language,
  setLanguage,
  onSelect,
  onContinue,
  isPending,
}: {
  language: string;
  setLanguage: (l: "en" | "fr" | "nl") => void;
  onSelect: (l: "en" | "fr" | "nl") => void;
  onContinue: () => void;
  isPending: boolean;
}) {
  return (
    <div>
      <StepHeader
        title="Choose your language"
        subtitle="Select your preferred language for the app."
        note="You can always change this later in Settings."
      />
      <div className="space-y-3">
        {[
          { code: "en" as const, label: "English", emoji: "🇬🇧" },
          { code: "fr" as const, label: "Français", emoji: "🇫🇷" },
          { code: "nl" as const, label: "Nederlands", emoji: "🇳🇱" },
        ].map((lang) => (
          <OptionCard
            key={lang.code}
            selected={language === lang.code}
            onClick={() => { setLanguage(lang.code); onSelect(lang.code); }}
            icon={<Globe className="w-5 h-5" />}
            label={`${lang.emoji}  ${lang.label}`}
            testId={`option-language-${lang.code}`}
          />
        ))}
      </div>
      <NavButtons onContinue={onContinue} isPending={isPending} showBack={false} />
    </div>
  );
}

function Step2Goal({
  goal,
  setGoal,
  onContinue,
  onBack,
}: {
  goal: string;
  setGoal: (g: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const options = [
    { key: "save", label: "Save more money", description: "Build savings habits and reach financial goals.", icon: <PiggyBank className="w-5 h-5" /> },
    { key: "track", label: "Track where my money goes", description: "See exactly where everything ends up.", icon: <TrendingUp className="w-5 h-5" /> },
    { key: "split", label: "Split bills with others", description: "Manage shared expenses with flatmates, family or friends.", icon: <Users className="w-5 h-5" /> },
    { key: "all", label: "All of the above", description: "I want the full package.", icon: <Sparkles className="w-5 h-5" /> },
  ];

  return (
    <div>
      <StepHeader
        title="What brings you here?"
        subtitle="This helps us personalise your experience."
      />
      <div className="space-y-3">
        {options.map((opt) => (
          <OptionCard
            key={opt.key}
            selected={goal === opt.key}
            onClick={() => setGoal(opt.key)}
            icon={opt.icon}
            label={opt.label}
            description={opt.description}
            testId={`option-goal-${opt.key}`}
          />
        ))}
      </div>
      <NavButtons onBack={onBack} onContinue={onContinue} continueDisabled={!goal} />
    </div>
  );
}

function Step3Name({
  userName,
  setUserName,
  onContinue,
  onBack,
  isPending,
}: {
  userName: string;
  setUserName: (n: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <div>
      <StepHeader
        title="What's your name?"
        subtitle="This is how you'll appear to others."
        note="You can always change this later in Settings."
      />
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="h-12 rounded-xl pl-10"
          placeholder="Your name"
          data-testid="input-onboarding-name"
        />
      </div>
      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        continueDisabled={!userName.trim()}
        isPending={isPending}
      />
    </div>
  );
}

function Step4Currency({
  currency,
  setCurrency,
  currencySearch,
  setCurrencySearch,
  filteredCurrencies,
  onSelect,
  onContinue,
  onBack,
  isPending,
}: {
  currency: string;
  setCurrency: (c: string) => void;
  currencySearch: string;
  setCurrencySearch: (s: string) => void;
  filteredCurrencies: typeof CURRENCIES;
  onSelect: (c: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <div>
      <StepHeader
        title="Pick your currency"
        subtitle="All amounts will be displayed in this currency."
        note="You can always change this later in Settings."
      />
      <div className="relative mb-3">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={currencySearch}
          onChange={(e) => setCurrencySearch(e.target.value)}
          className="h-11 rounded-xl pl-10"
          placeholder="Search currencies..."
          data-testid="input-currency-search"
        />
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {filteredCurrencies.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => { setCurrency(c.code); onSelect(c.code); }}
            data-testid={`option-currency-${c.code}`}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
              currency === c.code
                ? "border-primary bg-primary/8"
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            <span className={`font-mono font-bold text-sm min-w-10 ${currency === c.code ? "text-primary" : "text-muted-foreground"}`}>
              {c.symbol}
            </span>
            <span className="flex-1 text-sm font-medium">{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.code}</span>
            {currency === c.code && <Check className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </div>
      <NavButtons onBack={onBack} onContinue={onContinue} isPending={isPending} />
    </div>
  );
}

function Step5Personality({
  personality,
  setPersonality,
  onContinue,
  onBack,
}: {
  personality: string;
  setPersonality: (p: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const options = [
    {
      key: "spender",
      label: "Free spender",
      description: "I spend freely and figure things out later.",
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      key: "tracker",
      label: "Obsessive tracker",
      description: "I track every single purchase to the cent.",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      key: "middle",
      label: "Somewhere in between",
      description: "I try to keep an eye on spending without stressing.",
      icon: <Target className="w-5 h-5" />,
    },
  ];

  return (
    <div>
      <StepHeader
        title="Your financial personality"
        subtitle="There's no wrong answer — just pick what fits you best!"
      />
      <div className="space-y-3">
        {options.map((opt) => (
          <OptionCard
            key={opt.key}
            selected={personality === opt.key}
            onClick={() => setPersonality(opt.key)}
            icon={opt.icon}
            label={opt.label}
            description={opt.description}
            testId={`option-personality-${opt.key}`}
          />
        ))}
      </div>
      <NavButtons onBack={onBack} onContinue={onContinue} continueDisabled={!personality} />
    </div>
  );
}

function Step6SpendingInsights({
  onAccept,
  onSkip,
  onBack,
}: {
  onAccept: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeader
        title="Understand your spending"
        subtitle="Want to see where your money really goes?"
      />
      <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 border border-primary/15">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Spending Insights</div>
            <div className="text-xs text-muted-foreground">Visual breakdown of your habits</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "Food & Dining", width: "65%", color: "bg-primary" },
            { label: "Transport", width: "40%", color: "bg-accent" },
            { label: "Entertainment", width: "25%", color: "bg-emerald-500" },
          ].map((bar) => (
            <div key={bar.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">{bar.label}</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${bar.color} rounded-full`} style={{ width: bar.width }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Button
          onClick={onAccept}
          className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/20"
          data-testid="button-spending-insights-yes"
        >
          <span className="flex items-center gap-2">
            Yes, show me! <ChevronRight className="w-4 h-4" />
          </span>
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full h-10 rounded-xl text-muted-foreground"
          data-testid="button-spending-insights-skip"
        >
          Skip for now
        </Button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
        data-testid="button-onboarding-back-step6"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>
    </div>
  );
}

function Step7Budget({
  suggestedBudgets,
  selectedBudgets,
  setSelectedBudgets,
  onContinue,
  onBack,
  isPending,
  currency,
}: {
  suggestedBudgets: string[];
  selectedBudgets: string[];
  setSelectedBudgets: (b: string[]) => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
  currency: string;
}) {
  const toggle = (cat: string) => {
    setSelectedBudgets(
      selectedBudgets.includes(cat)
        ? selectedBudgets.filter((c) => c !== cat)
        : [...selectedBudgets, cat]
    );
  };

  return (
    <div>
      <StepHeader
        title="Start with a first budget"
        subtitle="We've suggested some categories based on your goal. You can add more later."
        note="You can always change this later in Settings."
      />
      <div className="space-y-3 mb-4">
        {suggestedBudgets.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            data-testid={`option-budget-${cat.toLowerCase().replace(/ /g, "-")}`}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
              selectedBudgets.includes(cat)
                ? "border-primary bg-primary/8 shadow-md"
                : "border-border bg-background hover:border-primary/40 hover:bg-muted/50"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                selectedBudgets.includes(cat)
                  ? "bg-primary border-primary"
                  : "border-border"
              }`}
            >
              {selectedBudgets.includes(cat) && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="font-medium text-sm">{cat}</span>
            <span className="ml-auto text-xs text-muted-foreground">{getCurrencySymbol(currency)}500/mo</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 w-12 rounded-xl p-0 shrink-0"
          data-testid="button-onboarding-back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          onClick={onContinue}
          disabled={isPending}
          className="flex-1 h-12 rounded-xl font-semibold shadow-lg shadow-primary/20"
          data-testid="button-onboarding-continue"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : selectedBudgets.length > 0 ? (
            <span className="flex items-center gap-2">
              Add {selectedBudgets.length} budget{selectedBudgets.length > 1 ? "s" : ""} <ChevronRight className="w-4 h-4" />
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Do this later <ChevronRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function OnboardingQrScannerDialog({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (code: string) => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setError(null);
    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted || !scannerRef.current) return;
      const scannerId = "onboarding-qr-scanner-region";
      scannerRef.current.id = scannerId;
      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;
      const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } };
      const onSuccess = (decodedText: string) => {
        onScan(decodedText);
        stopScanner();
      };
      try {
        await scanner.start({ facingMode: "environment" }, scanConfig, onSuccess, () => {});
      } catch {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices.length > 0) {
            await scanner.start(devices[0].id, scanConfig, onSuccess, () => {});
          } else if (mounted) {
            setError("Camera unavailable");
          }
        } catch {
          if (mounted) setError("Camera unavailable or permission denied");
        }
      }
    };
    const timer = setTimeout(startScanner, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopScanner(); onClose(); } }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Camera className="w-5 h-5 text-primary" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          {error ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { stopScanner(); onClose(); }} data-testid="button-close-onboarding-scanner">
                Close
              </Button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div ref={scannerRef} className="w-full" />
              <p className="text-center text-xs text-muted-foreground mt-2 pb-2">
                Point camera at the QR code
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step8Group({
  groupMode,
  setGroupMode,
  groupName,
  setGroupName,
  groupCode,
  setGroupCode,
  groupType,
  setGroupType,
  onContinue,
  onBack,
  isPending,
  alreadyInGroup,
}: {
  groupMode: "create" | "join" | "solo";
  setGroupMode: (m: "create" | "join" | "solo") => void;
  groupName: string;
  setGroupName: (n: string) => void;
  groupCode: string;
  setGroupCode: (c: string) => void;
  groupType: "family" | "roommates" | "couple";
  setGroupType: (t: "family" | "roommates" | "couple") => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
  alreadyInGroup: boolean;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const pending = localStorage.getItem("pending_invite_code");
    if (pending && !alreadyInGroup) {
      const code = pending.toUpperCase().trim();
      localStorage.removeItem("pending_invite_code");
      setGroupMode("join");
      setGroupCode(code);
      captureEvent("join_page_code_prefilled", { source: "join_page" });
    }
  }, []);

  if (alreadyInGroup) {
    return (
      <div>
        <StepHeader
          title="Group or solo?"
          subtitle="You're already in a group — great!"
        />
        <div className="bg-muted/50 rounded-2xl p-5 flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Group set up</div>
            <div className="text-xs text-muted-foreground">You already have a group configured.</div>
          </div>
        </div>
        <NavButtons onBack={onBack} onContinue={onContinue} isPending={isPending} />
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        title="Group or solo?"
        subtitle="SharedLedger works great for individuals and groups alike."
      />
      <div className="flex gap-2 mb-5">
        {(["create", "join", "solo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setGroupMode(m)}
            data-testid={`button-group-mode-${m}`}
            className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all capitalize ${
              groupMode === m
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            {m === "create" ? "Create" : m === "join" ? "Join" : "Solo"}
          </button>
        ))}
      </div>

      {groupMode === "create" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["family", "roommates", "couple"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setGroupType(t)}
                data-testid={`button-group-type-${t}`}
                className={`py-2.5 rounded-xl border text-xs font-medium transition-all capitalize ${
                  groupType === t
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {t === "roommates" ? "Roommates" : t === "couple" ? "Couple" : "Family"}
              </button>
            ))}
          </div>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (e.g. The Smiths)"
            className="h-11 rounded-xl"
            data-testid="input-group-name"
          />
        </div>
      )}

      {groupMode === "join" && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Invite Code</Label>
          <div className="flex gap-2">
            <Input
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value)}
              placeholder="GRP-1234"
              className="h-11 rounded-xl font-mono flex-1"
              autoComplete="off"
              data-testid="input-group-code"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
              onClick={() => setScannerOpen(true)}
              data-testid="button-onboarding-scan-qr"
              title="Scan QR Code"
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
          <OnboardingQrScannerDialog
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={(raw) => {
              setGroupCode(extractInviteCode(raw));
              setScannerOpen(false);
            }}
          />
        </div>
      )}

      {groupMode === "solo" && (
        <div className="bg-muted/50 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            You'll use SharedLedger as a personal finance tracker. You can always join or create a group later.
          </p>
        </div>
      )}

      <NavButtons onBack={onBack} onContinue={onContinue} isPending={isPending} />
    </div>
  );
}

function Step9Notifications({
  notifEnabled,
  setNotifEnabled,
  notifTime,
  setNotifTime,
  onContinue,
  onBack,
  isPending,
}: {
  notifEnabled: boolean;
  setNotifEnabled: (e: boolean) => void;
  notifTime: string;
  setNotifTime: (t: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <div>
      <StepHeader
        title="Daily nudge"
        subtitle="Get a daily reminder to log your expenses and stay on top of your budget."
        note="You can always change this later in Settings."
      />
      <div className="bg-gradient-to-br from-primary/8 to-accent/8 rounded-2xl p-5 mb-5 border border-primary/15">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">Daily expense reminder</div>
            <div className="text-xs text-muted-foreground">A gentle nudge at your preferred time</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNotifEnabled(true)}
            data-testid="button-notif-enable"
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              notifEnabled
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => setNotifEnabled(false)}
            data-testid="button-notif-disable"
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              !notifEnabled
                ? "bg-muted text-muted-foreground border-border"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            Skip
          </button>
        </div>
      </div>

      {notifEnabled && (
        <div className="mb-5">
          <label className="text-sm font-medium text-foreground block mb-2">
            Reminder time
          </label>
          <input
            type="time"
            value={notifTime}
            onChange={(e) => setNotifTime(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="input-notif-time"
          />
        </div>
      )}

      <NavButtons onBack={onBack} onContinue={onContinue} isPending={isPending} />
    </div>
  );
}

function Step10Intention({
  intention,
  setIntention,
  groupMode,
  onContinue,
  onBack,
  isPending,
}: {
  intention: string;
  setIntention: (v: string) => void;
  groupMode: "create" | "join" | "solo";
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  const isGroup = groupMode === "create" || groupMode === "join";
  const title = isGroup
    ? "One last thing — your reason"
    : "One last thing — your reason";
  const subtitle = isGroup
    ? groupMode === "create"
      ? "What's your reason for tracking finances together? The other members will be asked the same when they join."
      : "What's your reason for tracking finances together with this group?"
    : "In 3 months, what would have to be true about your finances for you to feel like this was worth it?";

  return (
    <div>
      <div className="mb-5">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h2 className="font-display font-bold text-2xl text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 mb-5">
        <p className="text-xs text-primary font-medium mb-1">Why this matters</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your answer becomes your personal benchmark. Three months from now, Sage will look back at what you wrote here and show you exactly how far you've come — not just in numbers, but in the habits that matter to you.
        </p>
      </div>

      <div className="mb-2">
        <textarea
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder={isGroup ? "e.g. I want us to be more transparent about who pays what…" : "e.g. I want to stop feeling like money just disappears every month…"}
          maxLength={500}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-muted-foreground/60"
          data-testid="input-onboarding-intention"
        />
        <p className="text-right text-xs text-muted-foreground mt-1">{intention.length}/500</p>
      </div>

      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        continueLabel={intention.trim() ? "Save & continue" : "Skip for now"}
        isPending={isPending}
      />
    </div>
  );
}

function Step11Celebration({
  userName,
  userNumber,
  onLogExpense,
  onSetGoal,
  onMount,
  isPending,
  isError,
  onRetry,
}: {
  userName: string;
  userNumber: number | null;
  onLogExpense: () => void;
  onSetGoal: () => void;
  onMount: () => void;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const firstName = userName.split(" ")[0] || userName;
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    onMount();

    const fireConfetti = () => {
      const count = 80;
      const defaults = { startVelocity: 30, spread: 55, ticks: 60, zIndex: 9999 };
      confetti({ ...defaults, particleCount: count, origin: { x: 0, y: 0.6 }, angle: 60 });
      confetti({ ...defaults, particleCount: count, origin: { x: 1, y: 0.6 }, angle: 120 });
    };

    fireConfetti();
    const timer = setTimeout(fireConfetti, 400);
    return () => clearTimeout(timer);
  }, []);

  const welcomeMessage = userNumber
    ? userNumber <= 200
      ? `You are user #${userNumber} of our first 200.`
      : `Welcome to the community!`
    : null;

  const ctasDisabled = isPending || isError;

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="w-24 h-24 bg-gradient-to-tr from-primary to-accent rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-primary/25 mb-6"
      >
        <PartyPopper className="w-12 h-12 text-white" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3 mb-8"
      >
        <h2 className="font-display font-bold text-3xl text-foreground">
          You're all set, {firstName}!
        </h2>
        {welcomeMessage && (
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="text-primary font-semibold text-sm"
            data-testid="text-celebration-user-number"
          >
            {welcomeMessage}
          </motion.p>
        )}
        <p className="text-muted-foreground">
          Your account is personalised and ready to go. What would you like to do first?
        </p>
      </motion.div>

      {isError && (
        <div className="mb-4 text-sm text-destructive flex flex-col items-center gap-2">
          <span>Something went wrong finalising your account.</span>
          <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-celebration-retry">
            Try again
          </Button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <Button
          onClick={onLogExpense}
          disabled={ctasDisabled}
          className="w-full h-14 rounded-2xl font-semibold text-base shadow-xl shadow-primary/25"
          data-testid="button-celebration-log-expense"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Log my first expense
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onSetGoal}
          disabled={ctasDisabled}
          className="w-full h-14 rounded-2xl font-semibold text-base"
          data-testid="button-celebration-set-goal"
        >
          <span className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Set a savings goal
          </span>
        </Button>
      </motion.div>
    </div>
  );
}
