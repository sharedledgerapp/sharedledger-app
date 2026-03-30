import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function usePwaInstall() {
  const [isInstallable, setIsInstallable] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(isStandalone);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const onInstalled = () => {
      deferredPrompt = null;
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setIsInstallable(false);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const showIosInstructions = isIos && isSafari && !isInstalled;

  return { isInstallable, isInstalled, promptInstall, showIosInstructions, isIos };
}
