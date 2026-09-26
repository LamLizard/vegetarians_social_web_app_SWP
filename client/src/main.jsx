import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/theme.scss';

import { initTheme } from './utils/theme';
import { ToastProvider } from './components';
import { AuthProvider } from './context/AuthContext';
import AuthPage from './pages/AuthPage';

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
