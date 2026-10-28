import { useEffect, useId, useState } from 'react';
import AdminLayout from '../components/AdminLayout/AdminLayout';
import Tabs from '../components/Tabs/Tabs';
import useAuth from '../hooks/useAuth';
import { getAIConfig, updateAIConfig } from '../services/aiConfig.service';
import AdminAIConfigurationSettings from './AdminAIConfigurationSettings';
import AdminGroqUsage from './AdminGroqUsage';
import styles from './AdminAIConfigurationPage.module.css';

function configChanged(config, savedConfig) {
  if (!config || !savedConfig) return false;
  return config.comment.enabled !== savedConfig.comment.enabled
    || config.comment.provider !== savedConfig.comment.provider
    || config.post.enabled !== savedConfig.post.enabled
    || config.post.provider !== savedConfig.post.provider
    || config.chatbot.enabled !== savedConfig.chatbot.enabled;
}

export default function AdminAIConfigurationPage() {
  const { user, logout } = useAuth();
  const tabId = useId();
  const [tab, setTab] = useState('settings');
  const [config, setConfig] = useState(null);
  const [savedConfig, setSavedConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getAIConfig({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setConfig(result.config);
      setSavedConfig(result.config);
      setStatus(result.providerStatus);
      setError('');
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setConfig(null);
        setSavedConfig(null);
        setError(err.message || 'Không thể tải cấu hình AI.');
      }
    });
    return () => controller.abort();
  }, [reload]);

  const updateSection = (section, values) => {
    setConfig((current) => ({ ...current, [section]: { ...current[section], ...values } }));
    setMessage('');
  };

  const hasChanges = configChanged(config, savedConfig);
  const save = async (event) => {
    event.preventDefault();
    if (!config || !hasChanges || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await updateAIConfig({
        comment: config.comment,
        post: config.post,
        chatbot: { enabled: config.chatbot.enabled },
        version: config.version,
      });
      setConfig(result.config);
      setSavedConfig(result.config);
      setStatus(result.providerStatus);
      setMessage('Đã lưu cấu hình AI.');
    } catch (err) {
      setError(err.message || 'Không thể lưu cấu hình AI.');
      if (err.status === 409) { setConfig(null); setSavedConfig(null); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout activeKey="ai-config" title="Cấu hình AI" user={user}
      onLogout={() => { logout(); window.location.assign('/'); }}>
      <section className={styles.page}>
        <header className={styles.header}>
          <h1>Cấu hình AI</h1>
          <p>Quản lý kiểm duyệt và trợ lý ăn chay.</p>
        </header>
        <Tabs value={tab} onChange={setTab} label="Chọn mục cấu hình AI" items={[
          { key: 'settings', label: 'Cấu hình sử dụng', id: `${tabId}-settings-tab`, controls: `${tabId}-settings-panel` },
          { key: 'usage', label: 'Mức sử dụng', id: `${tabId}-usage-tab`, controls: `${tabId}-usage-panel` },
        ]} />
        <section role="tabpanel" id={`${tabId}-settings-panel`} aria-labelledby={`${tabId}-settings-tab`} hidden={tab !== 'settings'}>
          <AdminAIConfigurationSettings config={config} status={status} error={error} message={message}
            busy={busy} hasChanges={hasChanges} onChange={updateSection} onSave={save}
            onReload={() => setReload((value) => value + 1)} />
        </section>
        <section role="tabpanel" id={`${tabId}-usage-panel`} aria-labelledby={`${tabId}-usage-tab`} hidden={tab !== 'usage'}>
          {tab === 'usage' && <AdminGroqUsage />}
        </section>
      </section>
    </AdminLayout>
  );
}
