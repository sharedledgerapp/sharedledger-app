import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Star,
  Download,
  Share2,
  Plus,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Layers,
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

export default function LandingPage() {
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

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
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
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
      <section className="py-16 px-6 bg-secondary/20">
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
      <section className="py-20 px-6">
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
      <section className="py-16 px-6 bg-secondary/20">
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
      <section className="py-20 px-6">
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
      <section className="py-20 px-6 bg-secondary/20">
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
