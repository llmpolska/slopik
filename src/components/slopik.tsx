"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUp,
  ArrowUpRight,
  Paperclip,
  X,
  History,
  LoaderCircle,
  Pause,
  Play,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { z } from "zod";
import {
  HistorySchema,
  VerdictSchema,
  type HistoryEntry,
  type Verdict,
} from "../domain";
import { HistoryDialog } from "./history-dialog";
import { VerdictCard } from "./verdict-card";
import { VerificationGate } from "./verification-gate";
import { attachmentBounds } from "../image";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; verdict: Verdict; question: string };
type Attachment = {
  name: string;
  preview: string;
  data: string;
  format: "jpg";
};
const ConfigSchema = z.object({
  siteKey: z.string(),
  ready: z.boolean(),
  verified: z.boolean(),
});
const ResultSchema = z.object({ verdict: VerdictSchema });
const samples = [
  "Czy rzucić wszystko i otworzyć kebaba?",
  "Apka randkowa dla właścicieli air fryerów",
  "Czy gołąb wie, że jest bezrobotny?",
  "Czy napisać do byłej?",
  "Kebab na abonament. Dobry biznes?",
  "Czy Polska krowa śni o delfinach?",
];
const storageKey = "slopik.history.v1";
function readHistory(): HistoryEntry[] {
  try {
    if (localStorage.getItem("slopik.remember") !== "yes") return [];
    return HistorySchema.parse(
      JSON.parse(localStorage.getItem(storageKey) || "[]"),
    );
  } catch {
    return [];
  }
}
export default function Slopik() {
  const [hydrated, setHydrated] = useState(false);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [remember, setRemember] = useState(false);
  const [panel, setPanel] = useState<"history" | "privacy" | null>(null);
  const [config, setConfig] = useState<z.infer<typeof ConfigSchema> | null>(
    null,
  );
  const [backgroundPlaying, setBackgroundPlaying] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const isLoading = phase.kind === "loading";
  const reduced = useReducedMotion();
  const requestInFlight = useRef(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = app.current;
    if (!viewport || !element) return;
    const fitViewport = () => {
      if (viewport.scale === 1)
        element.style.setProperty("--viewport-height", `${viewport.height}px`);
    };
    fitViewport();
    viewport.addEventListener("resize", fitViewport);
    return () => {
      viewport.removeEventListener("resize", fitViewport);
      element.style.removeProperty("--viewport-height");
    };
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        setRemember(localStorage.getItem("slopik.remember") === "yes");
        setHistory(readHistory());
      } catch {
        setRemember(false);
        setHistory([]);
      }
    };
    sync();
    setHydrated(true);
    const prefersReducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    try {
      setBackgroundPlaying(
        localStorage.getItem("slopik.background") !== "paused" &&
          !prefersReducedMotion,
      );
    } catch {
      setBackgroundPlaying(!prefersReducedMotion);
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((v) => setConfig(ConfigSchema.parse(v)))
      .catch(() =>
        toast.error("Nie udało się połączyć z wyrocznią. Odśwież stronę."),
      );
  }, []);
  useEffect(() => {
    if (!video.current) return;
    if (backgroundPlaying) void video.current.play().catch(() => {});
    else video.current.pause();
  }, [backgroundPlaying, videoOk]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "auto";
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [question]);
  function toggleRemember(value: boolean) {
    try {
      if (value) {
        localStorage.setItem("slopik.remember", "yes");
      } else {
        localStorage.removeItem("slopik.remember");
        localStorage.removeItem(storageKey);
        setHistory([]);
      }
      setRemember(value);
    } catch {
      toast.error(
        "Przeglądarka blokuje zapis lokalny. Historia pozostaje wyłączona.",
      );
    }
  }
  async function attach(selected?: File) {
    if (!selected || isLoading) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
      selected.size > 8_000_000
    ) {
      toast.error("Wrzuć obraz JPG, PNG lub WebP do 8 MB.");
      return;
    }
    setAttachmentBusy(true);
    try {
      const bitmap = await createImageBitmap(selected);
      if (bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error();
      }
      const bounds = attachmentBounds(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = bounds.canvasWidth;
      canvas.height = bounds.canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        bitmap,
        bounds.x,
        bounds.y,
        bounds.imageWidth,
        bounds.imageHeight,
      );
      bitmap.close();
      const preview = canvas.toDataURL("image/jpeg", 0.8);
      const data = preview.split(",")[1];
      if (!data || data.length > 1_400_000) throw new Error();
      setAttachment({ name: selected.name, preview, data, format: "jpg" });
    } catch {
      toast.error("Nie udało się odczytać obrazu. Spróbuj mniejszego pliku.");
    } finally {
      setAttachmentBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function submit() {
    if (
      (!question.trim() && !attachment) ||
      requestInFlight.current ||
      attachmentBusy
    )
      return;
    if (!config?.ready) {
      toast.error("Wyrocznia jest chwilowo niedostępna.", {
        description: "Spróbuj ponownie za moment.",
        id: "oracle-error",
      });
      return;
    }
    const asked = question.trim() || "Oceń ten obraz. Co na to nosacz?";
    requestInFlight.current = true;
    setPhase({ kind: "loading" });
    try {
      const response = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: asked,
          ...(attachment
            ? {
                attachment: {
                  format: attachment.format,
                  data: attachment.data,
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(40000),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setConfig((previous) =>
            previous ? { ...previous, verified: false } : previous,
          );
          setPanel(null);
        }
        const error = z.object({ error: z.string() }).safeParse(body);
        toast.error(
          error.success ? error.data.error : "Nie udało się odczytać werdyktu.",
          { id: "oracle-error" },
        );
        setPhase({ kind: "idle" });
        return;
      }
      const { verdict } = ResultSchema.parse(body);
      setPhase({ kind: "result", verdict, question: asked });
      try {
        if (localStorage.getItem("slopik.remember") === "yes") {
          const next = [
            { id: crypto.randomUUID(), question: asked, verdict },
            ...readHistory(),
          ].slice(0, 30);
          localStorage.setItem(storageKey, JSON.stringify(next));
          setHistory(next);
        }
      } catch {
        toast.error(
          "Brak miejsca na historię. Werdykt jest dostępny w tej karcie.",
        );
      }
    } catch {
      setPhase({ kind: "idle" });
      toast.error("Nosacz zgubił zasięg.", {
        description: "Spróbuj ponownie. Twoje pytanie nadal tu jest.",
        id: "oracle-error",
      });
    } finally {
      requestInFlight.current = false;
    }
  }
  async function share() {
    if (phase.kind !== "result") return;
    const text = `„${phase.question}”\n\n${phase.verdict.verdict}${phase.verdict.kind === "idea" ? `\nOcena nosacza: ${phase.verdict.score}/10` : ""}\n\nslopik.pl`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Nosacz wydał wyrok", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Werdykt skopiowany.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error("Nie udało się udostępnić werdyktu.");
    }
  }
  const completeVerification = useCallback(() => {
    setConfig((previous) =>
      previous ? { ...previous, verified: true } : previous,
    );
  }, []);
  function toggleBackground() {
    const next = !backgroundPlaying;
    setBackgroundPlaying(next);
    try {
      localStorage.setItem("slopik.background", next ? "playing" : "paused");
    } catch {
      // The background still pauses when browser storage is unavailable.
    }
  }
  function reset() {
    setQuestion("");
    setAttachment(null);
    setPhase({ kind: "idle" });
    input.current?.focus();
  }
  function selectSample(value: string) {
    setQuestion(value);
    input.current?.focus();
  }
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", duration: 0.28, bounce: 0.08 }}
    >
      <div
        ref={app}
        className={`app ${backgroundPlaying ? "" : "background-paused"} phase-${phase.kind}`}
      >
        <div className="site-content" inert={!config?.verified}>
          <div className="cosmos" aria-hidden="true">
            <img src="/assets/oracle.jpg" alt="" fetchPriority="high" />
            {videoOk && (
              <video
                ref={video}
                src="/assets/oracle.mp4"
                autoPlay
                muted
                loop
                playsInline
                poster="/assets/oracle.jpg"
                onError={() => setVideoOk(false)}
              />
            )}
          </div>
          <div className="vignette" aria-hidden="true" />
          <header>
            <a className="wordmark" href="/" aria-label="Slopik, strona główna">
              <picture>
                <source
                  media="(prefers-reduced-motion: reduce)"
                  srcSet="/assets/logo-static.webp"
                />
                <img
                  src={
                    backgroundPlaying
                      ? "/assets/logo.webp"
                      : "/assets/logo-static.webp"
                  }
                  width="320"
                  height="176"
                  alt="Slopik.pl"
                  fetchPriority="high"
                />
              </picture>
            </a>
            <div className="header-right">
              <button
                className="header-button background-toggle"
                onClick={toggleBackground}
                aria-label={backgroundPlaying ? "Spauzuj tło" : "Wznów tło"}
                title={backgroundPlaying ? "Spauzuj tło" : "Wznów tło"}
                aria-pressed={!backgroundPlaying}
              >
                {backgroundPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{backgroundPlaying ? "Spauzuj tło" : "Wznów tło"}</span>
              </button>
              <button
                className="header-button history-button"
                aria-label="Historia"
                onClick={() => setPanel("history")}
              >
                <History size={16} />
                <span>Historia</span>
                {history.length > 0 && (
                  <span className="history-count">{history.length}</span>
                )}
              </button>
            </div>
          </header>
          <main>
            <div className="mascot-space" aria-hidden="true" />
            <section className="oracle" aria-label="Zapytaj wyrocznię">
              <h1>
                Nosacz prawdę
                <br />
                ci <span>powie.</span>
                <svg viewBox="0 0 230 18" aria-hidden="true">
                  <path d="M4 12Q110 -3 223 8M20 17Q120 4 204 13" />
                </svg>
              </h1>
              <motion.form
                layout
                className={`composer ${question || attachment ? "has-text" : ""} ${isLoading ? "is-submitting" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void attach(e.dataTransfer.files[0]);
                }}
              >
                <AnimatePresence initial={false}>
                  {attachment && (
                    <motion.div
                      key="attachment"
                      className="attachment-wrap"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      layout
                    >
                      <div className="attachment">
                        <img
                          src={attachment.preview}
                          alt="Podgląd załącznika"
                        />
                        <span>{attachment.name}</span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Usuń załącznik"
                          onClick={() => setAttachment(null)}
                          disabled={isLoading}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <label className="sr-only" htmlFor="question">
                  Twoje pytanie do nosacza
                </label>
                <textarea
                  id="question"
                  ref={input}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="No dawaj, co cię gryzie?"
                  maxLength={1500}
                  rows={1}
                  disabled={isLoading || !hydrated || !config?.verified}
                  onPaste={(e) => {
                    const image = Array.from(e.clipboardData.files).find((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (image) {
                      e.preventDefault();
                      void attach(image);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                <div className="composer-bottom">
                  <div className="input-tools">
                    <button
                      type="button"
                      className="icon-button attach-button"
                      aria-label="Dodaj obraz"
                      title="Dodaj obraz lub wklej ze schowka"
                      onClick={() => file.current?.click()}
                      disabled={isLoading || attachmentBusy}
                    >
                      {attachmentBusy ? (
                        <LoaderCircle className="spin" size={19} />
                      ) : (
                        <Paperclip size={19} />
                      )}
                    </button>
                    {question.length > 0 && (
                      <span
                        className={question.length > 1400 ? "near-limit" : ""}
                      >
                        {question.length}/1500
                      </span>
                    )}
                  </div>
                  <motion.button
                    layout
                    className="ask-button"
                    type="submit"
                    disabled={
                      (!question.trim() && !attachment) ||
                      isLoading ||
                      attachmentBusy
                    }
                    whileTap={{ scale: 0.97 }}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={isLoading ? "loading" : "ready"}
                        className="ask-label"
                        initial={{
                          opacity: 0,
                          y: reduced ? 0 : 6,
                          filter: reduced ? "none" : "blur(3px)",
                        }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{
                          opacity: 0,
                          y: reduced ? 0 : -6,
                          filter: reduced ? "none" : "blur(3px)",
                        }}
                        transition={{ duration: 0.16 }}
                      >
                        {isLoading ? "Rozkminiam…" : "Zapytaj nosacza"}
                        {isLoading ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : (
                          <ArrowUp size={19} />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </motion.form>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                ref={file}
                tabIndex={-1}
                aria-label="Wybierz obraz"
                onChange={(e) => void attach(e.target.files?.[0])}
              />
              <AnimatePresence initial={false} mode="wait">
                {phase.kind === "result" ? (
                  <VerdictCard
                    key="verdict"
                    verdict={phase.verdict}
                    onReset={reset}
                    onShare={() => void share()}
                  />
                ) : (
                  <motion.div
                    key="suggestions"
                    className="suggestions"
                    initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                    animate={{ opacity: isLoading ? 0.35 : 1, y: 0 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                    transition={{ duration: 0.16 }}
                  >
                    <div className="chips">
                      {samples.slice(0, 3).map((sample, index) => (
                        <button
                          disabled={isLoading}
                          key={sample}
                          onClick={() => selectSample(sample)}
                        >
                          <span aria-hidden="true">
                            {["🥙", "💡", "🐦"][index]}
                          </span>
                          <span className="sample-text">{sample}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="sr-only" role="status" aria-live="polite">
                {isLoading ? "Nosacz analizuje pytanie." : ""}
              </span>
            </section>
          </main>
          <footer>
            <a
              className="powered"
              href="https://typesafe.ai"
              target="_blank"
              rel="noreferrer"
            >
              <span className="jev-symbol">✳</span>
              <span>
                Jev 1.14 <span className="powered-by">by TypeSafe AI</span>
              </span>
              <ArrowUpRight size={11} />
            </a>
            <div className="footer-links">
              <button onClick={() => setPanel("privacy")}>Prywatność</button>
              <a href="https://llmpolska.pl">2026 llmpolska</a>
            </div>
          </footer>
          <HistoryDialog
            panel={panel}
            onClose={() => setPanel(null)}
            remember={remember}
            onRemember={toggleRemember}
            history={history}
            onRestore={(entry) => {
              setPhase({
                kind: "result",
                question: entry.question,
                verdict: entry.verdict,
              });
              setQuestion(entry.question);
              setAttachment(null);
              setPanel(null);
            }}
            onClear={() => {
              try {
                localStorage.removeItem(storageKey);
                setHistory([]);
                toast.success("Historia usunięta.");
              } catch {
                toast.error("Nie udało się usunąć historii.");
              }
            }}
          />
        </div>
        <VerificationGate
          open={!config?.verified}
          ready={Boolean(config?.ready)}
          siteKey={config?.siteKey}
          onVerified={completeVerification}
        />
        <Toaster
          position="top-right"
          theme="dark"
          closeButton
          visibleToasts={3}
          duration={4500}
          offset={24}
          mobileOffset={16}
          containerAriaLabel="Powiadomienia"
          toastOptions={{
            className: "slopik-toast",
            closeButtonAriaLabel: "Zamknij powiadomienie",
          }}
        />
      </div>
    </MotionConfig>
  );
}
