import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import ChatThread from '../components/ChatThread/ChatThread';
import ChatBubble from '../components/ChatBubble/ChatBubble';
import RichText from '../components/ChatBubble/richText';
import PromptChip from '../components/PromptChip/PromptChip';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import { useToast } from '../components/Toast/Toast';
import ChatDiscoveryResult from './ChatDiscoveryResult';
import ChatSourceCard from './ChatSourceCard';
import ChatResultCards from './ChatResultCards';
import { AI_NAME } from '../constants/domain';
import logo from '../assets/logo-for-all.png';
import { useAuthContext } from '../context/AuthContext';
import chatbotService from '../services/chatbot.service';
import { AUTH_TOKEN_KEY } from '../services/api';
import { readChatSession, writeChatSession, clearChatSession } from '../utils/chatSession';
import { repeatedCardIndexes } from '../utils/chatCards';
import styles from './ChatbotPage.module.css';

// Khoi's code (05/11/2026): chỉ giữ deviceId trên máy khách; số lượt hỏi thử do server đếm.
const GUEST_DEVICE_KEY = 'vegetarian-chat-guest-device-v1';
const LEGACY_GUEST_KEYS = ['vegetarian-chat-guest-quota-v1', 'vegetarian-chat-guest-quota-v2'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Khoi's code (05/11/2026): gợi ý đúng khả năng của Mầm; khách không tìm bài viết được.
const SUGGESTIONS_MEMBER = [
  'Tối nay mình nên ăn món chay gì?',
  'Thay trứng trong bánh bằng gì?',
  'Tìm bài viết về đậu hũ',
  'Làm sao để đăng công thức lên Green Bowl?',
];
const SUGGESTIONS_GUEST = ['Tối nay mình nên ăn món chay gì?', 'Thay trứng trong bánh bằng gì?',
  'Ăn chay sao cho đủ đạm?', 'Làm sao để đăng công thức lên Green Bowl?'];

const MEDICAL_NOTE = 'Mầm chỉ cung cấp thông tin tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.';

function validText(value) {
  return Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

// Tùng: chỉ so sánh chủ đề bằng chữ chuẩn hóa, không tự suy đồng nghĩa.
// Khoi's code (08/11/2026): chữ ký HMAC base64url của server (32 byte).
const HISTORY_SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

function subjectKey(value) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

function emptyPostContext(state = 'unknown') {
  return { version: 1, state, activeSubject: null, topics: [], delivery: null };
}

function completedHistory(messages) {
  // Khoi's code (06/11/2026): quay về logic phiên gốc của Tùng — không còn tin 'system' để ngắt lịch sử.
  const result = [];
  for (let i = 0; i + 1 < messages.length; i += 1) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.sender === 'user' && answer.sender === 'bot'
      && (question.status ?? 'complete') === 'complete' && (answer.status ?? 'complete') === 'complete'
      // Khoi's code (08/11/2026): chỉ gửi cặp mà tin bot có chữ ký server; bản cũ/lượt lỗi thì bỏ.
      && typeof answer.turnId === 'string' && UUID.test(answer.turnId)
      && Number.isSafeInteger(answer.at) && typeof answer.sig === 'string' && HISTORY_SIGNATURE.test(answer.sig)) {
      result.push({ sender: 'user', content: question.content },
        { sender: 'bot', content: answer.content, turnId: answer.turnId, at: answer.at, sig: answer.sig });
      i += 1;
    }
  }
  return result.slice(-20);
}

function legacyGuestDevice() {
  for (const key of LEGACY_GUEST_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (value && typeof value.deviceId === 'string' && UUID.test(value.deviceId)) return value.deviceId;
    } catch { /* bỏ qua bản ghi cũ bị hỏng */ }
  }
  return null;
}

// Khoi's code (05/11/2026): deviceId vẫn lưu trên máy khách để gửi lên server; không còn đếm lượt ở đây.
function readGuestDevice() {
  const saved = localStorage.getItem(GUEST_DEVICE_KEY);
  const deviceId = saved && UUID.test(saved) ? saved : (legacyGuestDevice() ?? crypto.randomUUID());
  if (deviceId !== saved) localStorage.setItem(GUEST_DEVICE_KEY, deviceId);
  for (const key of LEGACY_GUEST_KEYS) localStorage.removeItem(key);
  return deviceId;
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
  return <img className={className} src={logo} alt="" />;
}

// Khoi's code (01/11/2026): mở từ khối "Hỏi Mầm" ở Bảng tin (/chatbot?ask=<câu hỏi>) → điền sẵn câu vào ô chat, chỉ cần Enter để gửi.
const readAskParam = () => (new URLSearchParams(window.location.search).get('ask') ?? '').trim().slice(0, 10000);

export default function ChatbotPage({ user }) {
  const { logout } = useAuthContext();
  const toast = useToast();
  const [text, setText] = useState(readAskParam); // Khoi's code 01/11: '' khi không có ?ask=
  const askFocusRef = useRef(Boolean(readAskParam())); // Khoi's code 01/11: còn chờ focus ô chat cho câu điền sẵn
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const stopRequested = useRef(false);
  const messagesRef = useRef([]);
  const sessionRef = useRef(null);
  const postContextRef = useRef(emptyPostContext());
  const running = useRef(null);
  const generation = useRef(0);
  const serverClock = useRef(null);
  const actorToken = useRef(null);
  const textareaRef = useRef(null);
  // Khoi's code (08/11/2026): tự gửi lại đúng 1 lần khi server báo lịch sử không hợp lệ.
  const sendRef = useRef(null);
  const retryRef = useRef(null);
  const historyRetried = useRef(null);
  const actor = user?.id ? `account:${user.id}` : 'guest';
  const suggestions = user?.id ? SUGGESTIONS_MEMBER : SUGGESTIONS_GUEST;

  // Khoi's code (01/11/2026): xoá ?ask= khỏi URL (tải lại trang không điền lại); ô chat bị khoá tới khi phiên sẵn sàng → lúc đó mới focus, con trỏ ở cuối câu
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('ask')) return;
    params.delete('ask');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!askFocusRef.current || !enabled || !sessionReady || busy || !textarea) return;
    askFocusRef.current = false;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [enabled, sessionReady, busy]);

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
      || !messages.some((message) => message.turnId === delivery.turnId
        && (message.result?.item?.id === delivery.postId
          || message.result?.items?.some((item) => item.id === delivery.postId)))) return;
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
        let deviceId;
        if (user?.id) {
          const result = await chatbotService.getSimpleQuota({ signal: controller.signal });
          if (!actorCurrent()) return;
          setQuota(result.quota);
        } else {
          deviceId = readGuestDevice();
          if (availability.enabled) {
            const result = await chatbotService.getGuestQuota(deviceId, { signal: controller.signal });
            if (!actorCurrent()) return;
            setQuota(result.quota);
          }
        }
        const scope = user?.id ? actor : deviceId ? `device:${deviceId}` : null;
        const saved = scope ? readChatSession(scope) : null;
        if (saved) {
          const result = await chatbotService.verifySimpleSession({ token: saved.token, deviceId }, { signal: controller.signal });
          if (!actorCurrent()) return;
          if (result.valid) {
            updateMessages(saved.messages);
            postContextRef.current = saved.postContext ?? emptyPostContext();
            updateSession({ token: saved.token, scope, deviceId,
              expiresAt: result.expiresAt, serverTime: result.serverTime });
          } else {
            // Khoi's code (06/11/2026): quay về logic phiên gốc của Tùng — phiên cũ hết hạn thì khung trống.
            postContextRef.current = emptyPostContext('known');
          }
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
          : (await chatbotService.getGuestQuota(readGuestDevice(), { signal: controller.signal })).quota;
        // Khoi's code (05/11/2026): quota khách do server trả nên không cần so ngày ở máy khách.
        const fresh = user?.id ? current.day === clockDay(serverClock.current) : true;
        if (actorCurrent() && refreshGeneration === generation.current && fresh) setQuota(current);
      } catch { if (actorCurrent() && refreshGeneration === generation.current) { setQuota(null); setError('Không thể đọc số lượt còn lại.'); } }
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
      // Khoi's code (06/11/2026): quay về logic phiên gốc của Tùng — hết phiên thì xoá toàn bộ tin.
      updateMessages([]);
      updateSession(null);
      postContextRef.current = emptyPostContext('known');
      setAnnouncement('Phiên trò chuyện đã hết hạn.');
    }, Math.max(0, session.expiresAt - session.serverTime));
    return () => window.clearTimeout(timer);
  }, [session, updateMessages, updateSession]);

  const sendQuestion = async (question, { ignoreBusy = false } = {}) => {
    if (!enabled || !sessionReady || (busy && !ignoreBusy) || running.current
      || !quota?.remaining || !question.trim() || !validText(question)) return;
    if (localStorage.getItem(AUTH_TOKEN_KEY) !== actorToken.current) { setError('Tài khoản đã thay đổi. Vui lòng mở lại cuộc trò chuyện.'); return; }
    if (!globalThis.crypto?.randomUUID) { setError('Không thể gửi câu hỏi trên trình duyệt này.'); return; }
    const turnToken = actorToken.current;
    const turnId = crypto.randomUUID();
    const turnGeneration = ++generation.current;
    const controller = new AbortController();
    running.current = controller;
    stopRequested.current = false;
    let timedOut = false;
    const startedAt = performance.now();
    // Tùng: giới hạn thời gian chờ bao gồm clock, lock và stream của lượt.
    // Khoi's code (07/11/2026): 20s tới chữ đầu tiên; có chữ rồi thì nới tổng lên 45s như server.
    let deadlineMs = 20000;
    let requestTimeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    const extendDeadline = () => {
      if (deadlineMs !== 20000) return;
      deadlineMs = 45000;
      window.clearTimeout(requestTimeout);
      requestTimeout = window.setTimeout(() => { timedOut = true; controller.abort(); },
        Math.max(0, deadlineMs - (performance.now() - startedAt)));
    };
    setBusy(true);
    setError('');
    setAnnouncement('Đang chờ phản hồi.');
    const history = completedHistory(messagesRef.current);
    updateMessages((current) => [...current,
      { sender: 'user', content: question, status: 'waiting', turnId },
      { sender: 'bot', content: '', status: 'waiting', turnId, question }]);
    let guestDeviceId;
    let accepted = false;
    let quotaFromServer = false;
    let scope;
    let reply = '';
    let pendingPostText = '';
    let resultCard;
    let resultCards;
    const active = () => {
      if (performance.now() - startedAt >= deadlineMs) { timedOut = true; controller.abort(); }
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
      // Khoi's code (05/11/2026): khách không tự trừ lượt; server trừ và trả lại khi lượt lỗi.
      if (!user?.id) {
        guestDeviceId = readGuestDevice();
        if (!active()) { if (timedOut) throw new Error('Kết nối quá lâu.'); return; }
      }
      const deviceId = guestDeviceId;
      const expectedDay = availability.quotaDay;
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
        ...(deviceId ? { deviceId, expectedDay } : {}), ...(priorSession?.token ? { sessionToken: priorSession.token } : {}) };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 2 * 1024 * 1024) {
        postContextRef.current = { ...postContextRef.current, state: 'unknown' };
        throw new Error('Không thể xác định danh sách bài đã hiện do dữ liệu quá lớn.');
      }
      const response = await chatbotService.streamTurnV3(payload, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        onAccepted: (payload) => {
          if (!active()) return;
          accepted = true;
          if (payload.quota?.day === clockDay(serverClock.current)) { quotaFromServer = true; setQuota(payload.quota); }
          const current = updateMessages((list) => list.map((message) => message.turnId === turnId && message.sender === 'user'
            ? { ...message, status: 'complete' } : message));
          saveSession(payload.session, scope, deviceId, current);
        },
        onDelta: (chunk, purpose, searchSubject) => {
          extendDeadline();
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
        onRetract: (text) => {
          if (!active()) return;
          // Khoi's code (07/11/2026): server thu hồi câu trả lời đã stream → thay toàn bộ bong bóng.
          reply = text;
          pendingPostText = '';
          resultCard = undefined;
          resultCards = undefined;
          // Khoi's code (06/11/2026): bị thu hồi thì bỏ luôn thẻ nguồn công thức.
          updateTurn({ content: text, cards: undefined, result: undefined, source: undefined });
        },
        onResult: (value) => {
          if (!active()) return;
          // Khoi's code (06/11/2026): thẻ nguồn công thức (Green Bowl đã duyệt / do AI tạo) — chỉ hiển thị.
          // Chỉ lưu đúng các khoá của hợp đồng (bỏ turnId) để chatSession đọc lại được ở lượt sau.
          if (value.kind === 'recipe-source' || value.kind === 'ai-generated') {
            updateTurn({ source: value.kind === 'recipe-source'
              ? { kind: 'recipe-source', item: value.item, quantityNote: value.quantityNote }
              : { kind: 'ai-generated' } });
            return;
          }
          // Khoi's code (05/11/2026): thẻ công thức/quán thật của Green Bowl.
          if (value.kind === 'recipes' || value.kind === 'shops') {
            resultCards = value;
            updateTurn({ cards: value });
            return;
          }
          if (!value.search) {
            postContextRef.current = { ...postContextRef.current, state: 'unknown' };
            resultCard = value;
            updateTurn({ result: value });
            return;
          }
          // Khoi's code (05/11/2026): cộng TẤT CẢ bài vừa hiện vào seenIds; delivery = bài hạng cao nhất.
          const resultItems = Array.isArray(value.items) ? value.items : (value.item ? [value.item] : []);
          const ids = resultItems.map((item) => item?.id);
          if (!ids.length || ids.some((id) => typeof id !== 'string' || !/^[1-9]\d{0,17}$/.test(id))
            || resultItems.some((item) => typeof item.title !== 'string' || !item.title.trim())) {
            throw new Error('Không thể nhận bài viết hợp lệ.');
          }
          const current = postContextRef.current;
          const key = subjectKey(value.search.subject);
          const oldTopic = current.topics.find((entry) => subjectKey(entry.subject) === key);
          const entry = { subject: value.search.subject, seenIds: [...new Set([...(oldTopic?.seenIds ?? []), ...ids])] };
          const nextContext = { ...current, activeSubject: entry.subject,
            topics: [...current.topics.filter((item) => subjectKey(item.subject) !== key), entry],
            delivery: { turnId, subject: entry.subject, postId: ids[0], state: 'pending' } };
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
      if (!active()) {
        if (timedOut) throw new Error('Kết nối quá lâu.');
        // Khoi's code (05/11/2026): người dùng bấm Dừng → coi như lượt lỗi để hiện đúng trạng thái.
        if (stopRequested.current) throw new Error('Đã dừng lượt.');
        return;
      }
      if (pendingPostText) throw new Error('Không thể hiển thị bài viết; kết quả chưa xác định.');
      const entry = response.historyEntry;
      const nextMessages = updateMessages((current) => current.map((message) => (
        message.turnId === turnId ? { ...message, status: 'complete',
          ...(message.sender === 'bot' ? { content: reply, result: resultCard, cards: resultCards, limited: response.limited,
            // Khoi's code (08/11/2026): lưu chữ ký cạnh nội dung để lượt sau gửi lại đúng cặp đã ký.
            ...(entry ? { at: entry.at, sig: entry.sig } : {}) } : {}) } : message
      )));
      saveSession(response.session, scope, deviceId, nextMessages);
      if (response.quota?.day === clockDay(serverClock.current)) { quotaFromServer = true; setQuota(response.quota); }
      setAnnouncement('Đã nhận phản hồi.');
    } catch (requestError) {
      const stopped = stopRequested.current;
      if (ownsTurn()) {
        if (requestError.details?.code === 'CHATBOT_DISABLED') setEnabled(false);
        // Khoi's code (05/11/2026): lượt lỗi có thể được server hoàn → cập nhật số lượt và ghi chú.
        const errorQuota = requestError.details?.quota;
        if (errorQuota && Number.isInteger(errorQuota.remaining)) { quotaFromServer = true; setQuota(errorQuota); }
        const wasRefunded = requestError.details?.refunded === true;
        if (requestError.details?.code === 'SESSION_EXPIRED') {
          // Khoi's code (06/11/2026): quay về logic phiên gốc của Tùng — bỏ phiên, chỉ giữ lượt đang gửi.
          updateSession(null);
          updateMessages((current) => current.filter((message) => message.turnId === turnId));
        }
        if (requestError.details?.code === 'HISTORY_INVALID') {
          // Khoi's code (06/11/2026): xử lý như SESSION_EXPIRED gốc (chỉ giữ lượt đang gửi) rồi tự gửi lại 1 lần.
          updateSession(null);
          updateMessages((current) => current.filter((message) => message.turnId === turnId));
          if (historyRetried.current !== question) {
            historyRetried.current = question;
            retryRef.current = question;
          }
          setError(requestError.message || 'Lịch sử trò chuyện không hợp lệ.');
        }
        const nextMessages = updateMessages((current) => current.map((message) => message.turnId === turnId
          ? { ...message, status: 'failed', ...(message.sender === 'bot' ? {
            content: reply, refunded: wasRefunded, error: stopped ? 'Bạn đã dừng lượt này.'
              : timedOut ? 'Kết nối quá lâu; chưa xác định được kết quả. Bạn có thể gửi lại.'
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
      // Khoi's code (08/11/2026): gửi lại đúng câu vừa rồi với lịch sử rỗng (chỉ một lần).
      const retry = retryRef.current;
      retryRef.current = null;
      if (retry) window.setTimeout(() => { void sendRef.current?.(retry, { ignoreBusy: true }); }, 0);
      // Khoi's code (05/11/2026): lượt không kèm quota (429, dừng, hoàn lượt sau khi ngắt) → đọc lại từ server.
      if (!quotaFromServer) {
        try {
          const result = user?.id
            ? await chatbotService.getSimpleQuota()
            : await chatbotService.getGuestQuota(readGuestDevice());
          if (generation.current === turnGeneration && actorToken.current === turnToken
            && localStorage.getItem(AUTH_TOKEN_KEY) === turnToken) setQuota(result.quota);
        } catch { /* giữ số lượt đang hiển thị */ }
      }
    }
  };

  // Khoi's code (08/11/2026): giữ bản mới nhất để lượt tự gửi lại dùng đúng state hiện tại.
  sendRef.current = sendQuestion;

  // Khoi's code (05/11/2026): dừng lượt đang chờ — server chỉ hoàn lượt khi chưa gửi câu trả lời (bước 2).
  const stopAnswer = () => {
    stopRequested.current = true;
    running.current?.abort();
  };

  const copyAnswer = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast('Đã sao chép');
    } catch { toast('Không thể sao chép', { tone: 'alert' }); }
  };

  // Khoi's code (05/11/2026): xoá lịch sử + sessionToken, không đụng quota (không hoàn, không trừ).
  const startNewChat = () => {
    setConfirmNew(false);
    const scope = sessionRef.current?.scope ?? (user?.id ? actor : `device:${readGuestDevice()}`);
    try { clearChatSession(scope); } catch { /* trình duyệt chặn lưu trữ */ }
    updateMessages([]);
    updateSession(null);
    postContextRef.current = emptyPostContext('known');
    setAnnouncement('Đã bắt đầu cuộc trò chuyện mới.');
  };

  const send = (event) => {
    event.preventDefault();
    const question = text.trim();
    if (!question || !validText(text) || busy || running.current || !enabled || !sessionReady || !quota?.remaining) return;
    setText('');
    void sendQuestion(question);
  };
  const suggestionsDisabled = !enabled || !sessionReady || busy || !quota?.remaining || text.length > 0;
  // Khoi's code (11/11/2026): các tin của Mầm có hàng thẻ trùng lượt ngay trước (không vẽ lại).
  const repeatedCards = repeatedCardIndexes(messages);
  const textValid = validText(text);

  return (
    <MemberNavigationLayout>
      <section className={styles.page} aria-labelledby="chatbot-title">
        <header className={styles.header}>
          <div className={styles.identity}>
            <MamAvatar className={styles.identityMark} />
            <div>
              <h1 id="chatbot-title">{AI_NAME}</h1>
              <p>Trợ lý cho những bữa ăn chay của bạn</p>
              {/* Khoi's code (05/11/2026): nói rõ chính sách lưu lịch sử (nhóm chốt: không lưu lâu dài). */}
              {/* Khoi's code (06/11/2026): khớp vòng đời phiên gốc — 30 phút không hoạt động là tự xoá. */}
              <small className={styles.subtitle}>Cuộc trò chuyện tự xoá sau 30 phút không hoạt động.</small>
            </div>
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
          {messages.length > 0 && (
            <div className={styles.chatTools}>
              {/* Khoi's code (05/11/2026): xoá lịch sử + sessionToken, không hoàn và không trừ lượt. */}
              <button type="button" className={styles.newChat} onClick={() => setConfirmNew(true)}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Cuộc trò chuyện mới
              </button>
            </div>
          )}
          <div className={styles.conversation}>
            {!sessionReady ? <p className={styles.sessionStatus} role="status">Đang kiểm tra phiên trò chuyện...</p>
              : messages.length === 0 ? (
                <div className={styles.empty}>
                  <MamAvatar className={styles.illustration} />
                  <h2>Chào bạn, hôm nay mình ăn gì nhỉ?</h2>
                  <p>Hỏi {AI_NAME} về món chay, nguyên liệu hoặc dinh dưỡng. Bạn cũng có thể bắt đầu từ một gợi ý:</p>
                  <div className={styles.suggestions} role="group" aria-label="Gợi ý câu hỏi">
                    {suggestions.map((suggestion) => <PromptChip key={suggestion} disabled={suggestionsDisabled}
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
                        {/* Khoi's code (09/11/2026): lượt lỗi chưa có chữ nào thì không vẽ bong bóng rỗng, chỉ hiện dòng lỗi. */}
                        {!(message.sender === 'bot' && message.status === 'failed' && !message.content) && (
                          <ChatBubble sender={message.sender} content={message.content}
                            className={message.sender === 'bot' ? styles.botBubble : undefined}
                            typing={message.sender === 'bot' && message.status === 'waiting' && !message.content}>
                            {message.sender === 'bot' && message.content
                              ? <div className={styles.replyText}><RichText text={message.content} /></div> : undefined}
                          </ChatBubble>
                        )}
                        {message.sender === 'bot' && message.content && message.status !== 'waiting' && (
                          <button type="button" className={styles.copy} onClick={() => void copyAnswer(message.content)}>
                            <i className="bi bi-clipboard" aria-hidden="true" /> Sao chép
                          </button>
                        )}
                        {message.sender === 'bot' && message.result && <ChatDiscoveryResult result={message.result} />}
                        {/* Khoi's code (06/11/2026): thẻ nguồn đứng NGAY dưới bong bóng, trước hàng thẻ món khác. */}
                        {message.sender === 'bot' && message.source && <ChatSourceCard source={message.source} />}
                        {/* Khoi's code (11/11/2026): hàng thẻ y hệt lượt trả lời ngay trước thì không vẽ lại. */}
                        {message.sender === 'bot' && message.cards && !repeatedCards.has(index) && (
                          <ChatResultCards cards={message.cards}
                            title={message.source ? 'Món khác trên Green Bowl bạn có thể thích' : undefined} />
                        )}
                        {message.sender === 'bot' && message.limited && <p className={styles.messageNotice}>Câu trả lời đã đạt giới hạn độ dài.</p>}
                        {message.sender === 'bot' && message.status === 'failed' && <div className={styles.messageNotice}>
                          <p>{message.error}</p>
                          {/* Khoi's code (05/11/2026): lượt lỗi đã được server hoàn thì nói rõ để khách yên tâm. */}
                          {message.refunded && <small>Lượt này không bị tính.</small>}
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
                aria-describedby="chatbot-hint chatbot-medical" placeholder="Hỏi Mầm về món chay..." />
              {/* Khoi's code (05/11/2026): đang chờ thì cho Dừng (abort) thay cho Gửi. */}
              {busy ? (
                <Button type="button" variant="outline" icon="stop-circle" onClick={stopAnswer}>Dừng</Button>
              ) : (
                <Button type="submit" icon="arrow-up"
                  disabled={!enabled || !sessionReady || !text.trim() || !textValid || !quota?.remaining}>Gửi</Button>
              )}
            </div>
            {/* Khoi's code (05/11/2026): dòng nhắc y tế cố định dưới ô nhập (FR-14/BR-03). */}
            <p className={styles.disclaimer} id="chatbot-medical">{MEDICAL_NOTE}</p>
            <div className={styles.composerFoot}>
              <small id="chatbot-hint">Enter để gửi, Shift + Enter để xuống dòng. {Array.from(text).length}/10.000 ký tự
                {!textValid && ' — Câu hỏi vượt giới hạn hoặc có ký tự không hợp lệ.'}</small>
            </div>
          </form>
        </div>
        <ConfirmDialog open={confirmNew} title="Xoá cuộc trò chuyện hiện tại?" confirmLabel="Xoá cuộc trò chuyện"
          message="Các tin nhắn trong khung chat sẽ bị xoá khỏi trình duyệt. Lượt đã dùng không được hoàn lại."
          onConfirm={startNewChat} onCancel={() => setConfirmNew(false)} />
        <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Đăng nhập để tiếp tục" size="sm">
          <p>Bạn đã dùng hết lượt hỏi thử trên trình duyệt này.</p>
          <Button onClick={() => window.location.assign('/login')}>Đăng nhập</Button>
        </Modal>
      </section>
    </MemberNavigationLayout>
  );
}
