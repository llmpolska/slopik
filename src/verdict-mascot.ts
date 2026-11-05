import { lines, type Verdict } from "./domain";

const positive = "/assets/verdict-nosacz.webp";
const negative = "/assets/verdict-nosacz-no.webp";
const thoughtful = "/assets/verdict-nosacz-wait.webp";
const absurd = "/assets/verdict-nosacz-absurd.webp";

const oracleMascots = new Map<string, string>([
  [lines.verdict.yes, positive],
  [lines.verdict.no, negative],
  [lines.verdict.wait, thoughtful],
  [lines.verdict.risky, thoughtful],
  [lines.verdict.test, thoughtful],
  [lines.verdict.unclear, thoughtful],
  [lines.verdict.cosmic, absurd],
  [lines.verdict.surreal, absurd],
  [lines.verdict.chaos, absurd],
]);

export function mascotForVerdict(verdict: Verdict): string {
  switch (verdict.kind) {
    case "idea":
      return "/assets/verdict-nosacz-idea.webp";
    case "absurd":
      return absurd;
    case "oracle":
      return oracleMascots.get(verdict.verdict) ?? thoughtful;
    default: {
      const exhaustive: never = verdict;
      return exhaustive;
    }
  }
}
