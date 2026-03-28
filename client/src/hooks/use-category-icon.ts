import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CACHE_KEY = "category_icon_cache";

const PRESET_EMOJI: Record<string, string> = {
  Food: "🍔",
  Transport: "🚌",
  Entertainment: "🎮",
  Shopping: "🛍️",
  Utilities: "💡",
  Education: "📚",
  Health: "🏥",
  Other: "📦",
};

const PRESET_ICON: Record<string, string> = {
  Subscriptions: "CreditCard",
  Utilities: "Zap",
  Taxes: "Building",
  Insurance: "Shield",
  Other: "Package",
};

function loadCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
  }
}

const memoryCache: Record<string, string> = loadCache();
const pendingRequests = new Set<string>();

async function fetchSuggestion(category: string, type: "emoji" | "icon"): Promise<string> {
  const cacheKey = `${type}:${category}`;
  if (memoryCache[cacheKey] !== undefined) {
    return memoryCache[cacheKey];
  }
  if (pendingRequests.has(cacheKey)) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (memoryCache[cacheKey] !== undefined || !pendingRequests.has(cacheKey)) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    return memoryCache[cacheKey] ?? (type === "emoji" ? "💸" : "Package");
  }

  pendingRequests.add(cacheKey);
  try {
    const res = await apiRequest("POST", "/api/suggest-category-icon", { category, type });
    const data = await res.json();
    const value: string = data.value ?? (type === "emoji" ? "💸" : "Package");
    memoryCache[cacheKey] = value;
    saveCache(memoryCache);
    return value;
  } catch {
    const fallback = type === "emoji" ? "💸" : "Package";
    memoryCache[cacheKey] = fallback;
    saveCache(memoryCache);
    return fallback;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

function resolvedOrFallback(cacheKey: string, fallback: string): string {
  return memoryCache[cacheKey] !== undefined ? memoryCache[cacheKey] : fallback;
}

export function useCategoryEmoji(category: string): string {
  const preset = PRESET_EMOJI[category];
  const cacheKey = `emoji:${category}`;

  const [emoji, setEmoji] = useState<string>(() =>
    preset ?? resolvedOrFallback(cacheKey, "💸")
  );

  useEffect(() => {
    const immediate = preset ?? memoryCache[cacheKey];
    if (immediate !== undefined) {
      setEmoji(immediate);
      return;
    }
    setEmoji("💸");
    let cancelled = false;
    fetchSuggestion(category, "emoji").then((val) => {
      if (!cancelled) setEmoji(val);
    });
    return () => { cancelled = true; };
  }, [category, preset, cacheKey]);

  return emoji;
}

export function useCategoryIconName(category: string): string {
  const preset = PRESET_ICON[category];
  const cacheKey = `icon:${category}`;

  const [iconName, setIconName] = useState<string>(() =>
    preset ?? resolvedOrFallback(cacheKey, "Package")
  );

  useEffect(() => {
    const immediate = preset ?? memoryCache[cacheKey];
    if (immediate !== undefined) {
      setIconName(immediate);
      return;
    }
    setIconName("Package");
    let cancelled = false;
    fetchSuggestion(category, "icon").then((val) => {
      if (!cancelled) setIconName(val);
    });
    return () => { cancelled = true; };
  }, [category, preset, cacheKey]);

  return iconName;
}

export function getLucideIcon(iconName: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
  return icons[iconName] ?? (LucideIcons.Package as LucideIcon);
}
