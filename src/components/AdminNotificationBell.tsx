import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  subscribeAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type AdminNotification,
} from '../services/firebase/adminNotifications';

const TYPE_META: Record<AdminNotification['type'], { icon: string; label: string; color: string }> = {
  word_submitted: { icon: '📝', label: 'New submission',  color: 'bg-amber-50  text-amber-700  border-amber-200'  },
  word_approved:  { icon: '✅', label: 'Word approved',   color: 'bg-green-50  text-green-700  border-green-200'  },
  word_rejected:  { icon: '✗',  label: 'Word rejected',   color: 'bg-red-50    text-red-700    border-red-200'    },
};

function timeAgo(ts: AdminNotification['createdAt']): string {
  if (!ts) return '';
  const ms = Date.now() - ts.seconds * 1000;
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AdminNotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeAdminNotifications(setNotifications);
    return unsub;
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifications.filter(n => !n.read).length;

  const handleOpen = () => {
    setOpen(v => !v);
  };

  const handleMarkRead = async (n: AdminNotification) => {
    if (!n.read) {
      await markAdminNotificationRead(n.id).catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAdminNotificationsRead().catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-sm rounded-xl hover:bg-white/60 transition-colors"
        title="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-baloo font-bold flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-sm w-96 bg-white rounded-2xl shadow-xl border border-divider z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-md py-sm border-b border-divider">
              <h3 className="font-baloo font-bold text-sm text-text-dark">
                Content Pipeline
                {unread > 0 && (
                  <span className="ml-sm text-xs bg-error/10 text-error font-semibold px-xs py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </h3>
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="font-baloo text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-xl px-md">
                  <div className="text-3xl mb-xs">🔔</div>
                  <p className="font-baloo text-sm text-text-muted">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const meta = TYPE_META[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n)}
                      className={`w-full text-left px-md py-sm border-b border-divider last:border-0 transition-colors hover:bg-gray-50 ${
                        !n.read ? 'bg-lavender-light/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-sm">
                        {/* Icon */}
                        <span className={`mt-0.5 text-sm w-7 h-7 flex items-center justify-center rounded-lg border shrink-0 ${meta.color}`}>
                          {meta.icon}
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-xs justify-between">
                            <span className="font-baloo font-semibold text-xs text-text-dark truncate">
                              {meta.label} — {n.wordText}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-xs flex-wrap mt-0.5">
                            {n.submittedByName && (
                              <span className="font-baloo text-xs text-text-muted">
                                by {n.submittedByName}
                              </span>
                            )}
                            {n.grade && (
                              <span className="font-baloo text-xs bg-gray-100 text-text-muted px-1 rounded">
                                Grade {n.grade}
                              </span>
                            )}
                            {n.curricula && (
                              <span className="font-baloo text-xs bg-green-50 text-green-700 px-1 rounded">
                                → {n.curricula}
                              </span>
                            )}
                          </div>

                          {n.rejectionNote && (
                            <p className="font-baloo text-xs text-red-600 mt-0.5 italic truncate">
                              "{n.rejectionNote}"
                            </p>
                          )}

                          {n.reviewedByName && n.type !== 'word_submitted' && (
                            <p className="font-baloo text-xs text-text-muted mt-0.5">
                              reviewed by {n.reviewedByName}
                            </p>
                          )}

                          <p className="font-baloo text-xs text-text-muted mt-0.5">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
