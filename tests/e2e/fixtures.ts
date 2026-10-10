import { config } from "dotenv";

// Playwright's own test runner, not Vitest's setupFiles -- loaded here
// because this file's static imports (lib/prisma, lib/password) run
// before any top-level code in files that import it, same reasoning as
// tests/setup.ts.
config({ path: ".env.local" });

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export const E2E_PASSWORD = "E2ETestPassword123!";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page, currentUserName: string) {
  await page.getByRole("button", { name: new RegExp(currentUserName) }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Every account created through these helpers is tagged with this
 * prefix in its email, so cleanupE2EData() can find and remove exactly
 * what a test run created without needing to track ids across
 * Playwright's separate worker processes.
 */
export function e2eEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teachinghospital.test`;
}

export async function createE2EPatient(name: string) {
  const email = e2eEmail("patient");
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const patientRole = await prisma.role.findUniqueOrThrow({
    where: { name: "PATIENT" },
  });
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles: { create: { roleId: patientRole.id } },
      patientProfile: { create: { dateOfBirth: new Date("1990-01-01") } },
    },
    include: { patientProfile: true },
  });
  return { ...user, email };
}

export async function createE2EDoctor(
  name: string,
  options: { canSupervise?: boolean } = {},
) {
  const email = e2eEmail("doctor");
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const [doctorRole, department] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "DOCTOR" } }),
    prisma.department.findFirstOrThrow(),
  ]);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles: { create: { roleId: doctorRole.id } },
      doctorProfile: {
        create: {
          departmentId: department.id,
          specialization: "General",
          licenseNumber: `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          canSupervise: options.canSupervise ?? false,
        },
      },
    },
    include: { doctorProfile: true },
  });
  return { ...user, email, department };
}

export async function createE2EStudent(name: string) {
  const email = e2eEmail("student");
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const studentRole = await prisma.role.findUniqueOrThrow({
    where: { name: "STUDENT" },
  });
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles: { create: { roleId: studentRole.id } },
      studentProfile: {
        create: {
          studentNumber: `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          university: "University of Testing",
          yearOfStudy: 3,
          program: "MBChB",
        },
      },
    },
    include: { studentProfile: true },
  });
  return { ...user, email };
}

export async function createE2EAdmin(name: string) {
  const email = e2eEmail("admin");
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "HOSPITAL_ADMIN" },
  });
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  return { ...user, email };
}

export async function createE2EPlacement(
  studentProfileId: string,
  supervisorProfileId: string,
  departmentId: string,
) {
  return prisma.studentPlacement.create({
    data: {
      studentId: studentProfileId,
      departmentId,
      supervisorId: supervisorProfileId,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: "ACTIVE",
    },
  });
}

/**
 * Removes every row this suite's helpers could have created for the
 * given user ids, in FK-safe order. Call from each spec's
 * `test.afterAll` with every user id the spec created.
 */
export async function cleanupE2EUsers(userIds: string[]) {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return;

  await prisma.feedback.deleteMany({
    where: { OR: [{ givenById: { in: ids } }, { givenToId: { in: ids } }] },
  });
  await prisma.studentReflection.deleteMany({
    where: { student: { userId: { in: ids } } },
  });
  await prisma.learningActivity.deleteMany({
    where: {
      OR: [
        { student: { userId: { in: ids } } },
        { supervisor: { userId: { in: ids } } },
      ],
    },
  });
  await prisma.clinicalLogbookEntry.deleteMany({
    where: { student: { userId: { in: ids } } },
  });
  await prisma.shadowingAssignment.deleteMany({
    where: {
      OR: [
        { student: { userId: { in: ids } } },
        {
          appointment: {
            OR: [
              { doctor: { userId: { in: ids } } },
              { patient: { userId: { in: ids } } },
            ],
          },
        },
      ],
    },
  });
  await prisma.testResult.deleteMany({
    where: { testOrder: { appointment: { OR: [
      { doctor: { userId: { in: ids } } },
      { patient: { userId: { in: ids } } },
    ] } } },
  });
  await prisma.testOrder.deleteMany({
    where: {
      OR: [
        { appointment: { doctor: { userId: { in: ids } } } },
        { appointment: { patient: { userId: { in: ids } } } },
      ],
    },
  });
  await prisma.prescription.deleteMany({
    where: { appointment: { OR: [
      { doctor: { userId: { in: ids } } },
      { patient: { userId: { in: ids } } },
    ] } },
  });
  await prisma.diagnosis.deleteMany({
    where: { appointment: { OR: [
      { doctor: { userId: { in: ids } } },
      { patient: { userId: { in: ids } } },
    ] } },
  });
  await prisma.clinicalNote.deleteMany({
    where: { appointment: { OR: [
      { doctor: { userId: { in: ids } } },
      { patient: { userId: { in: ids } } },
    ] } },
  });
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { doctor: { userId: { in: ids } } },
        { patient: { userId: { in: ids } } },
      ],
    },
  });
  await prisma.studentPlacement.deleteMany({
    where: {
      OR: [
        { student: { userId: { in: ids } } },
        { supervisor: { userId: { in: ids } } },
      ],
    },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.message.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { recipientId: { in: ids } }] },
  });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export async function disconnectE2E() {
  await prisma.$disconnect();
}
