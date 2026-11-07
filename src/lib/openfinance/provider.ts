// Interface do provedor de Open Finance. SOMENTE TIPOS: não há implementação concreta nesta etapa
// e nada aqui importa código da Celcoin nem de qualquer outro provedor.
//
// O provedor será escolhido no servidor (variável OF_PROVIDER, ainda sem efeito). Dados,
// tokens e consentimentos de um provedor nunca devem ser misturados com os de outro.

export type OpenFinanceConnectionStatus = "disconnected" | "pending" | "connected" | "expired" | "error";

export interface StartConsentInput {
  /** Usuário autenticado dono do consentimento. */
  userId: string;
  /** Instituição escolhida, quando o provedor exigir. */
  institutionId?: string;
  /** Endereço do Falaí para onde o usuário volta após autorizar no banco. */
  returnUrl: string;
}

export type StartConsentResult =
  | { status: "not_configured" }
  | { status: "pending"; authorizationUrl: string };

export interface OpenFinanceProvider {
  readonly id: string;
  startConsent(input: StartConsentInput): Promise<StartConsentResult>;
  getConnectionStatus(userId: string): Promise<OpenFinanceConnectionStatus>;
  // A documentação da Celcoin lida até agora não confirma endpoint de revogação:
  // disconnect() pode precisar apenas remover os dados locais.
  disconnect(userId: string): Promise<void>;
}
