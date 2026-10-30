import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import ChatThread from '../components/ChatThread/ChatThread';
import ChatBubble from '../components/ChatBubble/ChatBubble';
import PromptChip from '../components/PromptChip/PromptChip';
import Button from '../components/Button/Button';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import ChatMealPlanner from './ChatMealPlanner';
import ChatDiscoveryResult from './ChatDiscoveryResult';
import { previewAIWeek, plannerPayloadHash, confirmAIWeek, checkConfirmFor30s } from '../services/aiMealPlanner.service';
import { AI_DISCLAIMER, AI_NAME } from '../constants/domain';
import { useAuthContext } from '../context/AuthContext';
import chatbotService from '../services/chatbot.service';
import { AUTH_TOKEN_KEY } from '../services/api';
import { clearChatSession, readChatSession, writeChatSession, readPendingPlanner,
  reservePendingPlanner, clearPendingPlanner, clearUnstartedPlanner, setPendingPlannerReceipt, readPendingMemberChat,
  reservePendingMemberChat, clearPendingMemberChat, clearUnstartedMemberChat, setPendingMemberReceipt,
  readPendingConfirm, reservePendingConfirm, clearPendingConfirm } from '../utils/chatSession';
import styles from './ChatbotPage.module.css';

const GUEST_KEY = 'vegetarian-chat-guest-quota-v1';
const GUEST_LIMIT = 3;
const MAX_MESSAGE_LENGTH = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUGGESTIONS = [
  'Gợi ý bữa sáng chay giàu đạm',
  'Có thể thay trứng trong món bánh bằng gì?',
  'Gợi ý món chay dễ nấu cho bữa tối',
  'Mình muốn trò chuyện về món chay',
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
    || typeof parsed.deviceId !== 'string' || !UUID.test(parsed.deviceId)
    || (parsed.pending != null && (typeof parsed.pending !== 'string' || !UUID.test(parsed.pending)))
    || (parsed.pending && parsed.used >= GUEST_LIMIT)
    || (parsed.pendingPayloadHash !== undefined && (!parsed.pending || !/^[0-9a-f]{64}$/.test(parsed.pendingPayloadHash)))
    || (parsed.pendingReceipt !== undefined && (typeof parsed.pendingReceipt !== 'string' || parsed.pendingReceipt.length > 2048
      || !parsed.pendingPayloadHash))) throw new Error('STORAGE_UNAVAILABLE');
  return parsed;
}

async function reserveGuestTurn(operationId, payloadHash) {
  if (!navigator.locks || !globalThis.crypto?.randomUUID) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(GUEST_KEY, () => {
    const current = readGuestQuota();
    if (current.pending) throw new Error('GUEST_PENDING');
    if (current.used >= GUEST_LIMIT) throw new Error('GUEST_QUOTA');
    const next = { deviceId: current.deviceId ?? crypto.randomUUID(), used: current.used, pending: operationId,
      ...(payloadHash ? { pendingPayloadHash: payloadHash } : {}) };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

function guestPendingView(guest) {
  if (!guest.pending) return null;
  return { operationId: guest.pending, deviceId: guest.deviceId,
    ...(guest.pendingPayloadHash ? { protocol: 'v2', payloadHash: guest.pendingPayloadHash,
      ...(guest.pendingReceipt ? { receipt: guest.pendingReceipt } : {}) } : {}) };
}

async function setGuestReceipt(operationId, receipt) {
  if (!navigator.locks || typeof receipt !== 'string' || receipt.length > 2048) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(GUEST_KEY, () => {
    const current = readGuestQuota();
    if (current.pending !== operationId || !current.pendingPayloadHash) throw new Error('STORAGE_UNAVAILABLE');
    const next = { ...current, pendingReceipt: receipt };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

async function clearUnstartedGuest(operationId) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(GUEST_KEY, () => {
    const current = readGuestQuota();
    if (current.pending === operationId && current.pendingPayloadHash && !current.pendingReceipt) {
      const next = { deviceId: current.deviceId, used: current.used };
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
      return { cleared: true, guest: next };
    }
    return { cleared: false, guest: current };
  });
}

async function settleGuestTurn(operationId, success) {
  if (!navigator.locks) throw new Error('STORAGE_UNAVAILABLE');
  return navigator.locks.request(GUEST_KEY, () => {
    const current = readGuestQuota();
    if (current.pending !== operationId) return current;
    const next = { deviceId: current.deviceId, used: current.used + (success ? 1 : 0) };
    localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    return next;
  });
}

function guestQuotaView(guest) {
  return { used: guest.used, limit: GUEST_LIMIT, remaining: GUEST_LIMIT - guest.used };
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
    ? <strong key={`${keyBase}-${index}`}>{part}</strong>
    : part));
}

function ChatReplyText({ text }) {
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  String(text).replace(/\r/g, '').split('\n').forEach((line) => {
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    const heading = /^\s{0,3}#{1,6}(?:\s+|$)(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      if (heading[1]) blocks.push({ type: 'heading', text: heading[1] });
      return;
    }
    const bullet = /^\s*[-•*]\s+/.exec(line);
    const numbered = /^\s*(\d+)[.)]\s+/.exec(line);
    const type = bullet ? 'ul' : numbered ? 'ol' : null;
    if (type) {
      flushParagraph();
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [], ...(numbered ? { start: Number(numbered[1]) } : {}) };
      }
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
  const [loginReason, setLoginReason] = useState('quota');
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerWeek, setPlannerWeek] = useState('');
  const [plannerPreview, setPlannerPreview] = useState(null);
  const [plannerError, setPlannerError] = useState('');
  const [plannerProfileMissing, setPlannerProfileMissing] = useState(false);
  const [plannerPending, setPlannerPending] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null);
  const [confirmNotice, setConfirmNotice] = useState('');
  const [plannerSaved, setPlannerSaved] = useState(false);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [guestPending, setGuestPending] = useState(null);
  const [guestExpired, setGuestExpired] = useState(null);
  const [memberPending, setMemberPending] = useState(null);
  const [flow, setFlow] = useState(null);
  const plannerRequest = useRef(null);
  const guestCheckStarted = useRef(null);
  const memberCheckStarted = useRef(null);
  const plannerCheckStarted = useRef(null);
  const confirmCheckStarted = useRef(null);
  const pending = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    plannerCheckStarted.current = null;
    confirmCheckStarted.current = null;
    guestCheckStarted.current = null;
    memberCheckStarted.current = null;
    setPlannerOpen(false);
    setPlannerPreview(null);
    setPlannerError('');
    setConfirmNotice('');
    setPlannerSaved(false);
    setPlannerProfileMissing(false);
    setPlannerPending(null);
    setConfirmPending(null);
    setMemberPending(null);
    setPlannerBusy(false);
    if (!user?.id) return undefined;
    const sync = () => {
      try {
        setPlannerPending(readPendingPlanner(String(user.id)));
        setMemberPending(readPendingMemberChat(String(user.id)));
        setConfirmPending(readPendingConfirm(String(user.id)));
      } catch { setMemberPending({ invalid: true }); setConfirmPending({ invalid: true }); setPlannerError('Không thể đọc trạng thái yêu cầu trước trên trình duyệt này.'); setPlannerPending({ invalid: true }); }
    };
    sync();
    window.addEventListener('storage', sync);
    return () => {
      plannerRequest.current?.abort();
      plannerRequest.current = null;
      window.removeEventListener('storage', sync);
    };
  }, [user]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  }, [text]);

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
      setGuestPending(null);
      chatbotService.getQuota({ signal: controller.signal })
        .then((response) => setQuota(response.quota))
        .catch(() => { if (!controller.signal.aborted) setError('Không thể tải số lượt sử dụng.'); });
    } else {
      const syncGuest = () => {
        try {
          const guest = readGuestQuota();
          setQuota(guestQuotaView(guest));
          setGuestPending(guestPendingView(guest));
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
    setFlow(null);
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
          if (saved.flowToken) {
            const last = saved.messages.at(-1);
            const match = last?.sender === 'bot' && /^Bạn muốn tìm bài viết hay công thức về “([\s\S]*)”\?$/.exec(last.content);
            if (match) setFlow({ token: saved.flowToken, subject: match[1] });
            else setError('Không thể khôi phục ngữ cảnh tìm kiếm. Hãy bắt đầu một yêu cầu mới.');
          }
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
      setFlow(null);
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

  const pollTurn = useCallback(async (record, controller) => {
    const options = { signal: controller.signal,
      onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); } };
    if (record.protocol !== 'v2') return chatbotService.checkRequestFor30s(record, options);
    return chatbotService.checkDiscoveryFor30s(record, { ...options, onReceipt: async (receipt) => {
      if (user) {
        const saved = await setPendingMemberReceipt(String(user.id), record.operationId, receipt);
        if (!controller.signal.aborted) setMemberPending(saved);
      } else {
        const saved = await setGuestReceipt(record.operationId, receipt);
        if (!controller.signal.aborted) setGuestPending(guestPendingView(saved));
      }
    } });
  }, [user, logout]);

  const releaseUnstarted = useCallback(async (record, controller) => {
    if (user) {
      const result = await clearUnstartedMemberChat(String(user.id), record.operationId);
      if (!controller.signal.aborted) setMemberPending(result.pending);
      return result.cleared;
    }
    const result = await clearUnstartedGuest(record.operationId);
    if (!controller.signal.aborted) {
      setGuestPending(guestPendingView(result.guest));
      setQuota(guestQuotaView(result.guest));
    }
    return result.cleared;
  }, [user]);

  const runTurn = async (question, turnId, previous) => {
    if (!enabled || !sessionReady || busy || pending.current || !globalThis.crypto?.randomUUID) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setAnnouncement(`${AI_NAME} đang trả lời.`);
    setError('');
    const updateTurn = (fields) => setMessages((current) => current.map((message) => (
      message.turnId === turnId && message.sender === 'bot' ? { ...message, ...fields } : message
    )));
    let operationId;
    let deviceId;
    let record;
    let preparing = false;
    let responseText = '';
    let card = null;
    let updateTimer;
    try {
      if (previous && !previous.notReserved && !previous.confirmedSuccess) return;
      if (!quota?.remaining && !flow) {
        if (!user) { setLoginReason('quota'); setLoginOpen(true); }
        updateTurn({ status: 'failed', notReserved: true, error: 'Bạn đã hết lượt sử dụng.' });
        return;
      }
      const history = completedPairs(messages).slice(-20).map(({ sender, content }) => ({ sender, content }));
      const payload = { text: question, history, sessionToken: session?.token,
        ...(flow ? { flowToken: flow.token, flowSubject: flow.subject } : {}) };
      const payloadHash = await chatbotService.discoveryPayloadHash(payload);
      const nextOperationId = crypto.randomUUID();
      const metadata = { protocol: 'v2', payloadHash,
        ...(flow ? { flowToken: flow.token, sessionToken: session?.token } : {}) };
      if (!user) {
        const guest = await reserveGuestTurn(nextOperationId, payloadHash);
        operationId = nextOperationId;
        deviceId = guest.deviceId;
        record = guestPendingView(guest);
        if (controller.signal.aborted) return;
        guestCheckStarted.current = operationId;
        setGuestPending(record);
        setQuota(guestQuotaView(guest));
      } else {
        await reservePendingMemberChat(String(user.id), nextOperationId, metadata);
        operationId = nextOperationId;
        record = { operationId, ...metadata };
        if (controller.signal.aborted) return;
        memberCheckStarted.current = operationId;
        setMemberPending(record);
      }
      updateTurn({ status: 'waiting', content: '', error: '', operationId, deviceId,
        notReserved: false, confirmedSuccess: false });
      preparing = true;
      const prepared = await chatbotService.prepareTurn({ operationId, kind: 'turn', payloadHash,
        ...(deviceId ? { deviceId } : {}), ...(flow ? { flowToken: flow.token, sessionToken: session?.token } : {}) }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
      });
      preparing = false;
      if (controller.signal.aborted) return;
      if (typeof prepared.receipt !== 'string') throw new Error('INVALID_RECEIPT');
      record = { ...record, receipt: prepared.receipt };
      if (user) setMemberPending(await setPendingMemberReceipt(String(user.id), operationId, prepared.receipt));
      else setGuestPending(guestPendingView(await setGuestReceipt(operationId, prepared.receipt)));
      if (controller.signal.aborted) return;
      if (prepared.state !== 'prepared') throw new Error('OPERATION_ALREADY_STARTED');
      const response = await chatbotService.streamDiscovery({ operationId, receipt: prepared.receipt,
        ...payload, ...(deviceId ? { deviceId } : {}) }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
        onResult: (result) => { card = result; },
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
        || !responseText.trim() || !['chat', 'clarify', 'found', 'empty', 'cancelled', 'login_required'].includes(response.outcome)
        || (response.outcome === 'clarify' && (typeof response.flowToken !== 'string'
          || typeof response.flowSubject !== 'string'))) throw new Error('Không thể xác nhận phiên trò chuyện.');
      if (user) {
        const remaining = await clearPendingMemberChat(String(user.id), operationId);
        if (controller.signal.aborted) return;
        setMemberPending(remaining);
      } else {
        const guest = await settleGuestTurn(operationId, ['chat', 'found', 'cancelled', 'login_required'].includes(response.outcome));
        if (controller.signal.aborted) return;
        setGuestPending(guestPendingView(guest));
        setQuota(guestQuotaView(guest));
      }
      window.clearTimeout(updateTimer);
      const answer = { sender: 'bot', content: responseText, ...(response.limited ? { limited: true } : {}),
        ...(card ? { result: card } : {}), ...(response.offerPlanner ? { offerPlanner: true } : {}),
        ...(response.outcome === 'login_required' ? { loginRequired: true } : {}) };
      const finishedMessages = previous ? messages.map((message) => (message.turnId === turnId
        ? { ...message, status: 'complete', ...(message.sender === 'bot' ? answer : {}) } : message))
        : [...messages, { sender: 'user', content: question }, answer];
      const nextCompleted = completedPairs(finishedMessages, true);
      setMessages((current) => current.map((message) => (message.turnId === turnId
        ? { ...message, status: 'complete', ...(message.sender === 'bot' ? answer : {}) } : message)));
      const nextFlow = response.outcome === 'clarify' ? { token: response.flowToken, subject: response.flowSubject } : null;
      setFlow(nextFlow);
      const scope = user ? `account:${user.id}` : `device:${deviceId}`;
      setSession({ ...response.session, scope, deviceId });
      setAnnouncement(response.limited ? 'Câu trả lời đã đạt giới hạn độ dài.' : 'Câu trả lời đã hoàn thành.');
      try { writeChatSession(scope, response.session.token, nextCompleted, nextFlow?.token); } catch {
        setError('Không thể lưu phiên trò chuyện trên trình duyệt này.');
      }
      if (response.quota) setQuota(response.quota);
      return response.outcome;
    } catch (requestError) {
      if (!controller.signal.aborted) {
        if (requestError.message === 'CHAT_PENDING' && user) {
          try { setMemberPending(readPendingMemberChat(String(user.id))); } catch { setMemberPending({ invalid: true }); }
        }
        if (requestError.message === 'GUEST_PENDING') {
          try { setGuestPending(guestPendingView(readGuestQuota())); } catch { setError('Không thể đọc trạng thái lượt trước.'); }
        }
        if (requestError.message === 'GUEST_QUOTA') { setLoginReason('quota'); setLoginOpen(true); }
        const rejectedBeforePrepare = preparing && ([400, 401, 403, 429].includes(requestError.status)
          || ['SESSION_EXPIRED', 'CHATBOT_DISABLED'].includes(requestError.details?.code));
        if (operationId && record && rejectedBeforePrepare) {
          try {
            const cleared = await releaseUnstarted(record, controller);
            if (controller.signal.aborted) return;
            if (cleared && requestError.details?.code === 'SESSION_EXPIRED') {
              try { clearChatSession(session?.scope); } catch { /* Expired session stays hidden. */ }
              setFlow(null);
              setSession(null);
              setMessages([]);
              setError('Phiên trò chuyện đã hết hạn. Vui lòng bắt đầu lại.');
              setAnnouncement('Phiên trò chuyện đã hết hạn.');
            } else {
              updateTurn(cleared ? { status: 'failed', notReserved: true, error: requestError.message || 'Chưa thể gửi yêu cầu.' }
                : { status: 'unknown', error: 'Lượt trước cần được kiểm tra lại.' });
              setAnnouncement(cleared ? 'Chưa thể gửi yêu cầu.' : 'Chưa xác định được trạng thái lượt trước.');
            }
          } catch { updateTurn({ status: 'unknown', error: 'Chưa thể cập nhật trạng thái lượt trước.' }); }
        } else if (operationId && record) {
          updateTurn({ status: 'checking', content: responseText, operationId, deviceId,
            error: 'Đang kiểm tra lượt vừa gửi...' });
          setAnnouncement('Đang kiểm tra trạng thái lượt vừa gửi.');
          try {
            const result = await pollTurn(record, controller);
            if (controller.signal.aborted) return;
            if (result.state === 'not_started') {
              const cleared = await releaseUnstarted(record, controller);
              if (controller.signal.aborted) return;
              updateTurn(cleared ? { status: 'failed', notReserved: true, error: 'Yêu cầu chưa được gửi. Bạn có thể thử lại.' }
                : { status: 'unknown', error: 'Lượt trước cần được kiểm tra lại.' });
              setAnnouncement(cleared ? 'Yêu cầu chưa được gửi.' : 'Chưa xác định được trạng thái lượt trước.');
              return;
            }
            const success = ['success', 'found', 'cancelled', 'login_required'].includes(result.state);
            const failed = ['empty', 'failed'].includes(result.state);
            const terminal = success || failed || result.state === 'clarify';
            if (terminal || (user && result.state === 'expired')) {
              if (user) setMemberPending(await clearPendingMemberChat(String(user.id), operationId));
              else {
                const guest = await settleGuestTurn(operationId, success);
                setGuestPending(guestPendingView(guest));
                setQuota(guestQuotaView(guest));
              }
              if (controller.signal.aborted) return;
              updateTurn({ status: success || ['clarify', 'expired'].includes(result.state) ? 'recovered' : 'failed',
                confirmedSuccess: success, notReserved: failed,
                error: result.state === 'clarify' ? 'Câu hỏi làm rõ đã gửi nhưng không thể khôi phục. Hãy thử lại sau khi lượt chờ kết thúc.'
                  : success ? 'Lượt trước đã hoàn thành nhưng câu trả lời có thể chưa đầy đủ.'
                    : result.state === 'expired' ? 'Thông tin lượt trước đã hết hạn; không thể xác định kết quả.'
                      : 'Lượt trước không có kết quả hoặc không hoàn thành. Bạn có thể gửi lại.' });
              if (record.flowToken && result.state !== 'clarify') {
                setFlow(null);
                try { const scope = `account:${user.id}`; const saved = readChatSession(scope);
                  if (saved) writeChatSession(scope, saved.token, saved.messages); } catch { /* Ignore unavailable storage. */ }
              }
              setAnnouncement('Đã kiểm tra trạng thái lượt trước.');
              if (user) {
                try { const updated = await chatbotService.getQuota({ signal: controller.signal });
                  if (!controller.signal.aborted) setQuota(updated.quota); } catch { /* Preserve last quota. */ }
              }
            } else {
              if (!user && result.state === 'expired') setGuestExpired(operationId);
              updateTurn({ status: 'unknown', error: result.state === 'expired'
                ? 'Thông tin lượt trước đã hết hạn. Hãy chọn tiếp tục ở thông báo phía trên.'
                : 'Chưa xác định được trạng thái lượt trước. Hãy kiểm tra lại.' });
              setAnnouncement('Chưa xác định được trạng thái lượt trước.');
            }
          } catch {
            if (!controller.signal.aborted) updateTurn({ status: 'unknown', error: 'Chưa thể kiểm tra lượt trước. Hãy kiểm tra lại.' });
          }
        } else {
          updateTurn({ status: 'failed', content: responseText, notReserved: true,
            error: requestError.message === 'GUEST_QUOTA' ? 'Bạn đã hết lượt hỏi thử.'
              : 'Chưa thể gửi yêu cầu. Hãy thử lại.' });
          setAnnouncement('Chưa thể gửi yêu cầu.');
        }
      }
    } finally {
      window.clearTimeout(updateTimer);
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const checkPrevious = async (message) => {
    if (user && memberPending?.protocol === 'v2') return checkMemberPending();
    if (!user && guestPending?.protocol === 'v2') return checkGuestPending();
    if (busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    const update = (fields) => setMessages((current) => current.map((item) => (
      item.turnId === message.turnId && item.sender === 'bot' ? { ...item, ...fields } : item
    )));
    update({ status: 'checking' });
    setAnnouncement('Đang kiểm tra trạng thái lượt trước.');
    try {
      const result = await chatbotService.checkRequestFor30s({ operationId: message.operationId, deviceId: message.deviceId }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
      });
      if (controller.signal.aborted) return;
      if (user && ['success', 'failed'].includes(result.state)) {
        const remaining = await clearPendingMemberChat(String(user.id), message.operationId);
        if (controller.signal.aborted) return;
        setMemberPending(remaining);
      }
      if (!user && ['success', 'failed'].includes(result.state)) {
        const guest = await settleGuestTurn(message.operationId, result.state === 'success');
        if (controller.signal.aborted) return;
        setGuestPending(guestPendingView(guest));
        setQuota(guestQuotaView(guest));
      }
      if (result.state === 'success') {
        update({ status: 'recovered', confirmedSuccess: true,
          error: 'Lượt trước đã hoàn thành nhưng câu trả lời có thể chưa được nhận đầy đủ.' });
        setAnnouncement('Lượt trước đã hoàn thành, nhưng câu trả lời có thể chưa đầy đủ.');
        if (user) {
          try {
            const updated = await chatbotService.getQuota({ signal: controller.signal });
            if (!controller.signal.aborted) setQuota(updated.quota);
          }
          catch { /* Quota remains unchanged until it can be refreshed. */ }
        }
      } else if (result.state === 'failed') {
        update({ status: 'failed', notReserved: true, error: 'Lượt trước không hoàn thành. Bạn có thể gửi lại.' });
        setAnnouncement('Lượt trước không hoàn thành. Bạn có thể gửi lại.');
      } else {
        update({ status: 'unknown', error: 'Chưa xác định được trạng thái lượt trước. Hãy kiểm tra lại.' });
        setAnnouncement('Chưa xác định được trạng thái lượt trước.');
      }
    } catch {
      if (!controller.signal.aborted) {
        update({ status: 'unknown', error: 'Chưa thể kiểm tra lượt trước. Hãy kiểm tra lại.' });
        setAnnouncement('Chưa thể kiểm tra trạng thái lượt trước.');
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const checkGuestPending = useCallback(async () => {
    if (user || !guestPending || busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setAnnouncement('Đang kiểm tra lượt trước.');
    try {
      const result = await pollTurn(guestPending, controller);
      if (controller.signal.aborted) return;
      if (result.state === 'not_started') {
        const cleared = await releaseUnstarted(guestPending, controller);
        if (!controller.signal.aborted) {
          if (cleared) setMessages((current) => current.map((message) => message.sender === 'bot'
            && message.operationId === guestPending.operationId ? { ...message, status: 'failed', notReserved: true,
              error: 'Yêu cầu chưa được gửi. Bạn có thể thử lại.' } : message));
          setAnnouncement(cleared ? 'Yêu cầu chưa được gửi.' : 'Lượt trước cần được kiểm tra lại.');
        }
        return;
      }
      if (result.state === 'expired') { setGuestExpired(guestPending.operationId); setAnnouncement('Thông tin lượt trước đã hết hạn.'); return; }
      if (['success', 'found', 'cancelled', 'login_required', 'empty', 'failed'].includes(result.state)) {
        const guest = await settleGuestTurn(guestPending.operationId, ['success', 'found', 'cancelled', 'login_required'].includes(result.state));
        if (controller.signal.aborted) return;
        setGuestPending(guestPendingView(guest));
        setQuota(guestQuotaView(guest));
        setMessages((current) => current.map((message) => (
          message.sender === 'bot' && message.operationId === guestPending.operationId
            ? { ...message, status: ['success', 'found', 'cancelled', 'login_required', 'clarify', 'expired'].includes(result.state) ? 'recovered' : 'failed',
              confirmedSuccess: ['success', 'found', 'cancelled', 'login_required'].includes(result.state),
              notReserved: ['failed', 'empty'].includes(result.state),
              error: result.state === 'expired' ? 'Thông tin lượt trước đã hết hạn; không thể xác định kết quả.'
                : ['failed', 'empty'].includes(result.state) ? 'Lượt trước không có kết quả hoặc không hoàn thành. Bạn có thể gửi lại.'
                  : 'Lượt trước đã hoàn thành nhưng câu trả lời có thể chưa đầy đủ.' }
            : message
        )));
        setAnnouncement(['failed', 'empty'].includes(result.state)
          ? 'Lượt trước không hoàn thành hoặc không có kết quả và không bị tính lượt.' : 'Lượt trước đã hoàn thành; câu trả lời không thể khôi phục.');
      } else setAnnouncement('Chưa xác định được trạng thái lượt trước.');
    } catch {
      if (!controller.signal.aborted) setAnnouncement('Chưa thể kiểm tra lượt trước.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [user, guestPending, busy, pollTurn, releaseUnstarted]);

  useEffect(() => {
    if (user || !guestPending?.operationId || busy || pending.current
      || guestCheckStarted.current === guestPending.operationId) return;
    guestCheckStarted.current = guestPending.operationId;
    void checkGuestPending();
  }, [user, guestPending, busy, checkGuestPending]);

  const checkMemberPending = useCallback(async () => {
    if (!user?.id || !memberPending?.operationId || busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setAnnouncement('Đang kiểm tra lượt trước.');
    try {
      const result = await pollTurn(memberPending, controller);
      if (controller.signal.aborted) return;
      if (result.state === 'not_started') {
        const cleared = await releaseUnstarted(memberPending, controller);
        if (!controller.signal.aborted) {
          if (cleared) setMessages((current) => current.map((message) => message.sender === 'bot'
            && message.operationId === memberPending.operationId ? { ...message, status: 'failed', notReserved: true,
              error: 'Yêu cầu chưa được gửi. Bạn có thể thử lại.' } : message));
          setAnnouncement(cleared ? 'Yêu cầu chưa được gửi.' : 'Lượt trước cần được kiểm tra lại.');
        }
        return;
      }
      if (['success', 'found', 'cancelled', 'login_required', 'empty', 'failed', 'clarify', 'expired'].includes(result.state)) {
        const remaining = await clearPendingMemberChat(String(user.id), memberPending.operationId);
        if (controller.signal.aborted) return;
        setMemberPending(remaining);
        setMessages((current) => current.map((message) => (
          message.sender === 'bot' && message.operationId === memberPending.operationId
            ? { ...message, status: ['success', 'found', 'cancelled', 'login_required', 'clarify', 'expired'].includes(result.state) ? 'recovered' : 'failed',
              confirmedSuccess: ['success', 'found', 'cancelled', 'login_required'].includes(result.state),
              notReserved: ['failed', 'empty'].includes(result.state),
              error: result.state === 'expired' ? 'Thông tin lượt trước đã hết hạn; không thể xác định kết quả.'
                : ['failed', 'empty'].includes(result.state) ? 'Lượt trước không có kết quả hoặc không hoàn thành. Bạn có thể gửi lại.'
                  : 'Lượt trước đã hoàn thành nhưng câu trả lời có thể chưa đầy đủ.' }
            : message
        )));
        if (memberPending.flowToken && result.state !== 'clarify') {
          setFlow(null);
          try { const scope = `account:${user.id}`; const saved = readChatSession(scope);
            if (saved) writeChatSession(scope, saved.token, saved.messages); } catch { /* Ignore unavailable storage. */ }
        }
        setAnnouncement(result.state === 'expired' ? 'Thông tin lượt trước đã hết hạn; không thể xác định kết quả.'
          : ['failed', 'empty'].includes(result.state) ? 'Lượt trước không hoàn thành hoặc không có kết quả.'
            : 'Lượt trước đã hoàn thành; câu trả lời có thể không khôi phục được.');
        try {
          const updated = await chatbotService.getQuota({ signal: controller.signal });
          if (!controller.signal.aborted) setQuota(updated.quota);
        } catch { /* Keep the last known quota. */ }
      } else setAnnouncement('Chưa xác định được trạng thái lượt trước.');
    } catch {
      if (!controller.signal.aborted) setAnnouncement('Chưa thể kiểm tra lượt trước.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [user, memberPending, busy, pollTurn, releaseUnstarted]);

  useEffect(() => {
    if (!user?.id || !memberPending?.operationId || busy || pending.current
      || memberCheckStarted.current === memberPending.operationId) return;
    memberCheckStarted.current = memberPending.operationId;
    void checkMemberPending();
  }, [user, memberPending, busy, checkMemberPending]);

  const openPlanner = async () => {
    if (!user) { setLoginReason('planner'); setLoginOpen(true); return; }
    if (flow) {
      if (busy || pending.current || !globalThis.crypto?.randomUUID) return;
      const question = 'Hủy tìm kiếm và mở công cụ lập thực đơn';
      const turnId = crypto.randomUUID();
      setMessages((current) => [...current,
        { sender: 'user', content: question, status: 'waiting', turnId },
        { sender: 'bot', content: '', status: 'waiting', turnId, question }]);
      const outcome = await runTurn(question, turnId);
      if (outcome !== 'cancelled') return;
    }
    if (!plannerWeek) {
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const localDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      setPlannerWeek(localDate);
    }
    setPlannerOpen(true);
  };

  const resolvePlanner = useCallback(async (accountId, record, controller) => {
    const { operationId } = record;
    const options = { signal: controller.signal,
      onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); } };
    const result = record.protocol === 'v2'
      ? await chatbotService.checkDiscoveryFor30s(record, { ...options, onReceipt: async (receipt) => {
        const saved = await setPendingPlannerReceipt(accountId, operationId, receipt);
        if (!controller.signal.aborted) setPlannerPending(saved);
      } })
      : await chatbotService.checkRequestFor30s({ operationId }, options);
    if (controller.signal.aborted) return;
    if (result.state === 'not_started') {
      const cleared = await clearUnstartedPlanner(accountId, operationId);
      if (!controller.signal.aborted) {
        setPlannerPending(cleared.pending);
        setPlannerError(cleared.cleared ? 'Yêu cầu chưa được gửi. Bạn có thể tạo lại gợi ý.' : 'Yêu cầu trước cần được kiểm tra lại.');
      }
      return;
    }
    if (['success', 'failed', 'expired'].includes(result.state)) {
      const remaining = await clearPendingPlanner(accountId, operationId);
      if (controller.signal.aborted) return;
      setPlannerPending(remaining);
      setPlannerError(result.state === 'expired' ? 'Thông tin yêu cầu đã hết hạn; không thể xác định kết quả.'
        : result.state === 'success'
          ? 'Yêu cầu trước đã hoàn thành nhưng không thể khôi phục bản xem trước. Bạn có thể tạo gợi ý mới.'
          : 'Yêu cầu trước không hoàn thành. Bạn có thể tạo lại gợi ý.');
      try {
        const updated = await chatbotService.getQuota({ signal: controller.signal });
        if (!controller.signal.aborted) setQuota(updated.quota);
      } catch { /* Keep the last known quota. */ }
    } else {
      setPlannerError('Chưa xác định được kết quả. Hãy kiểm tra lại sau.');
    }
  }, [logout]);

  const checkPlanner = useCallback(async () => {
    if (!user?.id || !plannerPending?.operationId || plannerRequest.current) return;
    const controller = new AbortController();
    plannerRequest.current = controller;
    setPlannerBusy(true);
    setPlannerError('');
    try { await resolvePlanner(String(user.id), plannerPending, controller); }
    catch { if (!controller.signal.aborted) setPlannerError('Chưa thể kiểm tra kết quả. Hãy kiểm tra lại sau.'); }
    finally {
      if (plannerRequest.current === controller) plannerRequest.current = null;
      if (!controller.signal.aborted) setPlannerBusy(false);
    }
  }, [user, plannerPending, resolvePlanner]);

  useEffect(() => {
    if (!user?.id || !plannerPending?.operationId || plannerBusy || plannerRequest.current
      || plannerCheckStarted.current === plannerPending.operationId) return;
    plannerCheckStarted.current = plannerPending.operationId;
    void checkPlanner();
  }, [user, plannerPending, plannerBusy, checkPlanner]);

  useEffect(() => {
    const onOnline = () => {
      if (!busy && guestPending?.operationId) void checkGuestPending();
      if (!busy && memberPending?.operationId) void checkMemberPending();
      if (!plannerBusy && plannerPending?.operationId) void checkPlanner();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [busy, plannerBusy, guestPending, memberPending, plannerPending,
    checkGuestPending, checkMemberPending, checkPlanner]);

  const createPlannerPreview = async (continueWithoutProfile = false) => {
    if (!user?.id || plannerRequest.current || plannerPending || confirmPending || memberPending || busy || !quota?.remaining
      || !globalThis.crypto?.randomUUID) return;
    const accountId = String(user.id);
    const operationId = crypto.randomUUID();
    const controller = new AbortController();
    plannerRequest.current = controller;
    setPlannerBusy(true);
    setPlannerError('');
    setPlannerProfileMissing(false);
    setPlannerPreview(null);
    setPlannerSaved(false);
    setConfirmNotice('');
    let recorded = false;
    let preparing = false;
    let record;
    try {
      const payloadHash = await plannerPayloadHash(plannerWeek, continueWithoutProfile);
      record = { operationId, protocol: 'v2', payloadHash };
      await reservePendingPlanner(accountId, operationId, { protocol: 'v2', payloadHash });
      recorded = true;
      if (controller.signal.aborted) return;
      plannerCheckStarted.current = operationId;
      setPlannerPending(record);
      preparing = true;
      const prepared = await chatbotService.prepareTurn({ operationId, kind: 'turn', payloadHash }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
      });
      preparing = false;
      if (controller.signal.aborted) return;
      if (typeof prepared.receipt !== 'string') throw new Error('INVALID_RECEIPT');
      record = { ...record, receipt: prepared.receipt };
      setPlannerPending(await setPendingPlannerReceipt(accountId, operationId, prepared.receipt));
      if (controller.signal.aborted) return;
      if (prepared.state !== 'prepared') throw new Error('OPERATION_ALREADY_STARTED');
      const result = await previewAIWeek({ operationId, weekStart: plannerWeek, continueWithoutProfile, receipt: prepared.receipt }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
      });
      if (controller.signal.aborted) return;
      const remaining = await clearPendingPlanner(accountId, operationId);
      if (controller.signal.aborted) return;
      setPlannerPending(remaining);
      setPlannerPreview(result.preview);
      if (result.quota) setQuota(result.quota);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      if (!recorded) {
        try { setPlannerPending(readPendingPlanner(accountId)); } catch { setPlannerPending({ invalid: true }); }
        setPlannerError(requestError.message === 'PLANNER_PENDING'
          ? 'Có yêu cầu thực đơn khác đang chờ kiểm tra.' : 'Không thể lưu trạng thái yêu cầu trên trình duyệt này.');
      } else if (preparing && ([400, 401, 403, 429].includes(requestError.status)
        || ['CHATBOT_DISABLED', 'SESSION_EXPIRED'].includes(requestError.details?.code))) {
        try {
          const cleared = await clearUnstartedPlanner(accountId, operationId);
          if (controller.signal.aborted) return;
          setPlannerPending(cleared.pending);
          setPlannerError(cleared.cleared ? (requestError.message || 'Chưa thể gửi yêu cầu.') : 'Yêu cầu trước cần được kiểm tra lại.');
        } catch { setPlannerError('Không thể cập nhật trạng thái yêu cầu trên trình duyệt này.'); }
      } else if (!preparing && (['INVALID_INPUT', 'PROFILE_MISSING', 'NO_RECIPES', 'PROFILE_CHANGED', 'RECIPE_CHANGED',
        'QUOTA_EXCEEDED', 'CHATBOT_DISABLED', 'MODEL_UNAVAILABLE'].includes(requestError.details?.code)
        || [400, 401, 403, 413, 415, 429].includes(requestError.status))) {
        try {
          const remaining = await clearPendingPlanner(accountId, operationId);
          if (controller.signal.aborted) return;
          setPlannerPending(remaining);
          if (requestError.details?.code === 'PROFILE_MISSING') setPlannerProfileMissing(true);
          else setPlannerError(requestError.message || 'Không thể tạo gợi ý lúc này.');
        } catch { setPlannerError('Không thể cập nhật trạng thái yêu cầu trên trình duyệt này.'); }
      } else {
        setPlannerError('Đang kiểm tra trạng thái yêu cầu trước.');
        try { await resolvePlanner(accountId, record, controller); }
        catch { if (!controller.signal.aborted) setPlannerError('Chưa thể kiểm tra kết quả. Hãy kiểm tra lại sau.'); }
      }
    } finally {
      if (plannerRequest.current === controller) plannerRequest.current = null;
      if (!controller.signal.aborted) setPlannerBusy(false);
    }
  };

  const resolveConfirm = useCallback(async (accountId, operationId, controller) => {
    const result = await checkConfirmFor30s(operationId, { signal: controller.signal,
      onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); } });
    if (controller.signal.aborted) return;
    if (result.state === 'saved') {
      const remaining = await clearPendingConfirm(accountId, operationId);
      if (controller.signal.aborted) return;
      setConfirmPending(remaining);
      setPlannerSaved(true);
      setConfirmNotice('Thực đơn đã được lưu.');
    } else setConfirmNotice('Chưa xác định được kết quả lưu. Hãy kiểm tra lại.');
  }, [logout]);

  const checkConfirm = useCallback(async () => {
    if (!user?.id || !confirmPending?.operationId || plannerRequest.current) return;
    const controller = new AbortController();
    plannerRequest.current = controller;
    setPlannerBusy(true);
    setConfirmNotice('Đang kiểm tra kết quả lưu.');
    try { await resolveConfirm(String(user.id), confirmPending.operationId, controller); }
    catch { if (!controller.signal.aborted) setConfirmNotice('Chưa thể kiểm tra kết quả lưu. Hãy kiểm tra lại.'); }
    finally {
      if (plannerRequest.current === controller) plannerRequest.current = null;
      if (!controller.signal.aborted) setPlannerBusy(false);
    }
  }, [user, confirmPending, resolveConfirm]);

  useEffect(() => {
    if (!user?.id || !confirmPending?.operationId || plannerBusy || plannerRequest.current
      || confirmCheckStarted.current === confirmPending.operationId) return;
    confirmCheckStarted.current = confirmPending.operationId;
    void checkConfirm();
  }, [user, confirmPending, plannerBusy, checkConfirm]);

  useEffect(() => {
    const onOnline = () => {
      if (!plannerBusy && confirmPending?.operationId) void checkConfirm();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [plannerBusy, confirmPending, checkConfirm]);

  const savePlanner = async () => {
    if (!user?.id || plannerRequest.current || plannerPending || confirmPending || plannerSaved
      || !globalThis.crypto?.randomUUID || plannerPreview?.weekStart !== plannerWeek
      || !Array.isArray(plannerPreview?.days) || plannerPreview.days.length !== 7
      || typeof plannerPreview.version !== 'string' || !/^[0-9a-f]{64}$/.test(plannerPreview.version)) return;
    const slots = ['breakfast', 'lunch', 'dinner'];
    const days = plannerPreview.days.map((day) => ({ date: day.date,
      meals: Object.fromEntries(slots.map((slot) => [slot, day.meals?.[slot]?.id ?? null])) }));
    const operationId = crypto.randomUUID();
    const accountId = String(user.id);
    const controller = new AbortController();
    plannerRequest.current = controller;
    setPlannerBusy(true);
    setConfirmNotice('');
    let recorded = false;
    try {
      await reservePendingConfirm(accountId, operationId);
      recorded = true;
      if (controller.signal.aborted) return;
      confirmCheckStarted.current = operationId;
      setConfirmPending({ operationId });
      const result = await confirmAIWeek({ operationId, weekStart: plannerWeek, days,
        version: plannerPreview.version, replaceConfirmed: true }, {
        signal: controller.signal,
        onUnauthorized: (token) => { if (token && localStorage.getItem(AUTH_TOKEN_KEY) === token) logout(); },
      });
      if (controller.signal.aborted) return;
      if (result?.saved !== true) throw new Error('UNKNOWN_CONFIRM');
      const remaining = await clearPendingConfirm(accountId, operationId);
      if (controller.signal.aborted) return;
      setConfirmPending(remaining);
      setPlannerSaved(true);
      setConfirmNotice('Thực đơn đã được lưu.');
    } catch (requestError) {
      if (controller.signal.aborted) return;
      if (!recorded) {
        try { setConfirmPending(readPendingConfirm(accountId)); } catch { setConfirmPending({ invalid: true }); }
        setConfirmNotice(requestError.message === 'CONFIRM_PENDING'
          ? 'Có yêu cầu lưu trước đang chờ kiểm tra.' : 'Không thể lưu trạng thái yêu cầu trên trình duyệt này.');
      } else if (['INVALID_INPUT', 'PLAN_CHANGED', 'REPLACE_CONFIRM_REQUIRED', 'IDEMPOTENCY_CONFLICT'].includes(requestError.details?.code)
        || [401, 403].includes(requestError.status)) {
        try {
          const remaining = await clearPendingConfirm(accountId, operationId);
          if (controller.signal.aborted) return;
          setConfirmPending(remaining);
          setConfirmNotice(requestError.message || 'Không thể lưu thực đơn.');
        } catch { setConfirmNotice('Không thể cập nhật trạng thái yêu cầu trên trình duyệt này.'); }
      } else {
        setConfirmNotice('Đang kiểm tra kết quả lưu.');
        try { await resolveConfirm(accountId, operationId, controller); }
        catch { if (!controller.signal.aborted) setConfirmNotice('Chưa thể kiểm tra kết quả lưu. Hãy kiểm tra lại.'); }
      }
    } finally {
      if (plannerRequest.current === controller) plannerRequest.current = null;
      if (!controller.signal.aborted) setPlannerBusy(false);
    }
  };

  const send = (event) => {
    event.preventDefault();
    const question = text.trim();
    if (!enabled || !sessionReady || !question || busy || plannerBusy || plannerPending || guestPending || memberPending || unresolved || (!quota?.remaining && !flow) || pending.current) return;
    if (!isValidMessage(text)) { setError('Câu hỏi tối đa 10.000 ký tự hợp lệ.'); return; }
    if (!globalThis.crypto?.randomUUID) { setError('Không thể gửi câu hỏi lúc này.'); return; }
    const turnId = crypto.randomUUID();
    setMessages((current) => [...current,
      { sender: 'user', content: question, status: 'waiting', turnId },
      { sender: 'bot', content: '', status: 'waiting', turnId, question }]);
    setText('');
    void runTurn(question, turnId);
  };

  const unresolved = messages.some((message) => message.sender === 'bot' && ['checking', 'unknown'].includes(message.status));
  const suggestionsDisabled = !enabled || !sessionReady || busy || plannerBusy || plannerPending || guestPending || memberPending || unresolved || (!quota?.remaining && !flow) || text.length > 0;
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
          {user && memberPending && <Notice title="Đang chờ lượt trước">
            <p>Trạng thái lượt trước chưa được xác nhận.</p>
            <Button variant="outline" size="sm" disabled={busy || !memberPending.operationId}
              onClick={() => void checkMemberPending()}>Kiểm tra lại</Button>
          </Notice>}
          {!user && guestPending && <Notice title="Đang chờ lượt trước">
            <p>{guestExpired === guestPending.operationId ? 'Thông tin lượt trước đã hết hạn. Nếu tiếp tục, bạn có thể được thêm một lượt nếu lượt cũ đã thành công.'
              : 'Trạng thái lượt trước chưa được xác nhận.'}</p>
            {guestExpired === guestPending.operationId ? <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
              try {
                const guest = await settleGuestTurn(guestPending.operationId, false);
                setGuestPending(guestPendingView(guest));
                setQuota(guestQuotaView(guest));
                setGuestExpired(null);
                setMessages((current) => current.map((message) => message.operationId === guestPending.operationId
                  && message.sender === 'bot' ? { ...message, status: 'recovered',
                    error: 'Thông tin lượt trước đã hết hạn; không thể xác định kết quả.' } : message));
              } catch { setError('Không thể cập nhật lượt chờ trên trình duyệt này.'); }
            }}>Tiếp tục</Button> : <Button variant="outline" size="sm" disabled={busy}
              onClick={() => void checkGuestPending()}>Kiểm tra lại</Button>}
          </Notice>}
          {!user && quota?.remaining === 0 && (
            <div><Button variant="outline" onClick={() => { setLoginReason('quota'); setLoginOpen(true); }}>Đăng nhập để tiếp tục</Button></div>
          )}
          <div>
            <Button variant="outline" size="sm" disabled={!enabled || busy || plannerBusy || unresolved}
              onClick={openPlanner}>Lên thực đơn tuần</Button>
          </div>
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
                        typing={message.sender === 'bot' && message.status === 'waiting' && !message.content}>
                        {message.sender === 'bot' && message.content ? <ChatReplyText text={message.content} /> : undefined}
                      </ChatBubble>
                      {message.sender === 'bot' && message.result && <ChatDiscoveryResult result={message.result} />}
                      {message.sender === 'bot' && message.offerPlanner && <Button variant="outline" size="sm" onClick={openPlanner}>Lên thực đơn tuần</Button>}
                      {message.sender === 'bot' && message.loginRequired && <Button variant="outline" size="sm"
                        onClick={() => { setLoginReason('search'); setLoginOpen(true); }}>Đăng nhập</Button>}
                      {message.sender === 'bot' && message.limited && (
                        <p className={styles.messageNotice}>Câu trả lời đã đạt giới hạn độ dài.</p>
                      )}
                      {message.sender === 'bot' && ['failed', 'checking', 'unknown', 'recovered'].includes(message.status) && (
                        <div className={styles.messageNotice}>
                          <p>{message.status === 'checking' ? 'Đang kiểm tra lượt trước...' : message.error}</p>
                          {message.status === 'unknown' && <button type="button" className={styles.retry}
                            disabled={busy || !enabled || !sessionReady}
                            onClick={() => void checkPrevious(message)}>Kiểm tra lại</button>}
                          {message.status === 'failed' && <button type="button" className={styles.retry}
                            disabled={busy || unresolved || Boolean(guestPending) || Boolean(memberPending) || !enabled || !sessionReady}
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
              <textarea ref={textareaRef} id="chatbot-question" rows={1} value={text}
                onChange={(event) => setText(event.target.value)} disabled={!enabled || !sessionReady || busy || plannerBusy || Boolean(plannerPending) || Boolean(guestPending) || Boolean(memberPending) || unresolved}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
                    && event.nativeEvent.keyCode !== 229) send(event);
                }}
                aria-describedby="chatbot-hint chatbot-disclaimer"
                placeholder="Hỏi Mầm về món chay..." />
              <Button type="submit" icon="arrow-up" loading={busy}
                disabled={!enabled || !sessionReady || plannerBusy || Boolean(plannerPending) || Boolean(guestPending) || Boolean(memberPending) || unresolved || !text.trim() || !textValid || (!quota?.remaining && !flow)}>Gửi</Button>
            </div>
            <div className={styles.composerFoot}>
              <small id="chatbot-hint">Enter để gửi, Shift + Enter để xuống dòng. {Array.from(text).length}/10.000 ký tự
                {!textValid && ' — Câu hỏi vượt giới hạn hoặc có ký tự không hợp lệ.'}</small>
              <small id="chatbot-disclaimer">{AI_DISCLAIMER}</small>
            </div>
          </form>
        </div>
        <ChatMealPlanner open={plannerOpen} weekStart={plannerWeek} preview={plannerPreview}
          busy={plannerBusy} missingProfile={plannerProfileMissing}
          error={plannerError || (memberPending ? 'Hãy kiểm tra lượt trò chuyện đang chờ trước.'
            : !quota?.remaining && !plannerPending
              ? (plannerPreview ? 'Bạn đã hết lượt tạo gợi ý; vẫn có thể lưu bản xem trước.'
                : 'Bạn đã hết lượt hoặc chưa thể kiểm tra lượt sử dụng.') : '')}
          pending={Boolean(plannerPending)} savePending={Boolean(confirmPending)} saveNotice={confirmNotice}
          onCheckSave={() => void checkConfirm()}
          canConfirm={Boolean(user && plannerPreview?.weekStart === plannerWeek
            && /^[0-9a-f]{64}$/.test(plannerPreview?.version ?? '') && !plannerPending && !confirmPending && !plannerSaved)}
          onConfirm={() => void savePlanner()}
          onWeekStartChange={(value) => { setPlannerWeek(value); setPlannerPreview(null); setPlannerProfileMissing(false);
            setPlannerSaved(false); setConfirmNotice(''); }}
          onPreview={quota?.remaining && !memberPending ? () => void createPlannerPreview(false) : undefined}
          onContinueWithoutProfile={quota?.remaining && !memberPending ? () => void createPlannerPreview(true) : undefined}
          onCheck={() => void checkPlanner()} onProfile={() => window.location.assign('/profile')}
          onCancel={() => setPlannerOpen(false)} />
        <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title="Đăng nhập để tiếp tục" size="sm">
          <p>{loginReason === 'planner' ? 'Đăng nhập để tạo thực đơn bằng AI.'
            : loginReason === 'search' ? 'Đăng nhập để tìm bài viết hoặc công thức.'
              : 'Bạn đã dùng hết lượt hỏi thử trên trình duyệt này.'}</p>
          <Button onClick={() => window.location.assign('/login')}>Đăng nhập</Button>
        </Modal>
      </section>
    </MemberNavigationLayout>
  );
}
