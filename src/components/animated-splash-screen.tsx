import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "falai-splash-shown";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * Tela de abertura animada (apenas na primeira abertura da sessão).
 * Puramente visual: não toca em rotas, autenticação ou dados.
 */
export function AnimatedSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState(0); // 0: logo, 1: mic, 2: texto 1, 3: texto 2
  const [reduced, setReduced] = useState(false);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const t = window.setTimeout(() => setVisible(false), 420);
    timers.current.push(t);
  }, [leaving]);

  useEffect(() => {
    let already = true;
    try {
      already = sessionStorage.getItem(SESSION_KEY) === "1";
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      already = false;
    }
    if (already) return;

    const rm = prefersReducedMotion();
    setReduced(rm);
    setVisible(true);

    if (rm) {
      setPhase(3);
      timers.current.push(window.setTimeout(() => setLeaving(true), 700));
      timers.current.push(window.setTimeout(() => setVisible(false), 1100));
    } else {
      timers.current.push(window.setTimeout(() => setPhase(1), 500));
      timers.current.push(window.setTimeout(() => setPhase(2), 950));
      timers.current.push(window.setTimeout(() => setPhase(3), 1950));
      timers.current.push(window.setTimeout(() => setLeaving(true), 2650));
      timers.current.push(window.setTimeout(() => setVisible(false), 3050));
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      onPointerDown={dismiss}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 20%, color-mix(in oklab, var(--primary) 22%, oklch(0.16 0.02 180)) 0%, oklch(0.13 0.02 185) 60%, oklch(0.10 0.015 190) 100%)",
        opacity: leaving ? 0 : 1,
        transform: leaving && !reduced ? "scale(1.03)" : "scale(1)",
        transition: "opacity 400ms ease, transform 400ms ease",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Logo */}
      <img
        src="/icon-512.png"
        alt=""
        width={112}
        height={112}
        className="h-24 w-24 rounded-3xl shadow-2xl sm:h-28 sm:w-28"
        style={{
          opacity: 1,
          animation: reduced ? undefined : "splash-logo-in 700ms cubic-bezier(.16,1,.3,1) both",
        }}
      />

      {/* Textos */}
      <div className="mt-10 h-7 text-center">
        <p
          className="absolute left-0 right-0 px-6 text-lg font-semibold tracking-tight sm:text-xl"
          style={{
            color: "oklch(0.97 0.01 180)",
            opacity: phase === 2 ? 1 : 0,
            transition: "opacity 450ms ease",
          }}
        >
          Fale. Organize. Controle.
        </p>
        <p
          className="absolute left-0 right-0 px-6 text-lg font-semibold tracking-tight sm:text-xl"
          style={{
            color: "oklch(0.97 0.01 180)",
            opacity: phase >= 3 ? 1 : 0,
            transition: "opacity 450ms ease",
          }}
        >
          Seu dinheiro, sob controle.
        </p>
      </div>

      <style>{`
        @keyframes splash-logo-in {
          from { opacity: 0; transform: scale(.9); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default AnimatedSplashScreen;
