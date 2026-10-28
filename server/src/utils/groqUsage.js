// Groq usage is deliberately process-local: no prompts, identities, or provider bodies are retained.
const RETENTION_DAYS = 30;
const STARTED_AT = new Date();
const DAY_MS = 86400000;
const ZONE = 'Asia/Ho_Chi_Minh';
const MODEL_PRICES = Object.freeze({
  'openai/gpt-oss-20b': { input: 75000, cached: 37000, output: 300000,
    sourceUrl: 'https://console.groq.com/docs/model/openai/gpt-oss-20b' },
  'openai/gpt-oss-120b': { input: 150000, cached: 75000, output: 600000,
    sourceUrl: 'https://console.groq.com/docs/model/openai/gpt-oss-120b' },
});
const VALID_KINDS = new Set(['comment', 'post', 'chatbot']);
const days = new Map();
const snapshots = new Map();
let collectorIncomplete = false;

function vietnamDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric',
    month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(start) && vietnamDate(new Date(start)) === value ? start : null;
}

function allowedDate(value, now = new Date()) {
  const start = dateStart(value);
  const today = dateStart(vietnamDate(now));
  return start !== null && today !== null && start <= today && start >= today - (RETENTION_DAYS - 1) * DAY_MS;
}

function prune(now = new Date()) {
  for (const date of days.keys()) if (!allowedDate(date, now)) days.delete(date);
  for (const [model, snapshot] of snapshots) {
    if (now.getTime() - snapshot.time >= RETENTION_DAYS * DAY_MS) snapshots.delete(model);
  }
}

function newGroup(model, kind) {
  return { model, kind, attempts: 0, errors: 0, usageKnown: 0, usageUnknown: 0,
    inFlight: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0,
    costNumerator: 0, costKnown: 0, costUnknown: 0 };
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function safeSum(a, b) {
  const sum = a + b;
  return integer(sum) ? sum : null;
}

function parseUsage(value) {
  const prompt = value?.prompt_tokens;
  const completion = value?.completion_tokens;
  const total = value?.total_tokens;
  if (!integer(prompt) || !integer(completion) || !integer(total) || safeSum(prompt, completion) !== total) return null;
  const cachedValue = value?.prompt_tokens_details?.cached_tokens;
  const cached = integer(cachedValue) && cachedValue <= prompt ? cachedValue : null;
  return { prompt, completion, total, cached };
}

function durationMs(value) {
  if (typeof value !== 'string' || !value) return null;
  const match = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value);
  if (!match || !match.slice(1).some((part) => part !== undefined)) return null;
  const ms = (Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600
    + Number(match[3] || 0) * 60 + Number(match[4] || 0)) * 1000;
  return Number.isFinite(ms) && ms >= 0 && ms <= 365 * DAY_MS ? Math.round(ms) : null;
}

function headerNumber(headers, name) {
  const value = headers?.get(name);
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return integer(number) ? number : null;
}

function limitPair(headers, unit, observedAt) {
  const limit = headerNumber(headers, `x-ratelimit-limit-${unit}`);
  const remaining = headerNumber(headers, `x-ratelimit-remaining-${unit}`);
  if (limit === null || remaining === null || remaining > limit) return null;
  const resetMs = durationMs(headers?.get(`x-ratelimit-reset-${unit}`));
  return { limit, remaining, resetAt: resetMs === null ? null : new Date(observedAt + resetMs).toISOString() };
}

function observeHeaders(model, headers) {
  const now = Date.now();
  const requestsPerDay = limitPair(headers, 'requests', now);
  const tokensPerMinute = limitPair(headers, 'tokens', now);
  if (!requestsPerDay && !tokensPerMinute) return;
  const previous = snapshots.get(model);
  if (!previous || now >= previous.time) snapshots.set(model, {
    time: now, model, observedAt: new Date(now).toISOString(), requestsPerDay, tokensPerMinute,
  });
}

// A handle is created once per attempted fetch; all methods are synchronous and best effort.
function begin(model, kind) {
  try {
    if (!Object.hasOwn(MODEL_PRICES, model) || !VALID_KINDS.has(kind)) {
      collectorIncomplete = true;
      return null;
    }
    const started = new Date();
    const date = vietnamDate(started);
    prune(started);
    if (!days.has(date)) days.set(date, new Map());
    const groups = days.get(date);
    const key = `${model}:${kind}`;
    if (!groups.has(key)) groups.set(key, newGroup(model, kind));
    const group = groups.get(key);
    group.attempts += 1;
    group.inFlight += 1;
    let usage = null;
    let finished = false;
    return {
      headers(value) { try { observeHeaders(model, value); } catch { collectorIncomplete = true; } },
      usage(value) { try { usage = parseUsage(value); } catch { collectorIncomplete = true; } },
      finish(error) {
        if (finished) return;
        finished = true;
        try {
          if (!allowedDate(date) || days.get(date)?.get(key) !== group) {
            collectorIncomplete = true;
            return;
          }
          group.inFlight -= 1;
          if (error) group.errors += 1;
          const prompt = usage && safeSum(group.promptTokens, usage.prompt);
          const completion = usage && safeSum(group.completionTokens, usage.completion);
          const total = usage && safeSum(group.totalTokens, usage.total);
          if (!usage || prompt === null || completion === null || total === null) {
            group.usageUnknown += 1;
            group.costUnknown += 1;
            return;
          }
          group.usageKnown += 1;
          group.promptTokens = prompt;
          group.completionTokens = completion;
          group.totalTokens = total;
          const price = MODEL_PRICES[model];
          const numerator = usage.cached === null ? null : (usage.prompt - usage.cached) * price.input
            + usage.cached * price.cached + usage.completion * price.output;
          const cost = integer(numerator) ? safeSum(group.costNumerator, numerator) : null;
          if (cost === null) group.costUnknown += 1;
          else { group.costKnown += 1; group.costNumerator = cost; }
        } catch { collectorIncomplete = true; }
      },
    };
  } catch {
    collectorIncomplete = true;
    return null;
  }
}

function serializeGroup(group) {
  const { costNumerator, costKnown, costUnknown, ...result } = group;
  return { ...result, estimatedUsd: costKnown ? costNumerator / 1e12 : null,
    costState: !costKnown ? 'unknown' : costUnknown || group.inFlight ? 'partial' : 'known' };
}

function getUsage(date, now = new Date()) {
  if (!allowedDate(date, now)) throw new RangeError('Invalid usage date');
  prune(now);
  const rawGroups = [...(days.get(date)?.values() ?? [])];
  const totals = newGroup(null, null);
  for (const group of rawGroups) {
    for (const field of ['attempts', 'errors', 'usageKnown', 'usageUnknown', 'inFlight',
      'promptTokens', 'completionTokens', 'totalTokens', 'costNumerator', 'costKnown', 'costUnknown']) {
      const sum = safeSum(totals[field], group[field]);
      if (sum === null) throw new RangeError('Usage aggregate exceeds safe integer');
      totals[field] = sum;
    }
  }
  const start = dateStart(date);
  const end = start + DAY_MS;
  const coverage = STARTED_AT.getTime() >= end ? 'unknown'
    : STARTED_AT.getTime() > start || collectorIncomplete ? 'partial' : 'observed';
  const { model: _model, kind: _kind, ...totalValues } = serializeGroup(totals);
  return {
    version: 1, date, timezone: ZONE, generatedAt: now.toISOString(),
    source: { scope: 'server_process', startedAt: STARTED_AT.toISOString(), retentionDays: RETENTION_DAYS, persistent: false },
    coverage: { state: coverage, since: new Date(Math.max(start, STARTED_AT.getTime())).toISOString(),
      message: 'Số liệu chỉ từ tiến trình hiện tại và có thể chưa đầy đủ.' },
    totals: totalValues,
    groups: rawGroups.map(serializeGroup),
    limits: Object.keys(MODEL_PRICES).map((model) => {
      const snapshot = snapshots.get(model);
      return snapshot ? { model, observedAt: snapshot.observedAt, requestsPerDay: snapshot.requestsPerDay,
        tokensPerMinute: snapshot.tokensPerMinute }
        : { model, observedAt: null, requestsPerDay: null, tokensPerMinute: null };
    }),
    prices: Object.entries(MODEL_PRICES).map(([model, price]) => ({ model, sourceUrl: price.sourceUrl,
      observedOn: '2026-10-28', basis: 'public_list_price_estimate', currency: 'USD' })),
  };
}

module.exports = { begin, vietnamDate, allowedDate, getUsage };
