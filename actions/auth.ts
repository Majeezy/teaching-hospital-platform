"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  dateOfBirth: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date",
  }),
});

export type RegisterPatientResult =
  | { success: true }
  | { success: false; error: string };

export async function registerPatient(
  input: z.infer<typeof registerSchema>,
): Promise<RegisterPatientResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { name, email, password, dateOfBirth } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const patientRole = await prisma.role.findUnique({
    where: { name: "PATIENT" },
  });
  if (!patientRole) {
    // Seeded in Phase 0, Stage 2 -- if this is missing, the database
    // hasn't been seeded, not a user-facing error.
    throw new Error("PATIENT role is not seeded in the database.");
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roles: {
          create: { roleId: patientRole.id },
        },
        patientProfile: {
          create: {
            dateOfBirth: new Date(dateOfBirth),
          },
        },
      },
    });
  } catch (error) {
    // The existence check above is TOCTOU-racy under concurrent
    // registrations with the same email -- email is DB-unique, so the
    // loser of the race lands here instead of corrupting any data.
    // Surface the same friendly message rather than a raw Prisma
    // constraint error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }
    throw error;
  }

  return { success: true };
}
