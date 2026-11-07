import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/categories";
import { parseNotificationText } from "@/lib/insights/parse-notification";

// Transforma o texto de uma notificação de banco, SMS ou e-mail em um gasto.
// O Falaí NÃO lê notificações nem e-mails sozinho: o usuário cola o texto aqui. A leitura acontece no
// próprio aparelho (nada é enviado a nenhum servidor) e o usuário confere tudo antes de salvar.
// O texto colado não é guardado: só os campos do gasto confirmado.

interface ExistingExpense {
  amount: number;
  expense_date: string;
}

// Data LOCAL do usuário (toISOString usaria UTC e viraria o dia à noite no Brasil).
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function NotificationImportDialog({
  userId,
  expenses,
  onSuccess,
  initialText,
  defaultOpen = false,
  hideTrigger = false,
  onClose,
}: {
  userId: string;
  expenses: readonly ExistingExpense[];
  onSuccess: () => void;
  /** Texto já recebido (ex.: compartilhado de outro app). É lido ao abrir, sem o usuário precisar colar. */
  initialText?: string;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  /** Chamado quando o diálogo é fechado sem salvar. */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [analyzed, setAnalyzed] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState<string>("Outros");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setText("");
    setAnalyzed(false);
    setAmount("");
    setDescription("");
    setDate(today());
    setCategory("Outros");
    setNotice(null);
  }

  function analyze(value: string) {
    const parsed = parseNotificationText(value, new Date());
    setNotice(null);
    if (!parsed) {
      setAnalyzed(false);
      return;
    }
    if (parsed.kind === "income") {
      setAnalyzed(false);
      setNotice("Isso parece uma entrada de dinheiro. O Falaí registra apenas gastos.");
      return;
    }
    if (parsed.amount === null) {
      setAnalyzed(false);
      setNotice("Não encontrei o valor do gasto nesse texto. Confira se ele tem o valor em R$.");
      return;
    }
    setAmount(String(parsed.amount));
    setDescription(parsed.description);
    setDate(parsed.date ?? today());
    setCategory(parsed.category ?? "Outros");
    setAnalyzed(true);
  }

  // Texto compartilhado: preenche e lê automaticamente uma única vez, na abertura.
  useEffect(() => {
    if (!initialText?.trim()) return;
    const value = initialText.slice(0, 2000);
    setText(value);
    analyze(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      analyze(clip);
    } catch {
      toast.error("Não consegui acessar a área de transferência. Cole o texto manualmente.");
    }
  }

  const numericAmount = Number(amount);
  const possibleDuplicate =
    analyzed &&
    numericAmount > 0 &&
    expenses.some((e) => e.expense_date === date && Math.abs(Number(e.amount) - numericAmount) < 0.005);

  async function save() {
    if (!(numericAmount > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      amount: numericAmount,
      category,
      description: description.trim() || null,
      expense_date: date,
      source: "manual",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gasto adicionado");
    setOpen(false);
    reset();
    onSuccess();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
          onClose?.();
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <ClipboardPaste className="size-4" /> Colar notificação ou e-mail
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gasto a partir de um texto</DialogTitle>
          <DialogDescription>
            Cole a notificação do banco, o SMS ou o e-mail da compra. O Falaí não lê suas notificações nem e-mails sozinho: a
            leitura é feita aqui, no seu aparelho, e você confere antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 2000));
              setAnalyzed(false);
            }}
            placeholder="Ex.: Compra aprovada no valor de R$ 45,90 em MERCADO XYZ"
            className="min-h-24"
            aria-label="Texto da notificação ou do e-mail"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void pasteFromClipboard()}>
              Colar
            </Button>
            <Button type="button" size="sm" onClick={() => analyze(text)} disabled={!text.trim()}>
              Ler texto
            </Button>
          </div>
          {notice && <p className="text-sm text-destructive">{notice}</p>}
        </div>

        {analyzed && (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Confira e ajuste, se precisar:</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="notif-valor">Valor (R$)</Label>
                <Input id="notif-valor" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-data">Data</Label>
                <Input id="notif-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-desc">Descrição</Label>
              <Input id="notif-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Estabelecimento" />
            </div>
            <div className="space-y-2">
              <Label>Categoria (sugerida)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {possibleDuplicate && (
              <p className="text-xs text-amber-500">
                Você já tem um gasto com esse mesmo valor nessa data. Confira para não registrar duas vezes.
              </p>
            )}
            <Button className="w-full" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar gasto
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
