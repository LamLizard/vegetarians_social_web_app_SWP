import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import ChatThread from '../components/ChatThread/ChatThread';
import ChatBubble from '../components/ChatBubble/ChatBubble';
import PromptChip from '../components/PromptChip/PromptChip';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import ChatDiscoveryResult from './ChatDiscoveryResult';
import { AI_DISCLAIMER, AI_NAME } from '../constants/domain';
import { useAuthContext } from '../context/AuthContext';
import chatbotService from '../services/chatbot.service';
import { AUTH_TOKEN_KEY } from '../services/api';
import { readChatSession, writeChatSession } from '../utils/chatSession';
import styles from './ChatbotPage.module.css';

const GUEST_KEY = 'vegetarian-chat-guest-quota-v1';
const GUEST_LIMIT = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUGGESTIONS = [
  'Gợi ý bữa sáng chay giàu đạm',
  'Có thể thay trứng trong món bánh bằng gì?',
  'Gợi ý món chay dễ nấu cho bữa tối',
  'Mình muốn trò chuyện về món chay',
];

function validText(value) {
  return Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

function completedHistory(messages) {
  const result = [];
  for (let i = 0; i + 1 < messages.length; i += 1) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.sender === 'user' && answer.sender === 'bot'
      && (question.status ?? 'complete') === 'complete' && (answer.status ?? 'complete') === 'complete') {
      result.push({ sender: 'user', content: question.content }, { sender: 'bot', content: answer.content });
      i += 1;
    }
  }
  return result.slice(-20);
}

function readGuest() {
  const raw = localStorage.getItem(GUEST_KEY);
  if (raw === null) return { used: 0, deviceId: null };
  const value = JSON.parse(raw);
  if (!value || !Number.isInteger(value.used) || value.used < 0 || value.used > GUEST_LIMIT
    || typeof value.deviceId !== 'string' || !UUID.test(value.deviceId)
    || (value.simpleCharges !== undefined && (!Array.isArray(value.simpleCharges)
      || !value.simpleCharges.every((id) => typeof id === 'string' && UUID.test(id))))) {
    throw new Error('Không thể đọc lượt dùng trên trình duyệt này.');
  }
  return value;
}

function withGuestLock(action) {
  // Keep concurrent guest counter updates and pre-admission reversals isolated.
  if (!navigator.locks) return Promise.reject(new Error('Trình duyệt không hỗ trợ quản lý lượt dùng an toàn.'));
  return navigator.locks.request(GUEST_KEY, action);
}

async function reserveGuest(id) {
  return withGuestLock(() => {
    const current = readGuest();
    if (current.used >= GUEST_LIMIT) throw new Error('Bạn đã dùng hết lượt hỏi thử trên trình duyệt này.');
    const next = { ...current, deviceId: current.deviceId ?? crypto.randomUUID(), used: current.used + 1,
      simpleCharges: [...(current.simpleCharges || []), id] };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

async function settleGuest(id, rejectedBeforeAdmission) {
  return withGuestLock(() => {
    const current = readGuest();
    const charges = current.simpleCharges || [];
    if (!charges.includes(id)) return current;
    const next = { ...current, used: rejectedBeforeAdmission ? Math.max(0, current.used - 1) : current.used,
      simpleCharges: charges.filter((charge) => charge !== id) };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

function guestQuota(value) {
  return { used: value.used, limit: GUEST_LIMIT, remaining: GUEST_LIMIT - value.used };
}

function MamAvatar({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="31" fill="var(--v-accent-soft)" />
      <path d="M15 33c0-9.4 7.6-17 17-17s17 7.6 17 17v4c0 9.4-7.6 17-17 17s-17-7.6-17-17z" fill="var(--v-accent)" />
      <path d="M32 17c-1-8-7-10-12-9 0 7 4 11 12 11m0-2c1-7 6-10 12-9 0 6-4 10-12 11" fill="var(--v-accent)" />
      <circle cx="25.5" cy="34" r="1.8" fill="var(--ac-on-accent)" />
      <circle cx="38.5" cy="34" r="1.8" fill="var(--ac-on-accent)" />
      <path d="M27.5 41c2.7 2.4 6.3 2.4 9 0" fill="none" stroke="var(--ac-on-accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function replyInline(text, keyBase) {
  return text.split('**').map((part, index) => (index % 2 === 1
    ? <strong key={`${keyBase}-${index}`}>{part}</strong> : part));
}

function ChatReplyText({ text }) {
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph }); paragraph = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };
  String(text).replace(/\r/g, '').split('\n').forEach((line) => {
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    const heading = /^\s{0,3}#{1,6}(?:\s+|$)(.*)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); if (heading[1]) blocks.push({ type: 'heading', text: heading[1] }); return; }
    const bullet = /^\s*[-•*]\s+/.exec(line);
    const numbered = /^\s*(\d+)[.)]\s+/.exec(line);
    const type = bullet ? 'ul' : numbered ? 'ol' : null;
    if (type) {
      flushParagraph();
      if (!list || list.type !== type) { flushList(); list = { type, items: [], ...(numbered ? { start: Number(numbered[1]) } : {}) }; }
      list.items.push(line.slice((bullet || numbered)[0].length));
      return;
    }
    flushList();
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return (
    <div className={styles.replyText}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') return <h3 key={index}>{replyInline(block.text, index)}</h3>;
        if (block.type === 'paragraph') return <p key={index}>{block.lines.map((line, lineIndex) => (
          <span key={lineIndex}>{lineIndex > 0 && <br />}{replyInline(line, `${index}-${lineIndex}`)}</span>
        ))}</p>;
        const List = block.type;
        return <List key={index} start={block.type === 'ol' ? block.start : undefined}>{block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{replyInline(item, `${index}-${itemIndex}`)}</li>
        ))}</List>;
      })}
    </div>
  );
}

export default function ChatbotPage({ user }) {
  const { logout } = useAuthContext();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const messagesRef = useRef([]);
  const sessionRef = useRef(null);
  const running = useRef(null);
  const textareaRef = useRef(null);
  const actor = user?.id ? `account:${user.id}` : 'guest';

  const updateMessages = useCallback((update) => {
    const next = typeof update === 'function' ? update(messagesRef.current) : update;
    messagesRef.current = next;
    setMessages(next);
    return next;
  }, []);

  const updateSession = useCallback((next) => { sessionRef.current = next; setSession(next); }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [text]);

  useEffect(() => {
    const controller = new AbortController();
    updateMessages([]);
    updateSession(null);
    setSessionReady(false);
    setQuota(null);
    setEnabled(false);
    setError('');
    async function load() {
      try {
        const availability = await chatbotService.getAvailability({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setEnabled(Boolean(availability.enabled));
        let guest;
        if (user?.id) {
          const result = await chatbotService.getSimpleQuota({ signal: controller.signal });
          if (controller.signal.aborted) return;
          setQuota(result.quota);
        } else {
          guest = readGuest();
          setQuota(guestQuota(guest));
        }
        const scope = user?.id ? actor : guest.deviceId ? `device:${guest.deviceId}` : null;
        const saved = scope ? readChatSession(scope) : null;
        if (saved) {
          const result = await chatbotService.verifySimpleSession({ token: saved.token, deviceId: guest?.deviceId }, { signal: controller.signal });
          if (controller.signal.aborted) return;
          if (result.valid) {
            updateMessages(saved.messages.map((message) => ({ ...message, status: 'complete' })));
            updateSession({ token: saved.token, scope, deviceId: guest?.deviceId,
              expiresAt: result.expiresAt, serverTime: result.serverTime });
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message || 'Chưa thể mở cuộc trò chuyện.');
      } finally {
        if (!controller.signal.aborted) setSessionReady(true);
      }
    }
    void load();
    const syncGuest = () => {
      if (user?.id) return;
      try { setQuota(guestQuota(readGuest())); } catch { setQuota(null); setError('Không thể đọc lượt dùng trên trình duyệt này.'); }
    };
    window.addEventListener('storage', syncGuest);
    return () => {
      controller.abort();
      running.current?.abort();
      running.current = null;
      window.removeEventListener('storage', syncGuest);
    };
  }, [actor, user?.id, updateMessages, updateSession]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = window.setTimeout(() => {
      running.current?.abort();
      running.current = null;
      setBusy(false);
      updateMessages([]);
      updateSession(null);
      setAnnouncement('Phiên trò chuyện đã hết hạn.');
    }, Math.max(0, session.expiresAt - session.serverTime));
    return () => window.clearTimeout(timer);
  }, [session, updateMessages, updateSession]);

  const sendQuestion = async (question) => {
    if (!enabled || !sessionReady || busy || running.current || !quota?.remaining || !question.trim() || !validText(question)) return;
    if (!globalThis.crypto?.randomUUID) { setError('Không thể gửi câu hỏi trên trình duyệt này.'); return; }
    const turnId = crypto.randomUUID();
    const controller = new AbortController();
    running.current = controller;
    let timedOut = false;
    const requestTimeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    setBusy(true);
    setError('');
    setAnnouncement('Đang chờ phản hồi.');
    const history = completedHistory(messagesRef.current);
    updateMessages((current) => [...current,
      { sender: 'user', content: question, status: 'waiting', turnId },
      { sender: 'bot', content: '', status: 'waiting', turnId, question }]);
    let guest;
    let rejected = false;
    let accepted = false;
    let reply = '';
    let resultCard;
    const active = () => running.current === controller && !controller.signal.aborted;
    const ownsTurn = () => running.current === controller;
    const updateTurn = (changes) => updateMessages((current) => current.map((message) => (
      message.turnId === turnId && message.sender === 'bot' ? { ...message, ...changes } : message
    )));
    const saveSession = (value, scope, deviceId, completed) => {
      if (!value || typeof value.token !== 'string' || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.serverTime)) {
        throw new Error('Không thể xác nhận phiên trò chuyện.');
      }
      const next = { ...value, scope, deviceId };
      updateSession(next);
      try {
        const previous = readChatSession(scope);
        writeChatSession(scope, value.token, completed, previous?.flowToken);
      } catch { setError('Không thể lưu lịch sử trên trình duyệt này.'); }
    };
    try {
      if (!user?.id) {
        guest = await reserveGuest(turnId);
        if (!active()) { if (timedOut) throw new Error('Kết nối quá lâu.'); return; }
        setQuota(guestQuota(guest));
      }
      const deviceId = guest?.deviceId;
      const scope = user?.id ? actor : `device:${deviceId}`;
      const priorSession = sessionRef.current;
      const response = await chatbotService.streamSimpleTurn({ text: question, history,
        ...(deviceId ? { deviceId } : {}), ...(priorSession?.token ? { sessionToken: priorSession.token } : {}) }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        onAccepted: (payload) => {
          if (!active()) return;
          accepted = true;
          if (payload.quota) setQuota(payload.quota);
          saveSession(payload.session, scope, deviceId, history);
        },
        onDelta: (chunk) => { if (active()) { reply += chunk; updateTurn({ content: reply, status: 'streaming' }); } },
        onResult: (value) => { if (active()) { resultCard = value; updateTurn({ result: value }); } },
      });
      if (!active()) { if (timedOut) throw new Error('Kết nối quá lâu.'); return; }
      const nextMessages = updateMessages((current) => current.map((message) => (
        message.turnId === turnId ? { ...message, status: 'complete',
          ...(message.sender === 'bot' ? { content: reply, result: resultCard, limited: response.limited } : {}) } : message
      )));
      saveSession(response.session, scope, deviceId, completedHistory(nextMessages));
      if (response.quota) setQuota(response.quota);
      setAnnouncement('Đã nhận phản hồi.');
    } catch (requestError) {
      rejected = !accepted && requestError.rejectedBeforeAdmission === true;
      if (ownsTurn()) {
        if (requestError.details?.code === 'CHATBOT_DISABLED') setEnabled(false);
        if (requestError.details?.code === 'SESSION_EXPIRED') {
          updateSession(null);
          updateMessages((current) => current.filter((message) => message.turnId === turnId));
        }
        updateMessages((current) => current.map((message) => message.turnId === turnId
          ? { ...message, status: 'failed', ...(message.sender === 'bot' ? {
            content: reply, error: timedOut ? 'Kết nối quá lâu; chưa xác định được kết quả. Bạn có thể gửi lại.'
              : requestError instanceof TypeError ? 'Không thể kết nối; chưa xác định được kết quả. Bạn có thể gửi lại.'
                : requestError.message || 'Chưa xác định được kết quả. Bạn có thể gửi lại.',
          } : {}) } : message));
        setAnnouncement('Không thể hoàn tất phản hồi. Bạn có thể gửi lại.');
      }
    } finally {
      window.clearTimeout(requestTimeout);
      if (guest) {
        try {
          const current = await settleGuest(turnId, rejected);
          if (ownsTurn()) setQuota(guestQuota(current));
        } catch { if (ownsTurn()) { setQuota(null); setError('Không thể cập nhật lượt dùng trên trình duyệt này.'); } }
      }
      if (running.current === controller) { running.current = null; setBusy(false); }
    }
  };

  const send = (event) => {
    event.preventDefault();
    const question = text.trim();
    if (!question || !validText(text) || busy || running.current || !enabled || !sessionReady || !quota?.remaining) return;
    setText('');
    void sendQuestion(question);
  };
  const suggestionsDisabled = !enabled || !sessionReady || busy || !quota?.remaining || text.length > 0;
  const textValid = validText(text);

  return (
    <MemberNavigationLayout>
      <section className={styles.page} aria-labelledby="chatbot-title">
        <header className={styles.header}>
          <div className={styles.identity}>
            <MamAvatar className={styles.identityMark} />
            <div><h1 id="chatbot-title">{AI_NAME}</h1><p>Trợ lý cho những bữa ăn chay của bạn</p></div>
          </div>
          <div className={styles.quota} aria-live="polite">
            {quota ? <span>Còn {quota.remaining}/{quota.limit} lượt{user ? ' hôm nay' : ' hỏi thử'}</span>
              : <span>Chưa thể hiển thị số lượt.</span>}
          </div>
        </header>
        <div className={styles.panel}>
          {!enabled && <Notice tone="info">Trợ lý hiện không khả dụng, vui lòng quay lại sau.</Notice>}
          {error && <Notice tone="alert">{error}</Notice>}
          {!user && quota?.remaining === 0 && <div><Button variant="outline" onClick={() => setLoginOpen(true)}>Đăng nhập để tiếp tục</Button></div>}
          <div className={styles.conversation}>
            {!sessionReady ? <p className={styles.sessionStatus} role="status">Đang kiểm tra phiên trò chuyện...</p>
              : messages.length === 0 ? (
                <div className={styles.empty}>
                  <MamAvatar className={styles.illustration} />
                  <h2>Chào bạn, hôm nay mình ăn gì nhỉ?</h2>
                  <p>Hỏi {AI_NAME} về món chay, nguyên liệu hoặc dinh dưỡng. Bạn cũng có thể bắt đầu từ một gợi ý:</p>
                  <div className={styles.suggestions} role="group" aria-label="Gợi ý câu hỏi">
                    {SUGGESTIONS.map((suggestion) => <PromptChip key={suggestion} disabled={suggestionsDisabled}
                      onClick={() => { setText(suggestion); textareaRef.current?.focus(); }}>{suggestion}</PromptChip>)}
                  </div>
                  <small>Chọn gợi ý để thêm vào ô nhập, rồi chỉnh sửa trước khi gửi.</small>
                </div>
              ) : (
                <ChatThread className={styles.thread}>
                  {messages.map((message, index) => (
                    <div key={`${message.turnId || index}-${message.sender}`} aria-live="off"
                      className={message.sender === 'bot' ? styles.messageBot : styles.messageUser}>
                      {message.sender === 'bot' && <MamAvatar className={styles.messageAvatar} />}
                      <div className={styles.messageBody}>
                        <ChatBubble sender={message.sender} content={message.content}
                          className={message.sender === 'bot' ? styles.botBubble : undefined}
                          typing={message.sender === 'bot' && message.status === 'waiting' && !message.content}>
                          {message.sender === 'bot' && message.content ? <ChatReplyText text={message.content} /> : undefined}
                        </ChatBubble>
                        {message.sender === 'bot' && message.result && <ChatDiscoveryResult result={message.result} />}
                        {message.sender === 'bot' && message.limited && <p className={styles.messageNotice}>Câu trả lời đã đạt giới hạn độ dài.</p>}
                        {message.sender === 'bot' && message.status === 'failed' && <div className={styles.messageNotice}>
                          <p>{message.error}</p>
                          <button type="button" className={styles.retry} disabled={busy || !enabled || !quota?.remaining}
                            onClick={() => void sendQuestion(message.question)}>Gửi lại</button>
                        </div>}
                      </div>
                    </div>
                  ))}
                </ChatThread>
              )}
          </div>
          <p className={styles.waiting} role="status" aria-live="polite">{announcement}</p>
          <form className={styles.composer} onSubmit={send}>
            <label className="visually-hidden" htmlFor="chatbot-question">Câu hỏi của bạn</label>
            <div className={styles.composerBox}>
              <textarea ref={textareaRef} id="chatbot-question" rows={1} value={text}
                onChange={(event) => setText(event.target.value)} disabled={!enabled || !sessionReady || busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
                    && event.nativeEvent.keyCode !== 229) send(event);
                }}
                aria-describedby="chatbot-hint chatbot-disclaimer" placeholder="Hỏi Mầm về món chay..." />
              <Button type="submit" icon="arrow-up" loading={busy}
                disabled={!enabled || !sessionReady || !text.trim() || !textValid || !quota?.remaining}>Gửi</Button>
            </div>
            <div className={styles.composerFoot}>
              <small id="chatbot-hint">Enter để gửi, Shift + Enter để xuống dòng. {Array.from(text).length}/10.000 ký tự
                {!textValid && ' — Câu hỏi vượt giới hạn hoặc có ký tự không hợp lệ.'}</small>
              <small id="chatbot-disclaimer">{AI_DISCLAIMER}</small>
            </div>
          </form>
        </div>
        <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Đăng nhập để tiếp tục" size="sm">
          <p>Bạn đã dùng hết lượt hỏi thử trên trình duyệt này.</p>
          <Button onClick={() => window.location.assign('/login')}>Đăng nhập</Button>
        </Modal>
      </section>
    </MemberNavigationLayout>
  );
}
