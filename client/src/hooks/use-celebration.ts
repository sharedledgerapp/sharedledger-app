import confetti from "canvas-confetti";

export type CelebrationIntensity = "light" | "full";

function fireSideCannons(count: number, startVelocity: number) {
  const defaults = { startVelocity, spread: 55, ticks: 60, zIndex: 9999 };
  confetti({ ...defaults, particleCount: count, origin: { x: 0, y: 0.6 }, angle: 60 });
  confetti({ ...defaults, particleCount: count, origin: { x: 1, y: 0.6 }, angle: 120 });
}

export function useCelebration() {
  function celebrate(intensity: CelebrationIntensity = "full") {
    if (intensity === "light") {
      fireSideCannons(40, 25);
    } else {
      fireSideCannons(80, 30);
      setTimeout(() => fireSideCannons(80, 30), 400);
    }
  }

  return { celebrate };
}
