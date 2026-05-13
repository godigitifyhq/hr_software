// apps/web/src/lib/utils/scores.ts
export interface ScoreLike {
  weight?: number | null;
  selfScore?: number | null;
  hodScore?: number | null;
  committeeScore?: number | null;
  points?: number | null;
}

export function calcWeightedScore(items: ScoreLike[]): number {
  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight ?? 0),
    0,
  );

  if (totalWeight <= 0) {
    return 0;
  }

  const weightedTotal = items.reduce((sum, item) => {
    const score =
      item.selfScore ??
      item.hodScore ??
      item.committeeScore ??
      item.points ??
      0;
    return sum + Number(score) * Number(item.weight ?? 0);
  }, 0);

  return Number((weightedTotal / totalWeight).toFixed(2));
}

export function calcCompletedCount(
  items: ScoreLike[],
  field: "selfScore" | "hodScore" | "committeeScore" = "selfScore",
): number {
  return items.filter((item) => typeof item[field] === "number").length;
}
