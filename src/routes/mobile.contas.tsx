import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Building2, PiggyBank, CreditCard } from "lucide-react";
import { formatBRL } from "@/lib/categories";

export const Route = createFileRoute("/mobile/contas")({
  component: ContasTab,
});

const accounts = [
  { id: "cc", name: "Conta Corrente", bank: "Banco principal", balance: 0, icon: Building2 },
  { id: "pp", name: "Poupança", bank: "Reserva de emergência", balance: 0, icon: PiggyBank },
  { id: "cr", name: "Cartão de crédito", bank: "Fatura aberta", balance: 0, icon: CreditCard },
];

function ContasTab() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Contas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suas contas e cartões em um só lugar.
        </p>
      </header>

      <ul className="space-y-2.5">
        {accounts.map(({ id, name, bank, balance, icon: Icon }) => (
          <li key={id}>
            <Card className="p-4 shadow-soft flex items-center gap-3">
              <div className="size-11 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{bank}</p>
              </div>
              <p className="font-display font-semibold tabular-nums shrink-0">
                {formatBRL(balance)}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-xs text-center text-muted-foreground pt-4">
        Tela em construção — em breve você poderá adicionar contas reais.
      </p>
    </div>
  );
}
