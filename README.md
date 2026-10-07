# Teaching Hospital Platform

A simulated hospital management system and medical-student clinical-education
platform, sharing one backend, one database, and one role-based permission
model, by [Kudzaishe Majeza](https://github.com/Majeezy).

**This is a portfolio/educational project.** All data is fictional. It is
not intended for real patient data, real diagnoses, or any real clinical
use — see `docs/security.md` (coming in Phase 0) for more on that boundary.

**Status:** 🚧 In active development — Phase 0 (Foundations).

## What this is

Two connected halves:

1. **Hospital management** — patients, doctors, appointments, departments,
   clinical notes, diagnoses, prescriptions, test results.
2. **Medical student education** — placements, clinical shadowing (scoped,
   read-only access to specific appointments), learning activities,
   reflections, supervisor feedback, competency tracking, a logbook computed
   from real records.

The two connect through one relationship: a student can be assigned to
shadow a specific doctor's appointment with explicitly scoped access — never
unrestricted access to a patient's full record.

Full design rationale, the entity-relationship diagram, the permissions
matrix, and the roadmap live in [`docs/architecture.md`](docs/architecture.md).

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- PostgreSQL (Neon) + Prisma
- Auth.js (database sessions, bcrypt-hashed credentials)
- shadcn/ui, Recharts
- Vitest + Playwright
- Deployed on Vercel

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build log

- [x] Phase 0, Stage 1 — Project setup, GitHub + Vercel pipeline
- [ ] Phase 0, Stage 2 — Database schema (Prisma + Neon)
- [ ] Phase 0, Stage 3 — Authentication
- [ ] Phase 0, Stage 4 — Core RBAC + audit logging
- [ ] Phase 1 — Hospital core (staff, patients, appointments, clinical records, dashboards)
- [ ] Phase 2 — Education platform (students, placements, shadowing, learning activities, competencies)
- [ ] Phase 3 — Cross-cutting (notifications, search)
- [ ] Phase 4 — Harden & ship (security review, E2E tests, polish, deploy, docs)

See `docs/architecture.md` for what each phase actually contains.
