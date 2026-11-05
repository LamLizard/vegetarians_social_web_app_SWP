// Tùng: số liệu chatbot chỉ là aggregate cục bộ, không giữ nội dung hay định danh.
const RETENTION_DAYS = 30;
const DAY_MS = 86400000;
const ZONE = 'Asia/Ho_Chi_Minh';
const MODEL = 'deepseek-flash';
// Khoi's code (07/11/2026): tính cả lần gọi lớp duyệt đầu ra (policy_verification).
const KINDS = new Set(['classifier', 'answer', 'verifier']);
const FIELDS = ['attempts', 'errors', 'inFlight', 'usageKnown', 'usageUnknown',
  'promptTokens', 'completionTokens', 'totalTokens'];
const days = new Map();
let startedAt = null;
let incomplete = false;

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
}

function emptyGroup() {
  return Object.fromEntries(FIELDS.map((field) => [field, 0]));
}

function add(a, b) {
  const sum = a + b;
  return Number.isSafeInteger(sum) && sum >= 0 ? sum : null;
}

function parseUsage(value) {
  const prompt = value?.prompt_tokens;
  const completion = value?.completion_tokens;
  const total = value?.total_tokens;
  if (![prompt, completion, total].every((item) => Number.isSafeInteger(item) && item >= 0)
    || add(prompt, completion) !== total) return null;
  return { prompt, completion, total };
}

// Adapter phải gọi khi đã nối collector; trước đó coverage luôn unknown.
function activate() {
  try {
    if (!startedAt) startedAt = new Date();
  } catch {
    incomplete = true;
  }
}

function begin(kind) {
  try {
    if (!startedAt || !KINDS.has(kind)) { incomplete = true; return null; }
    const now = new Date();
    const date = vietnamDate(now);
    prune(now);
    if (!days.has(date)) days.set(date, new Map());
    const groups = days.get(date);
    if (!groups.has(kind)) groups.set(kind, emptyGroup());
    const group = groups.get(kind);
    const attempts = add(group.attempts, 1);
    const inFlight = add(group.inFlight, 1);
    if (attempts === null || inFlight === null) { incomplete = true; return null; }
    group.attempts = attempts;
    group.inFlight = inFlight;
    let observed = null;
    let finished = false;
    return {
      usage(value) {
        try {
          const parsed = parseUsage(value);
          if (parsed) observed = parsed;
        } catch { incomplete = true; }
      },
      finish(error) {
        if (finished) return;
        finished = true;
        try {
          if (!allowedDate(date) || days.get(date)?.get(kind) !== group) { incomplete = true; return; }
          group.inFlight -= 1;
          if (error) {
            const errors = add(group.errors, 1);
            if (errors === null) incomplete = true;
            else group.errors = errors;
          }
          const prompt = observed && add(group.promptTokens, observed.prompt);
          const completion = observed && add(group.completionTokens, observed.completion);
          const total = observed && add(group.totalTokens, observed.total);
          if (!observed || prompt === null || completion === null || total === null) {
            const unknown = add(group.usageUnknown, 1);
            if (unknown === null) incomplete = true;
            else group.usageUnknown = unknown;
            if (observed) incomplete = true;
            return;
          }
          const known = add(group.usageKnown, 1);
          if (known === null) { incomplete = true; return; }
          group.promptTokens = prompt;
          group.completionTokens = completion;
          group.totalTokens = total;
          group.usageKnown = known;
        } catch { incomplete = true; }
      },
    };
  } catch {
    incomplete = true;
    return null;
  }
}

function getUsage(date, now = new Date()) {
  if (!allowedDate(date, now)) throw new RangeError('Invalid usage date');
  prune(now);
  const groups = [...(days.get(date)?.entries() ?? [])].map(([kind, values]) => ({ kind, ...values }));
  const totals = emptyGroup();
  for (const group of groups) {
    for (const field of FIELDS) {
      const sum = add(totals[field], group[field]);
      if (sum === null) throw new RangeError('Usage aggregate exceeds safe integer');
      totals[field] = sum;
    }
  }
  const start = dateStart(date);
  const end = start + DAY_MS;
  const state = !startedAt || startedAt.getTime() >= end ? 'unknown'
    : startedAt.getTime() > start || incomplete ? 'partial' : 'observed';
  return {
    version: 1, provider: 'deepseek', model: MODEL, date, timezone: ZONE, generatedAt: now.toISOString(),
    source: { scope: 'server_process', startedAt: startedAt?.toISOString() ?? null,
      retentionDays: RETENTION_DAYS, persistent: false },
    coverage: { state, since: startedAt ? new Date(Math.max(start, startedAt.getTime())).toISOString() : null },
    totals, groups,
  };
}

module.exports = { activate, begin, vietnamDate, allowedDate, getUsage };
