"use client";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Share2 } from "lucide-react";
import type { Verdict } from "../domain";
import { mascotForVerdict } from "../verdict-mascot";
export function VerdictCard({
  verdict,
  onReset,
  onShare,
}: {
  verdict: Verdict;
  onReset: () => void;
  onShare: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="verdict-scene"
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.15 } }}
      transition={{ duration: reduced ? 0 : 0.25, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="verdict-peek" aria-hidden="true">
        <img
          className="verdict-mascot"
          src={mascotForVerdict(verdict)}
          alt=""
          aria-hidden="true"
          draggable={false}
          width={960}
          height={480}
        />
      </div>
      <article className="result" aria-live="polite">
        <div className="result-top">
          <span>
            {verdict.kind === "idea"
              ? "Pomysł pod lupą"
              : verdict.kind === "absurd"
                ? "Certyfikowana odklejka"
                : "Nosacz przemówił"}
          </span>
          {verdict.kind === "idea" && (
            <motion.b
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduced ? 0 : 0.2,
                delay: reduced ? 0 : 0.06,
              }}
            >
              {verdict.score.toLocaleString("pl-PL")}
              <small>/10</small>
            </motion.b>
          )}
        </div>
        <h2>{verdict.verdict}</h2>
        {verdict.kind === "idea" && (
          <div className="idea-details">
            <div>
              <span>+ Największy plus</span>
              <p>{verdict.advantage}</p>
            </div>
            <div>
              <span>− Największy przypał</span>
              <p>{verdict.flaw}</p>
            </div>
          </div>
        )}
        <div className="result-actions">
          <button onClick={onReset}>
            <RotateCcw size={14} /> Kolejna rozkmina
          </button>
          <button onClick={onShare}>
            <Share2 size={14} /> Puść wyrok w świat
          </button>
        </div>
      </article>
    </motion.div>
  );
}
