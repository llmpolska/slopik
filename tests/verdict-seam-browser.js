async function verifySeam(page) {
  const origin = new URL(page.url()).origin;
  const variants = [
    {
      kind: "oracle",
      verdict: "Tak. Daję okejkę. Tylko potem nie mów, że to był mój pomysł.",
    },
    {
      kind: "oracle",
      verdict:
        "Nie. Nawet moja Grażyna mówi, że nie. A ona kupiła air fryer na raty.",
    },
    {
      kind: "oracle",
      verdict: "Prześpij się z tym. Najlepiej do następnej wypłaty.",
    },
    {
      kind: "idea",
      score: 5,
      verdict: "Najpierw test.",
      advantage: "Plus.",
      flaw: "Minus.",
    },
    {
      kind: "absurd",
      verdict: "Kosmos zatwierdził. Ziemia wstrzymała się od głosu.",
    },
  ];
  let verdict = variants[0];
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { ready: true, verified: true, siteKey: "" } }),
  );
  await page.route("**/api/verdict", (r) => r.fulfill({ json: { verdict } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = [];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin);
    await page.waitForFunction(
      () =>
        document.querySelector("textarea") &&
        !document.querySelector("textarea").disabled,
    );
    const originalMask = await page
      .locator(".cosmos")
      .evaluate((el) => getComputedStyle(el).maskImage);
    for (let i = 0; i < variants.length; i++) {
      verdict = variants[i];
      await page.getByRole("textbox").fill("Pytanie");
      await page.locator(".ask-button").click();
      await page.locator(".composer").waitFor({ state: "detached" });
      await page.locator(".verdict-mascot").evaluate((img) => img.decode());
      const seam = await page.evaluate(() => {
        const img = document.querySelector(".verdict-mascot"),
          image = img.getBoundingClientRect(),
          card = document.querySelector(".result").getBoundingClientRect();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const sourceY = Math.round(
          ((card.top - image.top) * img.naturalWidth) / image.width,
        );
        const alpha = [0.25, 0.4, 0.6, 0.75].map(
          (x) =>
            ctx.getImageData(Math.round(img.naturalWidth * x), sourceY, 1, 1)
              .data[3],
        );
        return {
          sourceY,
          alpha,
          mask: getComputedStyle(document.querySelector(".cosmos")).maskImage,
          overflow: document.documentElement.scrollHeight > innerHeight,
        };
      });
      if (
        seam.sourceY < 390 ||
        seam.sourceY > 400 ||
        seam.alpha.some((a) => a < 200) ||
        seam.mask !== originalMask ||
        seam.overflow
      )
        throw Error(JSON.stringify({ width, i, ...seam }));
      results.push({ width, variant: i, ...seam });
      if (width === 390 && i === 4)
        await page.screenshot({ path: "/tmp/slopik-seam-fixed-mobile.png" });
      if (width === 1366 && i === 4)
        await page.screenshot({ path: "/tmp/slopik-seam-fixed-desktop.png" });
      const reset = page.getByRole("button", { name: "Kolejna rozkmina" });
      await reset.scrollIntoViewIfNeeded();
      await reset.click();
      await page.waitForFunction(
        () => document.activeElement?.id === "question",
      );
    }
  }
  await page.unrouteAll({ behavior: "wait" });
  return results;
}
