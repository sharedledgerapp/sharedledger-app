import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Lock, Share2, Heart, ChevronRight, ChevronLeft } from "lucide-react";

const ONBOARDING_COMPLETE_KEY = "familyledger_onboarding_complete";

const screens = [
  {
    icon: Users,
    title: "Welcome to Family Ledger",
    subtitle: "A shared family tool for understanding money",
    description: "Built for learning and participation, not control.",
    color: "from-primary to-primary/80",
  },
  {
    icon: Lock,
    title: "Personal First",
    subtitle: "Everyone tracks their own expenses and savings",
    description: "Your personal dashboard is private by default.",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    icon: Share2,
    title: "Shared, With Choice",
    subtitle: "Families can see shared totals together",
    description: "Sharing is always optional and based on your consent.",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: Heart,
    title: "Built on Trust",
    subtitle: "Conversation and flexibility come first",
    description: "No scores, no pressure, no forced visibility.",
    color: "from-rose-500 to-rose-600",
  },
];

export default function OnboardingPage() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [, setLocation] = useLocation();
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setLocation("/auth");
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setLocation("/auth");
  };

  const nextScreen = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      handleComplete();
    }
  };

  const prevScreen = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextScreen();
      } else {
        prevScreen();
      }
    }
    setTouchStart(null);
  };

  const screen = screens[currentScreen];
  const Icon = screen.icon;
  const isLastScreen = currentScreen === screens.length - 1;

  return (
    <div 
      className="min-h-screen flex flex-col bg-background relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="onboarding-page"
    >
      {/* Skip button */}
      <div className="absolute top-4 right-4 z-20">
        <Button 
          variant="ghost" 
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-skip"
        >
          Skip
        </Button>
      </div>

      {/* Decorative background blobs */}
      <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br ${screen.color} opacity-10 blur-[80px]`} />
      <div className={`absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br ${screen.color} opacity-10 blur-[80px]`} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 z-10">
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${screen.color} flex items-center justify-center shadow-lg mb-8`}>
          <Icon className="w-10 h-10 text-white" />
        </div>

        <h1 className="font-display font-bold text-3xl text-center text-foreground mb-3">
          {screen.title}
        </h1>
        
        <p className="text-lg text-center text-muted-foreground mb-4 max-w-xs">
          {screen.subtitle}
        </p>
        
        <p className="text-sm text-center text-muted-foreground/80 max-w-xs">
          {screen.description}
        </p>
      </div>

      {/* Bottom navigation */}
      <div className="px-8 pb-12 z-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {screens.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={`h-2 rounded-full ${
                index === currentScreen 
                  ? "w-6 bg-primary" 
                  : "w-2 bg-muted-foreground/30"
              }`}
              data-testid={`button-dot-${index}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentScreen > 0 && (
            <Button 
              variant="outline" 
              onClick={prevScreen}
              className="h-14 px-6 rounded-2xl"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          
          <Button 
            onClick={nextScreen}
            className={`flex-1 h-14 rounded-2xl text-lg font-semibold shadow-lg bg-gradient-to-r ${screen.color}`}
            data-testid="button-next"
          >
            {isLastScreen ? "Get Started" : "Next"}
            {!isLastScreen && <ChevronRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}
