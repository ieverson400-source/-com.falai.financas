import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Pause, Eye, Loader2, Tags, Pencil, Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { offerStatus } from "@/lib/shop-offer-status";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { adminApproveOffer, adminDeleteOffer, adminListOffers, adminSaveOffer } from "@/lib/shop.functions";

export const Route = createFileRoute("/app/admin/ofertas")({
  component: AdminOffersPage,
  head: () => ({
    meta: [
      { title: "Ofertas da Shop — Administração | Falaí Finanças" },
      {
        name: "description",
        content:
          "Cadastre e edite os destaques, ofertas de parceiros e cupons exibidos na tela Shop, com filtro por período de vigência.",
      },
      { property: "og:title", content: "Ofertas da Shop — Administração" },
      { property: "og:description", content: "Cadastro e edição das ofertas da Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Offer = Awaited<ReturnType<typeof adminListOffers>>["offers"][number];
type Kind = "highlight" | "offer" | "coupon";

type Form = {
  id: string | null;
  kind: Kind;
  category: string;
  brand: string;
  title: string;
  subtitle: string;
  price: string;
  installments: string;
  cashback: string;
  badges: string;
  cta_label: string;
  link_url: string;
  image_url: string;
  accent: string;
  sort_order: string;
  card_size: "sm" | "md" | "lg" | "full";
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const empty: Form = {
  id: null,
  kind: "offer",
  category: "",
  brand: "",
  title: "",
  subtitle: "",
  price: "",
  installments: "",
  cashback: "",
  badges: "",
  cta_label: "",
  link_url: "",
  image_url: "",
  accent: "",
  sort_order: "0",
  card_size: "md",
  is_active: false,
  starts_at: "",
  ends_at: "",
};

const kindLabel: Record<Kind, string> = {
  highlight: "Destaque (carrossel)",
  offer: "Oferta de parceiro",
  coupon: "Cupom",
};

function toDateInput(v: string | null) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}

function AdminOffersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const listOffers = useServerFn(adminListOffers);
  const saveOffer = useServerFn(adminSaveOffer);
  const deleteOffer = useServerFn(adminDeleteOffer);
  const approveOffer = useServerFn(adminApproveOffer);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState<Form>(empty);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    checkAdmin()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user, checkAdmin]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await listOffers({ data: { from: from || null, to: to || null } });
      setOffers(res.offers);
    } catch {
      setOffers([]);
    } finally {
      setBusy(false);
    }
  }, [listOffers, from, to]);

  useEffect(() => {
    if (isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const edit = (o: Offer) =>
    setForm({
      id: o.id,
      kind: o.kind as Kind,
      category: o.category ?? "",
      brand: o.brand ?? "",
      title: o.title,
      subtitle: o.subtitle ?? "",
      price: o.price ?? "",
      installments: o.installments ?? "",
      cashback: o.cashback ?? "",
      badges: (o.badges ?? []).join(", "),
      cta_label: o.cta_label ?? "",
      link_url: o.link_url ?? "",
      image_url: o.image_url ?? "",
      accent: o.accent ?? "",
      sort_order: String(o.sort_order ?? 0),
      card_size: (o.card_size ?? "md") as Form["card_size"],
      is_active: o.is_active,
      starts_at: toDateInput(o.starts_at),
      ends_at: toDateInput(o.ends_at),
    });

  const submit = async () => {
    if (!form.title.trim()) {
      setMessage("Informe o título da oferta.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveOffer({
        data: {
          id: form.id,
          kind: form.kind,
          category: form.category.trim() || null,
          brand: form.brand.trim() || null,
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          price: form.price.trim() || null,
          installments: form.installments.trim() || null,
          cashback: form.cashback.trim() || null,
          badges: form.badges
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)
            .slice(0, 6),
          cta_label: form.cta_label.trim() || null,
          link_url: form.link_url.trim() || null,
          image_url: form.image_url.trim() || null,
          accent: form.accent.trim() || null,
          sort_order: Number(form.sort_order) || 0,
          card_size: form.card_size,
          is_active: form.is_active,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        },
      });
      setForm(empty);
      setMessage("Oferta salva.");
      toast.success("Oferta salva.");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível salvar.";
      setMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteOffer({ data: { id } });
      toast.success("Oferta excluída.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const approve = async (offer: Offer) => {
    setBusy(true);
    try {
      await approveOffer({ data: { id: offer.id, approved: !offer.is_active } });
      toast.success(offer.is_active ? "Oferta pausada." : "Oferta aprovada.");
      await load();
    } catch { toast.error("Não foi possível alterar a aprovação."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para a administração">
            <Link to="/admin">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Tags className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Ofertas da Shop</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28">
        {isAdmin === null ? (
          <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Verificando permissões…
          </Card>
        ) : !isAdmin ? (
          <Card className="p-6">
            <h2 className="font-display text-base font-semibold">Acesso restrito</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta área é somente para administradores.
            </p>
          </Card>
        ) : (
          <>
            <Card className="grid gap-3 p-4 sm:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="p-from">
                  Vigência de
                </label>
                <Input id="p-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="p-to">
                  Vigência até
                </label>
                <Input id="p-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button onClick={() => void load()} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Aplicar período
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Limpar
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <Plus className="size-4" />
                {form.id ? "Editar oferta" : "Nova oferta"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-kind">
                    Tipo
                  </label>
                  <select
                    id="o-kind"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.kind}
                    onChange={(e) => set("kind", e.target.value as Kind)}
                  >
                    {(Object.keys(kindLabel) as Kind[]).map((k) => (
                      <option key={k} value={k}>
                        {kindLabel[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-brand">
                    Parceiro
                  </label>
                  <Input id="o-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-title">
                    Título
                  </label>
                  <Input id="o-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs text-muted-foreground" htmlFor="o-category">Categoria</label>
                  <Input id="o-category" maxLength={80} placeholder="Moda, Tecnologia, Casa…" value={form.category} onChange={(e) => set("category", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs text-muted-foreground" htmlFor="o-sub">
                    Subtítulo
                  </label>
                  <Input id="o-sub" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-price">
                    Preço
                  </label>
                  <Input
                    id="o-price"
                    placeholder="R$ 599,99"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-inst">
                    Parcelamento
                  </label>
                  <Input
                    id="o-inst"
                    placeholder="ou 10x de R$ 59,99"
                    value={form.installments}
                    onChange={(e) => set("installments", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-cb">
                    Cashback
                  </label>
                  <Input
                    id="o-cb"
                    placeholder="Até 12%"
                    value={form.cashback}
                    onChange={(e) => set("cashback", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-badges">
                    Selos (separados por vírgula)
                  </label>
                  <Input id="o-badges" value={form.badges} onChange={(e) => set("badges", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-cta">
                    Texto do botão
                  </label>
                  <Input id="o-cta" value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-order">
                    Ordem
                  </label>
                  <Input
                    id="o-order"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => set("sort_order", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground" htmlFor="o-link">
                    Link da oferta (https://)
                  </label>
                  <Input id="o-link" value={form.link_url} onChange={(e) => set("link_url", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-img">
                    Imagem (https://)
                  </label>
                  <Input id="o-img" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-start">
                    Início
                  </label>
                  <Input
                    id="o-start"
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => set("starts_at", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-end">
                    Data de validade
                  </label>
                  <Input
                    id="o-end"
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="o-size">
                    Tamanho do anúncio (carrossel)
                  </label>
                  <select
                    id="o-size"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.card_size}
                    onChange={(e) => set("card_size", e.target.value as Form["card_size"])}
                  >
                    <option value="sm">Pequeno</option>
                    <option value="md">Médio</option>
                    <option value="lg">Grande</option>
                    <option value="full">Largura total</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm" htmlFor="o-active">
                    <Switch
                      id="o-active"
                      checked={form.is_active}
                      onCheckedChange={(checked) => set("is_active", checked)}
                    />
                    Aprovada para publicação
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void submit()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {form.id ? "Salvar alterações" : "Cadastrar oferta"}
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!form.title.trim()}>
                  <Eye className="mr-2 size-4" /> Pré-visualizar
                </Button>
                {form.id && (
                  <Button variant="outline" onClick={() => setForm(empty)}>
                    Cancelar edição
                  </Button>
                )}
                {message && <span className="text-sm text-muted-foreground">{message}</span>}
              </div>
            </Card>

            <section aria-labelledby="lista-ofertas">
              <h2
                id="lista-ofertas"
                className="mb-2 flex items-center gap-2 font-display text-base font-semibold"
              >
                <Tags className="size-4" /> Ofertas cadastradas ({offers.length})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Parceiro</th>
                      <th className="p-3">Título</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Preço</th>
                      <th className="p-3">Parcelamento</th>
                      <th className="p-3">Cashback</th>
                      <th className="p-3">Vigência</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="p-3">{kindLabel[o.kind as Kind] ?? o.kind}</td>
                        <td className="p-3">{o.brand ?? "—"}</td>
                        <td className="p-3">{o.title}</td>
                        <td className="p-3">{o.category ?? "Sem categoria"}</td>
                        <td className="p-3">{o.price ?? "—"}</td>
                        <td className="p-3">{o.installments ?? "—"}</td>
                        <td className="p-3">{o.cashback ?? "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {toDateInput(o.starts_at) || "—"} → {toDateInput(o.ends_at) || "—"}
                        </td>
                        <td className="p-3">
                          <Badge variant={o.is_active ? "secondary" : "destructive"}>
                            {offerStatus(o)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void approve(o)} aria-label={`${o.is_active ? "Pausar" : "Aprovar"} ${o.title}`}>
                              {o.is_active ? <Pause className="size-4" /> : <Check className="size-4" />}{o.is_active ? "Pausar" : "Aprovar"}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Editar ${o.title}`}
                              onClick={() => edit(o)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Excluir ${o.title}`}
                              onClick={() => void remove(o.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
      </main>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prévia do anúncio</DialogTitle><DialogDescription>Visual aproximado do card exibido na Shop.</DialogDescription></DialogHeader>
          <Card className="overflow-hidden border-primary/20 bg-card">
            {form.image_url && <img src={form.image_url} alt="" className="aspect-[16/7] w-full object-cover" />}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3"><div>{form.brand && <p className="text-xs font-medium uppercase text-primary">{form.brand}</p>}<h3 className="mt-1 font-display text-xl font-semibold">{form.title || "Título do anúncio"}</h3></div><Badge variant="secondary">{kindLabel[form.kind]}</Badge></div>
              {form.subtitle && <p className="mt-2 text-sm text-muted-foreground">{form.subtitle}</p>}
              <div className="mt-4 flex items-end justify-between gap-3"><div>{form.price && <p className="text-xl font-semibold">{form.price}</p>}<p className="text-xs text-muted-foreground">{form.installments}</p></div><Button size="sm">{form.cta_label || "Ver oferta"}</Button></div>
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
