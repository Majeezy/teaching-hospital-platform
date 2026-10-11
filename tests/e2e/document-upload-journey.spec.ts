import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import {
  createE2EPatient,
  createE2EDoctor,
  cleanupE2EUsers,
  disconnectE2E,
  login,
  logout,
} from "./fixtures";

const TINY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
  "utf-8",
);

test.describe("documents: appointment uploads and patient self-uploads", () => {
  let patientUserId: string;
  let doctorUserId: string;
  let patientEmail: string;
  let doctorEmail: string;
  let appointmentId: string;

  test.beforeAll(async () => {
    const [patient, doctor] = await Promise.all([
      createE2EPatient("E2E Documents Patient"),
      createE2EDoctor("E2E Documents Doctor"),
    ]);
    patientUserId = patient.id;
    doctorUserId = doctor.id;
    patientEmail = patient.email;
    doctorEmail = doctor.email;

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.patientProfile!.id,
        doctorId: doctor.doctorProfile!.id,
        departmentId: doctor.department.id,
        scheduledAt: new Date(),
      },
    });
    appointmentId = appointment.id;
  });

  test.afterAll(async () => {
    await prisma.appointment.delete({ where: { id: appointmentId } }).catch(() => {});
    await cleanupE2EUsers([patientUserId, doctorUserId]);
    await disconnectE2E();
  });

  test("doctor uploads a document on the appointment; patient sees it, can't delete it, and can upload their own", async ({
    page,
  }) => {
    // --- Doctor uploads a document from the appointment page ---
    await login(page, doctorEmail);
    await page.goto(`/appointments/${appointmentId}`);

    await page.getByRole("button", { name: "Upload" }).click();
    const doctorDialog = page.getByRole("dialog");
    await doctorDialog.getByLabel("Document type").fill("Lab Result");
    await doctorDialog.getByLabel(/File \(PDF/).setInputFiles({
      name: "doctor-upload.pdf",
      mimeType: "application/pdf",
      buffer: TINY_PDF,
    });
    await doctorDialog.getByRole("button", { name: "Upload" }).click();
    await expect(doctorDialog).not.toBeVisible();
    await expect(page.getByText("doctor-upload.pdf")).toBeVisible();

    // Downloading goes through our own authenticated route, not a
    // directly-fetchable blob URL (the store is private) -- verifying
    // the link resolves is what actually proves the download route's
    // authorization check passed, not just that the row rendered.
    const downloadHref = await page
      .getByLabel("Download doctor-upload.pdf")
      .getAttribute("href");
    const downloadResponse = await page.request.get(downloadHref!);
    expect(downloadResponse.ok()).toBe(true);

    await logout(page, "E2E Documents Doctor");

    // --- Patient sees the doctor's upload on their own profile page ---
    await login(page, patientEmail);
    await page.goto("/patient/profile");
    await expect(page.getByText("doctor-upload.pdf")).toBeVisible();

    // Documents aren't the patient's to remove when a doctor uploaded
    // them -- no delete control should even render, not just be
    // disabled, so there's nothing a crafted request could abuse either.
    await expect(page.getByLabel("Delete doctor-upload.pdf")).toHaveCount(0);

    // --- Patient uploads their own document ---
    await page.getByRole("button", { name: "Upload" }).click();
    const patientDialog = page.getByRole("dialog");
    await patientDialog.getByLabel("Document type").fill("ID Document");
    await patientDialog.getByLabel(/File \(PDF/).setInputFiles({
      name: "patient-upload.pdf",
      mimeType: "application/pdf",
      buffer: TINY_PDF,
    });
    await patientDialog.getByRole("button", { name: "Upload" }).click();
    await expect(patientDialog).not.toBeVisible();
    await expect(page.getByText("patient-upload.pdf")).toBeVisible();

    // The patient uploaded it, so they can delete it.
    await page.getByLabel("Delete patient-upload.pdf").click();
    await expect(page.getByText("patient-upload.pdf")).not.toBeVisible();

    await logout(page, "E2E Documents Patient");

    // --- Doctor can see the patient's self-upload via the appointment too ---
    await login(page, doctorEmail);
    await page.goto(`/appointments/${appointmentId}`);
    await expect(page.getByText("doctor-upload.pdf")).toBeVisible();

    await page.getByLabel("Delete doctor-upload.pdf").click();
    await expect(page.getByText("doctor-upload.pdf")).not.toBeVisible();
  });
});
