/** Every model entry across every plan, deduplicated by id. */
export function getAllKnownModels(quota) {
  const dedup = new Map();
  for (const plan of Object.values(quota.plans)) {
    for (const model of plan) {
      if (!dedup.has(model.id)) dedup.set(model.id, model);
    }
  }
  return Array.from(dedup.values());
}

/** Matches a ChatGPT API model slug (e.g. "gpt-5-thinking") to a known model id. */
export function matchModelId(apiModelSlug, knownModels) {
  if (!apiModelSlug) return null;
  const slug = String(apiModelSlug).toLowerCase();

  const exact = knownModels.find((m) => m.aliases.some((alias) => alias.toLowerCase() === slug));
  if (exact) return exact.id;

  // Fall back to substring containment, preferring the longest alias match
  // so e.g. "gpt-4-1-mini" isn't mistakenly matched by the shorter "gpt-4-1".
  const candidates = knownModels
    .flatMap((m) => m.aliases.map((alias) => ({ id: m.id, alias: alias.toLowerCase() })))
    .sort((a, b) => b.alias.length - a.alias.length);

  const match = candidates.find(({ alias }) => slug.includes(alias) || alias.includes(slug));
  return match ? match.id : null;
}

/**
 * Computes usage for each model in a plan given recorded timestamps and any
 * custom overrides.
 * @param {Array<{id: string, label: string, quota: number, hours: number}>} models
 * @param {Record<string, number[]>} timestampsByModelId
 * @param {Record<string, {quota?: number, hours?: number}>} customLimits
 * @param {number} now
 */
export function computeUsage(models, timestampsByModelId, customLimits, now) {
  return models.map((model) => {
    const override = customLimits[model.id];
    const quota = override?.quota ?? model.quota;
    const hours = override?.hours ?? model.hours;
    const timestamps = timestampsByModelId[model.id] || [];
    const windowStart = now - hours * 60 * 60 * 1000;
    const recent = timestamps.filter((ts) => ts >= windowStart);
    const oldestInWindow = recent.length ? Math.min(...recent) : null;
    const resetsAt = oldestInWindow ? oldestInWindow + hours * 60 * 60 * 1000 : null;

    return {
      id: model.id,
      label: model.label,
      used: recent.length,
      quota,
      hours,
      unlimited: quota < 0,
      resetsAt,
    };
  });
}
