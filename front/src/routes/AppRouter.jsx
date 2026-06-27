import { Routes, Route } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { RequireAuth, RequireRole, GuestOnly } from './guards';
import { ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN } from '../constants/roles';

import LoginPage from '../pages/auth/LoginPage';
import SenderHomePage from '../pages/sender/SenderHomePage';
import CreateWriteOffPage from '../pages/sender/CreateWriteOffPage';
import MyRequestsPage from '../pages/sender/MyRequestsPage';
import RequestDetailPage from '../pages/sender/RequestDetailPage';
import ReviewQueuePage from '../pages/reviewer/ReviewQueuePage';
import ReviewDetailPage from '../pages/reviewer/ReviewDetailPage';
import ReviewHistoryPage from '../pages/reviewer/ReviewHistoryPage';
import ProfilePage from '../pages/common/ProfilePage';
import NotFoundPage from '../pages/common/NotFoundPage';

const sender = (el) => <RequireRole roles={[ROLE_SENDER]}>{el}</RequireRole>;
const reviewer = (el) => <RequireRole roles={[ROLE_REVIEWER, ROLE_ADMIN]}>{el}</RequireRole>;

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        {/* Отправитель */}
        <Route path="/" element={sender(<SenderHomePage />)} />
        <Route path="/create" element={sender(<CreateWriteOffPage />)} />
        <Route path="/my-requests" element={sender(<MyRequestsPage />)} />
        <Route path="/my-requests/:id" element={sender(<RequestDetailPage />)} />

        {/* Проверяющий */}
        <Route path="/review" element={reviewer(<ReviewQueuePage />)} />
        <Route path="/review/history" element={reviewer(<ReviewHistoryPage />)} />
        <Route path="/review/:id" element={reviewer(<ReviewDetailPage />)} />

        {/* Общее */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
