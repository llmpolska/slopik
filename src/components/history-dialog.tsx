"use client";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChevronRight, Trash2, X } from "lucide-react";
import type { HistoryEntry } from "../domain";
type Props = {
  panel: "history" | "privacy" | null;
  onClose: () => void;
  remember: boolean;
  onRemember: (value: boolean) => void;
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
};
export function HistoryDialog({
  panel,
  onClose,
  remember,
  onRemember,
  history,
  onRestore,
  onClear,
}: Props) {
  const reduced = useReducedMotion();
  const restoreFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={panel !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AnimatePresence>
        {panel && (
          <Dialog.Portal forceMount key={panel}>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="dialog-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              onOpenAutoFocus={() => {
                if (document.activeElement instanceof HTMLElement)
                  restoreFocus.current = document.activeElement;
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                restoreFocus.current?.focus();
              }}
            >
              <motion.section
                className={`dialog-content ${panel === "privacy" ? "privacy-dialog" : ""}`}
                initial={{
                  opacity: 0,
                  scale: reduced ? 1 : 0.96,
                  y: reduced ? 0 : 10,
                  filter: reduced ? "none" : "blur(4px)",
                }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  scale: reduced ? 1 : 0.98,
                  y: reduced ? 0 : 6,
                  filter: reduced ? "none" : "blur(2px)",
                }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="dialog-top">
                  <Dialog.Close asChild>
                    <button
                      className="icon-button dialog-close"
                      aria-label="Zamknij okno"
                    >
                      <X size={19} />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Title className="sr-only">
                  {panel === "history" ? "Historia" : "Prywatność"}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {panel === "history"
                    ? "Zapisane rozmowy na tym urządzeniu."
                    : "Nie zapisujemy rozmów na serwerze."}
                </Dialog.Description>
                {panel === "history" && (
                  <div className="save-setting">
                    <div>
                      <label htmlFor="remember-chats">
                        Zapisuj historię rozmów lokalnie
                      </label>
                    </div>
                    <Switch.Root
                      id="remember-chats"
                      className="switch-track"
                      checked={remember}
                      onCheckedChange={onRemember}
                      aria-label="Zapisuj historię rozmów lokalnie"
                    >
                      <Switch.Thumb className="switch-thumb">
                        <span />
                      </Switch.Thumb>
                    </Switch.Root>
                  </div>
                )}
                {panel === "history" && (
                  <div className="history-body">
                    <AnimatePresence initial={false} mode="wait">
                      {history.length ? (
                        <motion.div
                          className="history-list"
                          key="entries"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          {history.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => onRestore(entry)}
                            >
                              <span>{entry.question}</span>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          className="history-empty"
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          <p>Brak zapisanych rozmów.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {panel === "privacy" && (
                  <div className="privacy-details">
                    <p>Nie zapisujemy rozmów na serwerze.</p>
                    <p>
                      Pytania i obrazy trafiają do TypeSafe AI. Cloudflare
                      zabezpiecza formularz.
                    </p>
                    <div className="privacy-links">
                      <a
                        href="https://docs.typesafe.ai/legal"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src="/brand/typesafe.png"
                          alt=""
                          width="24"
                          height="24"
                        />
                        TypeSafe AI
                        <ArrowUpRight size={12} />
                      </a>
                      <a
                        href="https://www.cloudflare.com/privacypolicy/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src="/brand/cloudflare.png"
                          alt=""
                          width="24"
                          height="24"
                        />
                        Cloudflare
                        <ArrowUpRight size={12} />
                      </a>
                    </div>
                  </div>
                )}
                {panel === "history" && history.length > 0 && (
                  <button className="delete-history" onClick={onClear}>
                    <Trash2 size={14} /> Usuń całą historię
                  </button>
                )}
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
