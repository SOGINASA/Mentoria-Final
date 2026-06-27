import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './routes/AppRouter';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initTheme = useUiStore((s) => s.initTheme);

  useEffect(() => {
    initTheme(); // применить сохранённую тему к <html>
    initAuth(); // восстановить сессию по токену
  }, [initTheme, initAuth]);

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
