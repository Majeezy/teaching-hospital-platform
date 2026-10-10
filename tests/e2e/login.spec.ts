import { test, expect } from "@playwright/test";
import {
  createE2EPatient,
  cleanupE2EUsers,
  disconnectE2E,
  E2E_PASSWORD,
} from "./fixtures";

test.describe("login", () => {
  let patientUserId: string;
  let patientEmail: string;

  test.beforeAll(async () => {
    const patient = await createE2EPatient("E2E Login Patient");
    patientUserId = patient.id;
    patientEmail = patient.email;
  });

  test.afterAll(async () => {
    await cleanupE2EUsers([patientUserId]);
    await disconnectE2E();
  });

  test("rejects a nonexistent email with a generic error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody-at-all@teachinghospital.test");
    await page.getByLabel("Password").fill("whatever-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects the right email with the wrong password, same generic error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(patientEmail);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in with valid credentials and lands on the dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(patientEmail);
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("E2E Login Patient")).toBeVisible();
  });

  test("redirects an unauthenticated visitor away from a protected page", async ({
    page,
  }) => {
    await page.goto("/appointments");
    await expect(page).toHaveURL(/\/login/);
  });
});
