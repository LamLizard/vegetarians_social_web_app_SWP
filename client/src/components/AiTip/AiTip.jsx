import PromptChip from '../PromptChip/PromptChip';
import cx from '../cx';
import { AI_NAME } from '../../constants/domain';
import styles from './AiTip.module.css';

/**
 * Hộp gợi ý từ trợ lý AI dinh dưỡng, kèm câu hỏi nhanh.
 * @param {string} title      mặc định "Gợi ý từ Mầm"
 * @param {string[]} prompts  câu hỏi gợi ý bên dưới
 * @param {(prompt:string)=>void} onPrompt
 */
export default function AiTip({ title = `Gợi ý từ ${AI_NAME}`, prompts = [], onPrompt, className, children }) {
  return (
    <aside className={cx(styles.box, className)}>
      <div className={styles.head}>
        <span className={styles.mark} aria-hidden="true"><i className="bi bi-flower1" /></span>
        {title}
      </div>
      <p className={styles.text}>{children}</p>

      {prompts.length > 0 && (
        <>
          <div className={styles.label}>Hỏi nhanh {AI_NAME}:</div>
          <div className={styles.prompts}>
            {prompts.map((p) => (
              <PromptChip key={p} onClick={() => onPrompt?.(p)}>{p}</PromptChip>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
