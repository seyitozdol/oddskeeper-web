// Match Stats Model motoru giriş noktası.
import type { ModelInputs, MarketConfig, ModelConfig, ModelOutput } from './types';
import { computeExpectancy } from './expectancy';
import { analyticSegment } from './lines';

export * from './types';
export { computeExpectancy } from './expectancy';

// Çizgi/oran motoru: normal CDF ile kapalı-form (deterministik, kesin).
export function runModel(
  inputs: ModelInputs,
  mc: MarketConfig,
  cfg: ModelConfig
): ModelOutput {
  const expectancy = computeExpectancy(inputs, mc, cfg);
  return {
    expectancy,
    ft: analyticSegment(expectancy.ft, cfg),
    h1: analyticSegment(expectancy.h1, cfg),
    h2: analyticSegment(expectancy.h2, cfg),
  };
}
