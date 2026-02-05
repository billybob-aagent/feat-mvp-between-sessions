import { test, expect } from "@playwright/test";

const therapistEmail = process.env.E2E_THERAPIST_EMAIL ?? "";
const therapistPassword = process.env.E2E_THERAPIST_PASSWORD ?? "";
const clientEmail = process.env.E2E_CLIENT_EMAIL ?? "";
const clientPassword = process.env.E2E_CLIENT_PASSWORD ?? "";

async function login(page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/app/**");
}

async function logout(page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL("**/auth/login");
}

test("assignment happy path: therapist publishes, client submits, therapist reviews", async ({ page }) => {
  test.skip(
    !therapistEmail ||
      !therapistPassword ||
      !clientEmail ||
      !clientPassword,
    "Missing E2E_* credentials in environment.",
  );

  const assignmentTitle = `E2E Assignment ${Date.now()}`;
  const assignmentBody = "Please reflect on your week.";
  const responseText = `E2E response ${Date.now()}`;

  await login(page, therapistEmail, therapistPassword);

  await page.goto("/app/therapist/assignments");
  await page.getByRole("link", { name: "New assignment" }).click();

  await page.locator("select").first().selectOption({ index: 0 });
  await page.locator('input[placeholder="Assignment title"]').fill(assignmentTitle);
  await page.locator("textarea").fill(assignmentBody);
  await page.getByRole("button", { name: "Create draft" }).click();

  await page.waitForURL("**/edit");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Status: Published/)).toBeVisible();

  await logout(page);

  await login(page, clientEmail, clientPassword);
  await page.goto("/app/client/assignments");

  const row = page.locator("li", { hasText: assignmentTitle });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Open" }).click();

  await page.locator("textarea").fill(responseText);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Submitted successfully.")).toBeVisible();

  await logout(page);

  await login(page, therapistEmail, therapistPassword);
  await page.goto("/app/therapist/assignments");

  const therapistRow = page.locator("li", { hasText: assignmentTitle });
  await expect(therapistRow).toBeVisible();
  await therapistRow.getByRole("link", { name: "View responses" }).click();

  await page.getByRole("button", { name: "Decrypt & view" }).first().click();
  await expect(page.getByText(responseText)).toBeVisible();
});

