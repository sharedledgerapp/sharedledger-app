import { posthog } from "./posthog";

export function identifyUser(user: {
  id: number;
  name: string;
  username: string;
  currency: string;
  language: string;
  role: string;
}) {
  posthog.identify(String(user.id), {
    name: user.name,
    username: user.username,
    currency: user.currency,
    language: user.language,
    role: user.role,
  });
}

export function resetAnalytics() {
  posthog.reset();
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  posthog.capture(name, properties);
}
