async function verifyAndroidUI(page) {
  const origin = new URL(page.url()).origin;
  const expect = (value, message) => {
    if (!value) throw new Error(message);
  };
  let verified = false;
  let longAnswer = false;
  const movies = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".mp4"))
      movies.push(new URL(request.url()).pathname);
  });
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: { ready: true, siteKey: "", verified },
    }),
  );
  await page.route("**/api/verdict", (route) =>
    route.fulfill({
      json: {
        verdict: longAnswer
          ? {
              kind: "idea",
              score: 7,
              verdict: "Długa odpowiedź. ".repeat(20),
              advantage: "Zaleta. ".repeat(80),
              flaw: "Wada. ".repeat(100),
            }
          : { kind: "absurd", verdict: "Krótki werdykt." },
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(1800);
  expect(movies.length === 0, "Gate downloaded ambient video");
  expect(
    (await page.locator(".wordmark img").getAttribute("src")) ===
      "/assets/logo-static.webp",
    "Gate animated the logo",
  );
  verified = true;
  await page.evaluate(() =>
    localStorage.setItem("slopik.background", "paused"),
  );
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector("textarea").disabled,
  );
  await page.waitForTimeout(1800);
  expect(movies.length === 0, "Persisted pause downloaded video");
  await page.evaluate(() => localStorage.clear());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForTimeout(1800);
  expect(movies.length === 0, "Reduced motion downloaded video");
  await page.getByRole("button", { name: "Wznów tło", exact: true }).click();
  await page.waitForFunction(
    () => !!document.querySelector("video").currentSrc,
  );
  await page.waitForFunction(() => !document.querySelector("video").paused);
  expect(
    movies.every((path) => path === "/assets/oracle-mobile.mp4"),
    "Phone requested desktop video",
  );
  expect(
    await page
      .locator(".cosmos img")
      .evaluate((img) => img.currentSrc.endsWith("/oracle-mobile.webp")),
    "Phone used desktop poster",
  );
  const source = await page.locator("video").getAttribute("src");
  for (const name of ["Historia", "Prywatność"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("dialog").waitFor();
    expect(
      await page.locator("video").evaluate((v) => v.paused),
      `${name} did not pause video`,
    );
    expect(
      (await page.locator(".wordmark img").getAttribute("src")) ===
        "/assets/logo-static.webp",
      `${name} did not pause logo`,
    );
    expect(
      (await page.locator("video").getAttribute("src")) === source,
      "Modal unloaded video",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(() => !document.querySelector("video").paused);
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => document.querySelector("video").paused);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => !document.querySelector("video").paused);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector("textarea").disabled,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector("video").paused);
  await page.waitForTimeout(1200);
  expect(
    (await page.locator("video").getAttribute("src")) === null,
    "Preference change failed to cancel scheduled video",
  );
  const sizes = [
    [320, 568],
    [375, 667],
    [390, 844],
    [1366, 768],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.waitForFunction(
      () => !document.querySelector("textarea").disabled,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth &&
          document.querySelector("main").scrollHeight <=
            document.querySelector("main").clientHeight + 1,
      ),
      `Initial screen overflows at ${width}x${height}`,
    );
    await page.getByRole("textbox").fill("Pytanie");
    await page
      .getByRole("button", { name: "Zapytaj nosacza", exact: true })
      .click();
    await page.locator(".result").waitFor();
    await page.waitForTimeout(350);
    const short = await page.locator(".result").evaluate((el) => ({
      height: el.clientHeight,
      used:
        el.lastElementChild.getBoundingClientRect().bottom -
        el.getBoundingClientRect().top,
      padding: parseFloat(getComputedStyle(el).paddingBottom),
    }));
    expect(
      short.height - short.used <= short.padding + 2,
      `Short verdict has blank bottom at ${width}x${height}`,
    );
    await page.getByRole("button", { name: "Kolejna rozkmina" }).click();
    await page.locator(".result").waitFor({ state: "hidden" });
    await page.locator(".chips").waitFor();
    longAnswer = true;
    await page.getByRole("textbox").fill("Długie pytanie");
    await page
      .getByRole("button", { name: "Zapytaj nosacza", exact: true })
      .click();
    await page.locator(".result").waitFor();
    await page.waitForTimeout(350);
    expect(
      await page
        .locator(".result")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
      `Long verdict does not scroll at ${width}x${height}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
      `Long verdict overflowed page at ${width}x${height}`,
    );
    const reset = page.getByRole("button", { name: "Kolejna rozkmina" });
    await reset.scrollIntoViewIfNeeded();
    await reset.click();
    await page.locator(".result").waitFor({ state: "hidden" });
    await page.locator(".chips").waitFor();
    longAnswer = false;
  }
  const mobileOnly = movies.every((path) => path.endsWith("oracle-mobile.mp4"));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("test.saveData") === "yes")
      Object.defineProperty(navigator.connection, "saveData", {
        configurable: true,
        value: true,
      });
    if (sessionStorage.getItem("test.blockAutoplay") === "yes")
      HTMLMediaElement.prototype.play = () =>
        Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  });
  await page.evaluate(() => sessionStorage.setItem("test.saveData", "yes"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const beforeSaveData = movies.length;
  await page.reload();
  await page.waitForTimeout(1800);
  expect(
    movies.length === beforeSaveData,
    "Save-Data downloaded ambient video",
  );
  await page.getByRole("button", { name: "Wznów tło", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("video").paused);
  expect(
    await page
      .locator("video")
      .evaluate((v) => v.currentSrc.endsWith("/oracle.mp4")),
    "Desktop did not select desktop resource",
  );
  await page.evaluate(() => {
    sessionStorage.removeItem("test.saveData");
    sessionStorage.setItem("test.blockAutoplay", "yes");
  });
  await page.reload();
  await page.waitForFunction(
    () => !!document.querySelector("video").getAttribute("src"),
  );
  await page.waitForTimeout(250);
  expect(
    await page
      .locator("video")
      .evaluate((v) => getComputedStyle(v).opacity === "0"),
    "Failed autoplay covers poster with a dark frame",
  );
  await page.evaluate(() => sessionStorage.removeItem("test.blockAutoplay"));
  const beforeGate = movies.length;
  await page.route("**/api/verdict", (route) =>
    route.fulfill({ status: 401, json: { error: "Test expired session" } }),
  );
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector("textarea").disabled,
  );
  await page.getByRole("textbox").fill("Pytanie");
  await page
    .getByRole("button", { name: "Zapytaj nosacza", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(1800);
  expect(
    movies.length === beforeGate,
    "Lost verification did not cancel deferred download",
  );
  await page.unrouteAll({ behavior: "wait" });
  return { lifecycle: "passed", mobileOnly, sizes };
}
