# Chitram — Version Control Guide

Last updated: April 2026  
Applies to: `Chitram_Management` (this repo) and `Chitram_UI`

---

## 1. Branch Strategy (GitHub Flow)

```
main              ← always deployable; protected branch
  │
  ├── feature/<name>     ← new features and non-urgent fixes
  ├── fix/<name>         ← bug fixes
  └── hotfix/<name>      ← urgent production fixes (branch off main, merge back fast)
```

- `main` is the single source of truth. Every merge to `main` should be deployable.
- Never commit directly to `main`. All changes go through a feature branch + PR.
- Delete branches after merge.

---

## 2. Branch Naming Conventions

```
feature/pm-dashboard-real-data
feature/invite-user-modal
feature/gradebook-page
fix/classes-schoolid-hardcode
fix/button-width-bug
hotfix/auth-token-expired-v1.2.1
release/v1.3.0
```

**Rules:**
- All lowercase, hyphens only (no underscores, no spaces)
- Keep names short but descriptive — describe the *what*, not the *who*
- `release/` branches are optional — only needed when stabilising a multi-feature release before tagging

---

## 3. Commit Message Convention (Conventional Commits)

```
<type>(<scope>): <short description>

[optional body]
```

### Types
| Type | When to use |
|---|---|
| `feat` | New feature or page |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behaviour change |
| `docs` | Documentation only |
| `chore` | Dependency updates, config changes, file moves |
| `deploy` | Deployment-related (function deploy, hosting deploy) |
| `style` | Formatting, Tailwind changes with no logic change |

### Scopes
| Scope | Applies to |
|---|---|
| `portal` | Chitram_Management web app |
| `mobile` | Chitram_UI React Native app |
| `functions` | Firebase Cloud Functions |
| `rules` | Firestore security rules |
| `docs` | Documentation files |

### Examples
```
feat(portal): replace PM dashboard hardcoded stats with real Firebase data
fix(portal): fetch teacher schoolId from Firestore instead of hardcoded string
feat(functions): extend inviteUser CF to support projectAdmin role
fix(mobile): capture drawing path before clearing ref to avoid React batching issue
deploy(functions): deploy inviteUser + registerTeacher CFs
docs: add RBAC permission matrix and version control guide
chore(portal): upgrade Framer Motion to v11
```

---

## 4. Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

| Increment | When |
|---|---|
| `MAJOR` | Breaking change (database schema migration, auth flow change, removal of feature) |
| `MINOR` | New feature, new page, new Cloud Function (backwards-compatible) |
| `PATCH` | Bug fix, style fix, copy change |

### Tagging Convention
Tags are prefixed by component to allow independent versioning:

```
mobile-v1.2.0     ← React Native app (syncs with EAS build number)
portal-v1.2.0     ← Management web app
functions-v1.2.0  ← Cloud Functions
```

Tag after a release group is merged and deployed:
```bash
git tag portal-v1.3.0
git push origin portal-v1.3.0
```

---

## 5. Pull Request Workflow

1. **Create branch** off `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/my-feature
   ```

2. **Develop and commit** using Conventional Commits format

3. **TypeScript check** before opening PR:
   ```bash
   npx tsc --noEmit
   ```

4. **Open PR** to `main`:
   - Title: use Conventional Commits format (`feat(portal): ...`)
   - Description: what changed, why, how to test
   - Screenshots for any UI changes

5. **Review** — at least 1 approval required (or self-review for solo work; still use PRs for history)

6. **Merge with Squash and merge** — keeps `main` history clean (one commit per feature)

7. **Delete branch** after merge (GitHub does this automatically if configured)

8. **Tag** if this completes a release:
   ```bash
   git tag portal-v1.x.x && git push origin portal-v1.x.x
   ```

---

## 6. Deployment Pipeline

```
Feature branch
      │
      ▼
  PR → TypeScript check passes
      │
      ▼
  Squash merge to main
      │
      ├─── Portal ──────────────────────────────────────────────┐
      │    npm run build                                         │
      │    firebase deploy --only hosting                        │
      │    → https://chitram-51e22.web.app                       │
      │                                                          │
      ├─── Cloud Functions ─────────────────────────────────────┤
      │    cd functions && firebase deploy --only functions      │
      │                                                          │
      ├─── Firestore Rules/Indexes ─────────────────────────────┤
      │    firebase deploy --only firestore                      │
      │                                                          │
      └─── Mobile (on demand) ──────────────────────────────────┘
           eas build --platform android --profile preview
           → APK available at expo.dev
```

**Deployment is manual** — there is no automated CI/CD pipeline yet. Run deploy commands after every merge to `main` that affects the relevant component.

---

## 7. Protected Branch Rules

Apply these in **GitHub → Repository Settings → Branches → Add rule** for `main`:

- [x] Require a pull request before merging
- [x] Require at least 1 approval
- [x] Do not allow bypassing the above settings
- [x] Require status checks to pass (add TypeScript check via GitHub Actions when set up)
- [ ] Do not allow force pushes to `main`

---

## 8. .gitignore Hygiene

The following must never be committed:

| File | Why |
|---|---|
| `.env` | Contains `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| `google-services.json` | Firebase Android config with API keys |
| `GoogleService-Info.plist` | Firebase iOS config |
| `scripts/serviceAccountKey.json` | Admin SDK private key — full Firestore access |
| `node_modules/` | Dependencies — always reinstall from `package.json` |
| `*.apk` / `*.aab` | Large build artifacts — use EAS builds instead |
| `dist/` | Portal production build — regenerated on deploy |

If a secret is accidentally committed, rotate it immediately in Firebase Console / Google Cloud Console.

---

## 9. Hotfix Process

For critical production bugs (auth broken, data loss risk):

```bash
git checkout main && git pull
git checkout -b hotfix/describe-the-bug

# Fix, test, commit
git commit -m "fix(portal): describe the fix"

# Open PR, get reviewed (or self-merge if truly urgent), deploy immediately
firebase deploy --only functions   # if CF changed
npm run deploy:hosting             # if portal changed

# Tag
git tag portal-v1.x.x-hotfix && git push origin portal-v1.x.x-hotfix
```

---

## 10. Monorepo Note

Chitram has two separate repos sharing one Firebase project (`chitram-51e22`):

| Repo | URL | Deploy command |
|---|---|---|
| `Chitram_UI` | github.com/shashank-sk17/Chitram-UI | `eas build --platform android --profile preview` |
| `Chitram_Management` | github.com/shashank-sk17/Chitram-Management | `npm run deploy:hosting` |

Cloud Functions live in `Chitram_UI/functions/` and are deployed from there: `cd functions && firebase deploy --only functions`. Both repos consume the same deployed functions.

When a change touches both repos (e.g., a new Cloud Function + a portal page that calls it), open separate PRs in each repo and coordinate their merges/deploys.
