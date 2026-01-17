import { differenceInDays } from "date-fns";

export type GoalPriority = "low" | "medium" | "high";

export function getPriorityScore(goal: { priority?: string; deadline?: Date | string | null }): number {
  const priorityWeights: Record<GoalPriority, number> = { high: 300, medium: 200, low: 100 };
  let score = priorityWeights[(goal.priority as GoalPriority) || "medium"];
  
  if (goal.deadline) {
    const daysUntil = differenceInDays(new Date(goal.deadline), new Date());
    if (daysUntil < 0) {
      score -= 20;
    } else if (daysUntil <= 7) {
      score += 50;
    } else if (daysUntil <= 30) {
      score += 25;
    } else if (daysUntil <= 90) {
      score += 10;
    }
  }
  
  return score;
}

export function sortGoalsByPriority<T extends { priority?: string; deadline?: Date | string | null }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
}
