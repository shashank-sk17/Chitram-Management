import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';

// Layouts
import { AdminLayout } from '../components/layout/AdminLayout';
import { TeacherLayout } from '../components/layout/TeacherLayout';
import { PMLayout } from '../components/layout/PMLayout';
import { PrincipalLayout } from '../components/layout/PrincipalLayout';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import DeniedPage from '../pages/auth/DeniedPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import TeacherDashboardPage from '../pages/teacher/DashboardPage';
import TeacherClassesPage from '../pages/teacher/ClassesPage';
import TeacherAssignmentsPage from '../pages/teacher/AssignmentsPage';
import TeacherStudentAnalyticsPage from '../pages/teacher/StudentAnalyticsPage';
import TeacherClassDetailPage from '../pages/teacher/ClassDetailPage';
import TeacherCurriculumEditorPage from '../pages/teacher/CurriculumEditorPage';
import TeacherAnnouncementsPage from '../pages/teacher/AnnouncementsPage';
import TeacherNotificationsPage from '../pages/teacher/NotificationsPage';
import { ContentWriterLayout } from '../components/layout/ContentWriterLayout';
import { ContentReviewerLayout } from '../components/layout/ContentReviewerLayout';
import ContentWriterWordEditorPage from '../pages/writer/WordEditorPage';
import CsvImportPage from '../pages/writer/CsvImportPage';
import WordReviewPage from '../pages/reviewer/WordReviewPage';
import AdminDashboardPage from '../pages/admin/DashboardPage';
import AdminProjectsPage from '../pages/admin/ProjectsPage';
import AdminProjectDetailPage from '../pages/admin/ProjectDetailPage';
import AdminSchoolsPage from '../pages/admin/SchoolsPage';
import AdminSchoolDetailPage from '../pages/admin/SchoolDetailPage';
import AdminUsersPage from '../pages/admin/UsersPage';
import AdminAnalyticsPage from '../pages/admin/AnalyticsPage';
import AdminWordBankPage from '../pages/admin/WordBankPage';
import AdminLanguageCurriculaPage from '../pages/admin/LanguageCurriculaPage';
import AdminCurriculumReviewsPage from '../pages/admin/CurriculumReviewsPage';
import AdminLicenseKeysPage from '../pages/admin/LicenseKeysPage';
import AdminBrandProfilesPage from '../pages/admin/BrandProfilesPage';
import AdminDiscountPage from '../pages/admin/DiscountPage';
import AdminAnalyticsVisibilityPage from '../pages/admin/AnalyticsVisibilityPage';
import AdminFeaturePermissionsPage from '../pages/admin/FeaturePermissionsPage';
import AdminFeatureControlsPage from '../pages/admin/FeatureControlsPage';
import PMDashboardPage from '../pages/pm/DashboardPage';
import PMAnalyticsPage from '../pages/pm/AnalyticsPage';
import PrincipalDashboardPage from '../pages/principal/DashboardPage';
import PrincipalAnalyticsPage from '../pages/principal/AnalyticsPage';

export function AppRoutes() {
  const { user, claims, loading, needsVerification } = useAuthStore();

  // Loading - show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-md"></div>
          <p className="font-baloo text-lg text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated but email not yet verified — show verify screen
  if (needsVerification) {
    return <VerifyEmailPage />;
  }

  // Authenticated but no claims - show denied
  if (!claims) {
    return (
      <Routes>
        <Route path="/denied" element={<DeniedPage />} />
        <Route path="*" element={<Navigate to="/denied" replace />} />
      </Routes>
    );
  }

  // Authenticated with claims - role-based routing
  return (
    <Routes>
      {/* Teacher Routes */}
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['teacher', 'admin']}>
              <TeacherLayout>
                <Routes>
                  <Route index element={<TeacherDashboardPage />} />
                  <Route path="classes" element={<TeacherClassesPage />} />
                  <Route path="classes/:classId" element={<TeacherClassDetailPage />} />
                  <Route path="assignments" element={<TeacherAssignmentsPage />} />
                  <Route path="student-analytics" element={<TeacherStudentAnalyticsPage />} />
                  <Route path="curriculum-editor" element={<TeacherCurriculumEditorPage />} />
                  <Route path="announcements" element={<TeacherAnnouncementsPage />} />
                  <Route path="notifications" element={<TeacherNotificationsPage />} />
                  {/* Legacy redirects */}
                  <Route path="students" element={<Navigate to="/teacher/student-analytics" replace />} />
                  <Route path="analytics" element={<Navigate to="/teacher/student-analytics" replace />} />
                  <Route path="practice-tracking" element={<Navigate to="/teacher/student-analytics" replace />} />
                  <Route path="gradebook" element={<Navigate to="/teacher/assignments" replace />} />
                </Routes>
              </TeacherLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['admin', 'projectAdmin']}>
              <AdminLayout>
                <Routes>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="projects" element={<AdminProjectsPage />} />
                  <Route path="projects/:projectId" element={<AdminProjectDetailPage />} />
                  <Route path="schools" element={<AdminSchoolsPage />} />
                  <Route path="schools/:schoolId" element={<AdminSchoolDetailPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                  <Route path="word-bank" element={<AdminWordBankPage />} />
                  <Route path="curricula" element={<AdminLanguageCurriculaPage />} />
                  <Route path="reviews" element={<AdminCurriculumReviewsPage />} />
                  <Route path="license-keys" element={<AdminLicenseKeysPage />} />
                  <Route path="brand-profiles" element={<AdminBrandProfilesPage />} />
                  <Route path="discounts" element={<AdminDiscountPage />} />
                  <Route path="analytics-visibility" element={<AdminAnalyticsVisibilityPage />} />
                  <Route path="feature-permissions" element={<AdminFeaturePermissionsPage />} />
                  <Route path="feature-controls" element={<AdminFeatureControlsPage />} />
                  <Route path="word-editor" element={<ContentWriterWordEditorPage />} />
                  <Route path="word-editor/import" element={<CsvImportPage />} />
                  <Route path="word-review" element={<WordReviewPage />} />
                </Routes>
              </AdminLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* PM Routes */}
      <Route
        path="/pm/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['pm', 'admin']}>
              <PMLayout>
                <Routes>
                  <Route index element={<PMDashboardPage />} />
                  <Route path="analytics" element={<PMAnalyticsPage />} />
                </Routes>
              </PMLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Principal Routes */}
      <Route
        path="/principal/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['principal', 'admin']}>
              <PrincipalLayout>
                <Routes>
                  <Route index element={<PrincipalDashboardPage />} />
                  <Route path="analytics" element={<PrincipalAnalyticsPage />} />
                </Routes>
              </PrincipalLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Content Writer Routes */}
      <Route
        path="/writer/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['contentWriter', 'admin']}>
              <ContentWriterLayout>
                <Routes>
                  <Route index element={<ContentWriterWordEditorPage />} />
                  <Route path="import" element={<CsvImportPage />} />
                </Routes>
              </ContentWriterLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Content Reviewer Routes */}
      <Route
        path="/reviewer/*"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['contentReviewer', 'admin']}>
              <ContentReviewerLayout>
                <Routes>
                  <Route index element={<WordReviewPage />} />
                </Routes>
              </ContentReviewerLayout>
            </RoleGuard>
          </ProtectedRoute>
        }
      />

      {/* Default redirect based on role */}
      <Route path="*" element={<Navigate to={
        claims.role === 'contentWriter' ? '/writer' :
        claims.role === 'contentReviewer' ? '/reviewer' :
        `/${claims.role}`
      } replace />} />
    </Routes>
  );
}
