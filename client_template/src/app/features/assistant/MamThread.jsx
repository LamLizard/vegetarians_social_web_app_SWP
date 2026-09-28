import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatBubble, PromptChip } from '../../../components';
import cx from '../../../components/cx';
import { useChat } from './ChatContext';
import { STARTER_PROMPTS } from './assistantEngine';
import { useCurrentUser } from '../../store/AppStore';
import { firstName, formatTime } from '../../utils/format';
import MamCards from './MamCards';
import styles from './mam.module.css';

/**
 * Luồng hội thoại với Mầm: lời chào + câu hỏi gợi ý khi trống,
 * tin nhắn (ChatBubble của kit) + thẻ giao diện đi kèm câu trả lời.
 * @param {'rail'|'page'} variant  rail = cột phải/ngăn kéo (hẹp), page = trang Mầm (rộng)
 */
export default function MamThread({ variant = 'rail' }) {
  const { messages, typing, ask, retry } = useChat();
  const me = useCurrentUser();
  const scrollRef = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [messages.length, typing]);

  const last = messages[messages.length - 1];
  const followUps = !typing && last?.from === 'ai' && last.status === 'ok' ? last.followUps ?? [] : [];

  return (
    <div ref={scrollRef} className={cx(styles.thread, styles[`thread_${variant}`])} role="log" aria-label="Hội thoại với Mầm">
      {messages.length === 0 && !typing ? (
        <div className={styles.welcome}>
          <span className={styles.sprout} aria-hidden="true"><i className="bi bi-flower1" /></span>
          <h3 className={styles.welcomeTitle}>
            {firstName(me.fullName)} ơi, mình là <em>Mầm</em>.
          </h3>
          <p className={styles.welcomeText}>
            Hỏi mình về món chay, thực đơn, vi chất hay quán chay đã xác minh. Mình trả lời kèm thẻ món ăn để bạn lưu lại luôn.
          </p>
          <div className={cx(styles.starters, variant === 'page' && styles.startersWide)}>
            {STARTER_PROMPTS.slice(0, variant === 'page' ? 6 : 4).map((p) => (
              <PromptChip key={p.text} icon={p.icon} block={variant !== 'page'} onClick={() => ask(p.text)}>{p.text}</PromptChip>
            ))}
          </div>
        </div>
      ) : (
        <>
          {messages.map((m) => (
            <div key={m.id} className={styles.msg}>
              <ChatBubble
                from={m.from}
                status={m.status}
                time={formatTime(m.time)}
                onRetry={m.status === 'error' ? () => retry(m.id) : undefined}
              >
                {m.text}
              </ChatBubble>
              {m.cards?.length > 0 && <MamCards cards={m.cards} />}
            </div>
          ))}

          {followUps.length > 0 && (
            <div className={styles.followUps} aria-label="Câu hỏi tiếp theo gợi ý">
              {followUps.map((q) => <PromptChip key={q} onClick={() => ask(q)}>{q}</PromptChip>)}
            </div>
          )}

          <AnimatePresence>
            {typing && (
              <motion.div className={styles.typingRow} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className={styles.aiMark} aria-hidden="true"><i className="bi bi-flower1" /></span>
                <span className={styles.typing} aria-label="Mầm đang soạn câu trả lời"><i /><i /><i /></span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
