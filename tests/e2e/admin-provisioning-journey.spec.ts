import { test, expect } from "@playwright/test";
import {
  createE2EAdmin,
  e2eEmail,
  cleanupE2EUsers,
  disconnectE2E,
  login,
  logout,
  E2E_PASSWORD,
} from "./fixtures";
// Safe to import statically: ES module import hoisting evaluates
// "./fixtures" first, whose own top-level code loads .env.local before
// this file's body runs -- same reasoning fixtures.ts documents for
// itself.
import { prisma } from "@/lib/prisma";

test.describe("admin provisions a doctor account and later resets its password", () => {
  let adminUserId: string;
  let adminEmail: string;
  let doctorUserId: string | undefined;
  const doctorEmail = e2eEmail("provisioned-doctor");
  const doctorName = `E2E Provisioned Doctor ${Date.now()}`;

  test.beforeAll(async () => {
    const admin = await createE2EAdmin("E2E Provisioning Admin");
    adminUserId = admin.id;
    adminEmail = admin.email;
  });

  test.afterAll(async () => {
    await cleanupE2EUsers([adminUserId, doctorUserId].filter(Boolean) as string[]);
    await disconnectE2E();
  });

  test("create a doctor account, sign in as it, then reset its password", async ({
    page,
  }) => {
    // --- Admin creates a doctor account ---
    await login(page, adminEmail);
    await page.goto("/admin/staff");
    await page.getByRole("button", { name: "Add doctor" }).click();

    const createDialog = page.getByRole("dialog");
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Full name").fill(doctorName);
    await createDialog.getByLabel("Email").fill(doctorEmail);
    await createDialog.getByLabel("Initial password").fill(E2E_PASSWORD);
    await createDialog.getByRole("combobox", { name: "Department" }).click();
    await page.getByRole("option").first().click();
    await createDialog.getByLabel("Specialization").fill("General");
    await createDialog.getByLabel("License number").fill(`LIC-${Date.now()}`);
    await createDialog
      .getByRole("button", { name: "Create account" })
      .click();

    // Real post-mutation signal, not the toast -- same reasoning as the
    // other journey specs: the toast auto-dismisses on its own timer,
    // independent of whether the mutation actually landed.
    await expect(createDialog).not.toBeVisible();
    const staffRow = page.getByRole("row", { name: new RegExp(doctorEmail) });
    await expect(staffRow).toBeVisible();
    doctorUserId = (
      await prisma.user.findUniqueOrThrow({ where: { email: doctorEmail } })
    ).id;

    // --- The new account actually works ---
    await logout(page, "E2E Provisioning Admin");
    await login(page, doctorEmail);
    await expect(page.getByText(doctorName)).toBeVisible();

    // --- Admin resets that doctor's password ---
    await logout(page, doctorName);
    await login(page, adminEmail);
    await page.goto("/admin/staff");

    page.once("dialog", (dialog) => dialog.accept());
    await staffRow.getByRole("button", { name: "Reset password" }).click();

    const resetDialog = page.getByRole("dialog", {
      name: "New temporary password",
    });
    await expect(resetDialog).toBeVisible();
    const temporaryPassword = await resetDialog
      .locator("span.break-all")
      .innerText();
    expect(temporaryPassword.length).toBeGreaterThan(0);
    await resetDialog.getByRole("button", { name: "Done" }).click();
    await expect(resetDialog).not.toBeVisible();

    // --- The old password no longer works, the new one does ---
    await logout(page, "E2E Provisioning Admin");
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();

    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(doctorName)).toBeVisible();
  });
});
