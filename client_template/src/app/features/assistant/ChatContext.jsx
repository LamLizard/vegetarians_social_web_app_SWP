import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DAILY_LIMIT, getReply, isBlocked } from './assistantEngine';
import { DIETS } from '../../store/mockData';
import { firstName } from '../../utils/format';

// Hội thoại với trợ lý Mầm – dùng chung cho ngăn Mầm (cột phải) và trang /assistant,
// nên chuyển qua lại giữa 2 nơi vẫn giữ nguyên nội dung.

const ChatContext = createContext(null);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const emptyChat = () => ({ messages: [], quota: { date: today(), used: 0 } });

function loadChat(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.messages) {
      // Sang ngày mới → reset lượt hỏi
      return saved.quota?.date === today() ? saved : { ...saved, quota: { date: today(), used: 0 } };
    }
  } catch { /* bỏ qua */ }
  return emptyChat();
}

/**
 * message = { id, from: 'user'|'ai', text, time, status: 'ok'|'filtered'|'error',
 *             followUps?: string[], question?: string (câu hỏi gốc để "Thử lại") }
 */
export function ChatProvider({ user, children }) {
  const storageKey = `anchay-vuon-chat-v1-${user.id}`;
  const [chat, setChat] = useState(() => loadChat(storageKey));
  const [typing, setTyping] = useState(false);
  const [mamOpen, setMamOpen] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(chat)); } catch { /* bỏ qua */ }
  }, [storageKey, chat]);

  const push = useCallback((...msgs) => setChat((c) => ({
    ...c,
    messages: [...c.messages, ...msgs.map((m) => ({ id: uid(), time: new Date().toISOString(), status: 'ok', ...m }))],
  })), []);

  const request = useCallback(async (question) => {
    busy.current = true;
    setTyping(true);
    try {
      const res = await getReply(question, { name: firstName(user.fullName), diet: DIETS[user.diet]?.label });
      // Chỉ trừ lượt khi trợ lý trả lời thành công
      setChat((c) => ({ ...c, quota: { ...c.quota, used: c.quota.used + 1 } }));
      push({ from: 'ai', text: res.text, followUps: res.followUps, cards: res.cards });
    } catch {
      push({ from: 'ai', status: 'error', text: 'Không nhận được câu trả lời.', question });
    } finally {
      busy.current = false;
      setTyping(false);
    }
  }, [user.fullName, user.diet, push]);

  const remaining = Math.max(0, DAILY_LIMIT - chat.quota.used);

  /** Gửi câu hỏi. Trả về false nếu không gửi được (đang chờ, hết lượt, rỗng). */
  const ask = useCallback((raw) => {
    const text = raw.trim();
    if (!text || busy.current || remaining <= 0) return false;
    if (isBlocked(text)) {
      push(
        { from: 'user', text, status: 'filtered' },
        { from: 'ai', text: 'Câu hỏi có từ ngữ không phù hợp nên mình chưa thể trả lời. Bạn diễn đạt lại giúp mình nhé 🌿' },
      );
      return true;
    }
    push({ from: 'user', text });
    request(text);
    return true;
  }, [remaining, push, request]);

  const retry = useCallback((messageId) => {
    const msg = chat.messages.find((m) => m.id === messageId);
    if (!msg || busy.current) return;
    setChat((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) }));
    request(msg.question);
  }, [chat.messages, request]);

  const value = useMemo(() => ({
    messages: chat.messages,
    typing,
    remaining,
    limit: DAILY_LIMIT,
    ask,
    retry,
    newConversation: () => setChat((c) => ({ ...c, messages: [] })),
    mamOpen,
    setMamOpen,
    /** Mở ngăn Mầm (cột phải / ngăn kéo), có thể kèm luôn câu hỏi (vd bấm "Hỏi Mầm" trên bài viết) */
    askMam: (prompt) => {
      setMamOpen(true);
      if (prompt) ask(prompt);
    },
  }), [chat.messages, typing, remaining, ask, retry, mamOpen]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat phải nằm trong <ChatProvider>');
  return ctx;
}
