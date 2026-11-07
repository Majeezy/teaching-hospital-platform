# HSPS: the original project this one grew out of

This project has a predecessor. Before there was a Next.js app with
Prisma and role-based permissions, there was **HSPS (Hospital & Student
Portal System)** — a university group project built in PHP for "IT
Project 700" (BSc in IT, Semester 2, Phase 1 submitted 2023-08-29) by a
six-person team, with Kudzaishe Majeza (this repo's author) among them.
This document exists so that connection is on the record, not just in
someone's memory — and because the gap between what HSPS's own
requirements document asked for and what actually shipped turned out to
be the real blueprint for this project.

**HSPS itself isn't in this repository.** This is a description of it,
written from its surviving project files (PHP source, database dump, the
team's own phase deliverables) — not a port, not a copy, nothing here
runs HSPS's code.

## What it was

The team's own Phase 1 pitch: *"Hospital and student (Resident) portal
system (HSPS)... designed for medical educators, medical students,
medical professionals, and medical patients... integrating a student
portal into a hospital management system to offer residents a
real-world experience into patient diagnosis and care."*

That's the same core idea this project still has — a hospital system and
a medical-student system sharing one backend — stated independently,
years apart.

The project ran across five phases, which were academic milestones, not
calendar time: Phase 1 (proposal — intro, aim, problem definition,
hypothesis, objectives), Phase 2 (planning — feasibility study,
scheduling, a full Software Requirements Specification, data models),
Phases 3–4 (design/build iterations, where module screenshots start
appearing in the deliverables), and Phase 5 (final — testing summary,
conclusion, a PowerPoint presentation).

## What the requirements asked for, vs. what shipped

This is the single most useful fact to come out of reading HSPS's own
documents. Phase 2's Software Requirements Specification (§2.6) asked
for, among other things:

- Role-based access control
- Electronic health records
- **"Clinical Experience Tracking: Log and track clinical experiences,
  procedures, and patient interactions. Supervisors can verify and
  provide feedback on student experiences."**
- Secure/encrypted messaging
- Notifications
- Reporting/analytics

None of that made it into the PHP code that actually shipped. The real
HSPS app has four isolated login forms (admin/doctor/patient/resident),
no foreign keys between any of its tables, no clinical records of any
kind, no messaging, no notifications, and no meaningful distinction
between a doctor's and a resident's capabilities — they're near-identical
file trees with nothing modeling supervision at all. A specified feature
that never got built isn't a surprising outcome for a one-semester
student team project; it's normal. What's notable is how closely it maps
onto this project's own feature list, built independently:

| HSPS's SRS asked for (2023, never shipped) | This project actually has |
|---|---|
| Role-based access control | `lib/permissions.ts` + per-request DB-fresh `isActive`/role checks |
| Electronic health records | Typed clinical records (`ClinicalNote`, `Diagnosis`, `Prescription`, `TestOrder`/`TestResult`) |
| Clinical experience tracking with supervisor feedback | Shadowing assignments, learning activities, a calculated clinical logbook, competency assessments (Phase 2 of this project) |
| Secure messaging | Relationship-scoped internal messaging (Phase 3 Stage 2) |
| Notifications | In-app notifications (Phase 3 Stage 1) |
| Reporting/analytics | Role dashboards, audit logging |

This project isn't a rewrite of HSPS's code — it shares no code, no
schema, no framework. It's closer to: the same idea, pitched the same
way, finally built out to the scope the original proposal described.

## Tech stack

Plain procedural PHP, no framework, no Composer — `mysqli_*` calls
directly, PHP sessions for auth state. MySQL via WAMP (MyISAM tables,
`latin1` charset). Bootstrap 4.5.2 and jQuery pulled in from a CDN, no
bundler or build step. The team's own build notes (a file literally named
`NOTE`, not a README) read as a step-by-step tutorial written while
building the admin login feature from an empty folder — Sublime Text,
WAMP, phpMyAdmin for schema creation, CDN `<script>` tags, raw SQL
queries. It's genuinely useful as a record of how a team new to web
development actually works through a feature, which is a different kind
of documentation than this repository's, but a real one.

## Data model

`hsps.sql` defines six tables, **no foreign keys at all**:

- `admin` — id, username, password, profile
- `doctors` — id, firstname, surname, username, email, gender, phone,
  qualification, password, date_reg, `status` (Pending/Approved/Rejected)
- `patient` — id, firstname, surname, username, email, phone, gender,
  password, date_reg, profile
- `appointment` — id, firstname, surname, gender, phone,
  appointment_date, symptoms, status, date_booked
- `income` — id, doctor, patient, date_discharge, amount_paid,
  description
- `report` — id, title, message, username, date_send

Relationships are all implicit, matched by re-entering a name as a plain
string rather than referencing an id — an appointment isn't linked to a
patient row, it just has its own `firstname`/`surname`/`phone` fields
typed in again; `income.patient` and `income.doctor` are name strings,
not foreign keys. `residentlogin.php` queries a `residents` table that
doesn't exist anywhere in the schema dump — the SQL file shipped out of
sync with the code that depended on it.

## Roles and modules

Four isolated login forms (`adminlogin.php`, `doctorlogin.php`,
`patientlogin.php`, `residentlogin.php`), each gating its own session
variable (`$_SESSION['admin']`, etc.) — no shared user table, no unified
RBAC, each role is its own silo. Doctor and resident applications go
through an admin-approval workflow (`apply.php`/`applyrez.php` →
`admin/job_request*.php` → AJAX approve/reject endpoints) that gates
login on the `status` column.

- **Admin**: manage administrators, approve/reject doctor and resident
  applications, view all patients/doctors/residents, an income ledger,
  reports.
- **Doctor** and **Resident**: near-identical capabilities — dashboard,
  appointments, discharge-a-patient (which records an income row),
  patient list, profile. Nothing in the code models a
  supervisor/student relationship between them, despite that being the
  entire premise of the original proposal's title.
- **Patient**: dashboard, book an appointment (pre-filled from their own
  profile), view invoices, profile.

(Full per-screen inventory, from the team's own screenshots: each role
folder had Dashboard/Login/Profile screens plus role-specific ones —
Admin added approval-queue and total-count views; Doctor/Resident added
appointment/invoice/patient-detail and a two-step registration flow;
Patient added its own appointment and invoice views.)

## Honestly: the security gap

This is worth stating plainly rather than skipping past, the same way
this project's own `docs/architecture.md` documents its own gaps rather
than hiding them. By today's standards, and even by the standards this
project holds itself to, HSPS's auth is not safe to expose to the
internet:

- **Plaintext passwords**, both stored and compared directly in SQL
  (`WHERE username='$username' AND password='$password'`) — no hashing
  anywhere.
- **SQL injection** — login and lookup queries interpolate `$_POST`
  values straight into SQL strings, with no escaping and no prepared
  statements.
- No CSRF protection, no rate limiting, no password reset flow at all.

None of this is a criticism of the team — it's exactly what a first
real group project in PHP looks like, and it's precisely the kind of
gap a few more years of practice closes. It's also a fairly direct
measure of the distance between the two projects: this one has
timing-safe credential comparison, bcrypt hashing, parameterized queries
via Prisma, CSP/HSTS headers, and — as of its own Phase 6 — rate
limiting on login and registration specifically because that gap is
worth taking seriously now.

## What isn't reproduced here

HSPS's PHP source, database dump, screenshots, and the team's Phase 1–5
project documents (proposal, SRS, design iterations, Gantt/PERT charts,
final presentation) live only in the original project folder, not in
this repository. This document is a description of them, not a copy.
