import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './global.css';

// 注册 service worker (PWA 离线 + 可安装)
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
