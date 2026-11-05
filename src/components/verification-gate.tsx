"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export function VerificationGate({
  open,
  siteKey,
  ready,
  onVerified,
}: {
  open: boolean;
  siteKey?: string;
  ready: boolean;
  onVerified: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open || !ready || !siteKey || !container.current) return;
    let cancelled = false;
    async function verify(token: string) {
      if (cancelled) return;
      setBusy(true);
      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("verification");
        const config = await fetch("/api/config", { cache: "no-store" }).then(
          (result) => result.json(),
        );
        if (!z.object({ verified: z.literal(true) }).safeParse(config).success)
          throw new Error("cookie");
        if (!cancelled) onVerified();
      } catch {
        if (!cancelled) {
          setFailed(true);
          toast.error("Weryfikacja nie powiodła się. Spróbuj ponownie.", {
            id: "verification-error",
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    const mount = () => {
      if (cancelled || !container.current || !window.turnstile) return;
      widget.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        action: "access",
        theme: "dark",
        callback: verify,
        "error-callback": () => {
          setFailed(true);
          toast.error("Nie udało się wczytać weryfikacji.", {
            id: "verification-error",
          });
        },
      });
    };
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = mount;
    script.onerror = () => {
      setFailed(true);
      toast.error("Sprawdź połączenie i blokadę skryptów.", {
        id: "verification-error",
      });
    };
    if (window.turnstile) mount();
    else document.head.appendChild(script);
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      script.remove();
    };
  }, [open, ready, siteKey, onVerified]);
  return (
    <Dialog.Root open={open}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                className="dialog-overlay verification-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              forceMount
              asChild
              onEscapeKeyDown={(event) => event.preventDefault()}
              onPointerDownOutside={(event) => event.preventDefault()}
            >
              <motion.section
                className="dialog-content verification-dialog"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
                transition={{ duration: 0.22 }}
              >
                <Dialog.Title>Czy jesteś człowiekiem?</Dialog.Title>
                <Dialog.Description>
                  Weryfikujemy, aby Janusze nie użyli naszego modelu do
                  złowieszczych celów :)
                </Dialog.Description>
                <div ref={container} className="verification-widget" />
                {busy && (
                  <div className="verification-status" role="status">
                    <LoaderCircle size={18} className="spin" /> Weryfikuję…
                  </div>
                )}
                {(!ready || failed) && (
                  <button
                    className="verification-retry"
                    onClick={() => {
                      if (widget.current && window.turnstile) {
                        setFailed(false);
                        window.turnstile.reset(widget.current);
                      } else location.reload();
                    }}
                  >
                    <RotateCcw size={16} /> Spróbuj ponownie
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
