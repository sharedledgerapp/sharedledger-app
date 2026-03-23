import { createContext, useContext, useState, useCallback } from "react";
import { TUTORIAL_STEPS, TUTORIAL_STORAGE_KEY, type TutorialStep } from "@/lib/tutorial-steps";

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= TUTORIAL_STEPS.length) {
        setIsActive(false);
        localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
        return 0;
      }
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  }, []);

  return (
    <TutorialContext.Provider
      value={{ isActive, currentStep, steps: TUTORIAL_STEPS, startTutorial, nextStep, prevStep, skipTutorial }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
