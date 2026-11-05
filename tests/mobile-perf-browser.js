async function measure(page) {
  const initial = new URL(page.url());
  const origin = initial.origin;
  const runCount = Number(initial.searchParams.get("runs") || 5);
  const trace = initial.searchParams.has("trace");
  const gate = initial.searchParams.has("gate");
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
    connectionType: "cellular4g",
  });
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Performance.enable");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let network = new Map();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  client.on("Network.requestWillBeSent", (event) =>
    network.set(event.requestId, {
      url: event.request.url,
      type: event.type,
      bytes: 0,
      status: null,
    }),
  );
  client.on("Network.dataReceived", (event) => {
    const r = network.get(event.requestId);
    if (r) r.bytes += event.encodedDataLength;
  });
  client.on("Network.responseReceived", (event) => {
    const r = network.get(event.requestId);
    if (r) r.status = event.response.status;
  });
  client.on("Network.loadingFinished", (event) => {
    const r = network.get(event.requestId);
    if (r) {
      r.bytes = event.encodedDataLength;
      r.finished = true;
    }
  });
  client.on("Network.loadingFailed", (event) => {
    const r = network.get(event.requestId);
    if (r) r.failed = event.errorText;
  });
  await page.context().addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, longTasks: [], events: [], frames: [] };
    for (const type of [
      "largest-contentful-paint",
      "layout-shift",
      "longtask",
      "event",
    ]) {
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (type === "largest-contentful-paint")
              window.__perf.lcp = e.startTime;
            if (type === "layout-shift" && !e.hadRecentInput)
              window.__perf.cls += e.value;
            if (type === "longtask")
              window.__perf.longTasks.push({
                start: e.startTime,
                duration: e.duration,
              });
            if (type === "event" && e.interactionId)
              window.__perf.events.push({
                name: e.name,
                duration: e.duration,
                delay: e.processingStart - e.startTime,
              });
          }
        }).observe({ type, buffered: true, durationThreshold: 16 });
      } catch {}
    }
    let last = 0;
    function frame(now) {
      if (last) window.__perf.frames.push({ at: now, duration: now - last });
      last = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { siteKey: "", ready: !gate, verified: !gate } }),
  );
  let verdictCalls = 0;
  await page.route("**/api/verdict", async (route) => {
    verdictCalls++;
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      json: {
        verdict: { kind: "oracle", verdict: "Najpierw sprawdź popyt." },
        model: "jev-1.14.0",
      },
    });
  });
  const traceEvents = [];
  if (trace) {
    client.on("Tracing.dataCollected", (event) =>
      traceEvents.push(...event.value),
    );
    await client.send("Tracing.start", {
      categories: "devtools.timeline,blink.user_timing",
      options: "record-as-much-as-possible",
      transferMode: "ReportEvents",
    });
  }
  const runs = [];
  for (let run = 0; run < runCount; run++) {
    await client.send("Network.clearBrowserCache");
    network = new Map();
    verdictCalls = 0;
    pageErrors.length = 0;
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    if (gate) await page.locator(".verification-dialog").waitFor();
    else
      await page.waitForFunction(
        () =>
          document.querySelector("textarea") &&
          !document.querySelector("textarea").disabled,
      );
    const readyMs = await page.evaluate(() => performance.now());
    await page.waitForTimeout(Math.max(0, 15000 - readyMs));
    const start = await page.evaluate(() => performance.now());
    const before = (await client.send("Performance.getMetrics")).metrics;
    await page.waitForTimeout(10000);
    const after = (await client.send("Performance.getMetrics")).metrics;
    const end = await page.evaluate(() => performance.now());
    let resultGap = null;
    if (!gate) {
      await page.locator("textarea").fill("");
      await page
        .locator("textarea")
        .pressSequentially("Kebab na abonament?", { delay: 40 });
      await page.locator(".history-button").click();
      await page.getByRole("dialog").waitFor();
      await page.locator(".dialog-close").click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Prywatność", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.locator(".dialog-close").click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.locator(".ask-button").click();
      await page.locator(".result").waitFor();
      resultGap = await page.locator(".result").evaluate((el) => {
        const r = el.getBoundingClientRect(),
          actions = el.querySelector(".result-actions").getBoundingClientRect();
        return { height: r.height, emptyBottom: r.bottom - actions.bottom };
      });
      if (verdictCalls !== 1)
        throw new Error("Workload did not call fixture exactly once");
    }
    const metrics = await page.evaluate(
      ({ start, end }) => {
        const p = window.__perf,
          frames = p.frames
            .filter((f) => f.at >= start && f.at <= end)
            .map((f) => f.duration),
          v = document.querySelector("video");
        return {
          lcpMs: p.lcp,
          cls: p.cls,
          longTaskCount: p.longTasks.length,
          longTaskTotalMs: p.longTasks.reduce((a, e) => a + e.duration, 0),
          idleFrames: frames.length,
          idleFrameP95Ms:
            frames.sort((a, b) => a - b)[Math.floor(frames.length * 0.95)] ||
            null,
          idleFramesOver50Ms: frames.filter((v) => v > 50).length,
          labWorstEventMs: Math.max(0, ...p.events.map((e) => e.duration)),
          labWorstInputDelayMs: Math.max(0, ...p.events.map((e) => e.delay)),
          video: v
            ? {
                ...v.getVideoPlaybackQuality(),
                totalFrames: v.getVideoPlaybackQuality().totalVideoFrames,
                droppedFrames: v.getVideoPlaybackQuality().droppedVideoFrames,
                readyState: v.readyState,
                currentTime: v.currentTime,
              }
            : null,
        };
      },
      { start, end },
    );
    const delta = {};
    for (const key of [
      "TaskDuration",
      "ScriptDuration",
      "LayoutDuration",
      "RecalcStyleDuration",
    ])
      delta[key] =
        (after.find((v) => v.name === key)?.value || 0) -
        (before.find((v) => v.name === key)?.value || 0);
    const requests = [...network.values()].filter((r) =>
      r.url.startsWith(origin),
    );
    const errors = {
      page: [...pageErrors],
      http: requests.filter((r) => r.status >= 400),
      failed: requests.filter(
        (r) => r.failed && !r.failed.includes("ERR_ABORTED"),
      ),
    };
    if (errors.page.length || errors.http.length || errors.failed.length)
      throw new Error(JSON.stringify(errors));
    runs.push({
      run: run + 1,
      readyMs,
      ...metrics,
      idleCpuSeconds: delta,
      fixtureVerdictCalls: verdictCalls,
      resultGap,
      transferBytesInWindow: requests.reduce((a, r) => a + r.bytes, 0),
      requests,
      errors,
    });
  }
  let traceSummary = null;
  if (trace) {
    const ended = new Promise((resolve) =>
      client.once("Tracing.tracingComplete", resolve),
    );
    await client.send("Tracing.end");
    await ended;
    const totals = {};
    for (const e of traceEvents)
      if (e.ph === "X" && e.dur) {
        const t =
          totals[e.name] ||
          (totals[e.name] = { count: 0, totalMs: 0, maxMs: 0 });
        t.count++;
        t.totalMs += e.dur / 1000;
        t.maxMs = Math.max(t.maxMs, e.dur / 1000);
      }
    traceSummary = Object.entries(totals)
      .sort((a, b) => b[1].totalMs - a[1].totalMs)
      .slice(0, 25)
      .map(([name, stats]) => ({ name, ...stats }));
  }
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.unrouteAll({ behavior: "wait" });
  return {
    settings: {
      origin,
      cpuRate: 4,
      viewport: [390, 844],
      deviceScaleFactor: 2,
      downloadBytesPerSec: 200000,
      uploadBytesPerSec: 93750,
      latencyMs: 150,
      coldWindowMs: 15000,
      idleWindowMs: 10000,
      gate,
      trace,
    },
    runs,
    traceSummary,
    caveats: [
      "Desktop Chromium with emulated CPU/network; GPU is not a mid-range Android GPU.",
      "Fixture API excludes Turnstile and provider response performance.",
      "Network totals describe the observation window, not a complete-download page weight.",
      "Lab event timings are not field INP.",
    ],
  };
}
