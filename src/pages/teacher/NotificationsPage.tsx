import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  getTeacherNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type TeacherNotification,
} from '../../services/firebase/notifications';
import { Timestamp } from 'firebase/firestore';

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleString();
  return String(ts);
}

const TYPE_CONFIG = {
  curriculum_approved: { icon: '✅', label: 'Curriculum Approved', color: 'bg-success/10 border-success/20' },
  curriculum_rejected: { icon: '❌', label: 'Curriculum Rejected', color: 'bg-error/10 border-error/20' },
  word_edited: { icon: '✏️', label: 'Word Edited by Admin', color: 'bg-sky-50 border-sky-200' },
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await getTeacherNotifications(user.uid);
      setNotifications(items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleRead = async (notif: TeacherNotification) => {
    if (notif.read || !user) return;
    await markNotificationRead(user.uid, notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
  };

  const handleMarkAll = async () => {
    if (!user) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-lg max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Notifications</h1>
          <p className="font-baloo text-text-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="px-md py-sm rounded-xl border border-divider font-baloo font-semibold text-sm text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-xl text-text-muted font-baloo">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">🔔</span>
          <p className="font-baloo text-text-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-sm">
          {notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] ?? { icon: '📢', label: notif.type, color: 'bg-gray-50 border-gray-200' };
            return (
              <button
                key={notif.id}
                onClick={() => handleRead(notif)}
                className={`w-full text-left rounded-2xl border p-md shadow-sm transition-all ${config.color} ${
                  notif.read ? 'opacity-70' : 'ring-1 ring-primary/30'
                }`}
              >
                <div className="flex items-start gap-md">
                  <span className="text-2xl flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm flex-wrap mb-xs">
                      <span className="font-baloo font-bold text-sm text-text-dark">{config.label}</span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="font-baloo text-sm text-text-body">{notif.message}</p>
                    {notif.adminNote && notif.type !== 'curriculum_rejected' && (
                      <p className="font-baloo text-xs text-text-muted mt-xs italic">Admin note: {notif.adminNote}</p>
                    )}
                    <p className="font-baloo text-xs text-text-muted mt-xs">
                      Class: <span className="font-semibold">{notif.classId}</span>
                      {' · '}{formatDate(notif.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
