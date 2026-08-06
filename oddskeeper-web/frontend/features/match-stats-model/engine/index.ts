// Match Stats Model motoru giriş noktası.
import type { ModelInputs, MarketConfig, ModelConfig, ModelOutput } from './types';
import { computeExpectancy } from './expectancy';
import { analyticSegment, monteCarloSegment } from './lines';

export * from './types';
export { computeExpectancy } from './expectancy';

export function runModel(
  inputs: ModelInputs,
  mc: MarketConfig,
  cfg: ModelConfig
): ModelOutput {
  const expectancy = computeExpectancy(inputs, mc, cfg);

  if (cfg.engine === 'montecarlo') {
    return {
      expectancy,
      engine: 'montecarlo',
      // Sabit tohumlar → determinist; segment başına farklı tohum.
      ft: monteCarloSegment(expectancy.ft, cfg, 1001),
      h1: monteCarloSegment(expectancy.h1, cfg, 2002),
      h2: monteCarloSegment(expectancy.h2, cfg, 3003),
    };
  }
  return {
    expectancy,
    engine: 'analytic',
    ft: analyticSegment(expectancy.ft, cfg),
    h1: analyticSegment(expectancy.h1, cfg),
    h2: analyticSegment(expectancy.h2, cfg),
  };
}
