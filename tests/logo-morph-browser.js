async function verifyLogoMorph(page) {
  const origin = new URL(page.url()).origin;
  const record = new URL(page.url()).searchParams.has("record");
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  let verified = false;
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { ready: true, verified, siteKey: "fixture-key" } }),
  );
  await page.route("**/api/verify", (route) => {
    verified = true;
    return route.fulfill({ json: { verified: true } });
  });
  await page.route("**/api/verdict", (route) =>
    route.fulfill({
      json: {
        verdict: {
          kind: "absurd",
          verdict: "Kosmos zatwierdził. Ziemia wstrzymała się od głosu.",
        },
      },
    }),
  );
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile={render:(el,o)=>{el.innerHTML='<button id="fixture-verify" style="padding:12px 20px;border-radius:10px;background:#35243f;color:#f6ecf8;border:0;font:14px sans-serif;cursor:pointer">✓ Potwierdź · podgląd testowy</button>';el.querySelector('button').onclick=()=>o.callback('fixture-token');return 'fixture'},remove:()=>{},reset:()=>{}};`,
    }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const results = [];
  for (const [width, height] of [
    [1366, 768],
    [390, 844],
    [320, 568],
  ]) {
    verified = false;
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.getByRole("button", { name: /Potwierdź · podgląd/ }).waitFor();
    await page.waitForTimeout(400);
    const before = await page.locator(".wordmark").boundingBox();
    const gate = await page.locator(".verification-dialog").boundingBox();
    assert(
      before.y >= 0 && before.y + before.height < gate.y,
      `Logo overlaps gate at ${width}`,
    );
    assert(
      Math.abs(before.x + before.width / 2 - (gate.x + gate.width / 2)) < 2,
      "Logo is not centered",
    );
    const clip = record && width !== 320;
    if (clip)
      await page.screencast.start({
        path: `/tmp/slopik-logo-${width}.webm`,
        size: { width, height },
        fps: 60,
      });
    await page.screenshot({ path: `/tmp/slopik-logo-${width}-gate.png` });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__logoNode = document.querySelector(".wordmark");
      window.__logoImage = window.__logoNode.querySelector("img");
      window.__logoSamples = [];
      const start = performance.now();
      function frame(now) {
        const r = window.__logoNode.getBoundingClientRect();
        window.__logoSamples.push({
          time: now - start,
          x: r.x,
          width: r.width,
        });
        if (now - start < 1100) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      document.querySelector("#fixture-verify").click();
    });
    await page.waitForFunction(
      () => document.querySelector(".site-content").inert === false,
    );
    await page.waitForTimeout(1150);
    const state = await page.evaluate(() => {
      const logo = document.querySelector(".wordmark"),
        dock = document.querySelector(".wordmark-slot");
      const a = logo.getBoundingClientRect(),
        b = dock.getBoundingClientRect();
      return {
        same:
          logo === window.__logoNode &&
          logo.querySelector("img") === window.__logoImage,
        count: document.querySelectorAll(".wordmark").length,
        x: a.x,
        y: a.y,
        dockX: b.x,
        dockY: b.y,
        width: a.width,
        dockWidth: b.width,
        samples: window.__logoSamples,
        overflow: document.documentElement.scrollHeight > innerHeight,
      };
    });
    assert(state.same && state.count === 1, "Logo was cloned or remounted");
    assert(
      Math.abs(state.x - state.dockX) < 1 &&
        Math.abs(state.y - state.dockY) < 1 &&
        Math.abs(state.width - state.dockWidth) < 1,
      "Logo did not dock correctly",
    );
    assert(
      state.samples.some((s) => s.x > state.x + 2 && s.x < before.x - 2),
      "No intermediate transform frames",
    );
    assert(!state.overflow, "Page overflow");
    const mobile = await page.evaluate(() => {
      const privacy = document
        .querySelector(".privacy-button")
        .getBoundingClientRect();
      const creator = document
        .querySelector(".creator-link")
        .getBoundingClientRect();
      return {
        privacyOnLeft: privacy.right < creator.left,
        oldCredit: !!document.querySelector(".powered"),
        inputSize: parseFloat(
          getComputedStyle(document.querySelector("textarea")).fontSize,
        ),
        viewport: document.querySelector('meta[name="viewport"]').content,
      };
    });
    assert(
      mobile.privacyOnLeft && !mobile.oldCredit,
      "Footer privacy placement is incorrect",
    );
    assert(mobile.inputSize >= 16, "Input can trigger Safari focus zoom");
    assert(
      mobile.viewport.includes("viewport-fit=cover") &&
        !mobile.viewport.includes("maximum-scale"),
      "Safe-area viewport or zoom is incorrect",
    );
    await page.waitForTimeout(800);
    await page.getByRole("textbox").fill("Czy gołąb wie, że jest bezrobotny?");
    await page
      .getByRole("button", { name: "Zapytaj nosacza", exact: true })
      .click();
    await page.locator(".result").waitFor();
    await page.waitForTimeout(400);
    const buttons = await page
      .locator(".result-actions button")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          bg: getComputedStyle(n).backgroundColor,
          border: getComputedStyle(n).borderWidth,
          radius: getComputedStyle(n).borderRadius,
        })),
      );
    assert(
      buttons.every(
        (b) =>
          b.bg !== "rgba(0, 0, 0, 0)" &&
          b.border === "0px" &&
          b.radius !== "0px",
      ),
      "Result actions are not filled rounded buttons",
    );
    await page.screenshot({ path: `/tmp/slopik-logo-${width}-result.png` });
    await page.waitForTimeout(1200);
    if (clip) await page.screencast.stop();
    results.push({
      width,
      height,
      sameElement: state.same,
      docked: true,
      intermediateFrames: state.samples.length,
      buttons,
    });
  }
  verified = false;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await page.getByRole("button", { name: /Potwierdź · podgląd/ }).waitFor();
  assert(
    (await page.locator(".wordmark img").getAttribute("src")).endsWith(
      "logo-static.webp",
    ),
    "Reduced motion logo animates",
  );
  await page.getByRole("button", { name: /Potwierdź · podgląd/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.unrouteAll({ behavior: "wait" });
  return results;
}
