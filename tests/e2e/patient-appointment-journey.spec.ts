import { test, expect } from "@playwright/test";
import {
  createE2EPatient,
  createE2EDoctor,
  cleanupE2EUsers,
  disconnectE2E,
  login,
  logout,
} from "./fixtures";

test.describe("patient books, doctor runs the appointment", () => {
  let patientUserId: string;
  let doctorUserId: string;
  let patientEmail: string;
  let doctorEmail: string;
  let doctorName: string;

  test.beforeAll(async () => {
    const [patient, doctor] = await Promise.all([
      createE2EPatient("E2E Journey Patient"),
      createE2EDoctor("E2E Journey Doctor"),
    ]);
    patientUserId = patient.id;
    doctorUserId = doctor.id;
    patientEmail = patient.email;
    doctorEmail = doctor.email;
    doctorName = doctor.name;
  });

  test.afterAll(async () => {
    await cleanupE2EUsers([patientUserId, doctorUserId]);
    await disconnectE2E();
  });

  test("full lifecycle: request, confirm, start, add clinical records, complete", async ({
    page,
  }) => {
    // --- Patient requests an appointment ---
    await login(page, patientEmail);
    await page.goto("/appointments");
    await page.getByRole("button", { name: "Request appointment" }).click();

    await page.getByRole("combobox", { name: "Doctor" }).click();
    await page.getByRole("option", { name: new RegExp(doctorName) }).click();

    const tomorrow = new Date(Date.now() + 86400000);
    const localValue = `${tomorrow.toISOString().slice(0, 10)}T10:00`;
    await page.locator("#scheduledAt").fill(localValue);
    await page.getByLabel("Reason (optional)").fill("E2E checkup");

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Request appointment" })
      .click();
    // Toasts auto-dismiss on their own timer, independent of the
    // mutation -- asserting on toast text races that timer and is
    // exactly the flakiness pattern found (and fixed) elsewhere in this
    // suite. The dialog closing, and the new row actually showing up,
    // are the real, non-transient signals that the action succeeded.
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("E2E checkup")).not.toBeVisible(); // reason isn't shown in the list row
    await expect(page.getByRole("cell", { name: doctorName })).toBeVisible();

    // --- Doctor confirms, starts, and records the visit ---
    await logout(page, "E2E Journey Patient");
    await login(page, doctorEmail);
    await page.goto("/appointments");

    await page.getByRole("button", { name: "Confirm" }).click();
    // Same reasoning: wait for the next real action button to appear
    // (which only renders once router.refresh() has the updated
    // status), not for the transient toast.
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();

    await page.getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/appointments\/.+/);

    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("textbox")
      .fill("Patient presents well, vitals normal.");
    await page.getByRole("button", { name: "Save note" }).click();
    // The dialog only closes once the action has actually succeeded
    // (setOpen(false) runs after the await, not before) -- a more
    // reliable signal to wait on than a toast's own auto-dismiss timer.
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByText("Patient presents well, vitals normal."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add diagnosis" }).click();
    await page.getByRole("dialog").getByLabel("Description").fill("Seasonal allergies");
    await page.getByRole("button", { name: "Save diagnosis" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Seasonal allergies")).toBeVisible();

    await page.goto("/appointments");
    await page.getByRole("button", { name: "Complete" }).click();
    await expect(page.getByText("COMPLETED")).toBeVisible();
  });
});
