import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherStore } from '../../stores/teacherStore';
import { usePermission } from '../../hooks/usePermission';
import type { AnnouncementDoc } from '../../types/firestore';
import {
  createAnnouncement, getAnnouncementsForClass, deleteAnnouncement, pinAnnouncement,
} from '../../services/firebase/announcements';
import { Timestamp } from 'firebase/firestore';

type AnnouncementWithId = { id: string } & AnnouncementDoc;

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return String(ts);
}

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const { classes, listenToTeacherClasses } = useTeacherStore();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<AnnouncementWithId[]>([]);
  const [loading, setLoading] = useState(false);

  // Composer state
  const [compTitle, setCompTitle] = useState('');
  const [compBody, setCompBody] = useState('');
  const [compPinned, setCompPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  // Action state
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);

  useEffect(() => {
    if (user) return listenToTeacherClasses(user.uid);
  }, [user]);

  useEffect(() => {
    if (!selectedClassId) { setAnnouncements([]); return; }
    loadAnnouncements();
  }, [selectedClassId]);

  const loadAnnouncements = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const result = await getAnnouncementsForClass(selectedClassId);
      setAnnouncements(result);
    } catch {}
    setLoading(false);
  };

  const handlePost = async () => {
    if (!user || !selectedClassId || !compTitle.trim() || !compBody.trim()) return;
    classes.find(c => c.id === selectedClassId);
    setPosting(true);
    try {
      await createAnnouncement({
        classId: selectedClassId,
        teacherUid: user.uid,
        teacherName: user.displayName || user.email || 'Teacher',
        title: compTitle.trim(),
        body: compBody.trim(),
        pinned: compPinned,
      });
      setCompTitle('');
      setCompBody('');
      setCompPinned(false);
      await loadAnnouncements();
    } catch {}
    setPosting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    setDeleting(id);
    try {
      await deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch {}
    setDeleting(null);
  };

  const handlePin = async (id: string, currentPinned: boolean) => {
    setPinning(id);
    try {
      await pinAnnouncement(id, !currentPinned);
      setAnnouncements(prev => prev.map(a =>
        a.id === id ? { ...a, pinned: !currentPinned } : a
      ).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      }));
    } catch {}
    setPinning(null);
  };

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Announcements</h1>
          <p className="font-baloo text-text-muted">Post and manage class announcements</p>
        </div>
      </div>

      {/* Class selector */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md">
        <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Select Class</label>
        <select
          value={selectedClassId}
          onChange={e => setSelectedClassId(e.target.value)}
          className="w-full md:w-64 px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">— Choose a class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} · Grade {c.grade}</option>)}
        </select>
      </div>

      {selectedClassId && (
        <>
          {/* Composer card */}
          <div className="bg-white rounded-2xl border border-divider shadow-sm p-md space-y-md">
            <h2 className="font-baloo font-bold text-base text-text-dark">New Announcement</h2>
            <div>
              <label className="font-baloo font-semibold text-xs text-text-dark block mb-xs">Title</label>
              <input
                type="text"
                value={compTitle}
                onChange={e => setCompTitle(e.target.value)}
                placeholder="Announcement title…"
                className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-baloo font-semibold text-xs text-text-dark block mb-xs">Message</label>
              <textarea
                value={compBody}
                onChange={e => setCompBody(e.target.value)}
                placeholder="Write your announcement…"
                rows={4}
                className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-sm">
              <label className="flex items-center gap-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={compPinned}
                  onChange={e => setCompPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="font-baloo font-semibold text-sm text-text-dark">📌 Pin this announcement</span>
              </label>
              {can('announcements.create') && (
                <button
                  onClick={handlePost}
                  disabled={!compTitle.trim() || !compBody.trim() || posting}
                  className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {posting ? 'Posting…' : 'Post Announcement'}
                </button>
              )}
            </div>
          </div>

          {/* Announcements list */}
          {loading ? (
            <div className="text-center py-xl font-baloo text-text-muted">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
              <span className="text-5xl block mb-md">📢</span>
              <p className="font-baloo text-text-muted">No announcements yet. Post your first one above!</p>
            </div>
          ) : (
            <div className="space-y-sm">
              <AnimatePresence>
                {sorted.map(ann => (
                  <motion.div
                    key={ann.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className={`rounded-2xl border shadow-sm p-md ${
                      ann.pinned
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-divider'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-md">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-sm mb-xs flex-wrap">
                          {ann.pinned && (
                            <span className="text-amber-500 text-sm">📌</span>
                          )}
                          <h3 className={`font-baloo font-bold text-base ${ann.pinned ? 'text-amber-800' : 'text-text-dark'}`}>
                            {ann.title}
                          </h3>
                        </div>
                        <p className={`font-baloo text-sm leading-relaxed line-clamp-2 mb-xs ${ann.pinned ? 'text-amber-700' : 'text-text-muted'}`}>
                          {ann.body}
                        </p>
                        <p className="font-baloo text-xs text-text-muted">
                          {ann.teacherName} · {formatDate(ann.createdAt as Timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center gap-xs shrink-0">
                        <button
                          onClick={() => handlePin(ann.id, ann.pinned)}
                          disabled={pinning === ann.id}
                          title={ann.pinned ? 'Unpin' : 'Pin'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            ann.pinned ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-gray-100 text-text-muted hover:bg-amber-100 hover:text-amber-600'
                          }`}
                        >
                          {pinning === ann.id ? '…' : '📌'}
                        </button>
                        {can('announcements.delete') && (
                          <button
                            onClick={() => handleDelete(ann.id)}
                            disabled={deleting === ann.id}
                            title="Delete"
                            className="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors"
                          >
                            {deleting === ann.id ? '…' : '🗑️'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
