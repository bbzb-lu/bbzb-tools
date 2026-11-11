import { expect, test, type Page } from "@playwright/test";
import { elements, newProject } from "./fixtures";

const tip = (page: Page) => page.locator(".tooltip");
const shown = (page: Page) =>
  tip(page).evaluate((e) => e.matches(":popover-open"));

test("Kopfzeile: jeder Knopf hat seinen Namen, Icons sind 18 px", async ({
  page,
}) => {
  await newProject(page, "Post 4:5");
  const header = page.locator(".editor-header");
  for (const name of [
    "Übersicht",
    "Rückgängig",
    "Wiederholen",
    "Projektdatei sichern",
    "Einstellungen",
    "Exportieren",
  ])
    await expect(header.getByRole("button", { name, exact: true })).toBeVisible();
  for (const b of await header.locator("button:not(dialog *)").all())
    expect(
      await b.evaluate(
        (e) => e.getAttribute("aria-label") || e.textContent!.trim(),
      ),
    ).not.toBe("");
  const box = await header.locator(".tabler-icon").first().boundingBox();
  expect([box!.width, box!.height]).toEqual([18, 18]);
});

test("Rückgängig/Wiederholen: aria-disabled, fokussierbar, Klick ändert nichts, Tooltip nennt Strg Z", async ({
  page,
}) => {
  await newProject(page, "Post 4:5");
  const undo = page.getByRole("button", { name: "Rückgängig" });
  const redo = page.getByRole("button", { name: "Wiederholen" });
  const count = async () => (await elements(page)).length;
  await expect(undo).toHaveAttribute("aria-disabled", "true");
  await undo.hover();
  await expect.poll(() => shown(page)).toBe(true);
  await expect(tip(page).locator("kbd")).toHaveText(["Strg", "Z"]);
  await undo.focus();
  await expect(undo).toBeFocused();
  await page.getByRole("button", { name: "Text hinzufügen" }).click();
  await expect.poll(count).toBe(1);
  await undo.click();
  await expect.poll(count).toBe(0);
  // Verlauf vorhanden, aber Rückgängig leer: Klick darauf ändert nichts, Wiederholen bleibt gültig
  await expect(undo).toHaveAttribute("aria-disabled", "true");
  await undo.click({ force: true });
  expect(await count()).toBe(0);
  await expect(redo).not.toHaveAttribute("aria-disabled", "true");
  await redo.click();
  await expect.poll(count).toBe(1);
  await expect(redo).toHaveAttribute("aria-disabled", "true");
  await redo.click({ force: true });
  expect(await count()).toBe(1);
  await expect(undo).not.toHaveAttribute("aria-disabled", "true");
});

for (const width of [1280, 1100])
  test(`Logo und Kopfzeile bei ${width} px: Logo sichtbar, nichts scrollt waagrecht`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await newProject(page, "Post 4:5");
    await expect(page.locator(".editor-header .bbzb-wordmark")).toBeVisible();
    const h = await page
      .locator(".editor-header")
      .evaluate((e) => [e.scrollWidth, e.clientWidth]);
    expect(h[0]).toBeLessThanOrEqual(h[1]!);
  });

test("Icons: Übersicht House, Sicherheitszonen ShieldAlert", async ({
  page,
}) => {
  await newProject(page, "Post 4:5");
  await expect(
    page.getByRole("button", { name: "Übersicht", exact: true }).locator(".tabler-icon-home"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Sicherheitszonen" }).locator(".tabler-icon-shield-exclamation"),
  ).toHaveCount(1);
});
