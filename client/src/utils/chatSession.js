const PREFIX = 'vegetarian-chat-session-v1:';

export function readChatSession(scope) {
  if (!scope) return null;
  const raw = localStorage.getItem(PREFIX + scope);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.token !== 'string' || !Array.isArray(value.messages)
    || !value.messages.every((message) => (
      ['user', 'bot'].includes(message.sender) && typeof message.content === 'string'
      && Array.from(message.content).length <= 10000
      && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(message.content)
      && (message.limited === undefined || (message.sender === 'bot' && typeof message.limited === 'boolean'))
    ))) throw new Error('Phiên trò chuyện không hợp lệ.');
  return value;
}

export function writeChatSession(scope, token, messages) {
  localStorage.setItem(PREFIX + scope, JSON.stringify({ token, messages }));
}

export function clearChatSession(scope) {
  if (scope) localStorage.removeItem(PREFIX + scope);
}
