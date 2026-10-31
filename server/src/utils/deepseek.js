// Tùng: adapter riêng cho chatbot để không ảnh hưởng kiểm duyệt Groq.
const { recordProviderError, clearProviderError } = require('../models/aiConfig.model');

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-flash';
const MAX_BYTES = 256 * 1024;
const MAX_POINTS = 10000;

function failure(code = 'MODEL_UNAVAILABLE') {
  return Object.assign(new Error(code), { code });
}

// Tùng: không bắt đầu bước provider mới khi timer chưa kịp báo hết hạn.
function ensureActive(signal, deadlineAt) {
  if (signal?.aborted || (Number.isFinite(deadlineAt) && Date.now() >= deadlineAt)) throw failure('DEADLINE_EXCEEDED');
}

// Tùng: bỏ từng cặp cũ thay vì cắt câu hỏi hoặc hồ sơ bắt buộc.
function fitMessages(prefix, history, suffix) {
  const pairs = history.map(({ sender, content }) => ({ role: sender === 'bot' ? 'assistant' : 'user', content }));
  if (pairs.length % 2) throw failure('INVALID_INPUT');
  for (let start = 0; start <= pairs.length; start += 2) {
    const messages = [...prefix, ...pairs.slice(start), ...suffix];
    if (Buffer.byteLength(JSON.stringify(messages), 'utf8') <= MAX_BYTES) return messages;
  }
  throw failure('CONTEXT_BUDGET_EXCEEDED');
}

// Tùng: giữ lịch sử làm dữ liệu classifier và tính cả JSON đã escape trong byte budget.
function fitClassifierMessages(system, history, currentText, postSubject = null) {
  if (history.length % 2) throw failure('INVALID_INPUT');
  for (let start = 0; start <= history.length; start += 2) {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ history: history.slice(start), currentMessage: currentText, postSubject }) },
    ];
    if (Buffer.byteLength(JSON.stringify(messages), 'utf8') <= MAX_BYTES) return messages;
  }
  throw failure('CONTEXT_BUDGET_EXCEEDED');
}

async function openCompletion(messages, { signal, deadlineAt, stream, maxTokens, json = false }) {
  ensureActive(signal, deadlineAt);
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  // Tùng: chỉ báo mã cấu hình thiếu, không ghi key hay nội dung request.
  if (!key) { recordProviderError('deepseek', 'UNAVAILABLE'); throw failure('DEEPSEEK_KEY_MISSING'); }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, stream, max_tokens: maxTokens,
        thinking: { type: 'disabled' }, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    ensureActive(signal, deadlineAt);
    if (!response.ok) {
      // Tùng: giữ riêng 429 để admin không thấy nhầm thành lỗi kết nối.
      recordProviderError('deepseek', response.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE');
      throw failure(response.status === 429 ? 'MODEL_RATE_LIMITED' : `PROVIDER_HTTP_${response.status}`);
    }
    return response;
  } catch (error) {
    if (!signal?.aborted && !['DEADLINE_EXCEEDED', 'MODEL_RATE_LIMITED'].includes(error.code)) recordProviderError('deepseek', 'UNAVAILABLE');
    throw error.code ? error : failure('PROVIDER_NETWORK_ERROR');
  }
}

async function classify(messages, signal, deadlineAt) {
  const response = await openCompletion(messages, { signal, deadlineAt, stream: false, maxTokens: 1024, json: true });
  try {
    ensureActive(signal, deadlineAt);
    const result = await response.json();
    ensureActive(signal, deadlineAt);
    const choice = result?.choices?.[0];
    if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string'
      || Buffer.byteLength(choice.message.content, 'utf8') > MAX_BYTES) throw failure('PROVIDER_RESPONSE_INVALID');
    clearProviderError('deepseek');
    return choice.message.content;
  } catch (error) {
    if (!signal?.aborted && error.code !== 'DEADLINE_EXCEEDED') recordProviderError('deepseek', 'UNAVAILABLE');
    throw error.code ? error : failure('PROVIDER_RESPONSE_INVALID');
  }
}

// Tùng: giữ partial khi vượt giới hạn và chỉ coi stop là câu trả lời hoàn tất.
async function streamAnswer(messages, { signal, deadlineAt, onDelta, maxPoints = MAX_POINTS }) {
  const response = await openCompletion(messages, { signal, deadlineAt, stream: true, maxTokens: 4096 });
  if (!response.body) throw failure();
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let carry = '';
  let count = 0;
  let finishReason = null;
  let doneMarker = false;
  let limited = false;
  try {
    while (!doneMarker && !limited) {
      ensureActive(signal, deadlineAt);
      const chunk = await reader.read();
      ensureActive(signal, deadlineAt);
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > MAX_BYTES) throw failure();
      let boundary;
      while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
        ensureActive(signal, deadlineAt);
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r\n|\r|\n/).filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        if (data === '[DONE]') { doneMarker = true; break; }
        const parsed = JSON.parse(data);
        const choice = parsed?.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const text = choice.delta?.content;
        if (text !== undefined && text !== null) {
          if (typeof text !== 'string') throw failure();
          let value = carry + text;
          carry = '';
          if (/[\uD800-\uDBFF]$/.test(value)) { carry = value.slice(-1); value = value.slice(0, -1); }
          if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)) throw failure();
          const points = Array.from(value);
          const allowed = points.slice(0, Math.max(0, Math.min(MAX_POINTS, maxPoints) - count));
          count += allowed.length;
          if (allowed.length) onDelta(allowed.join(''));
          if (allowed.length < points.length) { limited = true; break; }
        }
      }
      if (chunk.done) break;
    }
    if (carry) throw failure();
    if (limited || finishReason === 'length') return { complete: false, limited: true };
    if (!doneMarker || finishReason !== 'stop' || count === 0) throw failure();
    clearProviderError('deepseek');
    return { complete: true, limited: false };
  } catch (error) {
    if (!signal?.aborted && error.code !== 'DEADLINE_EXCEEDED') recordProviderError('deepseek', 'UNAVAILABLE');
    throw error.code ? error : failure('PROVIDER_RESPONSE_INVALID');
  } finally {
    void reader.cancel().catch(() => {});
  }
}

module.exports = { fitMessages, fitClassifierMessages, classify, streamAnswer };
