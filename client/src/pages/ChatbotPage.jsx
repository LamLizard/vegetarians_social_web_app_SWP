import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import ChatThread from '../components/ChatThread/ChatThread';
import ChatBubble from '../components/ChatBubble/ChatBubble';
import PromptChip from '../components/PromptChip/PromptChip';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import { AI_DISCLAIMER, AI_NAME } from '../constants/domain';
import { useAuthContext } from '../context/AuthContext';
import chatbotService from '../services/chatbot.service';
import { AUTH_TOKEN_KEY } from '../services/api';
import { previewAIWeek } from '../services/aiMealPlanner.service';
import { clearChatSession, readChatSession, writeChatSession } from '../utils/chatSession';
import styles from './ChatbotPage.module.css';

const GUEST_KEY = 'vegetarian-chat-guest-quota-v1';
const GUEST_LIMIT = 3;
const MAX_MESSAGE_LENGTH = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUGGESTIONS = [
  'Gợi ý bữa sáng chay giàu đạm',
  'Có thể thay trứng trong món bánh bằng gì?',
  'Gợi ý món chay dễ nấu cho bữa tối',
  'Giúp mình lên thực đơn chay trong tuần',
];

function isValidMessage(value) {
  return Array.from(value).length <= MAX_MESSAGE_LENGTH
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

function completedPairs(messages, includeLimited = false) {
  const result = [];
  for (let i = 0; i + 1 < messages.length; i += 1) {
    const question = messages[i];
    const answer = messages[i + 1];
    if (question.sender === 'user' && answer.sender === 'bot'
      && (question.status ?? 'complete') === 'complete' && (answer.status ?? 'complete') === 'complete') {
      if (includeLimited || !answer.limited) {
        result.push({ sender: 'user', content: question.content },
          { sender: 'bot', content: answer.content, ...(answer.limited ? { limited: true } : {}) });
      }
      i += 1;
    }
  }
  return result;
}

function readGuestQuota() {
  const value = localStorage.getItem(GUEST_KEY);
  if (value === null) return { used: 0, deviceId: null };
  const parsed = JSON.parse(value);
  if (!Number.isInteger(parsed.used) || parsed.used < 0 || parsed.used > GUEST_LIMIT
    || typeof parsed.deviceId !== 'string' || !UUID.test(parsed.deviceId)) throw new Error('STORAGE_UNAVAILABLE');
  return parsed;
}

async function reserveGuestTurn() {
  if (!navigator.locks || !globalThis.crypto?.randomUUID) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(GUEST_KEY, () => {
    const current = readGuestQuota();
    if (current.used >= GUEST_LIMIT) throw new Error('GUEST_QUOTA');
    const next = { deviceId: current.deviceId ?? crypto.randomUUID(), used: current.used + 1 };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

function currentWeekStart() {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
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

function WeeklyPreview({ preview, selectedDay, setSelectedDay }) {
  const labels = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' };
  const days = Array.isArray(preview.days) ? preview.days : [];
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const day = days[selectedDay] || days[0];

  return (
    <section className={styles.plan} aria-label="Thực đơn tuần đề xuất">
      <div className={styles.planHeading}>
        <div>
          <h2>Thực đơn tuần</h2>
          <p>Chọn một ngày để xem các bữa ăn được gợi ý.</p>
        </div>
        <span className={styles.previewLabel}>Bản xem trước</span>
      </div>
      {warnings.map((warning, index) => <Notice tone="info" key={`${warning}-${index}`}>{warning}</Notice>)}
      {days.length > 0 ? <>
        <div className={styles.planDays} role="group" aria-label="Chọn ngày trong thực đơn">
          {days.map((item, index) => (
            <button type="button" key={`${item?.date || 'day'}-${index}`}
              className={styles.dayButton} aria-pressed={index === (days[selectedDay] ? selectedDay : 0)}
              onClick={() => setSelectedDay(index)}>
              <span>Ngày {index + 1}</span>
              <small>{item?.date || 'Chưa có ngày'}</small>
            </button>
          ))}
        </div>
        <article className={styles.planDay}>
          <h3>{day?.date || 'Ngày chưa xác định'}</h3>
          <div className={styles.meals}>
            {Object.entries(labels).map(([slot, label]) => (
              <div className={styles.meal} key={slot}>
                <span>{label}</span>
                <strong>{day?.meals?.[slot]?.name || 'Chưa có món'}</strong>
                {day?.meals?.[slot]?.allergyUnchecked && <small>Chưa kiểm tra dị ứng</small>}
              </div>
            ))}
          </div>
        </article>
      </> : <p className={styles.planEmpty}>Chưa có ngày nào trong bản xem trước.</p>}
      <Notice tone="info">Hiện chưa thể lưu thực đơn đề xuất.</Notice>
      <div><Button disabled>Lưu thực đơn</Button></div>
    </section>
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
  const [loginReason, setLoginReason] = useState('quota');
  const [profilePrompt, setProfilePrompt] = useState(false);
  const [plan, setPlan] = useState(null);
  const [selectedPlanDay, setSelectedPlanDay] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [planViewOpen, setPlanViewOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const pending = useRef(null);
  const planPending = useRef(null);
  const textareaRef = useRef(null);
  const toolsRef = useRef(null);
  const toolsButtonRef = useRef(null);

  useEffect(() => {
    if (!toolsOpen) return undefined;
    const dismissOutside = (event) => {
      if (!toolsRef.current?.contains(event.target)) setToolsOpen(false);
    };
    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') {
        setToolsOpen(false);
        toolsButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [toolsOpen]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [text]);

  useEffect(() => () => planPending.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    chatbotService.getAvailability({ signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setEnabled(result.enabled === true); })
      .catch(() => { if (!controller.signal.aborted) setError('Không thể kiểm tra trạng thái trợ lý.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (user) {
      chatbotService.getQuota({ signal: controller.signal })
        .then((response) => setQuota(response.quota))
        .catch(() => { if (!controller.signal.aborted) setError('Không thể tải số lượt sử dụng.'); });
    } else {
      const syncGuest = () => {
        try {
          const { used } = readGuestQuota();
          setQuota({ used, limit: GUEST_LIMIT, remaining: GUEST_LIMIT - used });
        } catch {
          setQuota(null);
          setError('Không thể kiểm tra lượt sử dụng trên trình duyệt này.');
        }
      };
      syncGuest();
      window.addEventListener('storage', syncGuest);
      return () => { window.removeEventListener('storage', syncGuest); pending.current?.abort(); };
    }
    return () => { controller.abort(); pending.current?.abort(); };
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    setMessages([]);
    setSession(null);
    setSessionReady(false);
    let deviceId;
    let scope;
    try {
      deviceId = user ? undefined : readGuestQuota().deviceId;
      scope = user ? `account:${user.id}` : deviceId ? `device:${deviceId}` : null;
      const saved = readChatSession(scope);
      if (!saved) {
        setSessionReady(true);
        return () => controller.abort();
      }
      chatbotService.verifySession({ token: saved.token, deviceId }, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result.valid) {
            clearChatSession(scope);
            setSessionReady(true);
            return;
          }
          setMessages(saved.messages);
          setSession({ token: saved.token, scope, deviceId,
            expiresAt: result.expiresAt, serverTime: result.serverTime });
          setSessionReady(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Không thể kiểm tra phiên trò chuyện. Vui lòng tải lại.');
        });
    } catch {
      if (scope) { try { clearChatSession(scope); } catch { /* Storage unavailable. */ } }
      setError('Không thể đọc phiên trò chuyện trên trình duyệt này.');
    }
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    const remaining = Math.max(0, session.expiresAt - session.serverTime);
    const deadline = performance.now() + remaining;
    const expire = () => {
      pending.current?.abort();
      pending.current = null;
      setBusy(false);
      setAnnouncement('Phiên trò chuyện đã hết hạn.');
      try { clearChatSession(session.scope); } catch { /* Expired session stays hidden. */ }
      setMessages([]);
      setSession(null);
      setSessionReady(true);
    };
    const timer = window.setTimeout(expire, remaining);
    const verifyVisible = () => {
      if (document.visibilityState === 'hidden') {
        setSessionReady(false);
        return;
      }
      if (performance.now() >= deadline) {
        expire();
        return;
      }
      setSessionReady(false);
      chatbotService.verifySession({ token: session.token, deviceId: session.deviceId }, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (!result.valid) { expire(); return; }
          setSession((current) => current?.token === session.token
            ? { ...current, expiresAt: result.expiresAt, serverTime: result.serverTime } : current);
          setSessionReady(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Không thể kiểm tra phiên trò chuyện. Vui lòng tải lại.');
        });
    };
    document.addEventListener('visibilitychange', verifyVisible);
    window.addEventListener('focus', verifyVisible);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', verifyVisible);
      window.removeEventListener('focus', verifyVisible);
    };
  }, [session]);

  const runTurn = async (question, turnId, previous) => {
    if (!enabled || !sessionReady || busy || pending.current || !globalThis.crypto?.randomUUID) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setAnnouncement(previous ? 'Đang kiểm tra và gửi lại câu hỏi.' : `${AI_NAME} đang trả lời.`);
    setError('');
    const updateTurn = (fields) => setMessages((current) => current.map((message) => (
      message.turnId === turnId && message.sender === 'bot' ? { ...message, ...fields } : message
    )));
    let operationId = previous?.operationId;
    let deviceId = previous?.deviceId;
    let responseText = previous?.content || '';
    let updateTimer;
    try {
      if (previous && !previous.notReserved && !previous.confirmedSuccess) {
        updateTurn({ status: 'checking', error: '' });
        const { state } = await chatbotService.getRequestState({ operationId, deviceId }, {
          signal: controller.signal,
          onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        });
        if (controller.signal.aborted) return;
        if (state === 'pending') {
          updateTurn({ status: 'failed', error: 'Lượt trước vẫn đang xử lý. Hãy kiểm tra lại sau.' });
          setAnnouncement('Lượt trước vẫn đang xử lý. Hãy kiểm tra lại sau.');
          return;
        }
        if (state === 'unknown' || !['failed', 'success'].includes(state)) {
          updateTurn({ status: 'failed', error: 'Chưa xác định được trạng thái lượt trước. Hãy thử kiểm tra lại.' });
          setAnnouncement('Chưa xác định được trạng thái lượt trước. Hãy thử kiểm tra lại.');
          return;
        }
        if (state === 'success') {
          if (user) {
            const updated = await chatbotService.getQuota({ signal: controller.signal });
            if (controller.signal.aborted) return;
            setQuota(updated.quota);
          }
          updateTurn({ status: 'failed', confirmedSuccess: true,
            error: 'Lượt trước đã hoàn thành nhưng kết nối bị ngắt. Gửi lại sẽ tạo lượt mới.' });
          setAnnouncement('Lượt trước đã hoàn thành nhưng kết nối bị ngắt. Gửi lại sẽ tạo lượt mới.');
          return;
        }
      }
      if (!quota?.remaining) {
        if (!user) { setLoginReason('quota'); setLoginOpen(true); }
        updateTurn({ status: 'failed', error: 'Bạn đã hết lượt sử dụng.' });
        setAnnouncement('Bạn đã hết lượt sử dụng.');
        return;
      }
      if (!user) {
        const guest = await reserveGuestTurn();
        deviceId = guest.deviceId;
        setQuota({ used: guest.used, limit: GUEST_LIMIT, remaining: GUEST_LIMIT - guest.used });
      }
      operationId = crypto.randomUUID();
      responseText = '';
      updateTurn({ status: 'waiting', content: '', error: '', operationId, deviceId,
        notReserved: false, confirmedSuccess: false });
      const history = completedPairs(messages).slice(-20).map(({ sender, content }) => ({ sender, content }));
      const response = await chatbotService.streamMessage({ operationId, text: question, history,
        deviceId, sessionToken: session?.token }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        onDelta: (fragment) => {
          responseText += fragment;
          if (!isValidMessage(responseText)) throw new Error('Không thể nhận câu trả lời.');
          if (!updateTimer) updateTimer = window.setTimeout(() => {
            updateTimer = undefined;
            updateTurn({ status: 'streaming', content: responseText });
          }, 100);
        },
      });
      if (controller.signal.aborted) return;
      if (!response.session || typeof response.session.token !== 'string'
        || !Number.isFinite(response.session.expiresAt) || !Number.isFinite(response.session.serverTime)
        || !responseText.trim()) throw new Error('Không thể xác nhận phiên trò chuyện.');
      window.clearTimeout(updateTimer);
      const answer = { sender: 'bot', content: responseText, ...(response.limited ? { limited: true } : {}) };
      const finishedMessages = previous ? messages.map((message) => (message.turnId === turnId
        ? { ...message, status: 'complete', ...(message.sender === 'bot' ? answer : {}) } : message))
        : [...messages, { sender: 'user', content: question }, answer];
      const nextCompleted = completedPairs(finishedMessages, true);
      setMessages((current) => current.map((message) => (message.turnId === turnId
        ? { ...message, status: 'complete', ...(message.sender === 'bot' ? answer : {}) } : message)));
      const scope = user ? `account:${user.id}` : `device:${deviceId}`;
      setSession({ ...response.session, scope, deviceId });
      setAnnouncement(response.limited ? 'Câu trả lời đã đạt giới hạn độ dài.' : 'Câu trả lời đã hoàn thành.');
      try { writeChatSession(scope, response.session.token, nextCompleted); } catch {
        setError('Không thể lưu phiên trò chuyện trên trình duyệt này.');
      }
      if (response.quota) setQuota(response.quota);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        if (requestError.message === 'GUEST_QUOTA') { setLoginReason('quota'); setLoginOpen(true); }
        if (requestError.details?.code === 'SESSION_EXPIRED') {
          try { clearChatSession(session?.scope); } catch { /* Expired data stays hidden. */ }
          setMessages([]);
          setSession(null);
          setError('Phiên trò chuyện đã hết hạn. Vui lòng bắt đầu lại.');
          setAnnouncement('Phiên trò chuyện đã hết hạn. Vui lòng bắt đầu lại.');
        } else {
          updateTurn({ status: 'failed', content: responseText, operationId, deviceId,
            notReserved: Boolean(requestError.notReserved) || !operationId,
            error: requestError.message === 'GUEST_QUOTA' ? 'Bạn đã hết lượt hỏi thử.'
              : requestError.details?.code === 'QUOTA_EXCEEDED' ? 'Bạn đã hết lượt trong ngày.'
              : 'Trợ lý đang gặp trục trặc. Bạn có thể bấm gửi lại.' });
          setAnnouncement('Trợ lý đang gặp trục trặc. Bạn có thể bấm gửi lại.');
        }
      }
    } finally {
      window.clearTimeout(updateTimer);
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const send = (event) => {
    event.preventDefault();
    const question = text.trim();
    if (!enabled || !sessionReady || !question || busy || !quota?.remaining || pending.current) return;
    if (!isValidMessage(text)) { setError('Câu hỏi tối đa 10.000 ký tự hợp lệ.'); return; }
    if (!globalThis.crypto?.randomUUID) { setError('Không thể gửi câu hỏi lúc này.'); return; }
    const turnId = crypto.randomUUID();
    setMessages((current) => [...current,
      { sender: 'user', content: question, status: 'waiting', turnId },
      { sender: 'bot', content: '', status: 'waiting', turnId, question }]);
    setText('');
    void runTurn(question, turnId);
  };

  const createPreview = async (continueWithoutProfile = false) => {
    if (!user) {
      setLoginReason('planner');
      setLoginOpen(true);
      return;
    }
    if (planPending.current || !quota?.remaining || !globalThis.crypto?.randomUUID) return;
    const controller = new AbortController();
    planPending.current = controller;
    setPlanBusy(true);
    setError('');
    setProfilePrompt(false);
    try {
      const result = await previewAIWeek({
        operationId: crypto.randomUUID(), weekStart: currentWeekStart(), continueWithoutProfile,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPlan(result.preview);
      setSelectedPlanDay(0);
      setPlanViewOpen(true);
      setQuota(result.quota);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        if (requestError.details?.code === 'PROFILE_MISSING') setProfilePrompt(true);
        else setError(requestError.message || 'Không thể tạo thực đơn lúc này.');
      }
    } finally {
      if (planPending.current === controller) planPending.current = null;
      if (!controller.signal.aborted) setPlanBusy(false);
    }
  };

  const suggestionsDisabled = !enabled || !sessionReady || busy || !quota?.remaining || text.length > 0;
  const textValid = isValidMessage(text);

  const chooseSuggestion = (suggestion) => {
    if (suggestionsDisabled) return;
    setText(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <MemberNavigationLayout>
      <section className={styles.page} aria-labelledby="chatbot-title">
        <header className={styles.header}>
          <div className={styles.identity}>
            <MamAvatar className={styles.identityMark} />
            <div>
              <h1 id="chatbot-title">{AI_NAME}</h1>
              <p>Trợ lý cho những bữa ăn chay của bạn</p>
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
          {!user && quota?.remaining === 0 && (
            <div><Button variant="outline" onClick={() => { setLoginReason('quota'); setLoginOpen(true); }}>Đăng nhập để tiếp tục</Button></div>
          )}
          <div className={styles.conversation}>
            {!sessionReady ? <p className={styles.sessionStatus} role="status">
              {error ? 'Chưa thể hiển thị cuộc trò chuyện.' : 'Đang kiểm tra phiên trò chuyện...'}
            </p>
              : messages.length === 0 ? (
                <div className={styles.empty}>
                  <MamAvatar className={styles.illustration} />
                  <h2>Chào bạn, hôm nay mình ăn gì nhỉ?</h2>
                  <p>Hỏi {AI_NAME} về món chay, nguyên liệu hoặc dinh dưỡng. Bạn cũng có thể bắt đầu từ một gợi ý:</p>
                  <div className={styles.suggestions} role="group" aria-label="Gợi ý câu hỏi">
                    {SUGGESTIONS.map((suggestion) => (
                      <PromptChip key={suggestion} disabled={suggestionsDisabled}
                        onClick={() => chooseSuggestion(suggestion)}>{suggestion}</PromptChip>
                    ))}
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
                        typing={message.sender === 'bot' && message.status === 'waiting' && !message.content} />
                      {message.sender === 'bot' && message.limited && (
                        <p className={styles.messageNotice}>Câu trả lời đã đạt giới hạn độ dài.</p>
                      )}
                      {message.sender === 'bot' && ['failed', 'checking'].includes(message.status) && (
                        <div className={styles.messageNotice}>
                          <p>{message.status === 'checking' ? 'Đang kiểm tra lượt trước...' : message.error}</p>
                          {message.status === 'failed' && <button type="button" className={styles.retry}
                            disabled={busy || !enabled || !sessionReady}
                            onClick={() => void runTurn(message.question, message.turnId, message)}>Gửi lại</button>}
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </ChatThread>
              )}
          </div>
          <p className={styles.waiting} role="status" aria-live="polite">
            {announcement}
          </p>
          <form className={styles.composer} onSubmit={send}>
            <label className="visually-hidden" htmlFor="chatbot-question">Câu hỏi của bạn</label>
            <div className={styles.composerBox}>
              <div className={styles.tools} ref={toolsRef}>
                <button ref={toolsButtonRef} type="button" className={styles.toolsButton}
                  aria-label="Công cụ" aria-expanded={toolsOpen} aria-controls="chatbot-tools"
                  disabled={!sessionReady} onClick={() => setToolsOpen((open) => !open)}>
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </button>
                {toolsOpen && (
                  <div id="chatbot-tools" className={styles.toolsMenu} aria-label="Công cụ trò chuyện">
                    <button type="button" className={styles.toolItem}
                      disabled={planBusy || !enabled || (Boolean(user) && !quota?.remaining)}
                      onClick={() => { setToolsOpen(false); void createPreview(false); }}>
                      <span className={styles.toolIcon} aria-hidden="true"><i className="bi bi-calendar2-week" /></span>
                      <span><strong>{planBusy ? 'Đang lên thực đơn...' : 'Lên thực đơn tuần'}</strong>
                        <small>Gợi ý bữa ăn cho cả tuần</small></span>
                    </button>
                    {plan && <button type="button" className={styles.toolItem}
                      onClick={() => { setToolsOpen(false); setPlanViewOpen(true); }}>
                      <span className={styles.toolIcon} aria-hidden="true"><i className="bi bi-journal-text" /></span>
                      <span><strong>Xem thực đơn đã tạo</strong><small>Mở lại bản xem trước</small></span>
                    </button>}
                  </div>
                )}
              </div>
              <textarea ref={textareaRef} id="chatbot-question" rows={1} value={text}
                onChange={(event) => setText(event.target.value)} disabled={!enabled || !sessionReady || busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
                    && event.nativeEvent.keyCode !== 229) send(event);
                }}
                aria-describedby="chatbot-hint chatbot-disclaimer"
                placeholder="Hỏi Mầm về món chay..." />
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
          <p>{loginReason === 'planner' ? 'Đăng nhập để đề xuất thực đơn tuần.' : 'Bạn đã dùng hết lượt hỏi thử trên trình duyệt này.'}</p>
          <Button onClick={() => window.location.assign('/login')}>Đăng nhập</Button>
        </Modal>
        <Modal open={profilePrompt} onClose={() => setProfilePrompt(false)} title="Chưa có hồ sơ sức khỏe" size="sm">
          <p>Bạn có thể tạo hồ sơ hoặc tiếp tục khi chưa kiểm tra dị ứng.</p>
          <Button variant="outline" onClick={() => window.location.assign('/profile')}>Đến hồ sơ</Button>{' '}
          <Button onClick={() => createPreview(true)}>Tiếp tục</Button>
        </Modal>
        <Modal open={planViewOpen} onClose={() => setPlanViewOpen(false)} title="Thực đơn tuần" size="lg">
          {plan && <WeeklyPreview preview={plan} selectedDay={selectedPlanDay} setSelectedDay={setSelectedPlanDay} />}
        </Modal>
      </section>
    </MemberNavigationLayout>
  );
}
