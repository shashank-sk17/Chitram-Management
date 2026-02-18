# Chitram Management (Web)

React web application for managing the Chitram vocabulary learning platform.

## ✅ Phase 1: Foundation - COMPLETE

**Built:** Vite + React + TypeScript project with Tailwind CSS, Firebase, Zustand, React Router, and Framer Motion.

**Design System:** 100% parity with mobile app - Baloo 2 fonts, exact colors (#7C81FF primary, #FF9B24 accent, #00BBAE secondary), spacing, shadows, and spring animations.

**Authentication:** Custom claims-based role system (Admin, Project Admin, PM, Principal, Teacher) with Firebase Auth and role-based route guards.

**Components:** Button (6 variants, 3 sizes), Card, Modal (spring animations), Avatar - all matching mobile exactly.

## 🚀 Quick Start

```bash
npm install
npm run dev        # Start dev server
npm run build      # Build for production
npx tsc --noEmit   # Type check
```

## 📁 Structure

```
src/
├── components/common/     # Button, Card, Modal, Avatar
├── config/firebase.ts     # Firebase config (same as mobile)
├── features/auth/         # Auth hooks & login
├── pages/                 # Login, Teacher/Admin dashboards
├── routes/                # Routing & role guards
├── stores/authStore.ts    # Zustand auth state
├── theme/                 # Design tokens & animations
└── types/                 # TypeScript types
```

## 🎯 Next Phases

- **Phase 2:** Admin features (projects, schools, user invites)
- **Phase 3:** LMS (curriculum, word creation, AI services)
- **Phase 4:** Teacher features (classes, students, analytics)
- **Phase 5:** PM/Principal dashboards
- **Phase 6:** Polish, testing, deployment

## 🔒 Security

- Custom claims for roles
- Firestore rules enforce permissions
- Role guards **hide** unauthorized UI (not error on action)
- Server-side validation in Cloud Functions

## 📱 Mobile Compatibility

Shares same Firebase backend with Chitram mobile app:
- ✅ No breaking changes
- ✅ Backward compatible schema
- ✅ Identical design language

---

Built for Next Skills 360
