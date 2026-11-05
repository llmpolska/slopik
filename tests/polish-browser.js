async function verifyPolish(page) {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { ready: false, siteKey: "", verified: true } }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("textbox").fill("Czy to ma sens?");
  const formBefore = await page.locator("form").boundingBox();
  await page
    .getByRole("button", { name: "Zapytaj nosacza", exact: true })
    .click();
  const notification = page.locator("[data-sonner-toast]");
  await notification.waitFor();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("[data-sonner-toast]"))
        .opacity === "1",
  );
  const toastBox = await notification.boundingBox();
  assert(
    toastBox.x > 1000 && toastBox.y >= 15 && toastBox.y < 40,
    "Error is not a top-right popup",
  );
  assert(
    (await page.locator(".error").count()) === 0,
    "Inline error must not exist",
  );
  const formAfter = await page.locator("form").boundingBox();
  assert(
    formBefore.y === formAfter.y && formBefore.height === formAfter.height,
    "Error moved the form",
  );
  assert(
    (await page.getByRole("textbox").inputValue()) === "Czy to ma sens?",
    "Error cleared the draft",
  );
  await notification.waitFor({ state: "detached", timeout: 9000 });
  const historyButton = page.getByRole("button", {
    name: "Historia",
    exact: true,
  });
  await historyButton.click();
  await page.getByRole("dialog").waitFor();
  assert(
    (await page.getByRole("checkbox").count()) === 0,
    "Stock checkbox remains",
  );
  await page.getByRole("switch").focus();
  await page.keyboard.press("Tab");
  assert(
    await page.evaluate(() =>
      document.querySelector("[role=dialog]").contains(document.activeElement),
    ),
    "Focus escaped modal",
  );
  const closeState = await page.evaluate(() => {
    document.querySelector('[aria-label="Zamknij okno"]').click();
    return new Promise((resolve) =>
      setTimeout(() => {
        const dialog = document.querySelector("[role=dialog]");
        resolve(
          dialog
            ? {
                opacity: +getComputedStyle(dialog).opacity,
                transform: getComputedStyle(dialog).transform,
              }
            : null,
        );
      }, 40),
    );
  });
  assert(
    closeState && closeState.opacity > 0 && closeState.opacity < 1,
    "Modal has no exit animation",
  );
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert(
    await historyButton.evaluate((el) => el === document.activeElement),
    "Modal did not restore focus",
  );
  await page.getByRole("button", { name: "Spauzuj tło" }).click();
  assert(
    await page.locator("video").evaluate((v) => v.paused),
    "Background did not pause",
  );
  await historyButton.click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Wznów tło" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Prywatność", exact: true }).click();
  const modal = await page.getByRole("dialog").boundingBox();
  assert(
    modal.x >= 15 && modal.x + modal.width <= 375 && modal.y >= 15,
    "Mobile dialog overflows",
  );
  assert(
    (await page.getByRole("switch").count()) === 0,
    "Privacy must not duplicate the history switch",
  );
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await historyButton.click();
  await page.getByRole("switch").check();
  assert(
    (await page.getByRole("switch").getAttribute("data-state")) === "checked",
    "Custom switch failed",
  );
  await page.getByRole("switch").uncheck();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await historyButton.click();
  await page.getByRole("dialog").waitFor();
  const transforms = await page
    .getByRole("dialog")
    .evaluate((el) => getComputedStyle(el).transform);
  assert(transforms === "none", "Reduced motion still moves the modal");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.unrouteAll({ behavior: "wait" });
}
