import { useEffect } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import AppRouter from './routes/AppRouter';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';

// В Android-обёртке (WebView, file://) history API недоступен — используем HashRouter.
// Включается флагом REACT_APP_HASH_ROUTER=1 при сборке под Android. На вебе — BrowserRouter.
const Router = process.env.REACT_APP_HASH_ROUTER === '1' ? HashRouter : BrowserRouter;

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initTheme = useUiStore((s) => s.initTheme);

  useEffect(() => {
    initTheme(); // применить сохранённую тему к <html>
    initAuth(); // восстановить сессию по токену
  }, [initTheme, initAuth]);

  return (
    <Router>
      <AppRouter />
    </Router>
  );
}
