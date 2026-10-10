"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  requireFound,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getAppointmentForUser, isAssignedDoctor } from "@/actions/appointments";

const clinicalNoteSchema = z.object({
  appointmentId: z.string().min(1),
  content: z.string().trim().min(1, "Note content is required").max(5000),
});

const diagnosisSchema = z.object({
  appointmentId: z.string().min(1),
  description: z.string().trim().min(1, "Description is required").max(1000),
  icdCode: z.string().trim().max(20).optional(),
});

const prescriptionSchema = z.object({
  appointmentId: z.string().min(1),
  medication: z.string().trim().min(1, "Medication is required").max(200),
  dosage: z.string().trim().min(1, "Dosage is required").max(100),
  instructions: z.string().trim().max(500).optional(),
});

const testOrderSchema = z.object({
  appointmentId: z.string().min(1),
  testType: z.string().trim().min(1, "Test type is required").max(200),
});

const testResultSchema = z.object({
  testOrderId: z.string().min(1),
  result: z.string().trim().min(1, "Result is required").max(2000),
});

export type ClinicalNoteInput = z.infer<typeof clinicalNoteSchema>;
export type DiagnosisInput = z.infer<typeof diagnosisSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
export type TestOrderInput = z.infer<typeof testOrderSchema>;
export type TestResultInput = z.infer<typeof testResultSchema>;

const authorInclude = { author: { select: { name: true } } } as const;

/**
 * Every write in this file follows the same rule: only the doctor
 * assigned to the appointment can add clinical records to it -- not any
 * doctor, not the admin (admin is read-only/oversight on clinical data
 * per the permissions matrix, unlike every other entity in this app where
 * admin has full access).
 */
async function assertDoctorOwnsAppointment(
  user: SessionUser,
  appointmentId: string,
) {
  requireRole(user, "DOCTOR");
  const appointment = requireFound(
    await prisma.appointment.findUnique({ where: { id: appointmentId } }),
  );
  const owns = await isAssignedDoctor(user, appointment.doctorId);
  if (!owns) {
    throw new AuthorizationError(
      "You can only add clinical records to your own appointments.",
    );
  }
  return appointment;
}

export async function getAppointmentRecordsForUser(
  user: SessionUser,
  appointmentId: string,
) {
  // Reuses the exact same access rule as the appointment itself --
  // record visibility never diverges from appointment visibility.
  const { appointment, canEdit, isShadowingStudent } =
    await getAppointmentForUser(user, appointmentId);

  const [notes, diagnoses] = await Promise.all([
    prisma.clinicalNote.findMany({
      where: { appointmentId },
      include: authorInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.diagnosis.findMany({
      where: { appointmentId },
      include: authorInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // A shadowing student gets notes + diagnosis only, per the explicit
  // scoping decision in docs/architecture.md -- prescriptions and test
  // results are never even queried for this case, not just hidden in the
  // UI, so there's nothing to leak if a later change forgets to filter.
  const [prescriptions, testOrders] = isShadowingStudent
    ? [[], []]
    : await Promise.all([
        prisma.prescription.findMany({
          where: { appointmentId },
          include: authorInclude,
          orderBy: { createdAt: "desc" },
        }),
        prisma.testOrder.findMany({
          where: { appointmentId },
          include: { ...authorInclude, result: true },
          orderBy: { orderedAt: "desc" },
        }),
      ]);

  return {
    appointment,
    canEdit,
    isShadowingStudent,
    notes,
    diagnoses,
    prescriptions,
    testOrders,
  };
}

export async function addClinicalNoteForUser(
  user: SessionUser,
  input: ClinicalNoteInput,
) {
  const data = clinicalNoteSchema.parse(input);
  const appointment = await assertDoctorOwnsAppointment(
    user,
    data.appointmentId,
  );

  const note = await prisma.clinicalNote.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      authorId: user.id,
      content: data.content,
    },
  });

  await audit({
    actorId: user.id,
    action: "ADDED_CLINICAL_NOTE",
    entityType: "ClinicalNote",
    entityId: note.id,
  });

  return note;
}

export async function addDiagnosisForUser(
  user: SessionUser,
  input: DiagnosisInput,
) {
  const data = diagnosisSchema.parse(input);
  const appointment = await assertDoctorOwnsAppointment(
    user,
    data.appointmentId,
  );

  const diagnosis = await prisma.diagnosis.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      authorId: user.id,
      description: data.description,
      icdCode: data.icdCode || null,
    },
  });

  await audit({
    actorId: user.id,
    action: "ADDED_DIAGNOSIS",
    entityType: "Diagnosis",
    entityId: diagnosis.id,
  });

  return diagnosis;
}

export async function addPrescriptionForUser(
  user: SessionUser,
  input: PrescriptionInput,
) {
  const data = prescriptionSchema.parse(input);
  const appointment = await assertDoctorOwnsAppointment(
    user,
    data.appointmentId,
  );

  const prescription = await prisma.prescription.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      authorId: user.id,
      medication: data.medication,
      dosage: data.dosage,
      instructions: data.instructions || null,
    },
  });

  await audit({
    actorId: user.id,
    action: "ADDED_PRESCRIPTION",
    entityType: "Prescription",
    entityId: prescription.id,
  });

  return prescription;
}

export async function addTestOrderForUser(
  user: SessionUser,
  input: TestOrderInput,
) {
  const data = testOrderSchema.parse(input);
  const appointment = await assertDoctorOwnsAppointment(
    user,
    data.appointmentId,
  );

  const testOrder = await prisma.testOrder.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      authorId: user.id,
      testType: data.testType,
    },
  });

  await audit({
    actorId: user.id,
    action: "ORDERED_TEST",
    entityType: "TestOrder",
    entityId: testOrder.id,
  });

  return testOrder;
}

export async function addTestResultForUser(
  user: SessionUser,
  input: TestResultInput,
) {
  const data = testResultSchema.parse(input);
  requireRole(user, "DOCTOR");

  const testOrder = requireFound(
    await prisma.testOrder.findUnique({ where: { id: data.testOrderId } }),
  );
  if (!testOrder.appointmentId) {
    throw new Error("This test order isn't linked to an appointment.");
  }
  const appointment = requireFound(
    await prisma.appointment.findUnique({
      where: { id: testOrder.appointmentId },
    }),
  );
  const owns = await isAssignedDoctor(user, appointment.doctorId);
  if (!owns) {
    throw new AuthorizationError(
      "You can only record results for your own patients' tests.",
    );
  }

  const [result] = await prisma.$transaction([
    prisma.testResult.create({
      data: {
        testOrderId: data.testOrderId,
        result: data.result,
        reviewedById: user.id,
      },
    }),
    prisma.testOrder.update({
      where: { id: data.testOrderId },
      data: { status: "COMPLETED" },
    }),
  ]);

  await audit({
    actorId: user.id,
    action: "RECORDED_TEST_RESULT",
    entityType: "TestResult",
    entityId: result.id,
  });

  return result;
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function getAppointmentRecords(appointmentId: string) {
  const user = await requireUser();
  return getAppointmentRecordsForUser(user, appointmentId);
}

export async function addClinicalNote(input: ClinicalNoteInput) {
  const user = await requireUser();
  return addClinicalNoteForUser(user, input);
}

export async function addDiagnosis(input: DiagnosisInput) {
  const user = await requireUser();
  return addDiagnosisForUser(user, input);
}

export async function addPrescription(input: PrescriptionInput) {
  const user = await requireUser();
  return addPrescriptionForUser(user, input);
}

export async function addTestOrder(input: TestOrderInput) {
  const user = await requireUser();
  return addTestOrderForUser(user, input);
}

export async function addTestResult(input: TestResultInput) {
  const user = await requireUser();
  return addTestResultForUser(user, input);
}
