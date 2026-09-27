import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

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
  const [phase, setPhase] = useState(0); // 0: mic in, 1: glow/ondas, 2: texto 1, 3: texto 2
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
      timers.current.push(window.setTimeout(() => setLeaving(true), 4550));
      timers.current.push(window.setTimeout(() => setVisible(false), 5000));
    } else {
      timers.current.push(window.setTimeout(() => setPhase(1), 500));
      timers.current.push(window.setTimeout(() => setPhase(2), 950));
      timers.current.push(window.setTimeout(() => setPhase(3), 1950));
      timers.current.push(window.setTimeout(() => setLeaving(true), 4550));
      timers.current.push(window.setTimeout(() => setVisible(false), 5000));
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
      {/* Microfone + ondas */}
      <div className="relative flex items-center justify-center">
        {/* Ondas expansivas */}
        {!reduced && (
          <>
            <span
              className="absolute rounded-full"
              style={{
                width: 96,
                height: 96,
                border: "2px solid color-mix(in oklab, var(--primary) 55%, transparent)",
                opacity: phase >= 1 ? 1 : 0,
                animation:
                  phase >= 1 ? "splash-wave 1.8s ease-out infinite" : undefined,
              }}
            />
            <span
              className="absolute rounded-full"
              style={{
                width: 96,
                height: 96,
                border: "2px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                opacity: phase >= 1 ? 1 : 0,
                animation:
                  phase >= 1
                    ? "splash-wave 1.8s ease-out infinite 0.6s"
                    : undefined,
              }}
            />
            <span
              className="absolute rounded-full"
              style={{
                width: 96,
                height: 96,
                border: "2px solid color-mix(in oklab, var(--primary) 30%, transparent)",
                opacity: phase >= 1 ? 1 : 0,
                animation:
                  phase >= 1
                    ? "splash-wave 1.8s ease-out infinite 1.2s"
                    : undefined,
              }}
            />
          </>
        )}

        {/* Halo de brilho */}
        <span
          className="absolute rounded-full blur-2xl"
          style={{
            width: 120,
            height: 120,
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent) 0%, transparent 70%)",
            opacity: phase >= 1 ? 0.9 : 0,
            transition: "opacity 500ms ease",
            animation:
              phase >= 1 && !reduced
                ? "splash-pulse 1.4s ease-in-out infinite"
                : undefined,
          }}
        />

        {/* Ícone do microfone */}
        <div
          className="relative flex items-center justify-center rounded-full shadow-2xl"
          style={{
            width: 84,
            height: 84,
            background:
              "linear-gradient(160deg, color-mix(in oklab, var(--primary) 92%, white) 0%, var(--primary) 100%)",
            color: "white",
            animation: reduced
              ? undefined
              : "splash-mic-in 700ms cubic-bezier(.16,1,.3,1) both",
          }}
        >
          <Mic
            className="size-9"
            style={{
              animation:
                phase >= 1 && !reduced
                  ? "splash-mic-bob 1.4s ease-in-out infinite"
                  : undefined,
            }}
          />
        </div>
      </div>

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

      <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-0 right-0 px-6 text-center text-base font-extrabold text-foreground">
        GRUPO IOS TRIPLE CONECTE
      </p>

      <style>{`
        @keyframes splash-mic-in {
          from { opacity: 0; transform: scale(.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-mic-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50%      { transform: scale(1.18); opacity: 0.9; }
        }
        @keyframes splash-wave {
          0%   { transform: scale(0.85); opacity: 0.7; }
          70%  { opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default AnimatedSplashScreen;
