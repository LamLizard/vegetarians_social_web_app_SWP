import { createContext, useContext } from 'react';

/**
 * Các hành động dùng chung trong khung app:
 *   openCompose(type?)   mở hộp thoại đăng bài ('share' | 'recipe' | 'review' | 'question')
 *   openPalette()        mở bảng lệnh "Tìm hoặc hỏi Mầm" (Ctrl+K)
 *   setRailMam(bool)     cột phải của trang đang hiện ngăn Mầm → không cần mở ngăn kéo nữa
 */
export const ShellContext = createContext({
  openCompose: () => {},
  openPalette: () => {},
  setRailMam: () => {},
});

export const useShell = () => useContext(ShellContext);
