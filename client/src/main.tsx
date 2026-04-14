import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NAVIGATE') {
      try {
        const targetUrl = new URL(event.data.url);
        const newPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;
        window.history.pushState(null, '', newPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      } catch (err) {
        console.error('[PWA] Failed to handle NAVIGATE message:', err);
      }
    }
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('[PWA] Service Worker registered successfully');

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available — activating immediately');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('[PWA] Controller changed, reloading...');
          window.location.reload();
        }
      });

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}
