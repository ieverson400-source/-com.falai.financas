const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Pagamentos em produção ainda não estão configurados. Conclua a ativação em Payments para aceitar pagamentos reais.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
        Modo de teste: nenhum pagamento real será cobrado. Use o cartão <strong>4242 4242 4242 4242</strong> para testar.
      </div>
    );
  }
  return null;
}
