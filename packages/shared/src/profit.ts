// Deterministic profitability math. The AI reasons over these numbers but
// never invents them — every estimate shown to a user comes from here.

export interface ProfitInput {
  postedRate: number;
  /** Loaded distance, origin → destination. */
  distanceKm: number;
  /** Empty distance to reach the pickup. */
  deadheadKm?: number;
  /** All-in operating cost per km (fuel, maintenance, insurance…). */
  costPerKm: number;
  tolls?: number;
}

export interface ProfitEstimate {
  totalKm: number;
  costs: number;
  profit: number;
  /** Profit / rate, 0–100. */
  marginPct: number;
  ratePerKm: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateProfit(input: ProfitInput): ProfitEstimate {
  const deadheadKm = input.deadheadKm ?? 0;
  const totalKm = input.distanceKm + deadheadKm;
  const costs = totalKm * input.costPerKm + (input.tolls ?? 0);
  const profit = input.postedRate - costs;
  const marginPct = input.postedRate > 0 ? (profit / input.postedRate) * 100 : 0;
  return {
    totalKm: round2(totalKm),
    costs: round2(costs),
    profit: round2(profit),
    marginPct: round2(marginPct),
    ratePerKm: input.distanceKm > 0 ? round2(input.postedRate / input.distanceKm) : 0,
  };
}
