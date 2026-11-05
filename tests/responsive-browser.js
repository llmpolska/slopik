async function verifyResponsive(page) {
  const origin = new URL(page.url()).origin;
  const expect = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: { siteKey: "", ready: true, verified: true },
    }),
  );
  await page.route("**/api/verdict", (route) =>
    route.fulfill({
      json: {
        verdict: {
          kind: "idea",
          score: 7,
          verdict: "To jest długa odpowiedź nosacza. ".repeat(20),
          advantage: "Ktoś może za to zapłacić. ".repeat(25),
          flaw: "Trzeba jeszcze sprawdzić zainteresowanie. ".repeat(16),
        },
      },
    }),
  );
  const results = [];
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [390, 844],
    [375, 667],
    [320, 568],
    [667, 320],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.locator("textarea").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector("textarea").disabled,
    );
    const idle = await page.evaluate(() => {
      const main = document.querySelector("main");
      return {
        documentFits:
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
        mainFits: main.scrollHeight <= main.clientHeight + 1,
        tileColumns: getComputedStyle(
          document.querySelector(".chips"),
        ).gridTemplateColumns.split(" ").length,
        footerVisible:
          document.querySelector("footer").getBoundingClientRect().bottom <=
          innerHeight + 1,
      };
    });
    expect(
      idle.documentFits && idle.footerVisible,
      `Document overflow at ${width}x${height}`,
    );
    if (height >= 568)
      expect(idle.mainFits, `Initial main scrolls at ${width}x${height}`);
    expect(
      idle.tileColumns === (width >= 720 ? 3 : 1),
      `Prompt columns at ${width}x${height}`,
    );
    await page.getByRole("button", { name: "Prywatność", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    expect(
      (await dialog
        .getByText("Nie zapisujemy rozmów na serwerze.", { exact: true })
        .count()) >= 1,
      "Privacy copy missing",
    );
    const providerIcons = dialog.locator(".privacy-links img");
    expect((await providerIcons.count()) === 2, "Provider icons missing");
    await providerIcons.evaluateAll((imgs) =>
      Promise.all(imgs.map((img) => img.decode())),
    );
    await page.getByRole("button", { name: "Zamknij okno" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.locator("textarea").fill("Czy ten pomysł ma sens?");
    await page
      .getByRole("button", { name: "Zapytaj nosacza", exact: true })
      .click();
    await page.locator(".result").waitFor();
    const result = await page.locator(".result").evaluate((el) => ({
      scrolls: el.scrollHeight > el.clientHeight,
      height: el.clientHeight,
    }));
    expect(
      result.scrolls && result.height > 0,
      `Verdict has no scroll panel at ${width}x${height}`,
    );
    const reset = page.getByRole("button", { name: "Kolejna rozkmina" });
    await reset.scrollIntoViewIfNeeded();
    await reset.click();
    await page.locator(".chips").waitFor();
    results.push({ width, height, ...idle, verdictScrolls: result.scrolls });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(origin);
  const logo = page.locator(".wordmark img");
  await page.waitForFunction(() => {
    const logo = document.querySelector(".wordmark").getBoundingClientRect();
    const dock = document
      .querySelector(".wordmark-slot")
      .getBoundingClientRect();
    return (
      Math.abs(logo.x - dock.x) < 0.1 &&
      Math.abs(logo.y - dock.y) < 0.1 &&
      Math.abs(logo.width - dock.width) < 0.1
    );
  });
  await page.getByRole("button", { name: "Spauzuj tło", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector(".wordmark img")
      .currentSrc.endsWith("logo-static.webp"),
  );
  const logoBox = await logo.boundingBox();
  await page.getByRole("button", { name: "Wznów tło", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".wordmark img").currentSrc.endsWith("/logo.webp"),
  );
  await page.waitForTimeout(1100);
  expect(
    JSON.stringify(logoBox) === JSON.stringify(await logo.boundingBox()),
    "Animated logo moved the header",
  );
  expect(
    (await page
      .getByRole("link", { name: "2026 llmpolska", exact: true })
      .getAttribute("href")) === "https://llmpolska.pl",
    "Footer link is incorrect",
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await page.waitForFunction(
    () => !document.querySelector("textarea").disabled,
  );
  await page.waitForFunction(() =>
    document
      .querySelector(".wordmark img")
      .currentSrc.endsWith("logo-static.webp"),
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await page.locator("textarea").fill("Pytanie");
  const buffer = await (
    await page.request.get(`${origin}/brand/typesafe.png`)
  ).body();
  await page.locator("input[type=file]").setInputFiles({
    name: "bardzo-dluga-nazwa-".repeat(8) + ".png",
    mimeType: "image/png",
    buffer,
  });
  const remove = page.getByRole("button", { name: "Usuń obraz" });
  await remove.waitFor();
  await remove.scrollIntoViewIfNeeded();
  await remove.click();
  const enlarged = await page.evaluate(() => ({
    documentFits:
      document.documentElement.scrollWidth <= innerWidth &&
      document.documentElement.scrollHeight <= innerHeight,
    mainScrolls:
      document.querySelector("main").scrollHeight >
      document.querySelector("main").clientHeight,
    backgroundPaused: document
      .querySelector(".app")
      .classList.contains("background-paused"),
  }));
  expect(
    enlarged.documentFits && enlarged.mainScrolls && enlarged.backgroundPaused,
    "Enlarged text or reduced motion failed",
  );
  results.push({ enlargedText: enlarged });
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  return results;
}
