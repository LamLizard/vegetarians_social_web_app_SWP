const PREFIX = 'vegetarian-chat-session-v1:';
const V2_PREFIX = 'vegetarian-chat-session-v2:';

// Tùng: chỉ lưu chủ đề và ID đã hiện, không biến metadata thành quyền đọc bài.
function validPostDiscovery(entries) {
  return Array.isArray(entries) && entries.every((entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
    && Object.keys(entry).length === 2 && Object.keys(entry).every((key) => ['subject', 'postId'].includes(key))
    && typeof entry.subject === 'string' && Boolean(entry.subject.trim())
    && Array.from(entry.subject).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(entry.subject)
    && typeof entry.postId === 'string' && /^[1-9]\d{0,17}$/.test(entry.postId)
  ));
}

// Tùng: metadata chỉ mô tả bài đã hiện, không cấp quyền xem bài.
function validPostContext(context) {
  const keysAre = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const validSubject = (value) => typeof value === 'string' && Boolean(value.trim())
    && Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
  const key = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const validId = (id) => typeof id === 'string' && /^[1-9]\d{0,17}$/.test(id);
  if (!keysAre(context, ['version', 'state', 'activeSubject', 'topics', 'delivery'])
    || context.version !== 1 || !['known', 'unknown'].includes(context.state)
    || (context.activeSubject !== null && !validSubject(context.activeSubject))
    || !Array.isArray(context.topics)) return false;
  const subjects = new Set();
  for (const topic of context.topics) {
    if (!keysAre(topic, ['subject', 'seenIds']) || !validSubject(topic.subject)
      || !Array.isArray(topic.seenIds) || !topic.seenIds.every(validId)
      || new Set(topic.seenIds).size !== topic.seenIds.length || subjects.has(key(topic.subject))) return false;
    subjects.add(key(topic.subject));
  }
  if (context.activeSubject !== null && !subjects.has(key(context.activeSubject))) return false;
  if (context.delivery === null) return true;
  const delivery = context.delivery;
  if (!keysAre(delivery, ['turnId', 'subject', 'postId', 'state'])
    || typeof delivery.turnId !== 'string' || !OPERATION_UUID.test(delivery.turnId)
    || !validSubject(delivery.subject) || !validId(delivery.postId)
    || !['pending', 'shown'].includes(delivery.state)) return false;
  return context.topics.some((topic) => key(topic.subject) === key(delivery.subject)
    && topic.seenIds.includes(delivery.postId));
}

export function readChatSession(scope) {
  if (!scope) return null;
  // Tùng: ưu tiên history mới, giữ nguyên record v1 để không mất dữ liệu cũ.
  const v2 = localStorage.getItem(V2_PREFIX + scope);
  const raw = v2 ?? localStorage.getItem(PREFIX + scope);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || (v2 !== null && value.version !== 2) || typeof value.token !== 'string' || value.token.length > 1024
    || (value.flowToken !== undefined && (typeof value.flowToken !== 'string' || value.flowToken.length > 2048))
    || (value.postDiscovery !== undefined && !validPostDiscovery(value.postDiscovery))
    || (value.postContext !== undefined && !validPostContext(value.postContext))
    || !Array.isArray(value.messages)
    || !value.messages.every((message) => (
      ['user', 'bot'].includes(message.sender) && typeof message.content === 'string'
      && Array.from(message.content).length <= 10000
      && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(message.content)
      && (message.limited === undefined || (message.sender === 'bot' && typeof message.limited === 'boolean'))
      && (message.status === undefined || ['complete', 'failed', 'waiting', 'streaming'].includes(message.status))
      && (message.turnId === undefined || (typeof message.turnId === 'string' && OPERATION_UUID.test(message.turnId)))
      && (message.error === undefined || (typeof message.error === 'string' && message.error.length <= 1000))
      && (message.question === undefined || (typeof message.question === 'string' && Array.from(message.question).length <= 10000
        && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(message.question)))
      && (message.result === undefined || (message.sender === 'bot' && message.result?.kind === 'post'
        && /^[1-9]\d{0,17}$/.test(String(message.result?.item?.id)) && typeof message.result?.item?.title === 'string'))
    ))) throw new Error('Phiên trò chuyện không hợp lệ.');
  return { ...value,
    ...(value.postContext?.delivery?.state === 'pending'
      ? { postContext: { ...value.postContext, state: 'unknown' } } : {}),
    messages: value.messages.map((message) => {
      const incomplete = message.sender === 'bot' && ['waiting', 'streaming'].includes(message.status);
      return { ...message, status: incomplete ? 'failed' : (message.status ?? 'complete'),
        ...(incomplete ? { error: 'Chưa xác định được kết quả của lượt trước.' } : {}) };
    }) };
}

export function writeChatSession(scope, token, messages, flowToken, postDiscovery, postContext) {
  // Tùng: lưu UI history đầy đủ; giới hạn 10 cặp chỉ áp dụng khi gửi model.
  if (postDiscovery !== undefined && !validPostDiscovery(postDiscovery)) throw new Error('Phiên trò chuyện không hợp lệ.');
  if (postContext !== undefined && !validPostContext(postContext)) throw new Error('Phiên trò chuyện không hợp lệ.');
  localStorage.setItem(V2_PREFIX + scope, JSON.stringify({ version: 2, token, messages,
    ...(flowToken ? { flowToken } : {}), ...(postDiscovery !== undefined ? { postDiscovery } : {}),
    ...(postContext !== undefined ? { postContext } : {}) }));
}

export function clearChatSession(scope) {
  if (scope) localStorage.removeItem(PREFIX + scope);
}

// Tùng: bỏ helper planner không còn consumer, giữ nguyên record local cũ.
const OPERATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHAT_PENDING_PREFIX = 'vegetarian-chat-member-pending-v1:';

export function readPendingMemberChat(accountId) {
  const raw = localStorage.getItem(CHAT_PENDING_PREFIX + accountId);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.operationId !== 'string' || !OPERATION_UUID.test(value.operationId)
    || (value.protocol === 'v2' && (!Object.keys(value).every((key) => ['operationId', 'protocol', 'payloadHash', 'receipt', 'flowToken', 'sessionToken'].includes(key))
      || !/^[0-9a-f]{64}$/.test(value.payloadHash)
      || (value.receipt !== undefined && (typeof value.receipt !== 'string' || value.receipt.length > 2048))
      || (value.flowToken !== undefined && (typeof value.flowToken !== 'string' || value.flowToken.length > 2048))
      || (value.sessionToken !== undefined && (typeof value.sessionToken !== 'string' || value.sessionToken.length > 1024))))
    || (value.protocol !== 'v2' && Object.keys(value).length !== 1)) throw new Error('STORAGE_UNAVAILABLE');
  return value;
}

export async function reservePendingMemberChat(accountId, operationId, metadata = {}) {
  if (!navigator.locks || !OPERATION_UUID.test(operationId)) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CHAT_PENDING_PREFIX + accountId, () => {
    if (readPendingMemberChat(accountId)) throw new Error('CHAT_PENDING');
    localStorage.setItem(CHAT_PENDING_PREFIX + accountId, JSON.stringify({ operationId, ...metadata }));
  });
}

export async function setPendingMemberReceipt(accountId, operationId, receipt) {
  if (!navigator.locks || typeof receipt !== 'string' || receipt.length > 2048) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CHAT_PENDING_PREFIX + accountId, () => {
    const current = readPendingMemberChat(accountId);
    if (!current || current.operationId !== operationId || current.protocol !== 'v2') throw new Error('STORAGE_UNAVAILABLE');
    const next = { ...current, receipt };
    localStorage.setItem(CHAT_PENDING_PREFIX + accountId, JSON.stringify(next));
    return next;
  });
}

export async function clearUnstartedMemberChat(accountId, operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CHAT_PENDING_PREFIX + accountId, () => {
    const current = readPendingMemberChat(accountId);
    if (current?.operationId === operationId && current.protocol === 'v2' && !current.receipt) {
      localStorage.removeItem(CHAT_PENDING_PREFIX + accountId);
      return { cleared: true, pending: null };
    }
    return { cleared: false, pending: current };
  });
}

export async function clearPendingMemberChat(accountId, operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CHAT_PENDING_PREFIX + accountId, () => {
    if (readPendingMemberChat(accountId)?.operationId === operationId) {
      localStorage.removeItem(CHAT_PENDING_PREFIX + accountId);
    }
    return readPendingMemberChat(accountId);
  });
}
