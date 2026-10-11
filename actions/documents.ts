"use server";

import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  requireFound,
  hasRole,
  hasAnyRole,
  AuthorizationError,
  type SessionUser,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getAppointmentForUser, isOwningPatient } from "@/actions/appointments";
import { assertDoctorOwnsAppointment } from "@/actions/clinical-records";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/document-constraints";

const recordDocumentSchema = z.object({
  fileUrl: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  type: z.string().trim().min(1, "Document type is required").max(100),
});

export type RecordDocumentInput = z.infer<typeof recordDocumentSchema>;

const uploaderInclude = { uploadedBy: { select: { name: true } } } as const;

/**
 * The actual metadata-recording step, shared by both upload paths
 * (appointment context and a patient's own profile). The file itself is
 * already sitting in Blob storage by the time this runs -- a client
 * token scoped to the right pathname/content-type/size was the real
 * authorization gate (see app/api/documents/upload/route.ts); this just
 * persists the result. There's no onUploadCompleted webhook dependency
 * here on purpose -- that webhook doesn't fire reliably without a public
 * URL (i.e. never in local dev), so the client calls this directly once
 * its own upload() promise resolves.
 */
async function createDocumentRecord(
  user: SessionUser,
  patientId: string,
  input: RecordDocumentInput,
) {
  const data = recordDocumentSchema.parse(input);
  const document = await prisma.document.create({
    data: {
      patientId,
      uploadedById: user.id,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      sizeBytes: data.sizeBytes,
      type: data.type,
    },
  });

  await audit({
    actorId: user.id,
    action: "UPLOADED_DOCUMENT",
    entityType: "Document",
    entityId: document.id,
    metadata: { patientId },
  });

  return document;
}

/**
 * Documents aren't modeled per-appointment (a lab result from last month
 * is still relevant today) -- this reuses the appointment's own access
 * rule rather than inventing a second one, then lists everything on file
 * for that patient. A shadowing student gets nothing here at all, same
 * exclusion as prescriptions/test results in clinical-records.ts.
 */
export async function listDocumentsForAppointmentForUser(
  user: SessionUser,
  appointmentId: string,
) {
  const { appointment, canEdit, isShadowingStudent } =
    await getAppointmentForUser(user, appointmentId);

  if (isShadowingStudent) {
    return { documents: [], canUpload: false };
  }

  const documents = await prisma.document.findMany({
    where: { patientId: appointment.patientId },
    include: uploaderInclude,
    orderBy: { uploadedAt: "desc" },
  });

  return { documents, canUpload: canEdit };
}

export async function recordAppointmentDocumentForUser(
  user: SessionUser,
  appointmentId: string,
  input: RecordDocumentInput,
) {
  const appointment = await assertDoctorOwnsAppointment(user, appointmentId);
  return createDocumentRecord(user, appointment.patientId, input);
}

export async function listMyDocumentsForUser(user: SessionUser) {
  requireRole(user, "PATIENT");
  const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  return prisma.document.findMany({
    where: { patientId: patientProfile.id },
    include: uploaderInclude,
    orderBy: { uploadedAt: "desc" },
  });
}

export async function recordMyDocumentForUser(
  user: SessionUser,
  input: RecordDocumentInput,
) {
  requireRole(user, "PATIENT");
  const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  return createDocumentRecord(user, patientProfile.id, input);
}

/**
 * Who can read/download a document's file content, keyed only by
 * documentId (the download route has no appointmentId to borrow access
 * from). Mirrors the roles that already reach patient data elsewhere:
 * the owning patient, the uploader, admin (read-only oversight, same as
 * every other clinical record type), any doctor who has an appointment
 * with this patient, or a nurse in the department of one of those
 * appointments. A student never qualifies here, shadowing or not --
 * documents are excluded from shadowing access entirely.
 */
export async function canAccessDocument(
  user: SessionUser,
  document: { patientId: string; uploadedById: string },
): Promise<boolean> {
  if (hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) return true;
  if (document.uploadedById === user.id) return true;
  if (await isOwningPatient(user, document.patientId)) return true;

  if (hasRole(user, "DOCTOR")) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id },
    });
    if (doctorProfile) {
      const treated = await prisma.appointment.findFirst({
        where: { patientId: document.patientId, doctorId: doctorProfile.id },
        select: { id: true },
      });
      if (treated) return true;
    }
  }

  if (hasRole(user, "NURSE")) {
    const nurseProfile = await prisma.nurseProfile.findUnique({
      where: { userId: user.id },
    });
    if (nurseProfile) {
      const sameDept = await prisma.appointment.findFirst({
        where: {
          patientId: document.patientId,
          departmentId: nurseProfile.departmentId,
        },
        select: { id: true },
      });
      if (sameDept) return true;
    }
  }

  return false;
}

export async function deleteDocumentForUser(
  user: SessionUser,
  documentId: string,
) {
  const document = requireFound(
    await prisma.document.findUnique({ where: { id: documentId } }),
  );

  // Only the person who uploaded it can delete it -- not the owning
  // patient (a doctor's upload isn't theirs to remove) and not admin
  // (read-only oversight, same rule as every other clinical record).
  if (document.uploadedById !== user.id) {
    throw new AuthorizationError(
      "You can only delete documents you uploaded.",
    );
  }

  await prisma.document.delete({ where: { id: documentId } });
  await del(document.fileUrl).catch(() => {
    // Blob deletion failing (e.g. already gone) shouldn't block removing
    // the metadata row -- an orphaned blob is a harmless storage cost,
    // a row pointing at nothing is a broken UI.
  });

  await audit({
    actorId: user.id,
    action: "DELETED_DOCUMENT",
    entityType: "Document",
    entityId: documentId,
  });
}

// Thin wrappers -- the actual "use server" entry points called from the UI.

export async function listDocumentsForAppointment(appointmentId: string) {
  const user = await requireUser();
  return listDocumentsForAppointmentForUser(user, appointmentId);
}

export async function recordAppointmentDocument(
  appointmentId: string,
  input: RecordDocumentInput,
) {
  const user = await requireUser();
  return recordAppointmentDocumentForUser(user, appointmentId, input);
}

export async function listMyDocuments() {
  const user = await requireUser();
  return listMyDocumentsForUser(user);
}

export async function recordMyDocument(input: RecordDocumentInput) {
  const user = await requireUser();
  return recordMyDocumentForUser(user, input);
}

export async function deleteDocument(documentId: string) {
  const user = await requireUser();
  return deleteDocumentForUser(user, documentId);
}
