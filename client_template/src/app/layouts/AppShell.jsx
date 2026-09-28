import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useToast } from '../../components';
import { useCurrentUser } from '../store/AppStore';
import { ChatProvider, useChat } from '../features/assistant/ChatContext';
import { MamDrawer } from '../features/assistant/MamPanel';
import CommandPalette from '../features/command/CommandPalette';
import CreatePostModal from '../features/posts/CreatePostModal';
import { ShellContext } from './ShellContext';
import Dock from './Dock';
import TopBar from './TopBar';
import MobileTabs from './MobileTabs';
import styles from './shell.module.css';

/** Khung cho mọi trang của thành viên: dock trái · nội dung · (cột phải do từng trang tự thêm). */
export default function AppShell() {
  const user = useCurrentUser();
  return (
    <ChatProvider key={user.id} user={user}>
      <ShellInner />
    </ChatProvider>
  );
}

function ShellInner() {
  const toast = useToast();
  const { pathname } = useLocation();
  const { mamOpen } = useChat();
  const [composeType, setComposeType] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railMam, setRailMam] = useState(false);

  // Ctrl/⌘ + K → bảng lệnh ở mọi trang
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shell = useMemo(() => ({
    openCompose: (type = 'share') => setComposeType(type),
    openPalette: () => setPaletteOpen(true),
    setRailMam,
  }), []);

  return (
    <ShellContext.Provider value={shell}>
      <div className={styles.shell}>
        <Dock />
        <div className={styles.main}>
          <TopBar />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
      <MobileTabs />

      {/* Trang có cột phải đang hiện Mầm thì không mở thêm ngăn kéo */}
      <MamDrawer open={mamOpen && !railMam && pathname !== '/assistant'} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CreatePostModal
        openType={composeType}
        onClose={() => setComposeType(null)}
        onCreated={() => toast('Đã gửi bài. Bài sẽ hiện công khai sau khi quản trị viên duyệt.', { tone: 'info', duration: 4500 })}
      />
    </ShellContext.Provider>
  );
}
