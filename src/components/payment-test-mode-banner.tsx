const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-center text-sm text-destructive">
        Pagamentos em produção ainda não estão configurados. Conclua a ativação em Payments para aceitar pagamentos reais.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-muted border-b border-border px-4 py-2 text-center text-sm text-muted-foreground">
        Modo de teste: nenhum pagamento real será cobrado. Use o cartão <strong>4242 4242 4242 4242</strong> para testar.
      </div>
    );
  }
  return null;
}
