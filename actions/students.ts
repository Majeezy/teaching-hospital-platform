"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireUser, requireRole, type SessionUser } from "@/lib/permissions";
import { audit } from "@/lib/audit";

const createStudentSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  studentNumber: z.string().trim().min(2, "Student number is required"),
  university: z.string().trim().min(2, "University is required"),
  yearOfStudy: z.coerce.number().int().min(1).max(10),
  program: z.string().trim().min(2, "Program is required"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

const studentListSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  studentProfile: {
    select: {
      studentNumber: true,
      university: true,
      yearOfStudy: true,
      program: true,
    },
  },
} as const;

export async function listStudentsForUser(user: SessionUser) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  return prisma.user.findMany({
    where: { roles: { some: { role: { name: "STUDENT" } } } },
    orderBy: { createdAt: "desc" },
    select: studentListSelect,
  });
}

export async function createStudentForUser(
  user: SessionUser,
  input: CreateStudentInput,
) {
  requireRole(user, "HOSPITAL_ADMIN", "SYSTEM_ADMIN");
  const data = createStudentSchema.parse(input);

  const [existingEmail, existingStudentNumber] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email } }),
    prisma.studentProfile.findUnique({
      where: { studentNumber: data.studentNumber },
    }),
  ]);
  if (existingEmail) {
    throw new Error("An account with this email already exists.");
  }
  if (existingStudentNumber) {
    throw new Error("A student with this student number already exists.");
  }

  const studentRole = await prisma.role.findUniqueOrThrow({
    where: { name: "STUDENT" },
  });
  const passwordHash = await hashPassword(data.password);

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      roles: { create: { roleId: studentRole.id } },
      studentProfile: {
        create: {
          studentNumber: data.studentNumber,
          university: data.university,
          yearOfStudy: data.yearOfStudy,
          program: data.program,
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    action: "CREATED_STUDENT_ACCOUNT",
    entityType: "User",
    entityId: created.id,
    metadata: { email: created.email, studentNumber: data.studentNumber },
  });

  return created;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listStudents() {
  const user = await requireUser();
  return listStudentsForUser(user);
}

export async function createStudent(input: CreateStudentInput) {
  const user = await requireUser();
  return createStudentForUser(user, input);
}
