import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function ManualIncomeDialog({ userId, onSuccess }: { userId: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("incomes").insert({ user_id: userId, amount: Number(amount), description: description || null, income_date: date });
    setLoading(false);
    if (error) { toast.error("Não foi possível salvar a receita."); return; }
    toast.success("Receita adicionada");
    setOpen(false); setAmount(""); setDescription("");
    onSuccess?.();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><TrendingUp className="size-4" /> Receita</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar receita</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Descrição (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Salário" /></div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
