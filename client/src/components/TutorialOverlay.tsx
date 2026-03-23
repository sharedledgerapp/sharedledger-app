import { useEffect, useState, useLayoutEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useTutorial } from "@/contexts/TutorialContext";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Sparkles, Navigation } from "lucide-react";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialOverlay() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTutorial } = useTutorial();
  const [location, setLocation] = useLocation();
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [ready, setReady] = useState(false);
  const measureGenRef = useRef(0);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const PADDING = 8;
  const TOOLTIP_WIDTH = 300;
  const TOOLTIP_EST_HEIGHT = 200;
  const MARGIN = 12;

  const findVisibleTarget = useCallback((target: string): Element | null => {
    const elements = Array.from(document.querySelectorAll(`[data-tutorial="${target}"]`));
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const style = window.getComputedStyle(el);
        if (style.display !== "none" && style.visibility !== "hidden") {
          return el;
        }
      }
    }
    return null;
  }, []);

  const measureTarget = useCallback((retries = 5, gen?: number) => {
    const currentGen = gen ?? measureGenRef.current;
    if (currentGen !== measureGenRef.current) return;

    if (!step?.target) {
      setSpotlightRect(null);
      setReady(true);
      return;
    }
    const el = findVisibleTarget(step.target);
    if (!el) {
      if (retries > 0) {
        setTimeout(() => measureTarget(retries - 1, currentGen), 200);
        return;
      }
      setSpotlightRect(null);
      setReady(true);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      if (currentGen !== measureGenRef.current) return;
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
      setReady(true);
    }, 350);
  }, [step, findVisibleTarget]);

  useLayoutEffect(() => {
    if (!isActive) {
      measureGenRef.current += 1;
      setReady(false);
      setSpotlightRect(null);
      return;
    }

    measureGenRef.current += 1;
    const gen = measureGenRef.current;
    setReady(false);
    setSpotlightRect(null);

    if (step?.page && location !== step.page) {
      setLocation(step.page);
      setTimeout(() => measureTarget(5, gen), 500);
    } else {
      measureTarget(5, gen);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) return;
    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isActive, measureTarget]);

  useEffect(() => {
    if (!spotlightRect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placement = step?.placement || "bottom";

    let left = spotlightRect.left + spotlightRect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - MARGIN));

    const spaceBelow = vh - (spotlightRect.top + spotlightRect.height);
    const spaceAbove = spotlightRect.top;
    const showAbove =
      placement === "top" ||
      (spaceBelow < TOOLTIP_EST_HEIGHT + MARGIN * 2 && spaceAbove > spaceBelow);

    if (showAbove) {
      setTooltipStyle({
        position: "fixed",
        bottom: vh - spotlightRect.top + MARGIN,
        left,
        width: TOOLTIP_WIDTH,
      });
    } else {
      setTooltipStyle({
        position: "fixed",
        top: spotlightRect.top + spotlightRect.height + MARGIN,
        left,
        width: TOOLTIP_WIDTH,
      });
    }
  }, [spotlightRect, step]);

  if (!isActive || !ready) return null;

  const isCentered = !step?.target || !spotlightRect;
  const showNavigationHint = isCentered && !!step?.page && !spotlightRect;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      {isCentered ? (
        <div className="absolute inset-0 bg-black/60" />
      ) : (
        <>
          <div className="absolute inset-0">
            <div
              className="absolute bg-black/60"
              style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotlightRect.top) }}
            />
            <div
              className="absolute bg-black/60"
              style={{
                top: spotlightRect.top + spotlightRect.height,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <div
              className="absolute bg-black/60"
              style={{
                top: spotlightRect.top,
                left: 0,
                width: Math.max(0, spotlightRect.left),
                height: spotlightRect.height,
              }}
            />
            <div
              className="absolute bg-black/60"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left + spotlightRect.width,
                right: 0,
                height: spotlightRect.height,
              }}
            />
          </div>
          <div
            className="absolute rounded-xl ring-2 ring-primary ring-offset-0"
            style={{
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
            }}
          />
        </>
      )}

      <button
        onClick={skipTutorial}
        className="fixed top-4 right-4 z-[10001] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-semibold border border-white/25 hover:bg-white/25 transition-colors"
        data-testid="button-skip-tutorial"
        aria-label="Skip tour"
        style={{ pointerEvents: "auto" }}
      >
        <X className="w-3.5 h-3.5" />
        Skip Tour
      </button>

      {isCentered ? (
        <div
          className="fixed inset-0 flex items-center justify-center p-6 z-[10001]"
          style={{ pointerEvents: "auto" }}
        >
          <TutorialCard
            step={step}
            currentStep={currentStep}
            totalSteps={steps.length}
            isLastStep={isLastStep}
            showNavigationHint={showNavigationHint}
            targetPage={step?.page}
            onNavigate={() => step?.page && setLocation(step.page)}
            onNext={nextStep}
            onPrev={prevStep}
          />
        </div>
      ) : (
        <div style={{ ...tooltipStyle, zIndex: 10001, pointerEvents: "auto" }}>
          <TutorialCard
            step={step}
            currentStep={currentStep}
            totalSteps={steps.length}
            isLastStep={isLastStep}
            showNavigationHint={false}
            targetPage={step?.page}
            onNavigate={() => step?.page && setLocation(step.page)}
            onNext={nextStep}
            onPrev={prevStep}
          />
        </div>
      )}
    </div>
  );
}

function TutorialCard({
  step,
  currentStep,
  totalSteps,
  isLastStep,
  showNavigationHint,
  targetPage,
  onNavigate,
  onNext,
  onPrev,
}: {
  step: { title: string; description: string; page?: string };
  currentStep: number;
  totalSteps: number;
  isLastStep: boolean;
  showNavigationHint: boolean;
  targetPage?: string;
  onNavigate: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const pageNames: Record<string, string> = {
    "/": "Home",
    "/expenses": "Expenses",
    "/budget": "Budget",
    "/goals": "Goals",
    "/family": "Group",
    "/family-dashboard": "Dashboard",
    "/reports": "Reports",
    "/messages": "Messages",
    "/settings": "Settings",
  };

  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-2xl p-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-4 bg-primary"
                  : i < currentStep
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <h3 className="font-display font-bold text-sm text-foreground mb-1">{step.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.description}</p>

      {showNavigationHint && targetPage && (
        <div className="mb-3 rounded-xl bg-primary/8 border border-primary/15 p-2.5">
          <p className="text-[11px] text-muted-foreground mb-2">
            Navigate to {pageNames[targetPage] || targetPage} to see this feature.
          </p>
          <button
            onClick={onNavigate}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            data-testid="button-tutorial-navigate"
          >
            <Navigation className="w-3.5 h-3.5" />
            Go to {pageNames[targetPage] || targetPage}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {currentStep > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            className="h-8 w-8 p-0 rounded-full shrink-0"
            data-testid="button-tutorial-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        <Button
          onClick={onNext}
          size="sm"
          className="flex-1 h-8 rounded-xl text-xs font-semibold"
          data-testid="button-tutorial-next"
        >
          {isLastStep ? (
            "Done!"
          ) : (
            <>
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
