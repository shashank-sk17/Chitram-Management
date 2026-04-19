# Chitram — Role-Based Access Control (RBAC)

Last updated: April 2026

---

## Overview

Chitram uses a **two-layer RBAC system**:

1. **Page/Route-level** — Firebase custom claims + `RoleGuard` + Firestore Security Rules control which pages each role can access.
2. **Feature/Action-level** — A `featurePermissions` Firestore collection holds per-role (and optionally per-project / per-user) toggles that show or hide individual action buttons at runtime.

Claims are set server-side via the `inviteUser` and `registerTeacher` Cloud Functions and are verified on every request through Firebase Security Rules and frontend route guards.

---

## 1. Custom Claims Shape per Role

> **Additional roles added:** `contentWriter` and `contentReviewer` — for the word-bank pipeline. Claims shape: `{ role: 'contentWriter' }` / `{ role: 'contentReviewer' }`. These roles have no `projectId` or `schoolId` in their claims.



| Role | Custom Claims |
|---|---|
| `admin` | `{ role: 'admin' }` |
| `projectAdmin` | `{ role: 'projectAdmin', projectId: string }` |
| `pm` | `{ role: 'pm', projectId: string }` |
| `principal` | `{ role: 'principal', schoolIds: string[] }` |
| `teacher` | `{ role: 'teacher', schoolId: string }` |
| `contentWriter` | `{ role: 'contentWriter' }` |
| `contentReviewer` | `{ role: 'contentReviewer' }` |

Claims are stored in the Firebase ID token and refreshed on each login. After a role change, the user must sign out and back in to receive updated claims.

---

## 2. Role Descriptions

| Role | Scope | Purpose |
|---|---|---|
| **admin** (Super Admin) | Platform-wide | Full access to all data, settings, word bank, license keys, all projects and schools |
| **projectAdmin** | One project (`projectId`) | Manage schools, teachers, and curriculum within their assigned project; approve/reject curriculum edits |
| **pm** (Project Manager) | One project (`projectId`) | Read-only analytics and reporting for their project; no write access |
| **principal** | One or more schools (`schoolIds[]`) | Read-only access to school analytics, teacher activity, and student performance |
| **teacher** | One school (`schoolId`) | Full management of their own classes: students, curriculum editor, assignments, gradebook, announcements |
| **contentWriter** | Platform-wide | Submits new vocabulary words via `/writer/*` portal; words start in `pending` status awaiting review |
| **contentReviewer** | Platform-wide | Reviews and approves/rejects `pending` words submitted by content writers; approved words are added to `languageCurricula` |

---

## 3. Feature-Level Permission System

Feature-level RBAC controls individual action buttons within pages (not just route access). Unauthorized buttons are **hidden entirely** — not disabled — so non-admin roles do not see greyed-out controls.

### 3a. Architecture

Permission resolution order — most specific wins:
```
Code defaults (DEFAULT_PERMISSIONS in src/types/permissions.ts)
  ↓ overridden by Firestore role doc  (featurePermissions/{role})
    ↓ overridden by Firestore project doc (featurePermissions/project:{projectId})
      ↓ overridden by Firestore user doc  (featurePermissions/user:{uid})
```

### 3b. Key files

| File | Purpose |
|---|---|
| `src/types/permissions.ts` | `PermissionKey` type (49 keys), `DEFAULT_PERMISSIONS` matrix, grouping helpers |
| `src/services/firebase/featurePermissions.ts` | Firestore CRUD — `getRolePermissions`, `setRolePermissions`, project/user overrides |
| `src/stores/permissionsStore.ts` | Zustand store; atomic `setPermissions` enables Zustand `shallow` equality |
| `src/hooks/usePermissionSubscription.ts` | Called once at app root; sets up 3 `onSnapshot` listeners; writes merged result to store |
| `src/hooks/usePermission.ts` | `const { can } = usePermission()` — O(1) map lookup, no async work |
| `src/components/common/PermissionGate.tsx` | JSX wrapper: renders children if `can(permKey)`, else `fallback` |
| `src/pages/admin/FeaturePermissionsPage.tsx` | Admin UI — 3 tabs: By Role / By Project / By User; auto-saves on toggle |

### 3c. Firestore collection

Collection: `featurePermissions`

Doc IDs:
- `{role}` — e.g. `admin`, `projectAdmin`, `teacher`
- `project:{projectId}` — overrides for all projectAdmin users in that project
- `user:{uid}` — overrides for a specific user

Firestore rule: any signed-in user can **read** (needed at login); only `admin` can **write**.

### 3d. Default Permission Matrix

| Area | Permission Key | admin | projectAdmin | teacher | contentReviewer |
|---|---|:---:|:---:|:---:|:---:|
| **wordBank** | view | ✓ | ✓ | | |
| | create | ✓ | | | |
| | edit | ✓ | ✓ | | |
| | delete | ✓ | | | |
| | approve | ✓ | | | |
| | reject | ✓ | | | |
| **users** | view | ✓ | ✓ | | |
| | invite | ✓ | ✓ | | |
| | editRole | ✓ | | | |
| **projects** | view | ✓ | ✓ | | |
| | create | ✓ | | | |
| | edit | ✓ | ✓ | | |
| | delete | ✓ | | | |
| **schools** | view | ✓ | ✓ | | |
| | create | ✓ | ✓ | | |
| | edit | ✓ | ✓ | | |
| | delete | ✓ | | | |
| **curricula** | view | ✓ | ✓ | | |
| | edit | ✓ | | | |
| | resetToSeed | ✓ | | | |
| **curriculumReviews** | view | ✓ | ✓ | | |
| | approve | ✓ | ✓ | | |
| | reject | ✓ | ✓ | | |
| | edit | ✓ | | | |
| **discounts** | view/create/toggle | ✓ | | | |
| **licenseKeys** | view/generate/revoke | ✓ | | | |
| **brandProfiles** | view/create/edit/delete | ✓ | | | |
| **classes** | view/create/manageStudents | ✓ | | ✓ | |
| **assignments** | view/create/publish/close/delete | ✓ | | ✓ | |
| **announcements** | view/create/delete | ✓ | | ✓ | |
| **curriculumEditor** | view/edit | ✓ | | ✓ | |
| **wordReview** | view/approve/reject/edit | ✓ | | | ✓ |

`pm` and `principal` have no feature permissions (analytics-only; section visibility is controlled by `analyticsVisibility` collection instead).

### 3e. Usage patterns

**Inline (preferred for single buttons):**
```tsx
const { can } = usePermission();
{can('wordBank.approve') && <button onClick={handleApprove}>Approve</button>}
```

**`<PermissionGate>` (for groups of related gated elements):**
```tsx
<PermissionGate permKey="curriculumReviews.approve">
  <button onClick={approve}>Approve</button>
</PermissionGate>
```

**Rule: always HIDE, never disable.** A `projectAdmin` should not see a greyed-out "Delete Project" button. During `loading: true`, render nothing (all permissions default to `false` until Firestore resolves).

---

## 4. Portal Route Access Matrix

Route guards enforced by `RoleGuard` in `src/routes/AppRoutes.tsx`. Feature-level buttons within a route are additionally gated by `usePermission()` (see §3).

| Route | admin | projectAdmin | pm | principal | teacher | contentWriter | contentReviewer |
|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | ✓ | ✓ | — | — | — | — | — |
| `/admin/word-bank` | ✓ | ✓ (scoped) | — | — | — | — | — |
| `/admin/curricula` | ✓ | — | — | — | — | — | — |
| `/admin/reviews` | ✓ | ✓ (scoped) | — | — | — | — | — |
| `/admin/license-keys` | ✓ | — | — | — | — | — | — |
| `/admin/brand-profiles` | ✓ | — | — | — | — | — | — |
| `/admin/discounts` | ✓ | — | — | — | — | — | — |
| `/admin/projects` | ✓ | ✓ (own) | — | — | — | — | — |
| `/admin/schools` | ✓ | ✓ (own) | — | — | — | — | — |
| `/admin/users` | ✓ | ✓ | — | — | — | — | — |
| `/admin/analytics` | ✓ | ✓ (scoped) | — | — | — | — | — |
| `/admin/analytics-visibility` | ✓ | — | — | — | — | — | — |
| `/admin/feature-permissions` | ✓ | — | — | — | — | — | — |
| `/pm/dashboard` | — | — | ✓ | — | — | — | — |
| `/pm/analytics` | — | — | ✓ | — | — | — | — |
| `/principal/dashboard` | — | — | — | ✓ | — | — | — |
| `/principal/analytics` | — | — | — | ✓ | — | — | — |
| `/teacher/dashboard` | — | — | — | — | ✓ | — | — |
| `/teacher/classes` | — | — | — | — | ✓ | — | — |
| `/teacher/curriculum-editor` | — | — | — | — | ✓ | — | — |
| `/teacher/assignments` | — | — | — | — | ✓ | — | — |
| `/teacher/gradebook` | — | — | — | — | ✓ | — | — |
| `/teacher/students` | — | — | — | — | ✓ | — | — |
| `/teacher/practice-tracking` | — | — | — | — | ✓ | — | — |
| `/teacher/announcements` | — | — | — | — | ✓ | — | — |
| `/teacher/analytics` | — | — | — | — | ✓ | — | — |
| `/writer/*` | — | — | — | — | — | ✓ | — |
| `/reviewer/*` | — | — | — | — | — | — | ✓ |

---

## 5. Firestore Collection Permissions

### Read Permissions

| Collection | admin | projectAdmin | pm | principal | teacher |
|---|---|---|---|---|---|
| `users/{uid}` | All | Own only | Own only | Own only | Own only |
| `students/{uid}` | All | Project's schools | Project's schools | Assigned schools | Own classes |
| `teachers/{uid}` | All | Project's schools | Project's schools | Assigned schools | Own doc |
| `classes/{id}` | All | Project's schools | Project's schools | Assigned schools | Own classes |
| `schools/{id}` | All | Own project | Own project | Assigned | Own school |
| `projects/{id}` | All | Own project | Own project | — | — |
| `wordBank/{id}` | All | All | All | All | All |
| `languageCurricula/{id}` | All | All | All | All | All |
| `curriculumEdits/{id}` | All | Own project | Own project | Own schools | Own classes |
| `learningAttempts/{id}` | All | Project's | Project's | School's | Class's |
| `licenseKeys/{id}` | All | — | All | — | — |
| `mcqAssignments/{id}` | All | Project's | Project's | School's | Own classes |
| `announcements/{id}` | All | — | — | — | Own classes |
| `analyticsVisibility/{role}` | All | read-only | read-only | read-only | read-only |
| `featurePermissions/{docId}` | All | read-only | read-only | read-only | read-only |
| `adminNotifications/{id}` | All | read/update | — | — | — |

### Write Permissions

| Collection | admin | projectAdmin | pm | principal | teacher | contentWriter | contentReviewer |
|---|---|---|---|---|---|---|---|
| `users/{uid}` | All | Own only | Own only | Own only | Own only | — | — |
| `students/{uid}` | All | — | — | — | Approve/reject class join | — | — |
| `classes/{id}` | All | — | — | — | Own classes (create, update) | — | — |
| `schools/{id}` | All | Own project | — | — | — | — | — |
| `projects/{id}` | All | — | — | — | — | — | — |
| `wordBank/{id}` | All (approve/reject) | Own project (approve) | — | — | Create pending | Create pending | Approve/reject/edit |
| `languageCurricula/{id}` | All | — | — | — | — | — | ✓ (on word approve) |
| `curriculumEdits/{id}` | All (approve/reject) | Own project (approve) | — | — | Create/update own edits | — | — |
| `licenseKeys/{id}` | All | — | — | — | — | — | — |
| `mcqAssignments/{id}` | All | — | — | — | Own classes | — | — |
| `announcements/{id}` | All | — | — | — | Own classes | — | — |
| `analyticsVisibility/{role}` | All | — | — | — | — | — | — |
| `featurePermissions/{docId}` | All | — | — | — | — | — | — |
| `adminNotifications/{id}` | create | create | — | — | — | create | create |

---

## 6. Frontend Route Guards

### `src/routes/ProtectedRoute.tsx`
Redirects unauthenticated users to `/login`.

### `src/routes/RoleGuard.tsx`
Checks `claims.role` against an `allowedRoles` prop. Redirects unauthorized users to `/unauthorized`.

Usage example:
```tsx
<RoleGuard allowedRoles={['admin', 'projectAdmin']}>
  <WordBankPage />
</RoleGuard>
```

### Page-Level Scoping
For projectAdmin, pages additionally check `claims.projectId` against resource data:
```typescript
const isProjectAdmin = claims?.role === 'projectAdmin';
const myProjectId = claims?.projectId;

// Filter data to own project
const data = isProjectAdmin
  ? await getSchoolsInProject(myProjectId)
  : await getAllSchools();
```

---

## 7. Firestore Security Rules Summary

Key helper functions in `firestore.rules`:

```javascript
function isAdmin()        { return request.auth.token.role == 'admin'; }
function isProjectAdmin() { return request.auth.token.role == 'projectAdmin'; }
function isPM()           { return request.auth.token.role == 'pm'; }
function isPrincipal()    { return request.auth.token.role == 'principal'; }
function isTeacher()      { return request.auth.token.role == 'teacher'; }
function isAuthenticated(){ return request.auth != null; }
```

Key scoping patterns:
```javascript
// projectAdmin can only write to resources in their project
allow write: if isAdmin() ||
  (isProjectAdmin() && resource.data.projectId == request.auth.token.projectId);

// teacher can only write to their own classes
allow write: if isAdmin() ||
  (isTeacher() && resource.data.teacherId == request.auth.uid);

// principal read access scoped to their schoolIds
allow read: if isAdmin() ||
  (isPrincipal() && resource.data.schoolId in request.auth.token.schoolIds);
```

---

## 8. User Creation Flow

### Admin-invited roles (admin, projectAdmin, pm, principal)
1. Super admin opens **Users → Invite User** in the portal
2. Fills email, display name, role, and role-specific scope (projectId / schoolIds)
3. Portal calls `inviteUser` Cloud Function
4. CF creates Firebase Auth user (or finds existing), sets custom claims, generates a password reset link
5. Admin copies and shares the link with the invitee
6. Invitee sets their password and logs in — claims are active immediately

### Teacher self-registration
1. Teacher visits the portal login page → clicks "Register as Teacher"
2. Enters name, email, password, and school join code
3. Portal calls `registerTeacher` Cloud Function
4. CF creates the teacher, sets `role: 'teacher'` claim with `schoolId`
5. Teacher must verify their email before portal access is granted

---

## 9. Claim Refresh

Custom claims are embedded in the Firebase ID token (valid for 1 hour). After a role change:
- User must **sign out and sign back in** to get a new token with updated claims
- Or force a token refresh via `user.getIdToken(true)`

The portal does a forced token refresh on every `onAuthStateChanged` event (`getIdTokenResult(user, true)`), so logging back in always picks up the latest claims.
