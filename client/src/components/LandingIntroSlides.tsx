import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Wallet, PieChart, Trophy, Bell, BarChart3,
  ChevronRight, ChevronLeft, X, Download, Share2, Plus,
  CheckCircle2, Smartphone, ShieldCheck, Sparkles,
  ArrowRight, Globe, RefreshCw, Home, UserPlus, Layers, Star,
} from "lucide-react";

/* ─── Device detection ─── */
function useDeviceState() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  const isInApp = /(Instagram|FBAN|FBAV|WhatsApp|Snapchat|Twitter|LinkedIn)/i.test(ua);
  const isPWA =
    typeof window !== "undefined" && (window.navigator as any).standalone === true;
  const isNativeSafari = isIOS && !isChromeIOS && !isFirefoxIOS && !isInApp && !isPWA;
  return { isIOS, isAndroid, isChromeIOS, isInApp, isNativeSafari, isPWA };
}

/* ─── Animation helpers ─── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ animation: `fade-up 0.5s ease-out ${delay}ms both` }}
    >
      {children}
    </div>
  );
}

function Highlight({
  children,
  delay = 300,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span className="relative inline">
      <span
        className="absolute inset-[-2px_-5px] bg-primary/15 rounded-md"
        style={{
          animation: `highlight-pop 0.45s ease-out ${delay}ms both`,
          transformOrigin: "left center",
        }}
      />
      <span className="relative font-bold text-primary">{children}</span>
    </span>
  );
}

function Circled({
  children,
  delay = 400,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span className="relative inline-block">
      <svg
        className="absolute pointer-events-none"
        style={{
          inset: "-8px -12px",
          width: "calc(100% + 24px)",
          height: "calc(100% + 16px)",
          overflow: "visible",
        }}
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
      >
        <ellipse
          cx="100"
          cy="20"
          rx="96"
          ry="18"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="320"
          style={{
            animation: `circle-draw 0.75s ease-out ${delay}ms both`,
          }}
        />
      </svg>
      <span className="relative font-bold">{children}</span>
    </span>
  );
}

/* ─── Shared slide wrapper ─── */
function SlideWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto w-full flex flex-col gap-6 py-4">
      {children}
    </div>
  );
}

/* ─── Slide icon badge ─── */
function SlideIcon({
  icon: Icon,
  gradient = "from-primary to-accent",
}: {
  icon: React.ElementType;
  gradient?: string;
}) {
  return (
    <FadeUp delay={0}>
      <div
        className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center shadow-lg shadow-primary/20 mx-auto`}
      >
        <Icon className="w-8 h-8 text-white" />
      </div>
    </FadeUp>
  );
}

/* ══════════════════════════════════════
   SLIDE 1 — Welcome
══════════════════════════════════════ */
function Slide1() {
  return (
    <SlideWrap>
      <SlideIcon icon={Users} />

      <div className="text-center">
        <FadeUp delay={80}>
          <Badge
            variant="secondary"
            className="mb-3 text-xs px-3 py-1 rounded-full"
          >
            Beta · Free to try
          </Badge>
        </FadeUp>
        <FadeUp delay={160}>
          <h1 className="font-display font-bold text-3xl text-foreground leading-tight">
            Track money <Circled delay={500}>together</Circled>
            <br />— or on your own
          </h1>
        </FadeUp>
        <FadeUp delay={280}>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            SharedLedger is a shared finance app for households, couples,
            roommates — and{" "}
            <Highlight delay={600}>solo users too</Highlight>. No group
            required to get started.
          </p>
        </FadeUp>
      </div>

      <FadeUp delay={400}>
        <div className="bg-white dark:bg-card rounded-2xl border border-border/50 shadow-sm p-5 space-y-3">
          {[
            "Track everyday expenses and recurring bills",
            "Set budgets and savings goals",
            "Get AI-powered financial insights with Sage",
            "Invite family or housemates when you're ready",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={520}>
        <p className="text-center text-xs text-muted-foreground italic">
          Currently in beta testing — free, actively improved, and open to
          feedback
        </p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 2 — Who it's for
══════════════════════════════════════ */
function Slide2() {
  const groups = [
    {
      icon: Users,
      name: "Families",
      desc: "Household budgets, shared costs, and goals everyone can see",
    },
    {
      icon: Star,
      name: "Couples",
      desc: "See who spent what, track shared goals, settle up easily",
    },
    {
      icon: Layers,
      name: "Roommates",
      desc: "Split bills, shared expenses, and who owes what",
    },
    {
      icon: Wallet,
      name: "Solo users",
      desc: "Personal finance without needing a group — start alone, expand later",
      highlight: true,
    },
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          Who's it for?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          You don't need a group to start — use it solo and invite others later
        </p>
      </FadeUp>

      <div className="space-y-3">
        {groups.map(({ icon: Icon, name, desc, highlight }, i) => (
          <FadeUp key={name} delay={100 + i * 100}>
            <div
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                highlight
                  ? "bg-primary/8 border-primary/25"
                  : "bg-white dark:bg-card border-border/50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  highlight
                    ? "bg-gradient-to-tr from-primary to-accent shadow-sm shadow-primary/20"
                    : "bg-muted"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
                />
              </div>
              <div>
                <p
                  className={`font-semibold text-sm ${highlight ? "text-primary" : "text-foreground"}`}
                >
                  {name}{" "}
                  {highlight && (
                    <span className="text-xs font-normal text-primary/70 ml-1">
                      — you can start right now
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 3 — Features
══════════════════════════════════════ */
function Slide3() {
  const features = [
    { icon: Wallet, text: "Log everyday expenses — or scan a receipt" },
    { icon: PieChart, text: "Budgets by category with overspend alerts" },
    { icon: Trophy, text: "Savings goals with progress tracking" },
    { icon: RefreshCw, text: "Recurring bills and subscriptions" },
    { icon: BarChart3, text: "Weekly and monthly spending insights" },
    { icon: Bell, text: "Balance board — who owes what in your group" },
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground">
          What you can do
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Everything to take control of your money
        </p>
      </FadeUp>

      <FadeUp delay={80}>
        <div className="grid grid-cols-1 gap-2.5">
          {features.map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white dark:bg-card rounded-xl border border-border/50 px-4 py-3"
              style={{ animation: `fade-up 0.4s ease-out ${120 + i * 70}ms both` }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-foreground">{text}</span>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={600}>
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Sage AI</span> — your personal
            financial advisor, built right into the app. More on this next →
          </p>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 4 — Sage AI
══════════════════════════════════════ */
function Slide4() {
  const questions = [
    "Why did I overspend this month?",
    "How can I save more on groceries?",
    "Am I on track with my savings goals?",
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 to-primary flex items-center justify-center shadow-lg shadow-primary/20 mx-auto">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </FadeUp>

      <FadeUp delay={100} className="text-center">
        <Badge className="mb-2 bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1 rounded-full">
          Beta feature · Powered by Gemini
        </Badge>
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          Meet <Highlight delay={400}>Sage</Highlight>
        </h2>
        <p className="text-muted-foreground mt-2 leading-relaxed text-sm">
          Your personal AI financial advisor — built into the app. Sage reads
          your actual spending data and gives you real, personalised guidance.
        </p>
      </FadeUp>

      <FadeUp delay={260}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
          Ask things like
        </p>
        <div className="space-y-2 mt-2">
          {questions.map((q, i) => (
            <div
              key={i}
              className="bg-white dark:bg-card rounded-2xl rounded-tl-sm border border-border/50 px-4 py-3 shadow-sm text-sm text-foreground"
              style={{ animation: `fade-up 0.4s ease-out ${340 + i * 100}ms both` }}
            >
              "{q}"
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={680}>
        <p className="text-xs text-muted-foreground text-center italic">
          Sage is available in the Messages tab inside the app. No extra
          sign-up needed.
        </p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 5 — No bank integration
══════════════════════════════════════ */
function Slide5() {
  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
      </FadeUp>

      <FadeUp delay={100} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          One important<br />thing to know
        </h2>
      </FadeUp>

      <FadeUp delay={220}>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-center">
          <p className="font-bold text-lg text-foreground leading-snug">
            SharedLedger does{" "}
            <Circled delay={500}>not connect</Circled>
            <br />to your bank account
          </p>
        </div>
      </FadeUp>

      <FadeUp delay={380}>
        <div className="bg-white dark:bg-card rounded-2xl border border-border/50 p-5 space-y-3">
          <p className="text-sm text-foreground font-semibold">
            You log expenses yourself — and here's why that's actually good:
          </p>
          {[
            "Your banking credentials never leave your device",
            "No third-party access to your accounts — ever",
            "Manual entry helps you stay more aware of your spending",
            "Your data is private, not sold or shared",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={540}>
        <p className="text-center text-xs text-muted-foreground italic">
          This is intentional by design — not a limitation we're working around
        </p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 6 — Why not in the App Store
══════════════════════════════════════ */
function Slide6() {
  const benefits = [
    {
      icon: RefreshCw,
      title: "Instant updates",
      desc: "Fixes and new features ship immediately — no waiting for store approval",
    },
    {
      icon: Smartphone,
      title: "Feels native",
      desc: "Sits on your home screen and works offline, just like a normal app",
    },
    {
      icon: Globe,
      title: "No account needed to install",
      desc: "Install directly from your browser — no App Store login required",
    },
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mx-auto">
          <Smartphone className="w-8 h-8 text-white" />
        </div>
      </FadeUp>

      <FadeUp delay={100} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          Why it's not in<br />the App Store
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          SharedLedger is a{" "}
          <Highlight delay={450}>Progressive Web App</Highlight> — a website
          that installs like a native app, directly from your browser.
        </p>
      </FadeUp>

      <FadeUp delay={260}>
        <div className="space-y-3">
          {benefits.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={i}
              className="flex gap-4 items-start bg-white dark:bg-card rounded-xl border border-border/50 p-4"
              style={{ animation: `fade-up 0.4s ease-out ${340 + i * 100}ms both` }}
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={680}>
        <p className="text-center text-xs text-muted-foreground italic">
          We'll submit to the App Store once we're out of beta and the app is
          polished — the next slide shows you how to install it right now
        </p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 7 — Install guide
══════════════════════════════════════ */
function Slide7({
  installOS,
  setInstallOS,
  isPWA,
  isNativeSafari,
  isChromeIOS,
  isInApp,
  copyInstallLink,
}: {
  installOS: "ios" | "android" | null;
  setInstallOS: (v: "ios" | "android") => void;
  isPWA: boolean;
  isNativeSafari: boolean;
  isChromeIOS: boolean;
  isInApp: boolean;
  copyInstallLink: () => void;
}) {
  const iosSteps = [
    {
      icon: Globe,
      text: (
        <>
          Open <strong>sharedledger.app</strong> in <strong>Safari</strong>
          <br />
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Not Chrome, WhatsApp, Instagram, or Snapchat — those won't show the
            install option
          </span>
        </>
      ),
    },
    {
      icon: Share2,
      text: (
        <>
          Tap the <strong>Share button</strong> (□↑) at the bottom of the
          screen
          <br />
          <span className="text-xs text-muted-foreground">
            If you can't see it, scroll up slightly to bring the toolbar back
          </span>
        </>
      ),
    },
    {
      icon: Plus,
      text: (
        <>
          Scroll down the share sheet and tap{" "}
          <strong>"Add to Home Screen"</strong>
        </>
      ),
    },
    {
      icon: CheckCircle2,
      text: (
        <>
          Tap <strong>"Add"</strong> — the app appears on your home screen
          instantly
        </>
      ),
    },
  ];

  const androidSteps = [
    {
      text: (
        <>
          Open <strong>sharedledger.app</strong> in <strong>Chrome</strong>
        </>
      ),
    },
    {
      text: (
        <>
          Tap the <strong>three-dot menu</strong> (⋮) in the top-right corner
        </>
      ),
    },
    {
      text: (
        <>
          Tap <strong>"Add to Home Screen"</strong> or{" "}
          <strong>"Install app"</strong>
        </>
      ),
    },
    {
      text: (
        <>
          Tap <strong>"Add"</strong> — done! The app icon appears on your home
          screen
        </>
      ),
    },
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground">
          Add it to your<br />home screen
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Select your phone to see the steps
        </p>
      </FadeUp>

      {/* Already installed banner */}
      {isPWA && (
        <FadeUp delay={80}>
          <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>You're all set!</strong> SharedLedger is already installed
              on your home screen. Tap "Next" to continue.
            </p>
          </div>
        </FadeUp>
      )}

      {/* In-app browser warning for iOS */}
      {!isPWA && (isChromeIOS || isInApp) && (
        <FadeUp delay={80}>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-semibold mb-2">
              You're not in Safari right now
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              The "Add to Home Screen" option only appears in Safari. You need to
              open this page in Safari first.
            </p>
            <button
              onClick={copyInstallLink}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              data-testid="button-intro-copy-link"
            >
              Copy link to open in Safari
            </button>
          </div>
        </FadeUp>
      )}

      {/* OS toggle */}
      <FadeUp delay={140}>
        <div className="flex gap-2 bg-muted rounded-xl p-1">
          {(["ios", "android"] as const).map((os) => (
            <button
              key={os}
              onClick={() => setInstallOS(os)}
              data-testid={`button-intro-os-${os}`}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                installOS === os
                  ? "bg-white dark:bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {os === "ios" ? "📱 iPhone" : "🤖 Android"}
            </button>
          ))}
        </div>
      </FadeUp>

      {/* Steps */}
      {installOS === "ios" && (
        <FadeUp delay={220}>
          <div className="space-y-3">
            {iosSteps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      )}

      {installOS === "android" && (
        <FadeUp delay={220}>
          <div className="space-y-3">
            {androidSteps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      )}

      {installOS === null && (
        <FadeUp delay={220}>
          <div className="text-center py-6 text-muted-foreground text-sm">
            Select your device above to see the install steps
          </div>
        </FadeUp>
      )}
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   SLIDE 8 — Get started
══════════════════════════════════════ */
function Slide8({ onDone, onInstall }: { onDone: () => void; onInstall: () => void }) {
  const steps = [
    {
      icon: Download,
      num: "1",
      title: "Install the app",
      desc: "Add it to your home screen from the previous step — takes under 30 seconds",
      accent: true,
    },
    {
      icon: UserPlus,
      num: "2",
      title: "Create your account",
      desc: "Sign up inside the installed app — no email verification needed",
      accent: false,
    },
    {
      icon: Home,
      num: "3",
      title: "Start tracking",
      desc: "Add your first expense. Invite your household whenever you're ready — no rush",
      accent: false,
    },
  ];

  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-3">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          You're ready to start
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Follow this order for the smoothest experience
        </p>
      </FadeUp>

      <div className="space-y-3">
        {steps.map(({ icon: Icon, num, title, desc, accent }, i) => (
          <FadeUp key={i} delay={100 + i * 120}>
            <div
              className={`flex items-start gap-4 p-4 rounded-2xl border ${
                accent
                  ? "bg-primary/8 border-primary/25"
                  : "bg-white dark:bg-card border-border/50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  accent
                    ? "bg-gradient-to-tr from-primary to-accent shadow-sm shadow-primary/20"
                    : "bg-muted"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${accent ? "text-white" : "text-muted-foreground"}`}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`font-semibold text-sm ${accent ? "text-primary" : "text-foreground"}`}
                >
                  <span
                    className={`inline-block w-5 h-5 rounded-full text-xs font-bold text-center leading-5 mr-1.5 ${
                      accent
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {num}
                  </span>
                  {title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>

      <FadeUp delay={480}>
        <div className="flex flex-col gap-3">
          <Button
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
            onClick={onInstall}
            data-testid="button-intro-install"
          >
            <Download className="w-4 h-4 mr-2" /> How to Install the App
          </Button>

          <Link href="/app">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold"
              onClick={onDone}
              data-testid="button-intro-open-app"
            >
              Already installed? Open the App <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>

          <button
            onClick={onDone}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
            data-testid="button-intro-see-more"
          >
            ↓ Continue to learn more about SharedLedger
          </button>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
const TOTAL_SLIDES = 8;

interface Props {
  onDone: (scrollTo?: "install") => void;
}

export function LandingIntroSlides({ onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const { isIOS, isAndroid, isChromeIOS, isInApp, isNativeSafari, isPWA } =
    useDeviceState();
  const [installOS, setInstallOS] = useState<"ios" | "android" | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (isIOS) setInstallOS("ios");
    else if (isAndroid) setInstallOS("android");
  }, [isIOS, isAndroid]);

  const go = (newSlide: number, direction: "next" | "prev") => {
    setDir(direction);
    setSlide(newSlide);
  };

  const next = () => {
    if (slide < TOTAL_SLIDES - 1) go(slide + 1, "next");
    else done();
  };

  const prev = () => {
    if (slide > 0) go(slide - 1, "prev");
  };

  const done = (scrollTo?: "install") => {
    localStorage.setItem("sl_seen_intro", "1");
    onDone(scrollTo);
  };

  const copyInstallLink = () => {
    navigator.clipboard
      .writeText("https://sharedledger.app")
      .catch(() => {});
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const animClass =
    dir === "next" ? "animate-slide-from-right" : "animate-slide-from-left";

  return (
    <div
      className="min-h-screen flex flex-col bg-background relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/60">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
          style={{ width: `${((slide + 1) / TOTAL_SLIDES) * 100}%` }}
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between px-6 pt-7 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-tr from-primary to-accent rounded-lg flex items-center justify-center rotate-[-6deg]">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-primary">SharedLedger</span>
        </div>
        <button
          onClick={done}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-muted"
          data-testid="button-intro-skip"
        >
          Skip <X className="w-3 h-3" />
        </button>
      </div>

      {/* Slide content — keyed so animations replay on change */}
      <div
        key={slide}
        className={`flex-1 flex flex-col justify-center px-6 py-2 overflow-y-auto ${animClass}`}
      >
        {slide === 0 && <Slide1 />}
        {slide === 1 && <Slide2 />}
        {slide === 2 && <Slide3 />}
        {slide === 3 && <Slide4 />}
        {slide === 4 && <Slide5 />}
        {slide === 5 && <Slide6 />}
        {slide === 6 && (
          <Slide7
            installOS={installOS}
            setInstallOS={setInstallOS}
            isPWA={isPWA}
            isNativeSafari={isNativeSafari}
            isChromeIOS={isChromeIOS}
            isInApp={isInApp}
            copyInstallLink={copyInstallLink}
          />
        )}
        {slide === 7 && <Slide8 onDone={done} onInstall={() => done("install")} />}
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-8 pt-2 shrink-0">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > slide ? "next" : "prev")}
              className={`rounded-full transition-all duration-300 ${
                i === slide
                  ? "w-6 h-2 bg-primary"
                  : i < slide
                    ? "w-2 h-2 bg-primary/40"
                    : "w-2 h-2 bg-muted-foreground/25"
              }`}
              data-testid={`dot-slide-${i}`}
            />
          ))}
        </div>

        {/* Back / Next — hidden on final slide (it has its own CTAs) */}
        {slide < TOTAL_SLIDES - 1 && (
          <div className="flex gap-3">
            {slide > 0 ? (
              <Button
                variant="outline"
                className="h-12 px-5 rounded-xl border-border/60"
                onClick={prev}
                data-testid="button-intro-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <div />
            )}
            <Button
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
              onClick={next}
              data-testid="button-intro-next"
            >
              {slide === 6 ? "I've installed it" : "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
