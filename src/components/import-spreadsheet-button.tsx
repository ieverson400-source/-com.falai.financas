import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, Upload, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type RawRow = Record<string, unknown>;

interface ParsedRow {
  expense_date: string; // yyyy-mm-dd
  description: string;
  amount: number;
  category: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

function pick(row: RawRow, keys: string[]): unknown {
  const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
  for (const k of keys) {
    const real = map.get(norm(k));
    if (real !== undefined) return row[real];
  }
  return undefined;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
      return dt.toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = "20" + y;
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // iso yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

function parseAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.abs(v);
  let s = String(v).trim();
  s = s.replace(/[R$\s]/gi, "");
  // remove thousands then unify decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.abs(n);
}

function normalizeRows(rows: RawRow[]): { parsed: ParsedRow[]; skipped: number } {
  const parsed: ParsedRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = parseDate(pick(r, ["data", "date", "expense_date", "dt", "data da transacao"]));
    const description =
      (pick(r, ["descricao", "description", "desc", "historico", "titulo", "nome"]) as
        | string
        | number
        | undefined) ?? "";
    const amount = parseAmount(pick(r, ["valor", "amount", "preco", "price", "total"]));
    const category =
      (pick(r, ["categoria", "category", "tipo"]) as string | undefined) ?? "Outros";
    if (!date || amount == null) {
      skipped++;
      continue;
    }
    parsed.push({
      expense_date: date,
      description: String(description).trim(),
      amount,
      category: String(category).trim() || "Outros",
    });
  }
  return { parsed, skipped };
}

function toCsvUrl(url: string): string {
  // Convert Google Sheets share link to CSV export
  const m = url.match(/spreadsheets\/d\/([^/]+)/);
  if (!m) return url;
  const id = m[1];
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export function ImportSpreadsheetButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function processRows(rows: RawRow[]) {
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    const { parsed, skipped } = normalizeRows(rows);
    if (parsed.length === 0) {
      toast.error("Nenhuma linha válida encontrada. Verifique colunas: data, descrição, valor.");
      return;
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("expenses")
      .select("id, amount, description, expense_date, category");
    if (fetchErr) {
      toast.error("Erro ao ler planilha atual: " + fetchErr.message);
      return;
    }

    const key = (d: string, desc: string | null, amt: number) =>
      `${d}|${(desc ?? "").trim().toLowerCase()}|${Number(amt).toFixed(2)}`;
    const map = new Map<string, { id: string; category: string }>();
    for (const e of existing ?? []) {
      map.set(key(e.expense_date, e.description, Number(e.amount)), {
        id: e.id,
        category: e.category,
      });
    }

    const toInsert: Array<{
      user_id: string;
      expense_date: string;
      description: string;
      amount: number;
      category: string;
      source: string;
    }> = [];
    const toUpdate: Array<{ id: string; category: string }> = [];

    for (const row of parsed) {
      const k = key(row.expense_date, row.description, row.amount);
      const found = map.get(k);
      if (found) {
        if (found.category !== row.category) {
          toUpdate.push({ id: found.id, category: row.category });
        }
      } else {
        toInsert.push({
          user_id: user.id,
          expense_date: row.expense_date,
          description: row.description,
          amount: row.amount,
          category: row.category,
          source: "import",
        });
      }
    }

    let added = 0;
    let updated = 0;
    if (toInsert.length) {
      const { error } = await supabase.from("expenses").insert(toInsert);
      if (error) {
        toast.error("Erro ao adicionar: " + error.message);
        return;
      }
      added = toInsert.length;
    }
    for (const u of toUpdate) {
      const { error } = await supabase
        .from("expenses")
        .update({ category: u.category })
        .eq("id", u.id);
      if (!error) updated++;
    }

    toast.success(`${added} linhas adicionadas, ${updated} linhas atualizadas`, {
      description: skipped > 0 ? `${skipped} linhas ignoradas (dados incompletos).` : undefined,
    });
    setOpen(false);
    setSheetUrl("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      await processRows(rows);
    } catch (err) {
      toast.error("Arquivo inválido ou formato incorreto.");
      console.error(err);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleGoogleSheet() {
    if (!sheetUrl.trim()) {
      toast.error("Informe um link do Google Sheets.");
      return;
    }
    setLoading(true);
    try {
      const url = toCsvUrl(sheetUrl.trim());
      const res = await fetch(url);
      if (!res.ok) throw new Error("Não foi possível acessar a planilha (verifique se é pública).");
      const text = await res.text();
      const wb = XLSX.read(text, { type: "string" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      await processRows(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao importar Google Sheets.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full gap-2 bg-primary hover:bg-primary/90"
      >
        <Upload className="size-4" />
        <FileSpreadsheet className="size-4" />
        Incrementar Planilhas
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Incrementar Planilhas</DialogTitle>
            <DialogDescription>
              Envie .xlsx, .csv ou cole o link público de uma planilha do Google Sheets. Colunas
              esperadas: <strong>data</strong>, <strong>descrição</strong>, <strong>valor</strong>{" "}
              e opcionalmente <strong>categoria</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo (.xlsx ou .csv)</Label>
              <Input
                ref={fileRef}
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFile}
                disabled={loading}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gsheet">Link do Google Sheets (público)</Label>
              <div className="flex gap-2">
                <Input
                  id="gsheet"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSheet}
                  disabled={loading || !sheetUrl}
                >
                  <LinkIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Processando...
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
