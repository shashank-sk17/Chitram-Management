import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InviteUserModal } from '../../components/admin/InviteUserModal';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getSchoolsInProject } from '../../services/firebase/firestore';
import { useAuth } from '../../features/auth/hooks/useAuth';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  schoolId?: string;
  projectId?: string;
  createdAt?: any;
}

export default function UsersPage() {
  const { claims } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      // Fetch both collections in parallel — mobile app writes teachers to `teachers/`,
      // management app writes to `users/`. Merge and deduplicate by uid.
      const [usersSnapshot, teachersSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'teachers')),
      ]);

      const usersData = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as User[];

      // Normalise teacher docs to the same User shape (role defaults to 'teacher')
      const teachersData = teachersSnapshot.docs.map((doc) => ({
        id: doc.id,
        role: 'teacher',
        ...doc.data(),
      })) as User[];

      // Merge: prefer the `users` record if a uid exists in both (management-created)
      const existingIds = new Set(usersData.map((u) => u.id));
      const mobileOnlyTeachers = teachersData.filter((t) => !existingIds.has(t.id));
      const allUsers = [...usersData, ...mobileOnlyTeachers];

      if (isProjectAdmin && myProjectId) {
        const projectSchools = await getSchoolsInProject(myProjectId);
        const schoolIds = projectSchools.map((s: any) => s.id);

        const scoped = allUsers.filter((u) => {
          if (u.role === 'admin') return false;
          if (u.projectId === myProjectId) return true;
          if (u.schoolId && schoolIds.includes(u.schoolId)) return true;
          return false;
        });
        setUsers(scoped);
      } else {
        setUsers(allUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    admin: users.filter((u) => u.role === 'admin').length,
    projectAdmin: users.filter((u) => u.role === 'projectAdmin').length,
    teacher: users.filter((u) => u.role === 'teacher').length,
    pm: users.filter((u) => u.role === 'pm').length,
    principal: users.filter((u) => u.role === 'principal').length,
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, string> = {
      admin: '👑', projectAdmin: '🎯', teacher: '👨‍🏫', pm: '📊', principal: '🏛️',
    };
    return icons[role] || '👤';
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-gradient-to-r from-primary to-secondary',
      projectAdmin: 'bg-gradient-to-r from-secondary to-accent',
      teacher: 'bg-gradient-to-r from-accent to-primary',
      pm: 'bg-gradient-to-r from-primary/70 to-secondary/70',
      principal: 'bg-gradient-to-r from-secondary/70 to-accent/70',
    };
    return colors[role] || 'bg-gray-500';
  };

  const statCards = isProjectAdmin
    ? [
        { label: 'Teachers', count: roleStats.teacher, icon: '👨‍🏫', role: 'teacher' },
        { label: 'Principals', count: roleStats.principal, icon: '🏛️', role: 'principal' },
        { label: 'PMs', count: roleStats.pm, icon: '📊', role: 'pm' },
      ]
    : [
        { label: 'Admins', count: roleStats.admin, icon: '👑', role: 'admin' },
        { label: 'Project Admins', count: roleStats.projectAdmin, icon: '🎯', role: 'projectAdmin' },
        { label: 'Teachers', count: roleStats.teacher, icon: '👨‍🏫', role: 'teacher' },
        { label: 'PMs', count: roleStats.pm, icon: '📊', role: 'pm' },
        { label: 'Principals', count: roleStats.principal, icon: '🏛️', role: 'principal' },
      ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm mb-md">
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
            Users Management 👥
          </h1>
          <Button
            title="Invite User"
            onPress={() => setShowInviteUser(true)}
            variant="primary"
            size="sm"
            className="w-auto self-start sm:self-auto"
            icon={<span>➕</span>}
          />
        </div>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          {isProjectAdmin ? 'Users in your project' : 'Manage user accounts and roles'}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className={`grid gap-sm sm:gap-md mb-xl ${isProjectAdmin ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'}`}>
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.role}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setFilterRole(filterRole === stat.role ? 'all' : stat.role)}
                className="cursor-pointer"
              >
                <Card className={`${filterRole === stat.role ? 'ring-2 ring-primary' : ''} bg-white`}>
                  <div className="text-center">
                    <span className="text-2xl sm:text-3xl block mb-sm">{stat.icon}</span>
                    <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark">{stat.count}</h3>
                    <p className="font-baloo text-xs text-text-muted">{stat.label}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Search & Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mb-lg"
          >
            <Card className="bg-white">
              <div className="flex flex-col md:flex-row gap-md">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="md:w-48">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  >
                    <option value="all">All Roles</option>
                    {!isProjectAdmin && <option value="admin">Admin</option>}
                    {!isProjectAdmin && <option value="projectAdmin">Project Admin</option>}
                    <option value="teacher">Teacher</option>
                    <option value="pm">PM</option>
                    <option value="principal">Principal</option>
                  </select>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Users List */}
          {filteredUsers.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg"
            >
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  <Card className="hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-md mb-md">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                        <span className="font-baloo font-bold text-xl text-white">
                          {user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h3 className="font-baloo font-bold text-body text-text-dark truncate">
                          {user.name || user.email}
                        </h3>
                        <p className="font-baloo text-sm text-text-muted truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className={`${getRoleColor(user.role)} px-md py-sm rounded-lg`}>
                      <div className="flex items-center justify-center gap-sm text-white">
                        <span className="text-lg">{getRoleIcon(user.role)}</span>
                        <span className="font-baloo font-semibold text-sm capitalize">{user.role}</span>
                      </div>
                    </div>

                    <div className="mt-md pt-md border-t border-divider">
                      <div className="text-xs text-text-muted font-baloo">
                        Joined: {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card className="text-center py-lg sm:py-xxl">
              <span className="text-4xl sm:text-6xl mb-md block">🔍</span>
              <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">No users found</h3>
              <p className="font-baloo text-sm sm:text-body text-text-muted">
                {searchQuery || filterRole !== 'all' ? 'Try adjusting your filters' : 'Invite your first user to get started'}
              </p>
            </Card>
          )}
        </>
      )}

      <InviteUserModal
        isOpen={showInviteUser}
        onClose={() => setShowInviteUser(false)}
        onSuccess={loadUsers}
      />
    </div>
  );
}
