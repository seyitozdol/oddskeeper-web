// ─── Status inference ─────────────────────────────────────────────────────────

export type InferredStatus = "Pos. Starter" | "Pos. Sub" | "Out";

/**
 * Infer default status from last N matches.
 * Weights recent matches more heavily.
 * starter ≥ 7/10 → Pos. Starter
 * starter 3-6/10 → Pos. Sub (depends on weight)
 * starter < 3/10 → Pos. Sub or Out
 */
export function inferPlayerStatus(
  matches: Array<{ lineup_status: string; minutes_played: number }>,
  appearances: number,
  lastMatchDatetime?: string | null
): InferredStatus {
  // Never played this season → Out
  if (appearances === 0) return "Out";

  // Last match too long ago (>90 days) → Out
  if (lastMatchDatetime) {
    const lastMatch = new Date(lastMatchDatetime);
    const now = new Date();
    const daysSince = (now.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 90) return "Out";
  }

  // No recent match log data — fall back on appearances count
  if (matches.length === 0) {
    if (appearances >= 5) return "Pos. Starter";
    if (appearances >= 2) return "Pos. Sub";
    return "Out";
  }

  const n = Math.min(matches.length, 10);
  let starterWeight = 0;
  let subWeight = 0;
  let totalWeight = 0;

  for (let i = 0; i < n; i++) {
    const weight = n - i;
    totalWeight += weight;
    const status = matches[i].lineup_status?.toLowerCase();
    if (status === "starter") starterWeight += weight;
    else if (status === "substitute") subWeight += weight;
  }

  if (totalWeight === 0) return "Out";

  const starterRatio = starterWeight / totalWeight;
  const subRatio = subWeight / totalWeight;

  if (starterRatio >= 0.55) return "Pos. Starter";
  if (subRatio >= 0.3 || starterRatio >= 0.2) return "Pos. Sub";
  return "Out";
}

// ─── Distribution of market expectation ──────────────────────────────────────

export type PlayerEntry = {
  player_source_id: string;
  status: InferredStatus;
  seasonAvg: number | null; // per_match_value
  manualValue: number | string; // "" = not set
};

/**
 * Distribute distExp across starters + subs (not Out) proportionally by season avg.
 * If manual is set (non-empty, non-zero string), use that instead of distExp share.
 */
export function distributeExpectation(
  players: PlayerEntry[],
  distExp: number
): Record<string, number> {
  const eligible = players.filter((p) => p.status !== "Out");

  // Sum of season avgs for eligible players
  const totalAvg = eligible.reduce((sum, p) => sum + (p.seasonAvg ?? 0), 0);

  const result: Record<string, number> = {};

  for (const p of players) {
    // Manual override
    const manNum = parseFloat(String(p.manualValue));
    if (!isNaN(manNum) && manNum > 0) {
      result[p.player_source_id] = manNum;
      continue;
    }

    if (p.status === "Out") {
      result[p.player_source_id] = 0;
      continue;
    }

    if (totalAvg <= 0) {
      // Equal distribution
      result[p.player_source_id] = distExp / Math.max(eligible.length, 1);
    } else {
      const share = (p.seasonAvg ?? 0) / totalAvg;
      result[p.player_source_id] = distExp * share;
    }
  }

  return result;
}

// ─── Poisson helpers ──────────────────────────────────────────────────────────

/** Poisson CDF: P(X <= k) = sum_{i=0}^{k} e^(-lambda) * lambda^i / i! */
export function poissonCDF(lambda: number, k: number): number {
  if (lambda <= 0) return k >= 0 ? 1 : 0;
  let sum = 0;
  let term = Math.exp(-lambda);
  sum += term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(sum, 1);
}

/** P(X > line) = 1 - P(X <= floor(line)) */
export function overProb(lambda: number, line: number): number {
  return 1 - poissonCDF(lambda + 0.17, Math.floor(line));
}

/** Convert probability to decimal odds with payback */
export function probToOdds(prob: number, paybackPct: number): number {
  if (prob <= 0) return 999;
  if (prob >= 1) return 1.01;
  const rawOdds = 1 / prob;
  return rawOdds * (paybackPct / 100);
}

// ─── Mid-line finder ─────────────────────────────────────────────────────────

/**
 * Find mid line: the X.5 line where |over% - under%| is minimised.
 * Arama araligi beklentiye gore genisler; sabit 30.5 tavani buyuk
 * beklentili marketlerde (pas, isabetli pas) yanlis line uretiyordu.
 */
export function findMidLine(lambda: number): number {
  let bestLine = 0.5;
  let bestDiff = Infinity;

  const maxI = Math.max(30, Math.ceil(lambda) + 10);
  for (let i = 0; i <= maxI; i++) {
    const line = i + 0.5;
    const ov = overProb(lambda, line);
    const un = 1 - ov;
    const diff = Math.abs(ov - un);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLine = line;
    }
  }
  return bestLine;
}

// ─── First line finder (Excel formula equivalent) ────────────────────────────

/**
 * Excel: =MAX(0.5, ROUND(exp-0.5, 0) + 0.5) - 3
 * Then ensure it's an X.5 value.
 */
export function findFirstLine(exp: number): number {
  const rounded = Math.round(exp - 0.5) + 0.5;
  const raw = Math.max(0.5, rounded) - 3;
  // Snap to nearest 0.5
  const snapped = Math.round(raw * 2) / 2;
  return Math.max(0.5, snapped);
}

// ─── Lines to display ────────────────────────────────────────────────────────

export type OddsLine = {
  line: number;
  overProb: number;
  underProb: number;
  overOdds: number;
  underOdds: number;
};

/**
 * Determine which 2 lines to show:
 * - Find mid line
 * - Check if (mid - 0.5) over odds >= 1.2
 *   → If yes: show [mid-0.5, mid]
 *   → If no:  show [mid, mid+0.5] (wait, spec says mid and mid+1?)
 *
 * Re-reading spec:
 * "eğer midline değerinin bir altı (mid line - 0.5) line ın over değeri 1.2 veya üstünde ise
 *  ilk yazdırılacak min line bu line olur. değilse mid line ve mid line +1 line ı yazdırılır"
 *
 * So:
 *   if over odds at (mid-0.5) >= 1.2 → show [mid-0.5, mid]
 *   else → show [mid, mid+1.0]  (mid+1 is next X.5 which is mid+1.0)
 */
export function calcOddsLines(exp: number, paybackPct: number): OddsLine[] {
  if (exp <= 0) return [];

  const mid = findMidLine(exp); // always X.5 (e.g. 3.5)

  // One step below mid = mid - 1.0 (prev X.5, e.g. 2.5)
  // One step above mid = mid + 1.0 (next X.5, e.g. 4.5)
  const lowerLine = Math.max(0.5, mid - 1.0);
  const lowerOverP = overProb(exp, lowerLine);
  const lowerOverOdds = probToOdds(lowerOverP, paybackPct);

  let lines: number[];
  if (lowerLine < mid && lowerOverOdds >= 1.2) {
    lines = [lowerLine, mid];
  } else {
    lines = [mid, mid + 1.0];
  }

  // Secilen ciftin ustune iki line daha ekle (or. 0.5, 1.5 -> 2.5, 3.5)
  const last = lines[lines.length - 1];
  lines.push(last + 1.0, last + 2.0);

  // Deduplicate (guard)
  const unique = [...new Set(lines)];

  return unique.map((line) => {
    const ov = overProb(exp, line);
    const un = 1 - ov;
    return {
      line,
      overProb: ov,
      underProb: un,
      overOdds: probToOdds(ov, paybackPct),
      underOdds: probToOdds(un, paybackPct),
    };
  });
}
