import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, ScanLine, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { useServerFn } from "@tanstack/react-start";
import { scanReceipt } from "@/server/receipt.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onSuccess: () => void;
  userId: string;
}

type Extracted = {
  amount: number;
  expense_date: string;
  store: string | null;
  category: string;
  items?: string | null;
};

// Read file as base64 (without data: prefix) using FileReader to avoid stack overflow on big files
const fileToBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export function ReceiptScanner({ onSuccess, userId }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [saving, setSaving] = useState(false);
  const scanFn = useServerFn(scanReceipt);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 15_000_000) {
      toast.error("Imagem muito grande (máx 15 MB)");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const result = await scanFn({
        data: { imageBase64: base64, mimeType: file.type || "image/jpeg" },
        headers: { Authorization: `Bearer ${token}` },
      } as any);

      setExtracted(result.extracted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler nota");
      setPreviewUrl(null);
    } finally {
      setProcessing(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const close = () => {
    setExtracted(null);
    setPreviewUrl(null);
  };

  const save = async () => {
    if (!extracted) return;
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      amount: Number(extracted.amount),
      category: extracted.category,
      description: extracted.store
        ? extracted.items
          ? `${extracted.store} — ${extracted.items}`
          : extracted.store
        : extracted.items || null,
      expense_date: extracted.expense_date,
      source: "manual",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("✅ Gasto registrado da nota fiscal!");
    close();
    onSuccess();
  };

  return (
    <>
      <div className="rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ScanLine className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold">Ler nota fiscal por foto</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tire uma foto ou envie da galeria. A IA extrai valor, data e loja.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={() => cameraRef.current?.click()} disabled={processing} className="gap-2">
                {processing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                Tirar foto
              </Button>
              <Button size="sm" variant="outline" onClick={() => galleryRef.current?.click()} disabled={processing}>
                Enviar imagem
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </div>

      <Dialog open={!!extracted} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar gasto</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="rounded-xl overflow-hidden border border-border max-h-48 flex items-center justify-center bg-muted">
              <img src={previewUrl} alt="Nota fiscal" className="max-h-48 object-contain" />
            </div>
          )}
          {extracted && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={extracted.amount}
                    onChange={(e) => setExtracted({ ...extracted, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={extracted.expense_date}
                    onChange={(e) => setExtracted({ ...extracted, expense_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Estabelecimento</Label>
                <Input
                  value={extracted.store ?? ""}
                  onChange={(e) => setExtracted({ ...extracted, store: e.target.value })}
                  placeholder="Nome da loja"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={extracted.category}
                  onValueChange={(v) => setExtracted({ ...extracted, category: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {extracted.items && (
                <div className="space-y-1.5">
                  <Label>Itens (opcional)</Label>
                  <Input
                    value={extracted.items ?? ""}
                    onChange={(e) => setExtracted({ ...extracted, items: e.target.value })}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={close} className="flex-1" disabled={saving}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button onClick={save} className="flex-1" disabled={saving || !extracted.amount}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar gasto"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
