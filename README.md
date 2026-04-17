# Chitram Management Portal

Web-based admin and teacher portal for the Chitram vocabulary learning platform. Provides role-scoped dashboards, curriculum management, student analytics, assignment tracking, and full platform administration.

> **Two-repo system sharing one Firebase backend:**
> | Repo | Purpose | Stack |
> |------|---------|-------|
> | **Chitram_Management** *(this repo)* | Admin & teacher web portal | React 19 + Vite + Tailwind |
> | **[Chitram_UI](https://github.com/shashank-sk17/Chitram-UI)** | Mobile learning app for kids | React Native / Expo SDK 54 |
>
> **Firebase project:** `chitram-51e22` · **Live URL:** https://chitram-51e22.web.app · **Cloud Functions:** deployed from Chitram_UI/functions/

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Role-Based Access Control](#role-based-access-control)
5. [Pages by Role](#pages-by-role)
6. [Architecture](#architecture)
   - [Auth & Claims](#auth--claims)
   - [State Management](#state-management)
   - [Analytics Architecture](#analytics-architecture)
   - [Curriculum System](#curriculum-system)
7. [Firestore Collections](#firestore-collections)
8. [Services (Firebase Query Layer)](#services-firebase-query-layer)
9. [Commands Reference](#commands-reference)
10. [Deployment](#deployment)
11. [Version Control](#version-control)
12. [Security](#security)
13. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 19 + Vite | SPA with client-side routing |
| Language | TypeScript | Strict mode throughout |
| Styling | Tailwind CSS v3 | Custom design tokens — see `tailwind.config.ts` |
| State | Zustand | Per-domain stores: auth, teacher, curriculum, assignments, project |
| Auth | Firebase Auth | Custom claims for RBAC |
| Database | Cloud Firestore | Real-time listeners in teacher store |
| Animations | Framer Motion | Page transitions, skeleton loaders, stat card reveals |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | Curriculum level editor |
| Hosting | Firebase Hosting | Auto-deployed via `npm run deploy:hosting` |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **Firebase CLI:** `npm install -g firebase-tools`

### Setup

```bash
git clone https://github.com/shashank-sk17/Chitram-Management.git
cd Chitram-Management
npm install
```

### Development

```bash
npm run dev             # local dev server at localhost:5173
npm run build           # production build → dist/
npm run deploy:hosting  # build + deploy to Firebase Hosting
npx tsc --noEmit        # TypeScript check
```

Expose on local network (for testing on mobile/tablet):
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

---

## Project Structure

```
Chitram_Management/
├── RBAC.md                          Full role-based access control reference
├── VERSION_CONTROL.md               Branching strategy, commit conventions, release tagging
├── firebase.json                    Hosting config — SPA catch-all rewrite to index.html
│
└── src/
    ├── config/
    │   └── firebase.ts              Firebase app init (Auth, Firestore, Functions, Storage)
    │
    ├── features/
    │   └── auth/
    │       ├── hooks/
    │       │   └── useAuth.ts       Auth state, custom claims parsing, login/logout/register
    │       ├── LoginPage.tsx        Email + password sign-in
    │       └── VerifyEmailPage.tsx  Teacher email verification gate
    │
    ├── routes/
    │   ├── AppRoutes.tsx            All route definitions — lazy-loaded by role
    │   ├── ProtectedRoute.tsx       Redirects unauthenticated users to /login
    │   └── RoleGuard.tsx            Redirects unauthorized roles to /unauthorized
    │
    ├── pages/
    │   ├── admin/                   Super admin + project admin
    │   │   ├── DashboardPage.tsx    Platform overview, pending actions, stats
    │   │   ├── AnalyticsPage.tsx    School-level metrics, engagement tiers, leaderboard
    │   │   ├── WordBankPage.tsx     Browse, filter, approve/reject vocabulary words
    │   │   ├── LanguageCurriculaPage.tsx  Master curriculum editor (drag-and-drop)
    │   │   ├── CurriculumReviewsPage.tsx  Approve/reject teacher curriculum edits
    │   │   ├── LicenseKeysPage.tsx  Generate, manage, and export license keys
    │   │   ├── ProjectsPage.tsx     Manage education projects
    │   │   ├── ProjectDetailPage.tsx  Project detail: schools, stats, assignment
    │   │   ├── SchoolsPage.tsx      Manage schools, link to projects
    │   │   ├── SchoolDetailPage.tsx   School detail: teachers, classes, students, filters
    │   │   └── UsersPage.tsx        View platform users, invite new users
    │   │
    │   ├── teacher/
    │   │   ├── DashboardPage.tsx    Class summary, active students, pending approvals
    │   │   ├── ClassesPage.tsx      Class roster, join codes, create class
    │   │   ├── ClassDetailPage.tsx  Class detail: students, curriculum, assignments, announcements
    │   │   ├── StudentsPage.tsx     Student list with engagement flags and at-risk indicators
    │   │   ├── StudentAnalyticsPage.tsx  Per-student metrics: streak, words, accuracy, drawing
    │   │   ├── CurriculumEditorPage.tsx  Drag-and-drop level editor + submit for review
    │   │   ├── AssignmentsPage.tsx  Create/manage MCQ assignments, view submissions
    │   │   ├── GradebookPage.tsx    Student × assignment score matrix
    │   │   ├── PracticeTrackingPage.tsx  Daily practice attendance with word breakdown
    │   │   ├── AnnouncementsPage.tsx  Post announcements to classes
    │   │   └── AnalyticsPage.tsx    Class-level engagement, top performers, at-risk students
    │   │
    │   ├── pm/
    │   │   ├── DashboardPage.tsx    Project overview: schools, active students, avg accuracy
    │   │   └── AnalyticsPage.tsx    School-level metrics scoped to project
    │   │
    │   └── principal/
    │       ├── DashboardPage.tsx    School overview: teachers, students, classes, accuracy
    │       └── AnalyticsPage.tsx    Class and teacher metrics, at-risk student detection
    │
    ├── components/
    │   ├── common/
    │   │   ├── Button.tsx           Variant: primary/secondary/ghost/danger · size: sm/md/lg
    │   │   ├── Card.tsx             Wrapper with padding and border-radius
    │   │   ├── Modal.tsx            Accessible overlay modal
    │   │   ├── Skeleton.tsx         StatCardSkeleton + RowSkeleton for phased loading
    │   │   └── ...
    │   ├── layout/
    │   │   ├── AdminLayout.tsx      Sidebar nav + badge counts for admin roles
    │   │   ├── TeacherLayout.tsx    Sidebar nav with pending student badge
    │   │   └── AppLayout.tsx        Base layout wrapper
    │   ├── admin/
    │   │   ├── CreateSchoolModal.tsx
    │   │   ├── CreateProjectModal.tsx
    │   │   ├── InviteUserModal.tsx  Calls inviteUser CF → returns password setup link
    │   │   └── CurriculumDiffViewer.tsx  Side-by-side diff of curriculum edits
    │   ├── curriculum/
    │   │   ├── LevelEditor.tsx      @dnd-kit drag-and-drop level editor
    │   │   ├── WordCard.tsx         Draggable word card with image + label
    │   │   ├── WordPickerModal.tsx  Search + multi-select from word bank
    │   │   └── SharedCurriculaDrawer.tsx  Browse approved shared curricula
    │   └── teacher/
    │       ├── CreateClassModal.tsx  3-step class creation wizard
    │       ├── PendingStudentsModal.tsx  Approve/reject pending student requests
    │       └── EditLanguagesModal.tsx  Edit class home/learning languages
    │
    ├── stores/
    │   ├── authStore.ts             user, claims, loading, needsVerification
    │   ├── teacherStore.ts          classes[], students[] — real-time Firestore listeners
    │   ├── curriculumStore.ts       words, curricula, edits, badge counts
    │   ├── assignmentStore.ts       assignments, submissions per assignment
    │   └── projectStore.ts          projects[], schools[]
    │
    ├── services/
    │   └── firebase/
    │       ├── firestore.ts         Core Firestore helpers (projects, schools, teachers, students, classes)
    │       ├── teacher.ts           Teacher-specific: createClass, generateClassCode
    │       ├── wordBank.ts          getWordBankPage, approveWord, rejectWord, uploadWordImage
    │       ├── languageCurricula.ts getLanguageCurriculum, updateLanguageCurriculum
    │       ├── curriculumEdits.ts   submitEdit, getPendingEdits, approveEdit, adoptSharedCurriculum
    │       ├── assignments.ts       createMcqAssignment, getSubmissions, closeAssignment
    │       ├── announcements.ts     createAnnouncement, getAnnouncements, pinAnnouncement
    │       ├── licenseKeys.ts       createLicenseKey, createLicenseKeysBulk, exportCSV
    │       └── motherCurriculum.ts  getMotherCurriculum (used by CreateClassModal)
    │
    └── types/
        ├── firestore.ts             TypeScript interfaces for all Firestore documents
        └── claims.ts                CustomClaims type, UserRole union
```

---

## Role-Based Access Control

Access is enforced at three layers:
1. **Firebase custom claims** — set server-side via Cloud Functions; embedded in the ID token
2. **Frontend RoleGuard** — `src/routes/RoleGuard.tsx` redirects unauthorized roles
3. **Firestore security rules** — server-side enforcement in `firestore.rules`

See [RBAC.md](RBAC.md) for the full reference including per-collection read/write permissions and Firestore rule patterns.

### Custom Claims Shape

| Role | Custom Claims |
|------|--------------|
| `admin` | `{ role: 'admin' }` |
| `projectAdmin` | `{ role: 'projectAdmin', projectId: string }` |
| `pm` | `{ role: 'pm', projectId: string }` |
| `principal` | `{ role: 'principal', schoolIds: string[] }` |
| `teacher` | `{ role: 'teacher', schoolId: string }` |
| `contentWriter` | `{ role: 'contentWriter' }` |
| `contentReviewer` | `{ role: 'contentReviewer' }` |

Claims are set via the `inviteUser` Cloud Function (admin/PM/principal/projectAdmin) or `registerTeacher` CF (teachers). The user must **sign out and sign back in** after a role change.

### Creating Users

**Admin-level roles (admin, projectAdmin, pm, principal, contentWriter, contentReviewer):**
1. Log in as super admin → Users → Invite User
2. Fill email, display name, role, and scope (projectId / schoolIds where applicable)
3. A password setup link is returned — share it with the invitee

**Teachers:**
1. Teacher visits the portal login page
2. Clicks "Register as Teacher" → enters name, email, password, school join code
3. Must verify their email before portal access is granted

---

## Pages by Role

### Admin / Project Admin

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/admin/dashboard` | Platform stats, pending word/curriculum counts, quick links |
| Analytics | `/admin/analytics` | School engagement tiers, leaderboard, churn signal |
| Word Bank | `/admin/word-bank` | Browse/filter all vocabulary; approve or reject pending submissions |
| Language Curricula | `/admin/curricula` | Master curriculum editor per language per grade (drag-and-drop levels) |
| Curriculum Reviews | `/admin/reviews` | Side-by-side diff view of teacher-submitted curriculum edits; approve or reject |
| License Keys | `/admin/license-keys` | Generate individual keys, bulk create, export CSV, revoke |
| Projects | `/admin/projects` | Create and manage educational projects; assign schools |
| Schools | `/admin/schools` | Create schools; link to projects; view school stats |
| School Detail | `/admin/schools/:id` | Per-school teachers, classes, students; filter by grade/class/activity |
| Users | `/admin/users` | View all users; invite new admin-level users |

> Project admins see only their own project's schools, word bank, and curriculum reviews.

### Teacher

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/teacher/dashboard` | Active students today, pending approvals, class health overview |
| Classes | `/teacher/classes` | All classes with join codes; create new class |
| Class Detail | `/teacher/classes/:id` | Students, curriculum tab, assignments tab, announcements |
| Students | `/teacher/students` | Student list with engagement flags, last active, streak |
| Student Analytics | `/teacher/students/:id` | Per-student: streak, words learned, quiz accuracy, drawing accuracy, level progress |
| Curriculum Editor | `/teacher/curriculum-editor` | Drag-and-drop level editor; submit proposed changes for admin review |
| Assignments | `/teacher/assignments` | Create MCQ assignments; view submission rates and scores |
| Gradebook | `/teacher/gradebook` | Colour-coded student × assignment score matrix; export CSV |
| Practice Tracking | `/teacher/practice-tracking` | Daily attendance-style view: who practiced, words done, accuracy |
| Announcements | `/teacher/announcements` | Post and pin announcements per class |
| Analytics | `/teacher/analytics` | Class engagement trends, top performers, at-risk student alerts |

### Project Manager

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/pm/dashboard` | Real-time: school count, active students (7d), avg accuracy, total classes |
| Analytics | `/pm/analytics` | School-level engagement metrics scoped to the PM's project |

### Principal

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/principal/dashboard` | Real-time: teacher count, student count, class count, avg accuracy (7d) |
| Analytics | `/principal/analytics` | Class metrics, teacher activity, at-risk student flags |

### Content Writer

| Page | Route | Description |
|------|-------|-------------|
| Word Editor | `/writer` | Create and edit vocabulary words across 6 languages; upload up to 3 images per word; submit to review queue (not direct-publish) |
| CSV Import | `/writer/import` | Bulk upload words from a CSV file; preview and validate before importing; all imports enter the review queue as pending |

### Content Reviewer

| Page | Route | Description |
|------|-------|-------------|
| Review Queue | `/reviewer` | Approve or reject pending word submissions from content writers; view all 6-language content with TTS per field; inline edit before approving; add rejection notes |

---

## Architecture

### Auth & Claims

`useAuth()` (in `src/features/auth/hooks/useAuth.ts`) wraps Firebase `onAuthStateChanged`. On every auth event it calls `getIdTokenResult(user, true)` (force-refresh) to always have the latest claims:

```typescript
const { user, claims } = useAuth();

// claims shape:
claims.role        // 'admin' | 'projectAdmin' | 'pm' | 'principal' | 'teacher'
claims.projectId   // set for projectAdmin and pm
claims.schoolIds   // set for principal (string[])
claims.schoolId    // set for teacher
```

Pages use claims to scope data:
```typescript
const isProjectAdmin = claims?.role === 'projectAdmin';
const myProjectId = claims?.projectId;

const schools = isProjectAdmin
  ? await getSchoolsInProject(myProjectId)
  : await getAllSchools();
```

### State Management

Five Zustand stores:

| Store | Real-time? | Contents |
|-------|-----------|---------|
| `authStore` | Yes (Firebase listener) | user, claims, loading, needsVerification |
| `teacherStore` | Yes (Firestore `onSnapshot`) | classes[], students[] — live updates |
| `curriculumStore` | No (one-time fetch) | words, curricula, pending counts |
| `assignmentStore` | No | assignments, submissions |
| `projectStore` | No | projects[], schools[] |

### Analytics Visibility Controls

Super admins can control which analytics sections are visible to each role, project, or individual user in real time via **Admin → Analytics Controls**.

Resolution order (most specific wins): **user override > project override > role default**

```
analyticsVisibility/{role}           ← role defaults (pm, principal, projectAdmin, teacher)
analyticsVisibility/project:{id}     ← project-level override
analyticsVisibility/user:{uid}       ← per-user override
```

The `useAnalyticsVisibility({ role, projectId?, uid? })` hook subscribes to all three levels via `onSnapshot` and merges them automatically. Sections that don't have an explicit override show as "inherited" in the admin UI.

Available sections: `overviewStats`, `engagementMetrics`, `studentTable`, `teacherTable`, `gradeDistribution`, `gamification`, `atRiskStudents`, `hardestWords`, `assignmentMetrics`.

### Content Pipeline

Words flow through a review pipeline before reaching students:

```
Content Writer → wordBank (status: pending)
                     ↓
         Content Reviewer / Admin reviews
                     ↓
              Approved → status: active → appears in student app
              Rejected → status: rejected → writer notified via rejectionNote
```

Each word supports up to **3 images** (`imageUrls[]`) and content across 6 languages (te, en, hi, mr, es, fr). Bulk uploads are supported via CSV import.

**CSV format:**
```
word_te, word_en, word_hi, word_mr, word_es, word_fr,
pronunciation_te..fr, meaning_te..fr, sentence_te..fr,
wordType, difficulty
```

### Analytics Architecture

Analytics pages use **phased loading** — data appears progressively without blocking the entire UI:

```
Phase 1 (immediate): load schools / projects / students in parallel
    → stat cards render
Phase 2 (after Phase 1): load class details, teacher data
    → table rows render
Phase 3 (after Phase 2): load engagement data, leaderboard
    → charts and ranked lists render
```

Engagement metrics are computed **client-side** from already-loaded student docs — no extra Firestore reads:
- Active today / last 7 days (from `analytics.lastStudyDate`)
- Average streak (`analytics.streakDays`)
- Total words learned (`analytics.totalWordsLearned`)
- Quiz accuracy (`analytics.averageAccuracy`)
- Engagement tier: **High** ≥70% active · **Medium** 30–70% · **Low** <30%

Nightly stats (`schools/{id}/stats/{date}`, `projects/{id}/stats/{date}`) are written by the `aggregateDaily` Cloud Function (02:00 UTC) and power the "hardest words" and accuracy trend views.

### Curriculum System

```
wordBank/{wordId}                 ← source of all vocabulary
         ↓
languageCurricula/{lang}_g{grade} ← master curriculum (admin-editable)
         ↓
classes/{id}.customCurriculum     ← teacher override (optional)
         ↓
curriculumEdits/{editId}          ← teacher proposes → admin approves
```

**Teacher flow:**
1. Teacher opens Curriculum Editor → sees active curriculum for their class (custom or master)
2. Drags words between levels using `@dnd-kit`
3. Clicks "Submit for Review" → creates a `CurriculumEditDoc` in Firestore
4. Admin sees the edit in Curriculum Reviews with a side-by-side diff
5. Approval writes `customCurriculum` to the class doc

**DnD implementation notes:**
- Uses `PointerSensor` with 5px activation distance (distinguishes clicks from drags)
- Word card action buttons (`×`, edit) are positioned as `absolute` corner overlays — not full-card overlays — so they don't block pointer events for the DnD sensor

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users/{uid}` | Auth profile, kidType, homeLanguage, analytics |
| `students/{uid}` | Student mirror: name, grade, classId, analytics, schoolId |
| `teachers/{uid}` | Teacher profile: name, email, schoolId, projectId |
| `classes/{id}` | Class: studentIds, pendingStudentIds, teacherId, schoolId, grade, language |
| `schools/{id}` | School: name, code, projectId, teacherIds |
| `projects/{id}` | Project: name, description, schoolIds |
| `wordBank/{id}` | Vocabulary: status(active/pending/rejected), wordType, imageUrls[], all language fields |
| `analyticsVisibility/{docId}` | Analytics section toggles — role defaults (`pm`, `teacher`, …), project overrides (`project:{id}`), user overrides (`user:{uid}`) |
| `languageCurricula/{lang}_g{n}` | Master curriculum levels per language per grade |
| `curriculumEdits/{id}` | Teacher edit proposals: proposedLevels, pendingWordIds, status |
| `mcqAssignments/{id}` | MCQ assignments: questions, dueDate, totalPoints, status |
| `studentAssignments/{uid}/submissions/{id}` | Student answers + score per assignment |
| `announcements/{id}` | Class announcements: title, body, pinned |
| `licenseKeys/{id}` | Keys: grade, language, status, usedBy, expiresAt |
| `learningAttempts/{id}` | Per-session records: studentUid, classId, schoolId, projectId, date, accuracy |
| `schools/{id}/stats/{date}` | Nightly school aggregated stats |
| `projects/{id}/stats/{date}` | Nightly project aggregated stats |
| `students/{uid}/stats/{date}` | Daily per-student stats |
| `wordProgress/{uid}/words` | Per-word progress subcollection |

---

## Services (Firebase Query Layer)

All Firestore access goes through `src/services/firebase/`. Never call Firestore directly from components.

### Key functions

```typescript
// firestore.ts — core
getSchoolsInProject(projectId)       // schools where projectId == x
getClassesBySchool(schoolId)         // classes where schoolId == x
getTeachersBySchool(schoolId)        // teachers via school.teacherIds
getSchoolStats(schoolId, days)       // schools/{id}/stats/ subcollection
getLearningAttemptsByProject(projectId, days)  // learningAttempts scoped to project

// wordBank.ts
getWordBankPage(filters?, lastDoc?, pageSize)  // paginated, filtered
approveWord(wordId, adminUid)
rejectWord(wordId, adminUid, note)

// curriculumEdits.ts
getPendingEdits(projectId?)          // scoped to project for projectAdmin
approveCurriculumEdit(editId, adminUid)
adoptSharedCurriculum(classId, editId, resolvedLevels)

// assignments.ts
createMcqAssignment(data)
getSubmissionsForAssignment(assignmentId)

// licenseKeys.ts
createLicenseKeysBulk(count, grade, language, adminUid)
exportLicenseKeysCSV(keys)          // client-side CSV download
```

---

## Commands Reference

```bash
# ── Development ─────────────────────────────────────────────────────────────
npm run dev                     # local dev server (localhost:5173)
npm run build                   # production build → dist/
npx tsc --noEmit                # TypeScript check

# ── Deployment ──────────────────────────────────────────────────────────────
npm run deploy:hosting          # build + deploy to Firebase Hosting
firebase deploy --only hosting  # deploy existing dist/ to Hosting

# ── Firebase ────────────────────────────────────────────────────────────────
firebase login                  # authenticate
firebase login --reauth         # re-authenticate if token expired

# ── Cloud Functions (deployed from Chitram_UI/functions/) ───────────────────
cd ../Chitram_UI/functions
firebase deploy --only functions

# ── Firestore Rules (deployed from Chitram_UI/) ─────────────────────────────
cd ../Chitram_UI
firebase deploy --only firestore
```

---

## Deployment

### Firebase Hosting

```bash
npm run deploy:hosting
# Equivalent to: npm run build && firebase deploy --only hosting
```

SPA routing is handled by a catch-all rewrite in `firebase.json`:
```json
{
  "hosting": {
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

**Live URL:** https://chitram-51e22.web.app

### Cloud Functions

Cloud Functions live in `Chitram_UI/functions/src/index.ts` — deploy from there:
```bash
cd /path/to/Chitram_UI/functions
firebase deploy --only functions
```

Both portals share the same deployed functions.

---

## Version Control

See [VERSION_CONTROL.md](VERSION_CONTROL.md) for the full branching strategy, commit message conventions, semantic versioning, PR workflow, and deployment pipeline.

**Quick reference:**
```bash
# Branch naming
feature/gradebook-export-csv
fix/pm-dashboard-hardcoded-stats
hotfix/invite-user-modal-broken

# Commit format (Conventional Commits)
feat(portal): wire InviteUserModal to inviteUser Cloud Function
fix(portal): fetch teacher schoolId from Firestore on ClassesPage mount
docs: add comprehensive RBAC and version control documentation
deploy(functions): extend inviteUser CF to support projectAdmin role
```

---

## Security

- **Firestore rules** enforce server-side access control — see `Chitram_UI/firestore.rules`
- **Custom claims** scope all client queries — projectAdmins and teachers never read outside their scope
- **Cloud Functions** validate auth + claims before every write
- **Service account keys** are never committed — use `firebase login` for local dev
- **`.env` files** are git-ignored — no secrets in the repo

### Key Firestore Rule Patterns

```javascript
// Admin full access
allow read, write: if isAdmin();

// projectAdmin scoped to their project
allow write: if isAdmin() ||
  (isProjectAdmin() && resource.data.projectId == request.auth.token.projectId);

// Teacher scoped to their own classes
allow write: if isAdmin() ||
  (isTeacher() && resource.data.teacherId == request.auth.uid);

// Principal read-only to their schools
allow read: if isAdmin() || isPrincipal() &&
  resource.data.schoolId in request.auth.token.schoolIds;
```

---

## Troubleshooting

### Login succeeds but wrong pages load / access denied
Custom claims aren't refreshed until a new ID token is issued. **Sign out and sign back in** to force a token refresh.

### Teacher can't create a class (button disabled)
The teacher's `schoolId` couldn't be fetched from `teachers/{uid}`. Check:
- The teacher doc exists at `teachers/{uid}`
- The `schoolId` field is set (not null/empty)
- The teacher is in the school's `teacherIds` array

### Invite User: role not supported error
The `inviteUser` Cloud Function validates the role server-side. Supported roles: `admin`, `projectAdmin`, `pm`, `principal`, `contentWriter`, `contentReviewer`. Teachers self-register with a school code — do not invite them via this form.

### Word Bank shows no words
Check:
- `wordBank` collection exists in Firestore
- Words have `status: 'active'` (or `'pending'` for the Pending tab)
- Run `node scripts/seed-wordbank.mjs` to seed initial words

### Curriculum Editor drag not working
The `PointerSensor` requires a minimum 5px move before activating. If dragging feels unresponsive:
- Check that action buttons (× remove) are not covering the card area
- Confirm `@dnd-kit/core` and `@dnd-kit/sortable` are installed

### Firebase hosting deploy shows stale content
Clear the Firebase Hosting cache:
```bash
npm run build
firebase deploy --only hosting
```
The `.firebase/hosting.ZGlzdA.cache` file tracks what was last deployed — it's safe to commit.

### Analytics page shows 0 for accuracy / empty hardest words
The "hardest words" and accuracy stats depend on `schools/{id}/stats/{date}` docs written by the `aggregateDaily` Cloud Function. If the function hasn't run yet (or no students have practiced), these will be empty. Check:
- Cloud Function is deployed: `firebase deploy --only functions`
- At least one `learningAttempts` doc exists with a `schoolId` field
