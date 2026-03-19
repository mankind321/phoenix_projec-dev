/* eslint-disable @typescript-eslint/no-explicit-any */
export function scoreDSL(dsl: any) {
  let score = 0;

  if (!dsl) return 0;
  if (dsl.filters?.length) score += 0.4;
  if (dsl.geo?.location_text) score += 0.2;
  if (dsl.sort) score += 0.1;
  if (dsl.filters?.length >= 2) score += 0.3;

  return score;
}