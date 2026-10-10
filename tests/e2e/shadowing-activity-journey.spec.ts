import { test, expect } from "@playwright/test";
import {
  createE2EPatient,
  createE2EDoctor,
  createE2EStudent,
  createE2EPlacement,
  cleanupE2EUsers,
  disconnectE2E,
  login,
  logout,
} from "./fixtures";
// Safe to import statically here (unlike ad-hoc scratch scripts
// elsewhere in this project): ES module import hoisting evaluates
// "./fixtures" first, whose own top-level code loads .env.local
// before this file's body runs -- same reasoning fixtures.ts
// documents for itself.
import { prisma } from "@/lib/prisma";

test.describe("supervisor assigns shadowing and an activity, student reflects, supervisor gives feedback", () => {
  let patientUserId: string;
  let supervisorUserId: string;
  let studentUserId: string;
  let supervisorEmail: string;
  let studentEmail: string;
  let studentName: string;
  let appointmentId: string;

  test.beforeAll(async () => {
    const [patient, supervisor, student] = await Promise.all([
      createE2EPatient("E2E Shadowing Patient"),
      createE2EDoctor("E2E Shadowing Supervisor", { canSupervise: true }),
      createE2EStudent("E2E Shadowing Student"),
    ]);
    patientUserId = patient.id;
    supervisorUserId = supervisor.id;
    studentUserId = student.id;
    supervisorEmail = supervisor.email;
    studentEmail = student.email;
    studentName = student.name;

    await createE2EPlacement(
      student.studentProfile!.id,
      supervisor.doctorProfile!.id,
      supervisor.department.id,
    );

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.patientProfile!.id,
        doctorId: supervisor.doctorProfile!.id,
        departmentId: supervisor.department.id,
        scheduledAt: new Date(Date.now() + 86400000),
        reason: "E2E shadowing fixture appointment",
      },
    });
    appointmentId = appointment.id;
  });

  test.afterAll(async () => {
    await cleanupE2EUsers([patientUserId, supervisorUserId, studentUserId]);
    await disconnectE2E();
  });

  test("full lifecycle: assign shadowing, assign activity, reflect, give feedback", async ({
    page,
  }) => {
    const activityTitle = `E2E Shadowing Debrief ${Date.now()}`;
    const reflectionContent =
      "I observed the consultation and learned about patient communication.";
    const strengthsContent = "Attentive and asked good clarifying questions.";

    // --- Supervisor assigns the student to shadow the appointment ---
    await login(page, supervisorEmail);
    await page.goto(`/appointments/${appointmentId}`);

    await page.getByRole("button", { name: "Assign student" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("combobox", { name: "Student" }).click();
    await page.getByRole("option", { name: studentName }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Assign" }).click();
    // Real post-mutation signal, not the toast -- same reasoning as the
    // patient/doctor journey spec: toasts auto-dismiss on their own
    // timer, independent of whether the mutation actually landed.
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(studentName)).toBeVisible();

    // --- Supervisor assigns a learning activity tied to that shadowed appointment ---
    await page.goto("/activities");
    await page.getByRole("button", { name: "Assign activity" }).click();
    const activityDialog = page.getByRole("dialog");
    await expect(activityDialog).toBeVisible();

    await activityDialog.getByRole("combobox", { name: "Student" }).click();
    await page.getByRole("option", { name: studentName }).click();

    await activityDialog.getByLabel("Title").fill(activityTitle);
    await activityDialog
      .getByLabel("Description")
      .fill("Shadow debrief and reflection exercise.");

    // The related-appointment list loads asynchronously after picking
    // the student; its placeholder text flips from "No shadowed
    // appointments for this student" to "Not tied to an appointment"
    // once the fetch resolves with the appointment we just assigned
    // shadowing for -- a real, deterministic signal to wait on instead
    // of an arbitrary sleep.
    const relatedCombobox = activityDialog.getByRole("combobox", {
      name: /Related shadowed appointment/,
    });
    await expect(relatedCombobox).toContainText("Not tied to an appointment");
    await relatedCombobox.click();
    await page.getByRole("option").first().click();

    await activityDialog
      .getByRole("button", { name: "Assign activity" })
      .click();
    await expect(activityDialog).not.toBeVisible();
    await expect(page.getByRole("link", { name: activityTitle })).toBeVisible();

    await page.getByRole("link", { name: activityTitle }).click();
    await expect(page).toHaveURL(/\/activities\/.+/);

    // --- Student starts the activity and submits a reflection ---
    await logout(page, "E2E Shadowing Supervisor");
    await login(page, studentEmail);
    await page.goto("/activities");
    await page.getByRole("link", { name: activityTitle }).click();

    await page.getByRole("button", { name: "Start activity" }).click();
    await expect(
      page.getByRole("button", { name: "Start activity" }),
    ).not.toBeVisible();

    const reflectionTextarea = page.getByPlaceholder(
      "What did you observe or learn from this activity?",
    );
    await reflectionTextarea.fill(reflectionContent);
    await page.getByRole("button", { name: "Submit reflection" }).click();
    // Once the reflection is saved, the form unmounts in favour of the
    // saved reflection display -- this specific textarea no longer
    // exists on the page (the topbar search box is also a "textbox",
    // so a generic role check would never go away).
    await expect(reflectionTextarea).not.toBeVisible();
    await expect(page.getByText(reflectionContent)).toBeVisible();

    // --- Supervisor reviews the reflection and gives feedback ---
    await logout(page, "E2E Shadowing Student");
    await login(page, supervisorEmail);
    await page.goto("/activities");
    await page.getByRole("link", { name: activityTitle }).click();

    await page.getByLabel("Strengths").fill(strengthsContent);
    await page.getByRole("button", { name: "Record feedback" }).click();
    await expect(page.getByText(strengthsContent)).toBeVisible();
    await expect(page.getByText("REVIEWED")).toBeVisible();
  });
});
