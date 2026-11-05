import { expect, it } from "vitest";
import { lines } from "../src/domain";
import { mascotForVerdict } from "../src/verdict-mascot";

it.each([
  [lines.verdict.yes, "verdict-nosacz"],
  [lines.verdict.no, "verdict-nosacz-no"],
  [lines.verdict.wait, "verdict-nosacz-wait"],
  [lines.verdict.risky, "verdict-nosacz-wait"],
  [lines.verdict.test, "verdict-nosacz-wait"],
  [lines.verdict.unclear, "verdict-nosacz-wait"],
  [lines.verdict.cosmic, "verdict-nosacz-absurd"],
  [lines.verdict.surreal, "verdict-nosacz-absurd"],
  [lines.verdict.chaos, "verdict-nosacz-absurd"],
])("chooses the reaction for oracle answer %s", (verdict, asset) => {
  expect(mascotForVerdict({ kind: "oracle", verdict })).toBe(
    `/assets/${asset}.webp`,
  );
});

it.each([0, 5, 10])(
  "uses the analytical reaction at idea score %d",
  (score) => {
    expect(
      mascotForVerdict({
        kind: "idea",
        score,
        advantage: "",
        flaw: "",
        verdict: lines.verdict.no,
      }),
    ).toBe("/assets/verdict-nosacz-idea.webp");
  },
);

it("lets the absurd kind take precedence over the answer text", () => {
  expect(mascotForVerdict({ kind: "absurd", verdict: lines.verdict.yes })).toBe(
    "/assets/verdict-nosacz-absurd.webp",
  );
});

it.each([
  "Tak",
  "Nie",
  "Nie wiem, kosmos i chaos",
  "",
  `${lines.verdict.yes} `,
])("falls back to thoughtful for unknown oracle text %s", (verdict) => {
  expect(mascotForVerdict({ kind: "oracle", verdict })).toBe(
    "/assets/verdict-nosacz-wait.webp",
  );
});
