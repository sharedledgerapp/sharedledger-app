import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, Wallet, Users, Trophy, Shield, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const routes = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/expenses", label: t("expenses"), icon: Wallet },
    { href: "/goals", label: t("goals"), icon: Trophy },
    { href: "/family", label: t("family"), icon: Users },
    { href: "/family-dashboard", label: t("shared"), icon: Shield },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {routes.map((route) => {
          const Icon = route.icon;
          const isActive = location === route.href;
          return (
            <Link key={route.href} href={route.href} className="w-full h-full">
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 active:scale-95 cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-xl transition-all",
                  isActive && "bg-primary/10"
                )}>
                  <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                </div>
                <span className="text-[10px] font-medium tracking-tight">
                  {route.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Mobile Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4 bg-background/80 backdrop-blur-md flex justify-between items-center border-b border-border/20 lg:hidden">
        <h1 className="font-display font-bold text-xl text-primary tracking-tight">FamilyLedger</h1>
        {user && (
          <Link href="/settings">
            <Avatar className="w-9 h-9 border-2 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors" data-testid="button-profile-mobile">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.name} />
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
                {user.name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}
      </header>
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-border bg-card p-6">
        <h1 className="font-display font-bold text-2xl text-primary mb-10">FamilyLedger</h1>
        <nav className="space-y-2 flex-1">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-foreground font-medium transition-colors">
            <Home className="w-5 h-5" /> {t("home")}
          </Link>
          <Link href="/expenses" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-foreground font-medium transition-colors">
            <Wallet className="w-5 h-5" /> {t("expenses")}
          </Link>
          <Link href="/goals" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-foreground font-medium transition-colors">
            <Trophy className="w-5 h-5" /> {t("goals")}
          </Link>
          <Link href="/family" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-foreground font-medium transition-colors">
            <Users className="w-5 h-5" /> {t("family")}
          </Link>
          <Link href="/family-dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-foreground font-medium transition-colors">
            <Shield className="w-5 h-5" /> {t("shared")}
          </Link>
        </nav>
        <div className="pt-6 border-t border-border">
          <Link href="/settings">
            <div className="flex items-center gap-3 px-2 mb-4 cursor-pointer hover:bg-muted rounded-xl py-2 transition-colors" data-testid="button-profile-desktop">
              <Avatar className="w-10 h-10 border-2 border-primary/20">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden flex-1">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </div>
      </div>
      {/* Main Content */}
      <main className="flex-1 lg:pl-64 pb-20 pt-16 lg:pt-0">
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
      {/* Mobile Bottom Nav (hidden on desktop) */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
