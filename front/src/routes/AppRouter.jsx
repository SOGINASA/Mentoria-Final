import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Spinner from '../components/ui/Spinner';
import { RequireAuth, RequireRole, GuestOnly } from './guards';
import { ROLE_SENDER, ROLE_REVIEWER, ROLE_HR, ROLE_FINANCE, ROLE_ADMIN } from '../constants/roles';
import { PLATFORM_ROUTES } from '../platform/platformConfig';

import LoginPage from '../pages/auth/LoginPage';
import SenderHomePage from '../pages/sender/SenderHomePage';
import CreateWriteOffPage from '../pages/sender/CreateWriteOffPage';
import MyRequestsPage from '../pages/sender/MyRequestsPage';
import RequestDetailPage from '../pages/sender/RequestDetailPage';
import ReviewQueuePage from '../pages/reviewer/ReviewQueuePage';
import ReviewDetailPage from '../pages/reviewer/ReviewDetailPage';
import ReviewHistoryPage from '../pages/reviewer/ReviewHistoryPage';
import AdminPage from '../pages/admin/AdminPage';
import ProfilePage from '../pages/common/ProfilePage';
import NotificationsPage from '../pages/common/NotificationsPage';
import NotFoundPage from '../pages/common/NotFoundPage';

const PlatformShell = lazy(() => import('../platform/components/PlatformShell'));
const PlatformHomePage = lazy(() => import('../platform/pages/PlatformHomePage'));
const PlatformShiftsPage = lazy(() => import('../platform/pages/PlatformShiftsPage'));
const PlatformIncomePage = lazy(() => import('../platform/pages/PlatformIncomePage'));
const PlatformTasksPage = lazy(() => import('../platform/pages/PlatformTasksPage'));
const PlatformApprovalsPage = lazy(() => import('../platform/pages/PlatformApprovalsPage'));
const PlatformManagerPage = lazy(() => import('../platform/pages/PlatformManagerPage'));
const PlatformReviewerPage = lazy(() => import('../platform/pages/PlatformReviewerPage'));
const PlatformHrPage = lazy(() => import('../platform/pages/PlatformHrPage'));
const PlatformFinancePage = lazy(() => import('../platform/pages/PlatformFinancePage'));
const PlatformProfilePage = lazy(() => import('../platform/pages/PlatformProfilePage'));
const PlatformNotificationsPage = lazy(() => import('../platform/pages/PlatformNotificationsPage'));
const PlatformSupportPage = lazy(() => import('../platform/pages/PlatformSupportPage'));
const PlatformNewsPage = lazy(() => import('../platform/pages/PlatformNewsPage'));
const PlatformServicesPage = lazy(() => import('../platform/pages/PlatformServicesPage'));
const PlatformLearningPage = lazy(() => import('../platform/pages/PlatformLearningPage'));
const PlatformCoursePage = lazy(() => import('../platform/pages/PlatformCoursePage'));
const PlatformDocumentsPage = lazy(() => import('../platform/pages/PlatformDocumentsPage'));
const PlatformLeavePage = lazy(() => import('../platform/pages/PlatformLeavePage'));
const PlatformComingSoonPage = lazy(() => import('../platform/pages/PlatformComingSoonPage'));

const sender = (el) => <RequireRole roles={[ROLE_SENDER]}>{el}</RequireRole>;
const reviewer = (el) => <RequireRole roles={[ROLE_REVIEWER, ROLE_ADMIN]}>{el}</RequireRole>;
const hr = (el) => <RequireRole roles={[ROLE_HR, ROLE_ADMIN]}>{el}</RequireRole>;
const finance = (el) => <RequireRole roles={[ROLE_FINANCE, ROLE_ADMIN]}>{el}</RequireRole>;
const admin = (el) => <RequireRole roles={[ROLE_ADMIN]}>{el}</RequireRole>;
const platformPage = (el) => (
  <Suspense fallback={<div className="grid min-h-[50dvh] place-items-center"><Spinner size={30} /></div>}>
    {el}
  </Suspense>
);

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

      {/* Новая Staff Platform изолирована под /app; текущая система остаётся на прежних маршрутах. */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            {platformPage(<PlatformShell />)}
          </RequireAuth>
        }
      >
        <Route index element={platformPage(<PlatformHomePage />)} />
        <Route path="shifts" element={platformPage(<PlatformShiftsPage />)} />
        <Route path="income" element={platformPage(<PlatformIncomePage />)} />
        <Route path="tasks" element={platformPage(<PlatformTasksPage />)} />
        <Route path="approvals" element={platformPage(<PlatformApprovalsPage />)} />
        <Route path="management" element={platformPage(<PlatformManagerPage />)} />
        <Route path="control" element={reviewer(platformPage(<PlatformReviewerPage />))} />
        <Route path="hr" element={hr(platformPage(<PlatformHrPage />))} />
        <Route path="finance" element={finance(platformPage(<PlatformFinancePage />))} />
        <Route path="profile" element={platformPage(<PlatformProfilePage />)} />
        <Route path="notifications" element={platformPage(<PlatformNotificationsPage />)} />
        <Route path="support" element={platformPage(<PlatformSupportPage />)} />
        <Route path="news" element={platformPage(<PlatformNewsPage />)} />
        <Route path="services" element={platformPage(<PlatformServicesPage />)} />
        <Route path="learning" element={platformPage(<PlatformLearningPage />)} />
        <Route path="learning/:courseId" element={platformPage(<PlatformCoursePage />)} />
        <Route path="documents" element={platformPage(<PlatformDocumentsPage />)} />
        <Route path="leave" element={platformPage(<PlatformLeavePage />)} />
        <Route path="writeoff" element={sender(<CreateWriteOffPage exitPath={PLATFORM_ROUTES.home} successPath={PLATFORM_ROUTES.tasks} />)} />
        <Route path="*" element={platformPage(<PlatformComingSoonPage />)} />
      </Route>

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

        {/* Администратор */}
        <Route path="/admin" element={admin(<AdminPage />)} />

        {/* Общее */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
