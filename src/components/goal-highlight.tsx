import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plane,
  Car,
  Bike,
  Smartphone,
  Home,
  Heart,
  Gift,
  GraduationCap,
  Baby,
  Briefcase,
  Laptop,
  Camera,
  Gamepad2,
  Watch,
  ShoppingBag,
  Sofa,
  Dumbbell,
  Umbrella,
  Sun,
  Moon,
  Music,
  Wallet,
  PiggyBank,
  Pencil,
  Plus,
  Settings2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/categories";

type GoalType = "viagem" | "carro" | "moto" | "celular";

type GoalIconKey =
  | "plane"
  | "car"
  | "bike"
  | "smartphone"
  | "home"
  | "heart"
  | "gift"
  | "graduationCap"
  | "baby"
  | "briefcase"
  | "laptop"
  | "camera"
  | "gamepad2"
  | "watch"
  | "shoppingBag"
  | "sofa"
  | "dumbbell"
  | "umbrella"
  | "sun"
  | "moon"
  | "music"
  | "wallet"
  | "piggyBank";

type GoalColorKey =
  | "emerald"
  | "sky"
  | "orange"
  | "fuchsia"
  | "rose"
  | "violet"
  | "amber"
  | "cyan"
  | "lime"
  | "slate";

interface GoalState {
  name: string;
  target: number;
  current: number;
  history: { date: string; value: number }[];
  icon?: GoalIconKey;
  color?: GoalColorKey;
}

type AllGoals = Record<GoalType, GoalState>;

const STORAGE_KEY = "falai:goals:v2";
const ACTIVE_KEY = "falai:goals:active";
const NOTIFIED_KEY = "falai:goals:notified";

const ICON_OPTIONS: Record<GoalIconKey, React.ComponentType<{ className?: string }>> = {
  plane: Plane,
  car: Car,
  bike: Bike,
  smartphone: Smartphone,
  home: Home,
  heart: Heart,
  gift: Gift,
  graduationCap: GraduationCap,
  baby: Baby,
  briefcase: Briefcase,
  laptop: Laptop,
  camera: Camera,
  gamepad2: Gamepad2,
  watch: Watch,
  shoppingBag: ShoppingBag,
  sofa: Sofa,
  dumbbell: Dumbbell,
  umbrella: Umbrella,
  sun: Sun,
  moon: Moon,
  music: Music,
  wallet: Wallet,
  piggyBank: PiggyBank,
};

const COLOR_OPTIONS: Record<GoalColorKey, string> = {
  emerald: "from-emerald-400/30 to-teal-400/20",
  sky: "from-sky-400/30 to-indigo-400/20",
  orange: "from-orange-400/30 to-rose-400/20",
  fuchsia: "from-fuchsia-400/30 to-purple-400/20",
  rose: "from-rose-400/30 to-pink-400/20",
  violet: "from-violet-400/30 to-fuchsia-400/20",
  amber: "from-amber-400/30 to-orange-400/20",
  cyan: "from-cyan-400/30 to-blue-400/20",
  lime: "from-lime-400/30 to-emerald-400/20",
  slate: "from-slate-400/30 to-zinc-400/20",
};

const GOAL_META: Record<
  GoalType,
  { label: string; defaultName: string; defaultIcon: GoalIconKey; defaultColor: GoalColorKey }
> = {
  viagem: { label: "Viajar", defaultName: "Minha viagem dos sonhos", defaultIcon: "plane", defaultColor: "sky" },
  carro: { label: "Carro", defaultName: "Meu carro novo", defaultIcon: "car", defaultColor: "emerald" },
  moto: { label: "Moto", defaultName: "Minha moto nova", defaultIcon: "bike", defaultColor: "orange" },
  celular: { label: "Celular", defaultName: "Meu celular novo", defaultIcon: "smartphone", defaultColor: "fuchsia" },
};

function makeDefault(type: GoalType): GoalState {
  const meta = GOAL_META[type];
  return {
    name: meta.defaultName,
    target: 5000,
    current: 0,
    history: [],
    icon: meta.defaultIcon,
    color: meta.defaultColor,
  };
}

function migrateFromV1(raw: string | null): AllGoals | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AllGoals>;
    const result: AllGoals = {
      viagem: makeDefault("viagem"),
      carro: makeDefault("carro"),
      moto: makeDefault("moto"),
      celular: makeDefault("celular"),
    };
    for (const type of ["viagem", "carro", "moto", "celular"] as GoalType[]) {
      const g = parsed[type];
      if (g) {
        result[type] = {
          name: g.name || GOAL_META[type].defaultName,
          target: g.target ?? 5000,
          current: g.current ?? 0,
          history: Array.isArray(g.history) ? g.history : [],
          icon: g.icon || GOAL_META[type].defaultIcon,
          color: g.color || GOAL_META[type].defaultColor,
        };
      }
    }
    return result;
  } catch {
    return null;
  }
}

function loadAll(): AllGoals {
  if (typeof window === "undefined") {
    return {
      viagem: makeDefault("viagem"),
      carro: makeDefault("carro"),
      moto: makeDefault("moto"),
      celular: makeDefault("celular"),
    };
  }
  const v2 = window.localStorage.getItem(STORAGE_KEY);
  if (v2) {
    try {
      const parsed = JSON.parse(v2) as Partial<AllGoals>;
      return {
        viagem: parsed.viagem ? { ...makeDefault("viagem"), ...parsed.viagem } : makeDefault("viagem"),
        carro: parsed.carro ? { ...makeDefault("carro"), ...parsed.carro } : makeDefault("carro"),
        moto: parsed.moto ? { ...makeDefault("moto"), ...parsed.moto } : makeDefault("moto"),
        celular: parsed.celular ? { ...makeDefault("celular"), ...parsed.celular } : makeDefault("celular"),
      };
    } catch {}
  }
  const v1 = window.localStorage.getItem("falai:goals:v1");
  if (v1) {
    const migrated = migrateFromV1(v1);
    if (migrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return {
    viagem: makeDefault("viagem"),
    carro: makeDefault("carro"),
    moto: makeDefault("moto"),
    celular: makeDefault("celular"),
  };
}

function loadActive(): GoalType | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ACTIVE_KEY);
  return v === "viagem" || v === "carro" || v === "moto" || v === "celular" ? v : null;
}

function getGoalIcon(goal: GoalState, type: GoalType) {
  return ICON_OPTIONS[goal.icon || GOAL_META[type].defaultIcon] || Car;
}

function getGoalColor(goal: GoalState, type: GoalType) {
  return COLOR_OPTIONS[goal.color || GOAL_META[type].defaultColor] || COLOR_OPTIONS.emerald;
}

export function GoalHighlight() {
  const [goals, setGoals] = useState<AllGoals>(() => loadAll());
  const [active, setActive] = useState<GoalType | null>(() => loadActive());
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (active) localStorage.setItem(ACTIVE_KEY, active);
  }, [active]);

  const choose = (t: GoalType) => {
    setActive(t);
    setSelectorOpen(false);
    toast.success(`Destaque definido: ${GOAL_META[t].label}`);
  };

  const updateActive = (patch: Partial<GoalState>) => {
    if (!active) return;
    setGoals((g) => ({ ...g, [active]: { ...g[active], ...patch } }));
  };

  const addMoney = (value: number) => {
    if (!active || !value || value <= 0) return;
    const cur = goals[active];
    const newCurrent = cur.current + value;
    const today = new Date().toISOString().slice(0, 10);
    const history = [...cur.history, { date: today, value: newCurrent }].slice(-30);
    setGoals((g) => ({ ...g, [active]: { ...cur, current: newCurrent, history } }));

    const pct = (newCurrent / Math.max(1, cur.target)) * 100;
    const notifiedRaw = localStorage.getItem(NOTIFIED_KEY);
    const notified: Record<string, number[]> = notifiedRaw ? JSON.parse(notifiedRaw) : {};
    const seen = new Set(notified[active] ?? []);
    for (const m of [50, 75, 100]) {
      if (pct >= m && !seen.has(m)) {
        seen.add(m);
        toast.success(m === 100 ? "🎉 Você atingiu 100% da meta!" : `Você já alcançou ${m}% da meta!`);
      }
    }
    notified[active] = Array.from(seen);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
  };

  if (!active) {
    return (
      <Card className="p-5 sm:p-6 bg-card shadow-soft border-dashed border-2">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold">Qual seu próximo grande objetivo?</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Escolha um destaque para acompanhar suas economias. Depois personalize ícone e cor.
            </p>
          </div>
        </div>
        <GoalSelectorGrid goals={goals} onPick={choose} className="mt-4" />
      </Card>
    );
  }

  const goal = goals[active];
  const meta = GOAL_META[active];
  const Icon = getGoalIcon(goal, active);
  const tint = getGoalColor(goal, active);
  const pct = Math.min(100, Math.round((goal.current / Math.max(1, goal.target)) * 100));

  return (
    <>
      <Card className={`p-5 sm:p-6 shadow-soft bg-gradient-to-br ${tint} border-0 overflow-hidden`}>
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-background/70 backdrop-blur flex items-center justify-center shrink-0">
            <Icon className="size-6 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Meu destaque</p>
            <h3 className="font-display font-semibold truncate">{goal.name}</h3>
          </div>
          <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Trocar destaque">
                <Settings2 className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Trocar destaque</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                O progresso de cada objetivo é mantido separadamente.
              </p>
              <GoalSelectorGrid goals={goals} onPick={choose} active={active} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums">
              {formatBRL(goal.current)}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              de {formatBRL(goal.target)}
            </p>
          </div>
          <Progress value={pct} className="mt-2.5 h-2.5 bg-background/60" />
          <p className="text-[11px] text-muted-foreground mt-1.5">{pct}% concluído</p>
        </div>

        <MiniSparkline history={goal.history} target={goal.target} />

        <div className="mt-5 flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 rounded-full">
                <Plus className="size-4" /> Adicionar dinheiro
              </Button>
            </DialogTrigger>
            <AddMoneyModal onAdd={(v) => { addMoney(v); setAddOpen(false); }} />
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full">
                <Pencil className="size-4" /> Editar meta
              </Button>
            </DialogTrigger>
            <EditGoalModal
              goal={goal}
              type={active}
              onSave={(patch) => { updateActive(patch); setEditOpen(false); toast.success("Meta atualizada"); }}
            />
          </Dialog>
        </div>
      </Card>
    </>
  );
}

function GoalSelectorGrid({
  onPick,
  active,
  goals,
  className,
}: {
  onPick: (t: GoalType) => void;
  active?: GoalType;
  goals: AllGoals;
  className?: string;
}) {
  const items: { type: GoalType; desc: string }[] = [
    { type: "viagem", desc: "Conquiste sua próxima aventura." },
    { type: "carro", desc: "Acelere rumo ao carro novo." },
    { type: "moto", desc: "Liberdade sobre duas rodas." },
    { type: "celular", desc: "Aquele celular que você quer." },
  ];
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className ?? ""}`}>
      {items.map(({ type, desc }) => {
        const m = GOAL_META[type];
        const goal = goals[type];
        const Icon = getGoalIcon(goal, type);
        const tint = getGoalColor(goal, type);
        const isActive = active === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className={`text-left rounded-2xl border p-3 transition-colors hover:border-primary/60 ${
              isActive ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className={`size-9 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center`}>
              <Icon className="size-4" />
            </div>
            <p className="font-medium text-sm mt-2">{goal.name || m.label}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
          </button>
        );
      })}
    </div>
  );
}

function AddMoneyModal({ onAdd }: { onAdd: (value: number) => void }) {
  const [value, setValue] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Adicionar dinheiro</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Quanto você guardou agora?</label>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button onClick={() => onAdd(Number(value.replace(",", ".")))} className="w-full">
          Somar à meta
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditGoalModal({
  goal,
  type,
  onSave,
}: {
  goal: GoalState;
  type: GoalType;
  onSave: (patch: Partial<GoalState>) => void;
}) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.target));
  const [current, setCurrent] = useState(String(goal.current));
  const [icon, setIcon] = useState<GoalIconKey>(goal.icon || GOAL_META[type].defaultIcon);
  const [color, setColor] = useState<GoalColorKey>(goal.color || GOAL_META[type].defaultColor);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Editar meta</DialogTitle>
      </DialogHeader>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nome do objetivo</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Valor atual</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Meta</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Ícone</label>
          <div className="grid grid-cols-6 gap-2">
            {(Object.keys(ICON_OPTIONS) as GoalIconKey[]).map((key) => {
              const Icon = ICON_OPTIONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={`flex items-center justify-center rounded-xl border p-2 transition-colors ${
                    icon === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                  aria-label={`Ícone ${key}`}
                >
                  <Icon className="size-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Cor do destaque</label>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(COLOR_OPTIONS) as GoalColorKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setColor(key)}
                className={`h-10 rounded-xl bg-gradient-to-br ${COLOR_OPTIONS[key]} border-2 transition-all ${
                  color === key ? "border-foreground scale-105" : "border-transparent"
                }`}
                aria-label={`Cor ${key}`}
              />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter className="mt-2">
        <Button
          className="w-full"
          onClick={() =>
            onSave({
              name: name.trim() || goal.name,
              target: Math.max(0, Number(target.replace(",", ".")) || 0),
              current: Math.max(0, Number(current.replace(",", ".")) || 0),
              icon,
              color,
            })
          }
        >
          Salvar personalização
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MiniSparkline({ history, target }: { history: GoalState["history"]; target: number }) {
  const points = useMemo(() => {
    if (history.length < 2) return null;
    const max = Math.max(target, ...history.map((h) => h.value));
    const w = 100;
    const h = 32;
    return history
      .map((p, i) => {
        const x = (i / (history.length - 1)) * w;
        const y = h - (p.value / Math.max(1, max)) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [history, target]);

  if (!points) return null;
  return (
    <div className="mt-4">
      <p className="text-[11px] text-muted-foreground mb-1">Evolução recente</p>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-10">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          points={points}
        />
      </svg>
    </div>
  );
}
