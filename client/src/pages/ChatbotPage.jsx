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
const GUEST_V2_KEY = 'vegetarian-chat-guest-quota-v2';
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

// Tùng: chỉ so sánh chủ đề bằng chữ chuẩn hóa, không tự suy đồng nghĩa.
function subjectKey(value) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

function emptyPostContext(state = 'unknown') {
  return { version: 1, state, activeSubject: null, topics: [], delivery: null };
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

function readLegacyGuest() {
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

function withGuestLock(action, signal) {
  // Keep concurrent guest counter updates and pre-admission reversals isolated.
  if (!navigator.locks) return Promise.reject(new Error('Trình duyệt không hỗ trợ quản lý lượt dùng an toàn.'));
  return navigator.locks.request(GUEST_KEY, signal ? { signal } : {}, action);
}

// Tùng: chuyển nguyên lượt cũ trong cùng lock; ngày do server cung cấp, không dùng giờ máy.
function guestForDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Không thể xác nhận ngày sử dụng.');
  const raw = localStorage.getItem(GUEST_V2_KEY);
  let current;
  if (raw === null) {
    const legacy = readLegacyGuest();
    current = { version: 2, deviceId: legacy.deviceId ?? crypto.randomUUID(), day, used: legacy.used,
      pending: (legacy.simpleCharges || []).map((turnId) => ({ turnId, day })) };
  } else {
    current = JSON.parse(raw);
    if (!current || current.version !== 2 || typeof current.deviceId !== 'string' || !UUID.test(current.deviceId)
      || typeof current.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(current.day)
      || !Number.isInteger(current.used) || current.used < 0 || current.used > GUEST_LIMIT
      || !Array.isArray(current.pending) || !current.pending.every((p) => p && UUID.test(p.turnId)
        && /^\d{4}-\d{2}-\d{2}$/.test(p.day))) throw new Error('Không thể đọc lượt dùng trên trình duyệt này.');
    if (day < current.day) throw new Error('Không thể xác nhận ngày sử dụng.');
    if (day > current.day) current = { ...current, day, used: 0 };
  }
  localStorage.setItem(GUEST_V2_KEY, JSON.stringify(current));
  return current;
}

async function readGuest(day, signal) { return withGuestLock(() => guestForDay(day), signal); }

async function reserveGuest(id, day, signal) {
  return withGuestLock(() => {
    if (signal.aborted) throw new Error('Kết nối quá lâu.');
    const current = guestForDay(day);
    if (current.used >= GUEST_LIMIT) throw new Error('Bạn đã dùng hết lượt hỏi thử hôm nay.');
    const next = { ...current, used: current.used + 1, pending: [...current.pending, { turnId: id, day }] };
    localStorage.setItem(GUEST_V2_KEY, JSON.stringify(next));
    return next;
  }, signal);
}

// Tùng: response cũ chỉ hoàn đúng reservation cùng ngày; outcome chưa rõ giữ nguyên lượt.
async function settleGuest(id, day, rejectedBeforeAdmission, known) {
  return withGuestLock(() => {
    const raw = localStorage.getItem(GUEST_V2_KEY);
    if (!raw) throw new Error('Không thể đọc lượt dùng trên trình duyệt này.');
    const current = JSON.parse(raw);
    if (!current || current.version !== 2 || !Array.isArray(current.pending)
      || !Number.isInteger(current.used) || current.used < 0 || current.used > GUEST_LIMIT) throw new Error('Không thể đọc lượt dùng trên trình duyệt này.');
    const pending = current.pending.find((entry) => entry.turnId === id && entry.day === day);
    if (!pending || !known) return current;
    const next = { ...current,
      used: rejectedBeforeAdmission && current.day === day ? Math.max(0, current.used - 1) : current.used,
      pending: current.pending.filter((entry) => !(entry.turnId === id && entry.day === day)) };
    localStorage.setItem(GUEST_V2_KEY, JSON.stringify(next));
    return next;
  });
}

function guestQuota(value) {
  return { day: value.day, used: value.used, limit: GUEST_LIMIT, remaining: GUEST_LIMIT - value.used };
}

// Tùng: suy ngày từ clock server và đồng hồ monotonic để chặn response ngày cũ.
function clockDay(clock) {
  if (!clock) return null;
  const at = clock.serverTime + Math.max(0, performance.now() - clock.capturedAt);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function rememberClock(ref, availability) {
  if (!Number.isFinite(availability.serverTime) || !/^\d{4}-\d{2}-\d{2}$/.test(availability.quotaDay)
    || !Number.isFinite(Date.parse(availability.resetAt))) throw new Error('Không thể xác nhận ngày sử dụng.');
  const clock = { serverTime: availability.serverTime, capturedAt: performance.now() };
  if (clockDay(clock) !== availability.quotaDay) throw new Error('Không thể xác nhận ngày sử dụng.');
  if (ref.current && availability.quotaDay < clockDay(ref.current)) throw new Error('Không thể xác nhận ngày sử dụng.');
  ref.current = clock;
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
  const postContextRef = useRef(emptyPostContext());
  const running = useRef(null);
  const generation = useRef(0);
  const serverClock = useRef(null);
  const actorToken = useRef(null);
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
    const context = postContextRef.current;
    const delivery = context.delivery;
    const currentSession = sessionRef.current;
    if (!delivery || delivery.state !== 'pending' || !currentSession
      || !messages.some((message) => message.turnId === delivery.turnId && message.result?.item?.id === delivery.postId)) return;
    if (localStorage.getItem(AUTH_TOKEN_KEY) !== actorToken.current) return;
    try {
      const saved = readChatSession(currentSession.scope);
      if (!saved || saved.postContext?.delivery?.turnId !== delivery.turnId) throw new Error('STORAGE_UNAVAILABLE');
      const shown = { ...context, delivery: { ...delivery, state: 'shown' } };
      writeChatSession(currentSession.scope, currentSession.token, messagesRef.current, saved.flowToken, saved.postDiscovery, shown);
      postContextRef.current = shown;
    } catch {
      postContextRef.current = { ...context, state: 'unknown' };
      setError('Không thể xác định danh sách bài đã hiện trên trình duyệt này.');
    }
  }, [messages]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [text]);

  useEffect(() => {
    const controller = new AbortController();
    const tokenSnapshot = localStorage.getItem(AUTH_TOKEN_KEY);
    actorToken.current = tokenSnapshot;
    // Tùng: token đổi trước khi React cập nhật actor thì bỏ mọi response cũ.
    const actorCurrent = () => !controller.signal.aborted && localStorage.getItem(AUTH_TOKEN_KEY) === tokenSnapshot;
    let resetTimer;
    const scheduleReset = (availability) => {
      window.clearTimeout(resetTimer);
      const delay = Date.parse(availability.resetAt) - Number(availability.serverTime);
      if (Number.isFinite(delay) && delay >= 0) resetTimer = window.setTimeout(() => { void refreshQuota(); }, delay + 50);
    };
    updateMessages([]);
    updateSession(null);
    postContextRef.current = emptyPostContext();
    setSessionReady(false);
    setQuota(null);
    setEnabled(false);
    setError('');
    async function load() {
      try {
        const availability = await chatbotService.getAvailabilityOnce({ signal: controller.signal });
        if (!actorCurrent()) return;
        rememberClock(serverClock, availability);
        setEnabled(Boolean(availability.enabled));
        if (availability.enabled) scheduleReset(availability);
        let guest;
        if (user?.id) {
          const result = await chatbotService.getSimpleQuota({ signal: controller.signal });
          if (!actorCurrent()) return;
          setQuota(result.quota);
        } else {
          guest = availability.enabled ? await readGuest(availability.quotaDay, controller.signal) : readLegacyGuest();
          if (!actorCurrent()) return;
          setQuota(guestQuota(guest));
        }
        const scope = user?.id ? actor : guest.deviceId ? `device:${guest.deviceId}` : null;
        const saved = scope ? readChatSession(scope) : null;
        if (saved) {
          const result = await chatbotService.verifySimpleSession({ token: saved.token, deviceId: guest?.deviceId }, { signal: controller.signal });
          if (!actorCurrent()) return;
          if (result.valid) {
            updateMessages(saved.messages);
            postContextRef.current = saved.postContext ?? emptyPostContext();
            updateSession({ token: saved.token, scope, deviceId: guest?.deviceId,
              expiresAt: result.expiresAt, serverTime: result.serverTime });
          } else postContextRef.current = emptyPostContext('known');
        } else {
          postContextRef.current = emptyPostContext('known');
        }
      } catch (loadError) {
        if (actorCurrent()) setError(loadError.message || 'Chưa thể mở cuộc trò chuyện.');
      } finally {
        if (actorCurrent()) setSessionReady(true);
      }
    }
    void load();
    // Tùng: refresh theo clock server khi tab được mở lại hoặc counter tab khác đổi.
    const refreshQuota = async () => {
      if (!actorCurrent()) {
        generation.current += 1;
        running.current?.abort();
        running.current = null;
        updateMessages([]);
        updateSession(null);
        setQuota(null);
        setEnabled(false);
        setSessionReady(false);
        setBusy(false);
        return;
      }
      const refreshGeneration = generation.current;
      try {
        const availability = await chatbotService.getAvailabilityOnce({ signal: controller.signal });
        if (!actorCurrent() || !availability.enabled) return;
        rememberClock(serverClock, availability);
        scheduleReset(availability);
        const current = user?.id ? (await chatbotService.getSimpleQuota({ signal: controller.signal })).quota
          : guestQuota(await readGuest(availability.quotaDay, controller.signal));
        if (actorCurrent() && refreshGeneration === generation.current && current.day === clockDay(serverClock.current)) setQuota(current);
      } catch { if (actorCurrent() && refreshGeneration === generation.current) { setQuota(null); setError('Không thể đọc lượt dùng trên trình duyệt này.'); } }
    };
    window.addEventListener('storage', refreshQuota);
    window.addEventListener('focus', refreshQuota);
    return () => {
      controller.abort();
      window.clearTimeout(resetTimer);
      generation.current += 1;
      running.current?.abort();
      running.current = null;
      serverClock.current = null;
      window.removeEventListener('storage', refreshQuota);
      window.removeEventListener('focus', refreshQuota);
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
      postContextRef.current = emptyPostContext('known');
      setAnnouncement('Phiên trò chuyện đã hết hạn.');
    }, Math.max(0, session.expiresAt - session.serverTime));
    return () => window.clearTimeout(timer);
  }, [session, updateMessages, updateSession]);

  const sendQuestion = async (question) => {
    if (!enabled || !sessionReady || busy || running.current || !quota?.remaining || !question.trim() || !validText(question)) return;
    if (localStorage.getItem(AUTH_TOKEN_KEY) !== actorToken.current) { setError('Tài khoản đã thay đổi. Vui lòng mở lại cuộc trò chuyện.'); return; }
    if (!globalThis.crypto?.randomUUID) { setError('Không thể gửi câu hỏi trên trình duyệt này.'); return; }
    const turnToken = actorToken.current;
    const turnId = crypto.randomUUID();
    const turnGeneration = ++generation.current;
    const controller = new AbortController();
    running.current = controller;
    let timedOut = false;
    const startedAt = performance.now();
    // Tùng: giới hạn thời gian chờ bao gồm clock, lock và stream của lượt.
    const requestTimeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
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
    let requestStarted = false;
    let scope;
    let reply = '';
    let pendingPostText = '';
    let resultCard;
    const active = () => {
      if (performance.now() - startedAt >= 20000) { timedOut = true; controller.abort(); }
      if (localStorage.getItem(AUTH_TOKEN_KEY) !== turnToken || actorToken.current !== turnToken) controller.abort();
      return running.current === controller && !controller.signal.aborted;
    };
    const ownsTurn = () => running.current === controller && actorToken.current === turnToken
      && localStorage.getItem(AUTH_TOKEN_KEY) === turnToken;
    const updateTurn = (changes) => updateMessages((current) => current.map((message) => (
      message.turnId === turnId && message.sender === 'bot' ? { ...message, ...changes } : message
    )));
    const saveSession = (value, scope, deviceId, completed) => {
      if (!value || typeof value.token !== 'string' || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.serverTime)) {
        throw new Error('Không thể xác nhận phiên trò chuyện.');
      }
      const previousSession = sessionRef.current;
      const next = { ...value, scope, deviceId };
      updateSession(next);
      try {
        const previous = readChatSession(scope);
        // Tùng: chỉ giữ metadata bài khi đang tiếp tục đúng phiên của actor.
        const postDiscovery = previousSession?.scope === scope ? previous?.postDiscovery : undefined;
        const postContext = !previousSession || previousSession.scope === scope ? postContextRef.current : emptyPostContext();
        postContextRef.current = postContext;
        writeChatSession(scope, value.token, completed, previous?.flowToken, postDiscovery, postContext);
      } catch {
        postContextRef.current = { ...postContextRef.current, state: 'unknown' };
        setError('Không thể lưu lịch sử trên trình duyệt này.');
      }
    };
    try {
      // Tùng: kiểm tra clock và trạng thái trong cùng deadline, không tự retry lượt.
      const availability = await chatbotService.getAvailabilityOnce({ signal: controller.signal });
      if (!active()) throw new Error('Kết nối quá lâu.');
      rememberClock(serverClock, availability);
      if (!availability.enabled || typeof availability.quotaDay !== 'string') {
        setEnabled(false);
        throw new Error('Trợ lý hiện không khả dụng.');
      }
      if (!user?.id) {
        guest = await reserveGuest(turnId, availability.quotaDay, controller.signal);
        if (!active()) { if (timedOut) throw new Error('Kết nối quá lâu.'); return; }
        setQuota(guestQuota(guest));
      }
      const deviceId = guest?.deviceId;
      scope = user?.id ? actor : `device:${deviceId}`;
      const priorSession = sessionRef.current;
      if (priorSession && !readChatSession(scope)) postContextRef.current = emptyPostContext();
      const postContext = postContextRef.current;
      const topic = postContext.topics.find((entry) => postContext.activeSubject
        && subjectKey(entry.subject) === subjectKey(postContext.activeSubject));
      const searchContext = { state: postContext.state, subject: postContext.activeSubject,
        seenIds: postContext.state === 'known' ? (topic?.seenIds ?? []) : [] };
      const payload = { protocol: 3, turnId, text: question, history,
        postContext: searchContext,
        ...(deviceId ? { deviceId, expectedDay: guest.day } : {}), ...(priorSession?.token ? { sessionToken: priorSession.token } : {}) };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 2 * 1024 * 1024) {
        postContextRef.current = { ...postContextRef.current, state: 'unknown' };
        throw new Error('Không thể xác định danh sách bài đã hiện do dữ liệu quá lớn.');
      }
      requestStarted = true;
      const response = await chatbotService.streamTurnV3(payload, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        onAccepted: (payload) => {
          if (!active()) return;
          accepted = true;
          if (payload.quota?.day === clockDay(serverClock.current)) setQuota(payload.quota);
          const current = updateMessages((list) => list.map((message) => message.turnId === turnId && message.sender === 'user'
            ? { ...message, status: 'complete' } : message));
          saveSession(payload.session, scope, deviceId, current);
        },
        onDelta: (chunk, purpose, searchSubject) => {
          if (active()) {
            if (searchSubject && postContextRef.current.state === 'known') {
              const current = postContextRef.current;
              const key = subjectKey(searchSubject);
              const existing = current.topics.find((entry) => subjectKey(entry.subject) === key);
              postContextRef.current = { ...current, activeSubject: searchSubject,
                topics: [...current.topics.filter((entry) => subjectKey(entry.subject) !== key),
                  { subject: searchSubject, seenIds: existing?.seenIds ?? [] }], delivery: null };
            }
            if (purpose === 'post-found') pendingPostText += chunk;
            else { reply += chunk; updateTurn({ content: reply, status: 'streaming' }); }
          }
        },
        onResult: (value) => {
          if (!active()) return;
          if (!value.search) {
            postContextRef.current = { ...postContextRef.current, state: 'unknown' };
            resultCard = value;
            updateTurn({ result: value });
            return;
          }
          const id = value.item?.id;
          if (typeof id !== 'string' || !/^[1-9]\d{0,17}$/.test(id)
            || typeof value.item.title !== 'string' || !value.item.title.trim()) throw new Error('Không thể nhận bài viết hợp lệ.');
          const current = postContextRef.current;
          const key = subjectKey(value.search.subject);
          const oldTopic = current.topics.find((entry) => subjectKey(entry.subject) === key);
          const entry = { subject: value.search.subject, seenIds: [...new Set([...(oldTopic?.seenIds ?? []), id])] };
          const nextContext = { ...current, activeSubject: entry.subject,
            topics: [...current.topics.filter((item) => subjectKey(item.subject) !== key), entry],
            delivery: { turnId, subject: entry.subject, postId: id, state: 'pending' } };
          const nextMessages = messagesRef.current.map((message) => message.turnId === turnId && message.sender === 'bot'
            ? { ...message, content: reply + pendingPostText, status: 'streaming', result: value } : message);
          const saved = readChatSession(scope);
          if (!saved || !sessionRef.current?.token) throw new Error('Không thể lưu danh sách bài đã hiện.');
          writeChatSession(scope, sessionRef.current.token, nextMessages, saved.flowToken, saved.postDiscovery, nextContext);
          postContextRef.current = nextContext;
          reply += pendingPostText;
          pendingPostText = '';
          resultCard = value;
          updateMessages(nextMessages);
        },
      });
      if (!active()) { if (timedOut) throw new Error('Kết nối quá lâu.'); return; }
      if (pendingPostText) throw new Error('Không thể hiển thị bài viết; kết quả chưa xác định.');
      const nextMessages = updateMessages((current) => current.map((message) => (
        message.turnId === turnId ? { ...message, status: 'complete',
          ...(message.sender === 'bot' ? { content: reply, result: resultCard, limited: response.limited } : {}) } : message
      )));
      saveSession(response.session, scope, deviceId, nextMessages);
      if (response.quota?.day === clockDay(serverClock.current)) setQuota(response.quota);
      setAnnouncement('Đã nhận phản hồi.');
    } catch (requestError) {
      rejected = !accepted && requestError.rejectedBeforeAdmission === true;
      if (ownsTurn()) {
        if (requestError.details?.code === 'CHATBOT_DISABLED') setEnabled(false);
        if (requestError.details?.code === 'SESSION_EXPIRED') {
          updateSession(null);
          updateMessages((current) => current.filter((message) => message.turnId === turnId));
        }
        const nextMessages = updateMessages((current) => current.map((message) => message.turnId === turnId
          ? { ...message, status: 'failed', ...(message.sender === 'bot' ? {
            content: reply, error: timedOut ? 'Kết nối quá lâu; chưa xác định được kết quả. Bạn có thể gửi lại.'
              : requestError instanceof TypeError ? 'Không thể kết nối; chưa xác định được kết quả. Bạn có thể gửi lại.'
                : requestError.message || 'Chưa xác định được kết quả. Bạn có thể gửi lại.',
          } : {}) } : message));
        if (accepted && scope && sessionRef.current?.token) {
          try {
            const previous = readChatSession(scope);
            writeChatSession(scope, sessionRef.current.token, nextMessages, previous?.flowToken, previous?.postDiscovery, postContextRef.current);
          }
          catch {
            postContextRef.current = { ...postContextRef.current, state: 'unknown' };
            setError('Không thể lưu lịch sử trên trình duyệt này.');
          }
        }
        setAnnouncement('Không thể hoàn tất phản hồi. Bạn có thể gửi lại.');
      }
    } finally {
      window.clearTimeout(requestTimeout);
      // Tùng: mở composer đúng hạn, không chờ lock đối soát của tab khác.
      if (running.current === controller) { running.current = null; setBusy(false); }
      if (guest) {
        try {
          const current = await settleGuest(turnId, guest.day, rejected || !requestStarted, accepted || rejected || !requestStarted);
          if (generation.current === turnGeneration && actorToken.current === turnToken
            && localStorage.getItem(AUTH_TOKEN_KEY) === turnToken && current.day === clockDay(serverClock.current)) setQuota(guestQuota(current));
        } catch { if (generation.current === turnGeneration && localStorage.getItem(AUTH_TOKEN_KEY) === turnToken) { setQuota(null); setError('Không thể cập nhật lượt dùng trên trình duyệt này.'); } }
      }
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
