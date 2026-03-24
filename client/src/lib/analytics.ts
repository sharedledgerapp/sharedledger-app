declare global {
  interface Window {
    posthog?: {
      identify: (id: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

export function identifyUser(user: {
  id: number;
  name: string;
  username: string;
  currency: string;
  language: string;
  role: string;
}) {
  window.posthog?.identify(String(user.id), {
    name: user.name,
    username: user.username,
    currency: user.currency,
    language: user.language,
    role: user.role,
  });
}

export function resetAnalytics() {
  window.posthog?.reset();
}
