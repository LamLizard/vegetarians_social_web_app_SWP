import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run dev`       → chạy web app đầy đủ (mở /kit để xem Review Kit component)
// `npm run build:kit` → đóng gói Review Kit thành 1 file HTML duy nhất (dist-kit/index.html)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'kit' ? [viteSingleFile()] : [])],
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 vẫn dùng @import của Sass cũ → tắt cảnh báo cho đỡ rối terminal
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  build: mode === 'kit' ? { outDir: 'dist-kit' } : {},
}));
