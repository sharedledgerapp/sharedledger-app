import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Feedback submitted:", { feedbackName, feedbackEmail, feedbackMessage });
    toast({
      title: "Thank you for your feedback!",
      description: "We read every message and appreciate you taking the time to share your thoughts.",
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
            <Link href="/auth">
              <Button variant="ghost" size="sm" data-testid="link-signin-nav">Sign In</Button>
            </Link>
            <Link href="/app">
              <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md shadow-primary/20 text-white" data-testid="link-getstarted-nav">Open App</Button>
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
            Beta · Free while we're building
          </Badge>
          <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-tight mb-6">
            <span className="text-primary">Shared finances,</span><br />
            <span className="text-foreground">finally simple.</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-4 max-w-2xl mx-auto">
            Track expenses, split bills, and manage budgets together, whether you live with family, roommates, or a partner. Works like an app, installs from your browser.
          </p>
          <p className="text-sm text-muted-foreground mb-10 italic">
            Start on your own, or join a group anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="rounded-2xl text-lg px-8 h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg shadow-primary/25 w-full sm:w-auto" data-testid="button-hero-start">
                Open App <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl text-lg px-8 h-14 w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
              onClick={scrollToInstall}
              data-testid="button-hero-install"
            >
              Install App <Download className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Mock UI */}
      <section className="py-12 px-6">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/10 border border-border/50 overflow-hidden">
            <div className="bg-gradient-to-tr from-primary to-accent p-6 text-white">
              <p className="text-sm font-medium opacity-80 mb-1">This Month</p>
              <p className="font-display font-bold text-4xl">$1,847</p>
              <p className="text-sm opacity-70 mt-1">spent across 3 members</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Groceries", amount: "$420", pct: 70, color: "bg-primary" },
                { label: "Utilities", amount: "$180", pct: 45, color: "bg-accent" },
                { label: "Dining Out", amount: "$310", pct: 85, color: "bg-destructive" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>{item.label}</span>
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
                  <p className="text-xs text-muted-foreground">You owe</p>
                  <p className="font-display font-bold text-primary">$23.50</p>
                </div>
                <div className="flex-1 bg-accent/10 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Owed to you</p>
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
            Built for real life, not spreadsheets
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            SharedLedger is a progressive web app, so there's no app store needed. Add it to your home screen in seconds and get a full native-app experience. Your data is stored securely in the cloud, so you can access it from any device with a browser.
          </p>
        </div>
        <div className="max-w-4xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: ShieldCheck, label: "Secure & Private" },
            { icon: RefreshCw, label: "Cloud-Based" },
            { icon: Globe, label: "Multi-Currency" },
            { icon: Smartphone, label: "Mobile-First" },
            { icon: MessageCircle, label: "English & French" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-border/50 flex flex-col items-center gap-2 shadow-sm">
              <Icon className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium text-foreground text-center">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Use Cases */}
      <section className="py-16 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Who is SharedLedger for?</h2>
            <p className="text-muted-foreground text-lg">From couples to households to solo budgeters, it flexes to fit you.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <UseCaseCard
              icon={Users}
              title="Families"
              description="Track household spending, set budgets per category, and keep every family member aligned, from parents to kids."
            />
            <UseCaseCard
              icon={Layers}
              title="Roommates"
              description="Split rent, groceries, and utilities fairly. See who paid what and settle up in seconds without the awkward conversations."
            />
            <UseCaseCard
              icon={Star}
              title="Couples"
              description="Manage shared expenses side by side. Set joint savings goals, track progress together, and stay financially in sync."
            />
            <UseCaseCard
              icon={Globe}
              title="Friend Groups"
              description="Planning a trip, splitting dinners, or organising an outing? Create a group for any occasion, track who paid what, and settle up without the guesswork."
            />
            <UseCaseCard
              icon={Wallet}
              title="Solo Tracking"
              description="Don't share finances with anyone? SharedLedger works just as well on its own. Log expenses, set budgets, and track savings goals as a personal financial tracker."
            />
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Up and running in minutes</h2>
            <p className="text-muted-foreground text-lg">No complex setup. No credit card. No friction.</p>
          </div>
          <div className="space-y-8">
            <StepCard number="1" title="Create a free account" description="Sign up in under 30 seconds with your email or Google account. No payment info required." />
            <StepCard number="2" title="Set up your group (optional)" description="Create a household or join an existing one with an invite code. Or just use it solo to start. You can always join a group later." />
            <StepCard number="3" title="Add your first expense" description="Log any purchase instantly: pick a category, set an amount, choose a currency, and decide if it's shared or personal." />
            <StepCard number="4" title="Install as an app" description="Add SharedLedger to your home screen for the full native experience. No app store required. Works on iPhone and Android." />
          </div>
        </div>
      </section>

      {/* 6. Power Features */}
      <section className="py-16 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Everything you need to stay on track</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Wallet, title: "Expense Tracking", description: "Log personal and shared expenses with categories, notes, and receipts. Filter and search your history instantly." },
              { icon: PieChart, title: "Smart Budgets", description: "Set monthly budgets per category. Colour-coded progress bars alert you before you overspend." },
              { icon: Trophy, title: "Savings Goals", description: "Create goals with targets and deadlines. Contribute over time and watch your progress grow." },
              { icon: BarChart3, title: "Visual Reports", description: "Understand your spending patterns at a glance with charts, breakdowns, and trend analysis." },
              { icon: Bell, title: "Smart Notifications", description: "Get reminders to log expenses and alerts when budgets hit your thresholds. Fully configurable." },
              { icon: MessageCircle, title: "Group Messaging", description: "Chat with your group right inside the app. Discuss expenses, ask questions, and stay in sync." },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mb-4 shadow-sm shadow-primary/20">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Progressive Experience */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-6">
            Start simple. Grow with it.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            You don't need to set up a group on day one. Start tracking your own expenses solo and the app is fully useful right away. When you're ready, invite your household in one tap. Group features unlock naturally as you go.
          </p>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 text-left space-y-4">
            {[
              { label: "Solo tracking", detail: "Available from day one" },
              { label: "Budgets & goals", detail: "Available from day one" },
              { label: "Group expenses & splitting", detail: "Unlocks when you join a group" },
              { label: "Group messaging", detail: "Unlocks when you join a group" },
              { label: "Family dashboard", detail: "Unlocks when you join a group" },
            ].map(({ label, detail }) => (
              <div key={label} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="text-sm text-muted-foreground ml-2">· {detail}</span>
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
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Install SharedLedger on your phone</h2>
            <p className="text-muted-foreground text-lg">No app store. No downloads. Just add it to your home screen in seconds.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* iPhone */}
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-sm shadow-primary/20">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground">iPhone (Safari)</h3>
              </div>
              <ol className="space-y-4">
                {[
                  { icon: Globe, text: "Open SharedLedger in Safari (not Chrome)" },
                  { icon: Share2, text: 'Tap the Share button at the bottom of the screen' },
                  { icon: Plus, text: 'Scroll down and tap "Add to Home Screen"' },
                  { icon: CheckCircle2, text: 'Tap "Add" and the app icon will appear on your home screen' },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">{i + 1}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
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
                <h3 className="font-display font-bold text-xl text-foreground">Android (Chrome)</h3>
              </div>
              <ol className="space-y-4">
                {[
                  { text: "Open SharedLedger in Chrome" },
                  { text: 'Tap the three-dot menu (⋮) in the top right' },
                  { text: 'Tap "Add to Home Screen" or "Install App"' },
                  { text: 'Tap "Add" to confirm and it will appear on your home screen instantly' },
                ].map(({ text }, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">{i + 1}</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
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
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-6">Why install instead of just using the website?</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left mt-8">
            {[
              { title: "Home screen access", detail: "Launch instantly like any native app, without the browser bar or typing URLs." },
              { title: "Fast loading", detail: "The app loads instantly from your home screen with no browser startup needed." },
              { title: "Push notifications", detail: "Get budget alerts and expense reminders delivered to your device." },
              { title: "Full-screen experience", detail: "Hides browser chrome for a distraction-free, app-like interface." },
            ].map(({ title, detail }) => (
              <div key={title} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Why Not App Store */}
      <section className="py-16 px-6 bg-secondary/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-4">Why isn't it in the App Store?</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            SharedLedger is headed to the App Store and Play Store, but while we're in beta, we're using a PWA so we can ship improvements fast and act on your feedback in real time. No app store approval delays, no waiting for updates. You always have the latest version the moment we push it, and adding it to your home screen is just as easy.
          </p>
        </div>
      </section>

      {/* 12. Currency Support */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Globe className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Works in your currency</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            SharedLedger supports dozens of currencies including USD, EUR, GBP, CAD, AUD, JPY, INR, and many more. You can switch your currency any time in settings.
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
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Share your thoughts</h2>
            <p className="text-muted-foreground text-lg mb-3">SharedLedger is in beta. Your feedback shapes what gets built next. Every message is read.</p>
            <p className="text-sm text-muted-foreground mb-1">You can also send feedback directly from within the app settings once you're signed in.</p>
            <p className="text-sm text-muted-foreground">Or reach us via email: <a href="mailto:sharedledger.app@gmail.com" className="text-primary font-medium hover:underline">sharedledger.app@gmail.com</a></p>
          </div>
          <form onSubmit={handleFeedbackSubmit} className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 space-y-5">
            <div>
              <label htmlFor="feedback-name" className="text-sm font-medium text-foreground block mb-2">Name</label>
              <Input
                id="feedback-name"
                placeholder="Your name"
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                className="h-11 rounded-xl"
                data-testid="input-feedback-name"
              />
            </div>
            <div>
              <label htmlFor="feedback-email" className="text-sm font-medium text-foreground block mb-2">Email (optional)</label>
              <Input
                id="feedback-email"
                type="email"
                placeholder="you@example.com"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                className="h-11 rounded-xl"
                data-testid="input-feedback-email"
              />
            </div>
            <div>
              <label htmlFor="feedback-message" className="text-sm font-medium text-foreground block mb-2">Your feedback</label>
              <Textarea
                id="feedback-message"
                placeholder="What do you love? What's missing? What would make SharedLedger perfect for you?"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                className="rounded-xl min-h-[120px] resize-none"
                data-testid="input-feedback-message"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20" data-testid="button-feedback-submit">
              Send Feedback
            </Button>
          </form>
        </div>
      </section>

      {/* 14. Upcoming Features */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Zap className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">Coming soon</h2>
          <p className="text-muted-foreground text-lg mb-10">We're actively building. Here's what's on the roadmap.</p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              "Improved receipt scanning with smarter AI categorisation",
              "Optional bank account integration for automatic expense import",
              "Smart shared spending",
              "Support for multiple groups per user",
              "Smart analytics for personalised financial suggestions and planning",
              "iOS & Android native apps",
            ].map((feature) => (
              <div key={feature} className="flex gap-3 items-start bg-secondary/30 rounded-xl p-4">
                <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{feature}</p>
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
            Ready to take control of your shared finances?
          </h2>
          <p className="text-muted-foreground text-lg mb-4">
            Free during beta. No credit card required. Start in under a minute.
          </p>
          <p className="text-sm text-muted-foreground italic mb-10">
            Start on your own, or join a group anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="rounded-2xl text-lg px-10 h-14 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg shadow-primary/25 w-full sm:w-auto" data-testid="button-cta-start">
                Open App <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl text-lg px-10 h-14 w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50"
              onClick={scrollToInstall}
              data-testid="button-cta-install"
            >
              Install the App
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
          Beta · Free while we're building. Your feedback helps shape the product.
        </p>
        <p className="text-xs text-muted-foreground mt-2">Available in English and French.</p>
        <div className="flex gap-4 justify-center mt-4 text-sm text-muted-foreground">
          <Link href="/auth" className="hover:text-foreground transition-colors" data-testid="link-signin-footer">Sign In</Link>
          <Link href="/app" className="hover:text-foreground transition-colors" data-testid="link-register-footer">Open App</Link>
        </div>
      </footer>
    </div>
  );
}
