import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Falaí Finanças" },
      {
        name: "description",
        content:
          "Política de Privacidade do app Falaí Finanças: como coletamos, usamos e protegemos seus dados financeiros.",
      },
      { property: "og:title", content: "Política de Privacidade — Falaí Finanças" },
      {
        property: "og:description",
        content:
          "Política de Privacidade do app Falaí Finanças: como coletamos, usamos e protegemos seus dados financeiros.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
});

function PrivacyPage() {
  const updated = "11 de junho de 2026";
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="mb-2 text-3xl font-bold">Política de Privacidade</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Última atualização: {updated}
      </p>

      <section className="space-y-6 text-base leading-relaxed">
        <p>
          O <strong>Falaí Finanças</strong> ("nós", "nosso app") respeita a sua
          privacidade. Esta política descreve quais dados coletamos, como os
          usamos e quais são os seus direitos como usuário.
        </p>

        <h2 className="mt-8 text-xl font-semibold">1. Dados que coletamos</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Conta:</strong> e-mail, nome e foto de perfil para autenticação.
          </li>
          <li>
            <strong>Dados financeiros:</strong> lançamentos de receitas, despesas,
            categorias, metas e mensagens enviadas para o assistente.
          </li>
          <li>
            <strong>Áudio e imagens:</strong> gravações de voz e fotos de recibos
            que você envia voluntariamente para registro de despesas. O conteúdo é
            processado por IA e descartado após a transcrição/extração.
          </li>
          <li>
            <strong>Telefone (opcional):</strong> número de WhatsApp, caso você
            ative a integração de mensagens.
          </li>
          <li>
            <strong>Dados bancários (opcional):</strong> via Open Finance/Pluggy,
            apenas com seu consentimento explícito.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">2. Como usamos seus dados</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Permitir o funcionamento do app e sincronizar seus lançamentos.</li>
          <li>Processar comandos de voz, texto e imagens via serviços de IA.</li>
          <li>Enviar notificações relacionadas ao seu uso (se ativadas).</li>
          <li>Melhorar a qualidade e segurança do serviço.</li>
        </ul>
        <p>
          <strong>Não vendemos nem compartilhamos</strong> seus dados pessoais ou
          financeiros com terceiros para fins de marketing.
        </p>

        <h2 className="mt-8 text-xl font-semibold">3. Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com provedores estritamente necessários
          para operar o serviço:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Supabase (autenticação e banco de dados)</li>
          <li>Google Cloud / OpenAI (processamento de IA de voz e texto)</li>
          <li>Pluggy (Open Finance, somente se você conectar uma conta)</li>
          <li>Twilio (mensagens WhatsApp, somente se ativado)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">4. Segurança</h2>
        <p>
          Utilizamos criptografia em trânsito (HTTPS/TLS) e em repouso. O acesso
          aos seus dados é restrito ao seu usuário autenticado por meio de
          políticas de segurança no banco (Row-Level Security).
        </p>

        <h2 className="mt-8 text-xl font-semibold">5. Seus direitos (LGPD)</h2>
        <p>De acordo com a LGPD, você pode a qualquer momento:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Acessar, corrigir ou exportar seus dados;</li>
          <li>Solicitar a exclusão permanente da sua conta e dados;</li>
          <li>Revogar consentimentos (Open Finance, WhatsApp, notificações).</li>
        </ul>
        <p>
          Para exercer qualquer direito, envie um e-mail para{" "}
          <a className="underline" href="mailto:privacidade@falai.app">
            privacidade@falai.app
          </a>
          .
        </p>

        <h2 className="mt-8 text-xl font-semibold">6. Retenção</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão,
          os dados pessoais são removidos em até 30 dias, exceto quando a lei
          exigir retenção (ex.: registros fiscais).
        </p>

        <h2 className="mt-8 text-xl font-semibold">7. Crianças</h2>
        <p>
          O Falaí Finanças não é destinado a menores de 18 anos e não coleta
          intencionalmente dados de crianças.
        </p>

        <h2 className="mt-8 text-xl font-semibold">8. Alterações</h2>
        <p>
          Podemos atualizar esta política periodicamente. Mudanças relevantes
          serão comunicadas por e-mail ou dentro do app.
        </p>

        <h2 className="mt-8 text-xl font-semibold">9. Contato</h2>
        <p>
          Dúvidas?{" "}
          <a className="underline" href="mailto:privacidade@falai.app">
            privacidade@falai.app
          </a>
        </p>
      </section>
    </main>
  );
}
