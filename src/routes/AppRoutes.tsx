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
import TeacherCurriculumPage from '../pages/teacher/CurriculumPage';
import TeacherClassesPage from '../pages/teacher/ClassesPage';
import TeacherAssignmentsPage from '../pages/teacher/AssignmentsPage';
import TeacherStudentsPage from '../pages/teacher/StudentsPage';
import TeacherAnalyticsPage from '../pages/teacher/AnalyticsPage';
import TeacherApprovalsPage from '../pages/teacher/ApprovalsPage';
import TeacherAttendancePage from '../pages/teacher/AttendancePage';
import TeacherClassDetailPage from '../pages/teacher/ClassDetailPage';
import AdminDashboardPage from '../pages/admin/DashboardPage';
import AdminCurriculumPage from '../pages/admin/CurriculumPage';
import AdminProjectsPage from '../pages/admin/ProjectsPage';
import AdminSchoolsPage from '../pages/admin/SchoolsPage';
import AdminUsersPage from '../pages/admin/UsersPage';
import AdminAnalyticsPage from '../pages/admin/AnalyticsPage';
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
                  <Route path="curriculum" element={<TeacherCurriculumPage />} />
                  <Route path="classes" element={<TeacherClassesPage />} />
                  <Route path="classes/:classId" element={<TeacherClassDetailPage />} />
                  <Route path="assignments" element={<TeacherAssignmentsPage />} />
                  <Route path="students" element={<TeacherStudentsPage />} />
                  <Route path="approvals" element={<TeacherApprovalsPage />} />
                  <Route path="attendance" element={<TeacherAttendancePage />} />
                  <Route path="analytics" element={<TeacherAnalyticsPage />} />
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
                  {/* Curriculum only for super admin */}
                  <Route
                    path="curriculum"
                    element={
                      <RoleGuard allowedRoles={['admin']}>
                        <AdminCurriculumPage />
                      </RoleGuard>
                    }
                  />
                  <Route path="projects" element={<AdminProjectsPage />} />
                  <Route path="schools" element={<AdminSchoolsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
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

      {/* Default redirect based on role */}
      <Route path="*" element={<Navigate to={`/${claims.role}`} replace />} />
    </Routes>
  );
}
