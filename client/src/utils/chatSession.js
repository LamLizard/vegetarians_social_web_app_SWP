const PREFIX = 'vegetarian-chat-session-v1:';

export function readChatSession(scope) {
  if (!scope) return null;
  const raw = localStorage.getItem(PREFIX + scope);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.token !== 'string'
    || (value.flowToken !== undefined && (typeof value.flowToken !== 'string' || value.flowToken.length > 2048))
    || !Array.isArray(value.messages)
    || !value.messages.every((message) => (
      ['user', 'bot'].includes(message.sender) && typeof message.content === 'string'
      && Array.from(message.content).length <= 10000
      && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(message.content)
      && (message.limited === undefined || (message.sender === 'bot' && typeof message.limited === 'boolean'))
    ))) throw new Error('Phiên trò chuyện không hợp lệ.');
  return value;
}

export function writeChatSession(scope, token, messages, flowToken) {
  localStorage.setItem(PREFIX + scope, JSON.stringify({ token, messages, ...(flowToken ? { flowToken } : {}) }));
}

export function clearChatSession(scope) {
  if (scope) localStorage.removeItem(PREFIX + scope);
}

// Minimal metadata only; planner output and profile are never persisted here.
const PLANNER_PREFIX = 'vegetarian-chat-planner-pending-v1:';
const OPERATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readPendingPlanner(accountId) {
  const raw = localStorage.getItem(PLANNER_PREFIX + accountId);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.operationId !== 'string' || !OPERATION_UUID.test(value.operationId)
    || (value.protocol === 'v2' && (!Object.keys(value).every((key) => ['operationId', 'protocol', 'payloadHash', 'receipt'].includes(key))
      || !/^[0-9a-f]{64}$/.test(value.payloadHash)
      || (value.receipt !== undefined && (typeof value.receipt !== 'string' || value.receipt.length > 2048))))
    || (value.protocol !== 'v2' && Object.keys(value).length !== 1)) throw new Error('STORAGE_UNAVAILABLE');
  return value;
}

export async function reservePendingPlanner(accountId, operationId, metadata = {}) {
  if (!navigator.locks || !OPERATION_UUID.test(operationId)) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(PLANNER_PREFIX + accountId, () => {
    if (readPendingPlanner(accountId)) throw new Error('PLANNER_PENDING');
    localStorage.setItem(PLANNER_PREFIX + accountId, JSON.stringify({ operationId, ...metadata }));
  });
}

export async function setPendingPlannerReceipt(accountId, operationId, receipt) {
  if (!navigator.locks || typeof receipt !== 'string' || receipt.length > 2048) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(PLANNER_PREFIX + accountId, () => {
    const current = readPendingPlanner(accountId);
    if (!current || current.operationId !== operationId || current.protocol !== 'v2') throw new Error('STORAGE_UNAVAILABLE');
    const next = { ...current, receipt };
    localStorage.setItem(PLANNER_PREFIX + accountId, JSON.stringify(next));
    return next;
  });
}

export async function clearUnstartedPlanner(accountId, operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(PLANNER_PREFIX + accountId, () => {
    const current = readPendingPlanner(accountId);
    if (current?.operationId === operationId && current.protocol === 'v2' && !current.receipt) {
      localStorage.removeItem(PLANNER_PREFIX + accountId);
      return { cleared: true, pending: null };
    }
    return { cleared: false, pending: current };
  });
}

export async function clearPendingPlanner(accountId, operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(PLANNER_PREFIX + accountId, () => {
    if (readPendingPlanner(accountId)?.operationId === operationId) {
      localStorage.removeItem(PLANNER_PREFIX + accountId);
    }
    return readPendingPlanner(accountId);
  });
}

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

// The confirm record contains only an operation ID, never meal or profile data.
const CONFIRM_PREFIX = 'vegetarian-chat-planner-confirm-v1:';

export function readPendingConfirm(accountId) {
  const raw = localStorage.getItem(CONFIRM_PREFIX + accountId);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.operationId !== 'string' || !OPERATION_UUID.test(value.operationId)
    || Object.keys(value).length !== 1) throw new Error('STORAGE_UNAVAILABLE');
  return value;
}

export async function reservePendingConfirm(accountId, operationId) {
  if (!navigator.locks || !OPERATION_UUID.test(operationId)) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CONFIRM_PREFIX + accountId, () => {
    if (readPendingConfirm(accountId)) throw new Error('CONFIRM_PENDING');
    localStorage.setItem(CONFIRM_PREFIX + accountId, JSON.stringify({ operationId }));
  });
}

export async function clearPendingConfirm(accountId, operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(CONFIRM_PREFIX + accountId, () => {
    if (readPendingConfirm(accountId)?.operationId === operationId) localStorage.removeItem(CONFIRM_PREFIX + accountId);
    return readPendingConfirm(accountId);
  });
}
