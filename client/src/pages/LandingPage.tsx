import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingIntroSlides } from "@/components/LandingIntroSlides";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Wallet,
  PieChart,
  Trophy,
  Smartphone,
  Globe,
  ShieldCheck,
  Zap,
  Bell,
  BarChart3,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Download,
  Share2,
  Plus,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Layers,
  MessageSquareHeart,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react";

function UseCaseCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/50 flex flex-col gap-3 hover:shadow-md hover:border-primary/20 transition-all duration-200">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-sm shadow-primary/20">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center font-display font-bold text-lg shrink-0 shadow-md shadow-primary/20">
        {number}
      </div>
      <div>
        <h3 className="font-display font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function useIOSBrowserState() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  const isInApp = /(Instagram|FBAN|FBAV|WhatsApp|Snapchat|Twitter|LinkedIn)/i.test(ua);
  const isPWA = typeof window !== "undefined" && (window.navigator as any).standalone === true;
  const isNativeSafari = isIOS && !isChromeIOS && !isFirefoxIOS && !isInApp && !isPWA;
  return { isIOS, isChromeIOS, isInApp, isNativeSafari, isPWA };
}

export default function LandingPage() {
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const { isIOS, isChromeIOS, isInApp, isNativeSafari, isPWA } = useIOSBrowserState();

  // Show intro slides for first-time visitors (or when ?intro=1 is in the URL)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      const forceIntro = new URLSearchParams(window.location.search).get("intro") === "1";
      return forceIntro || !localStorage.getItem("sl_seen_intro");
    } catch {
      return false;
    }
  });
  const scrollToInstallRef = useRef(false);

  useEffect(() => {
    if (!showIntro && scrollToInstallRef.current) {
      scrollToInstallRef.current = false;
      const el = document.getElementById("install-section");
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }, [showIntro]);

  if (showIntro) {
    return (
      <LandingIntroSlides
        onDone={(scrollTo) => {
          if (scrollTo === "install") scrollToInstallRef.current = true;
          setShowIntro(false);
        }}
      />
    );
  }

  const copyInstallLink = () => {
    navigator.clipboard.writeText("https://sharedledger.app").then(() => {
      toast({ title: "Link copied!", description: "Paste it in Safari to install." });
    });
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Feedback submitted:", { feedbackName, feedbackEmail, feedbackMessage });
    toast({
      title: t("landingFormThankYou"),
      description: t("landingFormThankYouDesc"),
    });
    setFeedbackName("");
    setFeedbackEmail("");
    setFeedbackMessage("");
  };

  const scrollToInstall = () => {
    document.getElementById("install-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-primary to-accent rounded-xl flex items-center justify-center rotate-[-6deg]">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-primary">SharedLedger</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1" data-testid="language-selector-landing">
              {(["en", "fr", "nl"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  data-testid={`lang-option-${lang}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                    language === lang
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang === "en" ? t("english") : lang === "fr" ? t("french") : t("dutch")}
                </button>
              ))}
            </div>
            <Link href="/auth">
              <Button variant="ghost" size="sm" data-testid="link-signin-nav">{t("landingSignIn")}</Button>
            </Link>
            <Link href="/app">
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md shadow-primary/20 text-white" data-testid="link-getstarted-nav">{t("landingOpenApp")}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="pt-16 pb-20 px-6 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-accent/8 blur-[100px]" />
        <div className="max-w-3xl mx-auto relative z-10">
          <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5 rounded-full" data-testid="badge-beta">
            {t("landingBeta")}
          </Badge>
          <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-tight mb-6">
            <span className="text-primary">{t("landingHeroTitle1")}</span><br />
            <span className="text-foreground">{t("landingHeroTitle2")}</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-4 max-w-2xl mx-auto">
            {t("landingHeroSubtitle")}
          </p>
          <p className="text-sm text-muted-foreground mb-10 italic">
            {t("landingHeroNote")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="rounded-2xl text-lg px-8 h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg shadow-primary/25 w-full sm:w-auto" data-testid="button-hero-start">
                {t("landingOpenApp")} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl text-lg px-8 h-14 w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
              onClick={scrollToInstall}
              data-testid="button-hero-install"
            >
              {t("landingInstallApp")} <Download className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Revisit intro slides */}
          <div className="mt-6">
            <button
              onClick={() => setShowIntro(true)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="button-revisit-intro"
            >
              <ChevronDown className="w-4 h-4" />
              New here? View the app overview
            </button>
          </div>
        </div>
      </section>

      {/* 1b. Expandable Summary */}
      <section className="pb-2 px-6">
        <div className="max-w-sm mx-auto flex flex-col items-center">
          {/* Animated trigger button with pulsing rings */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            {!summaryOpen && (
              <span
                className="absolute inline-flex rounded-full"
                style={{
                  width: "100%",
                  height: "100%",
                  background: "hsl(var(--primary)/0.2)",
                  animation: "ring-pulse 2s ease-out infinite",
                }}
              />
            )}
            {/* Middle pulse ring — offset delay */}
            {!summaryOpen && (
              <span
                className="absolute inline-flex rounded-full"
                style={{
                  width: "100%",
                  height: "100%",
                  background: "hsl(var(--accent)/0.18)",
                  animation: "ring-pulse 2s ease-out infinite 0.6s",
                }}
              />
            )}
            <button
              onClick={() => setSummaryOpen((v) => !v)}
              data-testid="button-summary-toggle"
              className="relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300"
              style={{
                background: summaryOpen
                  ? "hsl(var(--primary)/0.12)"
                  : "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--accent)/0.15))",
                border: "1.5px solid hsl(var(--primary)/0.35)",
                color: "hsl(var(--primary))",
                boxShadow: summaryOpen ? "none" : "0 0 18px hsl(var(--primary)/0.2)",
              }}
            >
              {summaryOpen ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Close overview
                </>
              ) : (
                <>
                  <span>Quick overview</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Expandable content */}
          {summaryOpen && (
            <div className="mt-6 w-full space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">

              {/* Nav pills — first thing revealed */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: "Who it's for", href: "#why-section" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "Features", href: "#features" },
                  { label: "Sage AI", href: "#sage-section" },
                  { label: "Why install?", href: "#why-install" },
                ].map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setSummaryOpen(false)}
                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-white border border-border/50 hover:border-primary/30 hover:shadow-sm"
                  >
                    {label}
                  </a>
                ))}
                <a
                  href="#install-section"
                  onClick={() => setSummaryOpen(false)}
                  className="text-xs font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" /> Install the App
                </a>
                <a
                  href="#feedback-section"
                  onClick={() => setSummaryOpen(false)}
                  className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-white border border-border/50 hover:border-primary/30 hover:shadow-sm"
                >
                  Give Feedback
                </a>
              </div>

              {/* PWA explanation card */}
              <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0 shadow-sm shadow-primary/20 mt-0.5">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">Install it on your phone — no app store needed</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      SharedLedger is a <strong>Progressive Web App (PWA)</strong>. We chose this format for beta so we can ship
                      updates instantly without app store delays. It works offline, feels like a native app, and installs
                      directly from your browser in under 30 seconds.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSummaryOpen(false); scrollToInstall(); }}
                  className="shrink-0 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-primary/25 hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <Download className="w-4 h-4" /> See Install Guide
                </button>
              </div>

              {/* CTA card */}
              <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl border border-primary/15 p-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <MessageSquareHeart className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">
                    <strong>We need your help to make SharedLedger better.</strong> Try the app with your household, then share
                    what works, what's confusing, and what you wish it could do.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href="/app">
                    <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20" data-testid="button-summary-open-app">
                      Open the App
                    </Button>
                  </Link>
                  <a href="#feedback-section" onClick={() => setSummaryOpen(false)}>
                    <Button size="sm" variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/5">
                      Feedback
                    </Button>
                  </a>
                </div>
              </div>

            </div>
          )}
        </div>
      </section>

      {/* 2. Mock UI */}
      <section className="py-12 px-6">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/10 border border-border/50 overflow-hidden">
            <div className="bg-gradient-to-tr from-primary to-accent p-6 text-white">
              <p className="text-sm font-medium opacity-80 mb-1">{t("landingMockThisMonth")}</p>
              <p className="font-display font-bold text-4xl">$1,847</p>
              <p className="text-sm opacity-70 mt-1">{t("landingMockSpentAcross")}</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { labelKey: "landingMockGroceries" as const, amount: "$420", pct: 70, color: "bg-primary" },
                { labelKey: "landingMockUtilities" as const, amount: "$180", pct: 45, color: "bg-accent" },
                { labelKey: "landingMockDiningOut" as const, amount: "$310", pct: 85, color: "bg-destructive" },
              ].map((item) => (
                <div key={item.labelKey} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>{t(item.labelKey)}</span>
                      <span>{item.amount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 flex gap-2">
                <div className="flex-1 bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t("landingMockYouOwe")}</p>
                  <p className="font-display font-bold text-primary">$23.50</p>
                </div>
                <div className="flex-1 bg-accent/10 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t("landingMockOwedToYou")}</p>
                  <p className="font-display font-bold text-accent">$67.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Trust & Simplicity */}
      <section className="py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
            {t("landingTrustTitle")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("landingTrustBody")}
          </p>
        </div>
        <div className="max-w-4xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: ShieldCheck, labelKey: "landingTrustSecure" as const },
            { icon: RefreshCw, labelKey: "landingTrustCloud" as const },
            { icon: Globe, labelKey: "landingTrustCurrency" as const },
            { icon: Smartphone, labelKey: "landingTrustMobile" as const },
            { icon: MessageCircle, labelKey: "landingTrustLanguages" as const },
          ].map(({ icon: Icon, labelKey }) => (
            <div key={labelKey} className="bg-white rounded-2xl p-5 border border-border/50 flex flex-col items-center gap-2 shadow-sm">
              <Icon className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium text-foreground text-center">{t(labelKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Use Cases */}
      <section id="why-section" className="py-16 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingWhyTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("landingWhySubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <UseCaseCard
              icon={Users}
              title={t("landingUseFamiliesTitle")}
              description={t("landingUseFamiliesDesc")}
            />
            <UseCaseCard
              icon={Layers}
              title={t("landingUseRoommatesTitle")}
              description={t("landingUseRoommatesDesc")}
            />
            <UseCaseCard
              icon={Star}
              title={t("landingUseCouplesTitle")}
              description={t("landingUseCouplesDesc")}
            />
            <UseCaseCard
              icon={Globe}
              title={t("landingUseFriendsTitle")}
              description={t("landingUseFriendsDesc")}
            />
            <UseCaseCard
              icon={Wallet}
              title={t("landingUseSoloTitle")}
              description={t("landingUseSoloDesc")}
            />
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingHowTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("landingHowSubtitle")}</p>
          </div>
          <div className="space-y-8">
            <StepCard number="1" title={t("landingStep1Title")} description={t("landingStep1Desc")} />
            <StepCard number="2" title={t("landingStep2Title")} description={t("landingStep2Desc")} />
            <StepCard number="3" title={t("landingStep3Title")} description={t("landingStep3Desc")} />
            <StepCard number="4" title={t("landingStep4Title")} description={t("landingStep4Desc")} />
          </div>
        </div>
      </section>

      {/* 6. Power Features */}
      <section id="features" className="py-16 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingFeaturesTitle")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Wallet, titleKey: "landingFeature1Title" as const, descKey: "landingFeature1Desc" as const },
              { icon: PieChart, titleKey: "landingFeature2Title" as const, descKey: "landingFeature2Desc" as const },
              { icon: Trophy, titleKey: "landingFeature3Title" as const, descKey: "landingFeature3Desc" as const },
              { icon: BarChart3, titleKey: "landingFeature4Title" as const, descKey: "landingFeature4Desc" as const },
              { icon: Bell, titleKey: "landingFeature5Title" as const, descKey: "landingFeature5Desc" as const },
              { icon: MessageCircle, titleKey: "landingFeature6Title" as const, descKey: "landingFeature6Desc" as const },
              { icon: TrendingUp, titleKey: "landingFeature7Title" as const, descKey: "landingFeature7Desc" as const },
            ].map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mb-4 shadow-sm shadow-primary/20">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6b. Sage AI */}
      <section id="sage-section" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-primary to-accent p-1 shadow-2xl shadow-primary/25">
            <div className="rounded-[22px] bg-background/95 backdrop-blur-sm p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-10 items-start">

                {/* Left — icon + badge + title */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500 to-primary flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                      <Sparkles className="w-7 h-7 text-white animate-sparkle" />
                    </div>
                    <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full">
                      {t("landingSageBadge")}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-3 leading-tight">
                    {t("landingSageTitle")}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                    {t("landingSageSubtitle")}
                  </p>
                  <div className="mt-6">
                    <Link href="/app">
                      <Button
                        className="rounded-xl bg-gradient-to-r from-violet-500 to-primary hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
                        data-testid="button-landing-try-sage"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {t("landingSageCta")}
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right — feature list */}
                <div className="flex-1 space-y-3">
                  {(["landingSageWhat1", "landingSageWhat2", "landingSageWhat3", "landingSageWhat4"] as const).map((key) => (
                    <div key={key} className="flex items-start gap-3 bg-primary/5 rounded-xl p-3.5 border border-primary/10">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground leading-snug">{t(key)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground italic pt-1 px-1">
                    {t("landingSageDisclaimer")}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Progressive Experience */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-6">
            {t("landingGrowTitle")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            {t("landingGrowBody")}
          </p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 text-left space-y-4">
            {[
              { labelKey: "landingGrowItem1Label" as const, detailKey: "landingGrowItem1Detail" as const },
              { labelKey: "landingGrowItem2Label" as const, detailKey: "landingGrowItem2Detail" as const },
              { labelKey: "landingGrowItem3Label" as const, detailKey: "landingGrowItem3Detail" as const },
              { labelKey: "landingGrowItem4Label" as const, detailKey: "landingGrowItem4Detail" as const },
              { labelKey: "landingGrowItem5Label" as const, detailKey: "landingGrowItem5Detail" as const },
              { labelKey: "landingGrowItem6Label" as const, detailKey: "landingGrowItem6Detail" as const },
            ].map(({ labelKey, detailKey }) => (
              <div key={labelKey} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{t(labelKey)}</span>
                  <span className="text-sm text-muted-foreground ml-2">· {t(detailKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 & 9. Installation Guide */}
      <section id="install-section" className="py-20 px-6 bg-secondary/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingInstallTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("landingInstallSubtitle")}</p>
          </div>
          {/* iOS browser detection banner */}
          {isIOS && isPWA ? (
            <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 leading-relaxed">
                <strong>You're all set!</strong> SharedLedger is already installed on your home screen.
              </p>
            </div>
          ) : isIOS && (isInApp || isChromeIOS) ? (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>You're not in Safari right now.</strong> The "Add to Home Screen" option won't appear in {isInApp ? "WhatsApp, Snapchat, or Instagram's built-in browser" : "Chrome"}. You need to open this page in Safari first.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 ml-8">
                <button
                  onClick={copyInstallLink}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  data-testid="button-copy-install-link"
                >
                  Copy link to open in Safari
                </button>
                <p className="text-xs text-amber-700 self-center">Then paste it in Safari's address bar</p>
              </div>
            </div>
          ) : isIOS && isNativeSafari ? (
            <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>You're in Safari — perfect.</strong> Follow the steps below. If the Share button (□↑) isn't visible, scroll up slightly or tap the bottom edge of the screen to bring the toolbar back.
              </p>
            </div>
          ) : (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>iPhone users:</strong> If you opened this link from WhatsApp, Snapchat, or Instagram, you are in their built-in browser — not Safari. Tap <strong>···</strong> or the browser icon and choose <strong>"Open in Safari"</strong>. If you're in Chrome, tap the share icon and choose <strong>"Open in Safari"</strong>.
              </p>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-8">
            {/* iPhone */}
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-sm shadow-primary/20">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground">{t("landingInstallIphoneTitle")}</h3>
              </div>
              <ol className="space-y-4">
                {[
                  { icon: Globe, textKey: "landingInstallIphoneStep1" as const },
                  { icon: Share2, textKey: "landingInstallIphoneStep2" as const },
                  { icon: Plus, textKey: "landingInstallIphoneStep3" as const },
                  { icon: CheckCircle2, textKey: "landingInstallIphoneStep4" as const },
                ].map(({ icon: Icon, textKey }, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">{i + 1}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(textKey)}</p>
                  </li>
                ))}
              </ol>
            </div>
            {/* Android */}
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground">{t("landingInstallAndroidTitle")}</h3>
              </div>
              <ol className="space-y-4">
                {[
                  { textKey: "landingInstallAndroidStep1" as const },
                  { textKey: "landingInstallAndroidStep2" as const },
                  { textKey: "landingInstallAndroidStep3" as const },
                  { textKey: "landingInstallAndroidStep4" as const },
                ].map(({ textKey }, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">{i + 1}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(textKey)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Why Install */}
      <section id="why-install" className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-6">{t("landingWhyInstallTitle")}</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left mt-8">
            {[
              { titleKey: "landingWhyInstall1Title" as const, detailKey: "landingWhyInstall1Desc" as const },
              { titleKey: "landingWhyInstall2Title" as const, detailKey: "landingWhyInstall2Desc" as const },
              { titleKey: "landingWhyInstall3Title" as const, detailKey: "landingWhyInstall3Desc" as const },
              { titleKey: "landingWhyInstall4Title" as const, detailKey: "landingWhyInstall4Desc" as const },
            ].map(({ titleKey, detailKey }) => (
              <div key={titleKey} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{t(titleKey)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t(detailKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Why Not App Store */}
      <section className="py-16 px-6 bg-secondary/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-4">{t("landingWhyNotAppStoreTitle")}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("landingWhyNotAppStoreBody")}
          </p>
        </div>
      </section>

      {/* 12. Currency Support */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Globe className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingCurrencyTitle")}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            {t("landingCurrencyBody")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["USD $", "EUR €", "GBP £", "CAD $", "AUD $", "JPY ¥", "INR ₹", "CHF Fr", "SGD $", "NZD $", "MXN $", "BRL R$", "UGX", "KES KSh", "TZS TSh"].map((currency) => (
              <Badge key={currency} variant="secondary" className="text-sm px-3 py-1">
                {currency}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* 13. Feedback Form */}
      <section id="feedback-section" className="py-20 px-6 bg-secondary/20">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingFeedbackTitle")}</h2>
            <p className="text-muted-foreground text-lg mb-3">{t("landingFeedbackSubtitle")}</p>
            <p className="text-sm text-muted-foreground mb-1">{t("landingFeedbackAlsoIn")}</p>
            <p className="text-sm text-muted-foreground">{t("landingFeedbackEmail")} <a href="mailto:sharedledger.app@gmail.com" className="text-primary font-medium hover:underline">sharedledger.app@gmail.com</a></p>
          </div>
          <form onSubmit={handleFeedbackSubmit} className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 space-y-5">
            <div>
              <label htmlFor="feedback-name" className="text-sm font-medium text-foreground block mb-2">{t("landingFormName")}</label>
              <Input
                id="feedback-name"
                placeholder={t("landingFormNamePlaceholder")}
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                className="h-11 rounded-xl"
                data-testid="input-feedback-name"
              />
            </div>
            <div>
              <label htmlFor="feedback-email" className="text-sm font-medium text-foreground block mb-2">{t("landingFormEmailLabel")}</label>
              <Input
                id="feedback-email"
                type="email"
                placeholder={t("landingFormEmailPlaceholder")}
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                className="h-11 rounded-xl"
                data-testid="input-feedback-email"
              />
            </div>
            <div>
              <label htmlFor="feedback-message" className="text-sm font-medium text-foreground block mb-2">{t("landingFormMessageLabel")}</label>
              <Textarea
                id="feedback-message"
                placeholder={t("landingFormMessagePlaceholder")}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                className="rounded-xl min-h-[120px] resize-none"
                data-testid="input-feedback-message"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20" data-testid="button-feedback-submit">
              {t("landingFormSubmit")}
            </Button>
          </form>
        </div>
      </section>

      {/* 14. Upcoming Features */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Zap className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">{t("landingComingSoonTitle")}</h2>
          <p className="text-muted-foreground text-lg mb-10">{t("landingComingSoonSubtitle")}</p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {(["landingRoadmap1", "landingRoadmap2", "landingRoadmap3", "landingRoadmap4", "landingRoadmap5", "landingRoadmap6"] as const).map((key) => (
              <div key={key} className="flex gap-3 items-start bg-secondary/30 rounded-xl p-4">
                <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{t(key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="font-display font-bold text-4xl md:text-5xl text-foreground mb-4">
            {t("landingCtaTitle")}
          </h2>
          <p className="text-muted-foreground text-lg mb-4">
            {t("landingCtaSubtitle")}
          </p>
          <p className="text-sm text-muted-foreground italic mb-10">
            {t("landingCtaNote")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="rounded-2xl text-lg px-10 h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg shadow-primary/25 w-full sm:w-auto" data-testid="button-cta-start">
                {t("landingOpenApp")} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl text-lg px-10 h-14 w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
              onClick={scrollToInstall}
              data-testid="button-cta-install"
            >
              {t("landingInstallApp")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gradient-to-tr from-primary to-accent rounded-lg flex items-center justify-center rotate-[-6deg]">
            <Users className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-bold text-primary">SharedLedger</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("landingFooterText")}
        </p>
        <p className="text-xs text-muted-foreground mt-2">{t("landingFooterAvailable")}</p>
        <div className="flex gap-4 justify-center mt-4 text-sm text-muted-foreground">
          <Link href="/auth" className="hover:text-foreground transition-colors" data-testid="link-signin-footer">{t("landingSignIn")}</Link>
          <Link href="/app" className="hover:text-foreground transition-colors" data-testid="link-register-footer">{t("landingOpenApp")}</Link>
        </div>
      </footer>
    </div>
  );
}
