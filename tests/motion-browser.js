async function verifyMotion(page) {
  const origin = new URL(page.url()).origin;
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { ready: true, verified: true, siteKey: "" } }),
  );
  await page.route("**/api/verdict", (r) =>
    r.fulfill({
      json: {
        verdict: {
          kind: "absurd",
          verdict: "Kosmos zatwierdził. Ziemia wstrzymała się od głosu.",
        },
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const results = [];
  for (const [width, height] of [
    [1366, 768],
    [1950, 1280],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.getByRole("textbox").fill("Czy gołąb ma etat?");
    await page.locator(".ask-button").click();
    await page.locator(".composer").waitFor({ state: "detached" });
    await page.locator(".verdict-mascot").evaluate((img) => img.decode());
    await page.waitForTimeout(350);
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const scene = document.querySelector(".verdict-scene");
          const before = scene.getBoundingClientRect();
          const start = performance.now();
          const samples = [];
          function frame(now) {
            if (scene.isConnected && +getComputedStyle(scene).opacity > 0.01) {
              const r = scene.getBoundingClientRect();
              samples.push({
                ms: now - start,
                center: r.x + r.width / 2,
                width: r.width,
                opacity: +getComputedStyle(scene).opacity,
              });
            }
            if (now - start < 500) requestAnimationFrame(frame);
            else
              resolve({
                center: before.x + before.width / 2,
                width: before.width,
                samples,
              });
          }
          requestAnimationFrame(frame);
          [...scene.querySelectorAll("button")][0].click();
        }),
    );
    const drift = Math.max(
      0,
      ...frames.samples.map((f) => Math.abs(f.center - frames.center)),
    );
    const widthDrift = Math.max(
      0,
      ...frames.samples.map((f) => Math.abs(f.width - frames.width)),
    );
    if (drift > 1 || widthDrift > 1)
      throw Error(
        `Exiting verdict shifted: ${JSON.stringify({ width, drift, widthDrift, frames })}`,
      );
    await page.waitForFunction(() => document.activeElement?.id === "question");
    if (await page.locator(".verdict-scene").count())
      throw Error("Verdict failed to leave");
    results.push({ width, drift, widthDrift, samples: frames.samples.length });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await page.getByRole("textbox").fill("Pytanie");
  await page.locator(".ask-button").click();
  await page.locator(".result").waitFor();
  await page.getByRole("button", { name: "Kolejna rozkmina" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "question");
  await page.unrouteAll({ behavior: "wait" });
  return results;
}
