import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/guia-gestao-de-gastos")({
  head: () => ({
    meta: [
      { title: "Guia de gestão de gastos com voz e IA | Falaí Finanças" },
      {
        name: "description",
        content:
          "Guia completo de gestão de gastos pessoais: como organizar despesas, criar orçamento e automatizar tudo com voz, foto e IA — sem planilhas de Excel.",
      },
      { property: "og:title", content: "Guia de gestão de gastos eficiente com voz e IA" },
      {
        property: "og:description",
        content:
          "Pare de digitar despesas em planilhas. Aprenda a fazer gestão de gastos automatizada usando voz, fotos de recibos e IA.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:title", content: "Guia de gestão de gastos eficiente" },
      {
        name: "twitter:description",
        content:
          "Como organizar finanças pessoais com automação por voz e IA — alternativa moderna ao Excel.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://falai-finan-as.lovable.app/blog/guia-gestao-de-gastos" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Como fazer uma gestão de gastos eficiente em 2026",
          description:
            "Guia prático de gestão de gastos pessoais com automação por voz, foto e IA.",
          author: { "@type": "Organization", name: "Falaí Finanças" },
          publisher: { "@type": "Organization", name: "Falaí Finanças" },
          datePublished: "2026-06-12",
          dateModified: "2026-06-12",
          mainEntityOfPage: "https://falai-finan-as.lovable.app/blog/guia-gestao-de-gastos",
          inLanguage: "pt-BR",
        }),
      },
    ],
  }),
  component: GuiaGestaoGastos,
});

function GuiaGestaoGastos() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Guia · Finanças pessoais
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-bold leading-tight">
            Como fazer uma gestão de gastos eficiente em 2026
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Um guia prático para quem quer entender (e controlar) para onde o dinheiro
            vai — sem perder tempo digitando despesas em planilha.
          </p>
        </header>

        <section className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <h2 className="text-2xl font-semibold">O que é gestão de gastos?</h2>
          <p>
            Gestão de gastos é o hábito de registrar, categorizar e revisar tudo o que
            você gasta para tomar decisões financeiras melhores. Não é sobre cortar
            cafés: é sobre ter clareza para decidir onde vale a pena gastar e onde dá
            para economizar sem dor.
          </p>

          <h2 className="text-2xl font-semibold">Por que planilhas de Excel não funcionam</h2>
          <p>
            Quase todo mundo já tentou: cria uma planilha linda em janeiro, mantém em
            fevereiro, e em março já abandonou. O problema não é a planilha — é o
            atrito. Cada despesa exige abrir o computador, escolher categoria, digitar
            valor e descrição. Em compras do dia a dia (almoço, Uber, mercado), esse
            esforço se acumula até virar barreira.
          </p>
          <p>
            Resultado: você só lança quando "sobra tempo", esquece metade dos gastos e
            no fim do mês os números não batem com o extrato bancário.
          </p>

          <h2 className="text-2xl font-semibold">Os 4 pilares de uma gestão eficiente</h2>

          <h3 className="text-xl font-semibold mt-6">1. Registro sem atrito</h3>
          <p>
            Se anotar uma despesa demora mais de 5 segundos, você vai parar de fazer.
            Por isso a tendência moderna é registrar por <strong>voz</strong> ("anota
            25 reais de almoço hoje"), por <strong>foto do recibo</strong> ou por uma
            mensagem rápida no WhatsApp. A IA cuida do resto: extrai valor, data e
            categoria.
          </p>

          <h3 className="text-xl font-semibold mt-6">2. Categorização automática</h3>
          <p>
            Categorizar manualmente é o segundo gargalo. Um bom app reconhece padrões
            ("iFood" → Alimentação, "Uber" → Transporte) e aprende com suas correções.
            Você passa a revisar categorias em vez de digitá-las.
          </p>

          <h3 className="text-xl font-semibold mt-6">3. Conexão com o banco</h3>
          <p>
            Conectar suas contas via Open Finance importa transações automaticamente —
            cartão de crédito, débito, Pix. Você deixa de "lembrar" e passa a
            <em> revisar</em> o que já foi capturado. É a diferença entre contabilidade
            reativa e proativa.
          </p>

          <h3 className="text-xl font-semibold mt-6">4. Revisão semanal de 5 minutos</h3>
          <p>
            Reserve 5 minutos no domingo para olhar o resumo da semana: categorias com
            mais gasto, comparativo com a semana anterior e meta do mês. Essa revisão
            curta e regular vale mais do que uma análise mensal demorada que ninguém
            faz.
          </p>

          <h2 className="text-2xl font-semibold">Passo a passo para começar hoje</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Escolha uma ferramenta que aceite voz, foto ou mensagem.</li>
            <li>Conecte seu banco principal (Open Finance) para puxar histórico.</li>
            <li>
              Registre tudo por 7 dias — sem julgar, só capturando. Você precisa de
              dados antes de cortar nada.
            </li>
            <li>
              No 8º dia, abra o relatório por categoria e identifique as 3 maiores.
            </li>
            <li>
              Defina <strong>uma</strong> meta para o mês seguinte (ex: reduzir
              delivery em 20%).
            </li>
            <li>Revise toda semana. Ajuste no fim do mês.</li>
          </ol>

          <h2 className="text-2xl font-semibold">Erros comuns que travam a gestão</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Categorias demais:</strong> mais de 15 categorias vira ruído.
              Comece com 8 a 10.
            </li>
            <li>
              <strong>Querer perfeição:</strong> 80% das despesas capturadas já é o
              suficiente para tomar decisões.
            </li>
            <li>
              <strong>Misturar pessoal e empresarial:</strong> separe contas e cartões.
            </li>
            <li>
              <strong>Olhar só o saldo:</strong> saldo não conta a história — categorias
              contam.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold">Como o Falaí Finanças automatiza tudo isso</h2>
          <p>
            O Falaí Finanças foi feito para gente que já tentou (e desistiu de)
            planilhas. Você fala, manda foto do recibo ou escreve no WhatsApp — a IA
            categoriza, lança no relatório e mostra para onde seu dinheiro está indo.
            Conectado ao seu banco via Open Finance, ele garante que nada escapa.
          </p>

          <div className="my-8 rounded-xl border border-border bg-muted/30 p-6">
            <p className="font-semibold mb-2">Comece grátis em menos de 1 minuto</p>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre-se e registre sua primeira despesa por voz agora.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Criar conta gratuita
            </Link>
          </div>

          <h2 className="text-2xl font-semibold">Perguntas frequentes</h2>

          <h3 className="text-lg font-semibold mt-4">
            Qual a diferença entre orçamento e gestão de gastos?
          </h3>
          <p>
            Orçamento é o <em>plano</em> (quanto pretendo gastar em cada categoria).
            Gestão de gastos é o <em>acompanhamento</em> (quanto realmente gastei). Os
            dois andam juntos: sem registro, o orçamento vira ficção.
          </p>

          <h3 className="text-lg font-semibold mt-4">
            Preciso registrar gastos pequenos (R$ 5, R$ 10)?
          </h3>
          <p>
            Sim — são justamente os pequenos que somam e "desaparecem" no fim do mês.
            Por isso o registro por voz importa: dizer "5 reais de café" leva 2
            segundos.
          </p>

          <h3 className="text-lg font-semibold mt-4">É seguro conectar meu banco?</h3>
          <p>
            O Open Finance é regulamentado pelo Banco Central. O acesso é apenas de
            leitura — o app vê transações, mas não pode movimentar dinheiro.
          </p>
        </section>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            ← Voltar para o início
          </Link>
        </footer>
      </article>
    </main>
  );
}
