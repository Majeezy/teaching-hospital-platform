# Teaching Hospital Platform

A simulated hospital management system and medical-student clinical-education
platform, sharing one backend, one database, and one role-based permission
model, by [Kudzaishe Majeza](https://github.com/Majeezy).

**This is a portfolio/educational project.** All data is fictional. It is
not intended for real patient data, real diagnoses, or any real clinical
use — see [Section 10 of the architecture doc](docs/architecture.md#10-security-architecture)
for more on that boundary.

**Live demo:** [teaching-hospital-platform.vercel.app](https://teaching-hospital-platform.vercel.app)
— sign in with the demo admin account below, or register as a patient.

**Status:** 🚧 Phases 0–4 complete. Phase 5 (visual identity & production
readiness) in progress, Stage 2.

## Database

PostgreSQL via [Neon](https://neon.tech). The runtime app connects through
Neon's pooled endpoint using `@prisma/adapter-pg`; the Prisma CLI
(migrations, seeding) uses the direct endpoint, configured in
`prisma.config.ts` rather than `schema.prisma` (a Prisma 7 change).

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
Deliberate scope cuts (no file uploads, no self-service password reset,
no rate limiting, etc.) are listed explicitly in that document's
[Known limitations](docs/architecture.md#known-limitations) section.

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- PostgreSQL (Neon) + Prisma
- Auth.js (Credentials provider, JWT sessions with DB-checked revocation, bcrypt)
- shadcn/ui, Recharts
- Vitest + Playwright
- Deployed on [Vercel](https://teaching-hospital-platform.vercel.app)

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your own Neon connection strings
npx prisma migrate dev       # applies the schema to your database
npx prisma db seed           # seeds roles, departments, competency catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo admin account** (seeded, fictional — not a real credential, don't
reuse this password anywhere real): `admin@teachinghospital.test` /
`DemoAdmin123!`. Staff and student accounts are provisioned by an admin,
not self-registered — sign in with this account and use `/admin/staff` or
`/admin/students` to create them.

## Testing

```bash
npm test
```

Unit tests (`tests/unit/`) cover the pure authorization logic in
`lib/permissions.ts`. Integration tests (`tests/integration/`) run against
the real development database — same connection as the app itself — and
clean up after themselves. No mocking the database: these tests exist
specifically to catch real authorization bugs ("can a patient deactivate
another user?"), which a mocked Prisma client can't meaningfully verify.

```bash
npm run test:e2e
```

End-to-end tests (`tests/e2e/`, Playwright) drive a real, built app in a
real browser through its critical journeys — login, a patient booking and
a doctor completing an appointment with clinical records, a supervisor
assigning shadowing through to a student's reflection and feedback, and
admin account provisioning including a password reset. These exist for
what the tests above structurally can't catch: a button whose `onClick`
silently does nothing, a crash that only happens in a browser console.
Runs against `next build && next start`, not `next dev` — real Neon
network latency is generous-timeout territory here too, same reasoning as
the integration tests.

## Build log

- [x] Phase 0, Stage 1 — Project setup, GitHub + Vercel pipeline
- [x] Phase 0, Stage 2 — Database schema (Prisma + Neon)
- [x] Phase 0, Stage 3 — Authentication
- [x] Phase 0, Stage 4 — Core RBAC + audit logging
- [x] Phase 1, Stage 1 — Dashboard shell + Department management
- [x] Phase 1, Stage 2 — Staff management
- [x] Phase 1, Stage 3 — Patient management
- [x] Phase 1, Stage 4 — Appointments
- [x] Phase 1, Stage 5 — Clinical records
- [x] Phase 1, Stage 6 — Role dashboards
- [x] Phase 2, Stage 1 — Student management
- [x] Phase 2, Stage 2 — Clinical placements
- [x] Phase 2, Stage 3 — Shadowing
- [x] Phase 2, Stage 4 — Learning activities, reflections & feedback
- [x] Phase 2, Stage 5 — Clinical logbook & competency tracking
- [x] Phase 2, Stage 6 — Student dashboard
- [x] Phase 3, Stage 1 — Notifications
- [x] Phase 3, Stage 2 — Internal messaging
- [x] Phase 3, Stage 3 — Search
- [x] Phase 3, Stage 4 — Dashboard polish (Nurse dashboard)
- [x] Phase 4, Stage 1 — Admin-assisted password reset
- [x] Phase 4, Stage 2 — Security review & hardening
- [x] Phase 4, Stage 3 — E2E tests (Playwright)
- [x] Phase 4, Stage 4 — UI/UX polish
- [x] Phase 4, Stage 5 — Deployment hardening
- [x] Phase 4, Stage 6 — Finish docs
- [x] Phase 5, Stage 1 — Design tokens foundation (palette, type, dark mode)
- [x] Phase 5, Stage 2 — Public-facing pages
- [ ] Phase 5, Stage 3 — Dashboard shell
- [ ] Phase 5, Stage 4 — Dashboards & data surfaces
- [ ] Phase 5, Stage 5 — Forms & dialogs
- [ ] Phase 5, Stage 6 — Final pass & accessibility re-check

Phases 0–4 (the original scope) are complete. Phase 5 (visual identity and
movement toward production readiness) is in progress. See
`docs/architecture.md` for what each phase actually contains.
