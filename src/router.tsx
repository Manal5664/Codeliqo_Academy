import { Navigate, createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { LoginChoicePage } from './pages/auth/LoginChoicePage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage';
import { AboutPage } from './pages/public/AboutPage';
import { AdmissionsPage } from './pages/public/AdmissionsPage';
import { ContactPage } from './pages/public/ContactPage';
import { FaqPage } from './pages/public/FaqPage';
import { FeesPage } from './pages/public/FeesPage';
import { HomePage } from './pages/public/HomePage';
import { LearningExperiencePage } from './pages/public/LearningExperiencePage';
import { NotFoundPage } from './pages/public/NotFoundPage';
import { PoliciesPage } from './pages/public/PoliciesPage';
import { ProgramDetailPage } from './pages/public/ProgramDetailPage';
import { ProgramsPage } from './pages/public/ProgramsPage';
import { VerifyCertificatePage } from './pages/public/VerifyCertificatePage';
import { AssignmentsPage } from './pages/student/AssignmentsPage';
import { CertificatesPage } from './pages/student/CertificatesPage';
import { LessonsPage } from './pages/student/LessonsPage';
import { MyProgramPage } from './pages/student/MyProgramPage';
import { PaymentsPage } from './pages/student/PaymentsPage';
import { ProfilePage } from './pages/student/ProfilePage';
import { ProgressPage } from './pages/student/ProgressPage';
import { ProjectsPage } from './pages/student/ProjectsPage';
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage';
import {
  AdminAnnouncementsPage,
  AdminAssignmentsPage,
  AdminAttendancePage,
  AdminBatchesPage,
  AdminCertificatesPage,
  AdminEnrollmentsPage,
  AdminLessonsPage,
  AdminPaymentsPage,
  AdminProgramsPage,
  AdminProjectsPage,
} from './pages/admin/AdminResourcesPages';

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'programs/:slug', element: <ProgramDetailPage /> },
      { path: 'learning-experience', element: <LearningExperiencePage /> },
      { path: 'admissions', element: <AdmissionsPage /> },
      { path: 'fees', element: <FeesPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'faqs', element: <FaqPage /> },
      { path: 'policies', element: <PoliciesPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'verify-certificate', element: <VerifyCertificatePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/login', element: <LoginChoicePage /> },
  { path: '/student/login', element: <LoginPage portal="student" /> },
  { path: '/student/accept-invite', element: <AcceptInvitePage /> },
  { path: '/admin/login', element: <LoginPage portal="admin" /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleProtectedRoute role="student" />,
        children: [{
          path: '/student', element: <DashboardLayout type="student" />,
          children: [
            { index: true, element: <Navigate to="dashboard" replace /> },
            { path: 'dashboard', element: <StudentDashboardPage />, handle: { title: 'Dashboard' } },
            { path: 'my-program', element: <MyProgramPage />, handle: { title: 'My Program' } },
            { path: 'lessons', element: <LessonsPage />, handle: { title: 'Lessons' } },
            { path: 'assignments', element: <AssignmentsPage />, handle: { title: 'Assignments' } },
            { path: 'projects', element: <ProjectsPage />, handle: { title: 'Projects' } },
            { path: 'progress', element: <ProgressPage />, handle: { title: 'Progress' } },
            { path: 'payments', element: <PaymentsPage />, handle: { title: 'Payments' } },
            { path: 'certificates', element: <CertificatesPage />, handle: { title: 'Certificates' } },
            { path: 'profile', element: <ProfilePage />, handle: { title: 'Profile' } },
            { path: '*', element: <Navigate to="dashboard" replace /> },
          ],
        }],
      },
      {
        element: <RoleProtectedRoute role="admin" />,
        children: [{
          path: '/admin', element: <DashboardLayout type="admin" />,
          children: [
            { index: true, element: <Navigate to="dashboard" replace /> },
            { path: 'dashboard', element: <AdminDashboardPage />, handle: { title: 'Admin Dashboard' } },
            { path: 'students', element: <AdminStudentsPage />, handle: { title: 'Students' } },
            { path: 'enrollments', element: <AdminEnrollmentsPage />, handle: { title: 'Enrollments' } },
            { path: 'programs', element: <AdminProgramsPage />, handle: { title: 'Programs' } },
            { path: 'batches', element: <AdminBatchesPage />, handle: { title: 'Batches' } },
            { path: 'lessons', element: <AdminLessonsPage />, handle: { title: 'Lessons' } },
            { path: 'assignments', element: <AdminAssignmentsPage />, handle: { title: 'Assignments' } },
            { path: 'projects', element: <AdminProjectsPage />, handle: { title: 'Projects' } },
            { path: 'submissions', element: <AdminSubmissionsPage />, handle: { title: 'Submission Review' } },
            { path: 'attendance', element: <AdminAttendancePage />, handle: { title: 'Attendance' } },
            { path: 'payments', element: <AdminPaymentsPage />, handle: { title: 'Payments' } },
            { path: 'certificates', element: <AdminCertificatesPage />, handle: { title: 'Certificates' } },
            { path: 'announcements', element: <AdminAnnouncementsPage />, handle: { title: 'Announcements' } },
            { path: '*', element: <Navigate to="dashboard" replace /> },
          ],
        }],
      },
    ],
  },
]);
