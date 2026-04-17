import { useState, useEffect } from 'react';
import {
  subscribeAnalyticsVisibility,
  subscribeProjectOverride,
  subscribeUserOverride,
  mergeSections,
  DEFAULT_SECTIONS,
  type VisibilityRole,
  type AnalyticsSections,
  type SectionsOverride,
} from '../services/firebase/analyticsVisibility';

interface UseAnalyticsVisibilityOptions {
  role: VisibilityRole | undefined;
  projectId?: string;
  uid?: string;
}

export function useAnalyticsVisibility(
  roleOrOptions: VisibilityRole | undefined | UseAnalyticsVisibilityOptions,
): {
  sections: AnalyticsSections;
  loading: boolean;
} {
  // Accept both the old string signature and the new options object
  const opts: UseAnalyticsVisibilityOptions =
    typeof roleOrOptions === 'object' && roleOrOptions !== null
      ? roleOrOptions
      : { role: roleOrOptions };

  const { role, projectId, uid } = opts;

  const [roleSections, setRoleSections] = useState<AnalyticsSections>({ ...DEFAULT_SECTIONS });
  const [projectOverride, setProjectOverride] = useState<SectionsOverride | null>(null);
  const [userOverride, setUserOverride] = useState<SectionsOverride | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

  // Subscribe to role-level defaults
  useEffect(() => {
    if (!role) {
      setRoleSections({ ...DEFAULT_SECTIONS });
      setRoleLoaded(true);
      return;
    }
    setRoleLoaded(false);
    const unsub = subscribeAnalyticsVisibility(role, s => {
      setRoleSections(s);
      setRoleLoaded(true);
    });
    return unsub;
  }, [role]);

  // Subscribe to project-level override
  useEffect(() => {
    if (!projectId) { setProjectOverride(null); return; }
    const unsub = subscribeProjectOverride(projectId, o => setProjectOverride(o));
    return unsub;
  }, [projectId]);

  // Subscribe to user-level override
  useEffect(() => {
    if (!uid) { setUserOverride(null); return; }
    const unsub = subscribeUserOverride(uid, o => setUserOverride(o));
    return unsub;
  }, [uid]);

  const sections = mergeSections(roleSections, projectOverride, userOverride);

  return { sections, loading: !roleLoaded };
}
