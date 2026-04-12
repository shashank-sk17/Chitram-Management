# Chitram — Role-Based Access Control (RBAC)

Last updated: April 2026

---

## Overview

Chitram uses Firebase custom claims for role enforcement. Claims are set server-side via the `inviteUser` and `registerTeacher` Cloud Functions and are verified on every request through Firebase Security Rules and frontend route guards.

---

## 1. Custom Claims Shape per Role

| Role | Custom Claims |
|---|---|
| `admin` | `{ role: 'admin' }` |
| `projectAdmin` | `{ role: 'projectAdmin', projectId: string }` |
| `pm` | `{ role: 'pm', projectId: string }` |
| `principal` | `{ role: 'principal', schoolIds: string[] }` |
| `teacher` | `{ role: 'teacher', schoolId: string }` |

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

---

## 3. Portal Route Access Matrix

| Route | admin | projectAdmin | pm | principal | teacher |
|---|---|---|---|---|---|
| `/admin/dashboard` | ✓ | ✓ | — | — | — |
| `/admin/word-bank` | ✓ | ✓ (project-scoped) | — | — | — |
| `/admin/curricula` | ✓ | — | — | — | — |
| `/admin/reviews` | ✓ | ✓ (project-scoped) | — | — | — |
| `/admin/license-keys` | ✓ | — | — | — | — |
| `/admin/projects` | ✓ | ✓ (own project) | — | — | — |
| `/admin/schools` | ✓ | ✓ (own project) | — | — | — |
| `/admin/users` | ✓ | — | — | — | — |
| `/admin/analytics` | ✓ | ✓ (project-scoped) | — | — | — |
| `/pm/dashboard` | — | — | ✓ | — | — |
| `/pm/analytics` | — | — | ✓ | — | — |
| `/principal/dashboard` | — | — | — | ✓ | — |
| `/principal/analytics` | — | — | — | ✓ | — |
| `/teacher/dashboard` | — | — | — | — | ✓ |
| `/teacher/classes` | — | — | — | — | ✓ |
| `/teacher/curriculum-editor` | — | — | — | — | ✓ |
| `/teacher/assignments` | — | — | — | — | ✓ |
| `/teacher/gradebook` | — | — | — | — | ✓ |
| `/teacher/students` | — | — | — | — | ✓ |
| `/teacher/practice-tracking` | — | — | — | — | ✓ |
| `/teacher/announcements` | — | — | — | — | ✓ |
| `/teacher/analytics` | — | — | — | — | ✓ |

---

## 4. Firestore Collection Permissions

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

### Write Permissions

| Collection | admin | projectAdmin | pm | principal | teacher |
|---|---|---|---|---|---|
| `users/{uid}` | All | Own only | Own only | Own only | Own only |
| `students/{uid}` | All | — | — | — | Approve/reject class join |
| `classes/{id}` | All | — | — | — | Own classes (create, update) |
| `schools/{id}` | All | Own project | — | — | — |
| `projects/{id}` | All | — | — | — | — |
| `wordBank/{id}` | All (approve/reject) | Own project (approve) | — | — | Create pending submissions |
| `languageCurricula/{id}` | All | — | — | — | — |
| `curriculumEdits/{id}` | All (approve/reject) | Own project (approve) | — | — | Create/update own edits |
| `licenseKeys/{id}` | All | — | — | — | — |
| `mcqAssignments/{id}` | All | — | — | — | Own classes |
| `announcements/{id}` | All | — | — | — | Own classes |

---

## 5. Frontend Route Guards

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

## 6. Firestore Security Rules Summary

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

## 7. User Creation Flow

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

## 8. Claim Refresh

Custom claims are embedded in the Firebase ID token (valid for 1 hour). After a role change:
- User must **sign out and sign back in** to get a new token with updated claims
- Or force a token refresh via `user.getIdToken(true)`

The portal does a forced token refresh on every `onAuthStateChanged` event (`getIdTokenResult(user, true)`), so logging back in always picks up the latest claims.
