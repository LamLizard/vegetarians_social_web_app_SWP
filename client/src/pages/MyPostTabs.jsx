import styles from './MyPostTabs.module.css';

export default function MyPostTabs({ tabs, value, onChange }) {
  const selectTab = (index) => {
    const tab = tabs[index];
    if (tab) onChange(tab.value);
  };

  return (
    <div className={styles.scroller}>
      <div className={styles.tabs} role="tablist" aria-label="Lọc bài theo trạng thái">
        {tabs.map((tab, index) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              id={`my-post-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="my-post-panel"
              tabIndex={active ? 0 : -1}
              className={`${styles.tab} ${active ? styles.active : ''}`}
              onClick={() => onChange(tab.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const direction = event.key === 'ArrowRight' ? 1 : -1;
                  const nextIndex = (index + direction + tabs.length) % tabs.length;
                  selectTab(nextIndex);
                  document.getElementById(`my-post-tab-${tabs[nextIndex].value}`)?.focus();
                }
              }}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
