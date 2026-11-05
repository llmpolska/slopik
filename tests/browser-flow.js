async function verify(page) {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  let verified = false;
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: { ready: true, siteKey: "test-only-key", verified },
    }),
  );
  await page.route("**/api/verify", (route) => {
    assert(
      route.request().postDataJSON().token === "test-token",
      "Verification token was not sent",
    );
    verified = true;
    return route.fulfill({ json: { verified: true } });
  });
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.turnstile={render:(el,o)=>{window.__turnstileMounts=(window.__turnstileMounts||0)+1;window.__testToken=o.callback;o.callback("test-token");return "test"},reset:()=>window.__testToken("test-token"),remove:()=>{}}',
      }),
  );
  let resolveResponse;
  let called = false;
  await page.route("**/api/verdict", async (route) => {
    called = true;
    const request = route.request().postDataJSON();
    assert(
      request.attachment?.format === "jpg",
      "Pasted image was not normalized to JPEG",
    );
    await new Promise((resolve) => {
      resolveResponse = resolve;
    });
    await route.fulfill({
      json: {
        verdict: {
          kind: "idea",
          score: 6.3,
          advantage: "Można sprawdzić małym kosztem.",
          flaw: "Najpierw sprawdź popyt.",
          verdict: "Najpierw spróbuj na małą skalę.",
        },
        model: "jev-1.14.0",
      },
    });
  });
  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("textbox").fill("Kebab na abonament");
  const imageBytes = await (
    await page.request.get(`${origin}/assets/oracle.webp`)
  ).body();
  await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], "pasted.webp", {
      type: "image/webp",
    });
    const data = new DataTransfer();
    data.items.add(file);
    document.querySelector("textarea").dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(imageBytes));
  await page.getByAltText("Podgląd obrazu").waitFor();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Zamknij okno",
  );
  assert(
    !(await page.getByRole("switch").isChecked()),
    "History must default off",
  );
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await page
    .getByRole("button", { name: "Zapytaj nosacza", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.getByRole("switch").uncheck();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  assert(called, "API was not called");
  resolveResponse();
  await page
    .getByRole("heading", { name: "Najpierw spróbuj na małą skalę." })
    .waitFor();
  assert(
    (await page.evaluate(() => localStorage.getItem("slopik.history.v1"))) ===
      null,
    "Opt-out during request must prevent persistence",
  );
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.getByRole("switch").check();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await page.unroute("**/api/verdict");
  await page.route("**/api/verdict", (route) =>
    route.fulfill({
      json: {
        verdict: {
          kind: "absurd",
          verdict: "Rada delfinów zatwierdziła odklejkę.",
        },
        model: "jev-1.14.0",
      },
    }),
  );
  await page.getByRole("button", { name: "Kolejna rozkmina" }).click();
  await page.getByRole("textbox").fill("Czy gołąb wie, że jest bezrobotny?");
  await page
    .getByRole("button", { name: "Zapytaj nosacza", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Rada delfinów zatwierdziła odklejkę." })
    .waitFor();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("slopik.history.v1")),
  );
  assert(stored.length === 1, "Opt-in must store a verdict");
  assert(
    !JSON.stringify(stored).includes("base64") &&
      !JSON.stringify(stored).includes("attachment"),
    "History must not contain images",
  );
  await page.reload();
  await page.getByRole("button", { name: /Historia/ }).click();
  await page
    .getByRole("button", {
      name: "Czy gołąb wie, że jest bezrobotny?",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Rada delfinów zatwierdziła odklejkę." })
    .waitFor();
  await page.locator(".composer").waitFor({ state: "hidden" });
  assert(
    (await page.getByRole("textbox").count()) === 0,
    "History restoration must hide composer",
  );
  await page.getByRole("button", { name: /Historia/ }).click();
  await page.getByRole("button", { name: "Usuń całą historię" }).click();
  await page.getByRole("switch").uncheck();
  await page.getByRole("button", { name: "Zamknij okno" }).click();
  await page.getByRole("button", { name: "Kolejna rozkmina" }).click();
  for (const [width, height] of [
    [390, 844],
    [320, 740],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Horizontal overflow at ${width}`,
    );
  }
  await page.getByRole("button", { name: "Spauzuj tło" }).click();
  assert(
    await page
      .locator(".app")
      .evaluate((el) => el.classList.contains("background-paused")),
    "Motion toggle did not pause animation",
  );
  await page.unroute("**/api/verdict");
  await page.route("**/api/verdict", (route) => {
    verified = false;
    return route.fulfill({
      status: 401,
      json: { error: "Potwierdź jeszcze raz, że jesteś człowiekiem." },
    });
  });
  const mountsBefore = await page.evaluate(() => window.__turnstileMounts || 0);
  await page.getByRole("textbox").fill("Czy sesja nadal działa?");
  await page
    .getByRole("button", { name: "Zapytaj nosacza", exact: true })
    .click();
  try {
    await page.waitForFunction(
      (before) => (window.__turnstileMounts || 0) > before,
      mountsBefore,
      { timeout: 5000 },
    );
  } catch {
    const state = await page.evaluate(() => ({
      gateOpen: !!document.querySelector(".verification-dialog"),
      widgetPresent: !!document.querySelector(".verification-widget"),
      mounts: window.__turnstileMounts || 0,
    }));
    throw new Error(
      `Turnstile did not remount after 401: ${JSON.stringify(state)}`,
    );
  }
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(
    (await page.getByRole("textbox").inputValue()) ===
      "Czy sesja nadal działa?",
    "Reverification discarded the draft",
  );
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
}
