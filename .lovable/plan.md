## Problema

Ao clicar no ícone ⚙️ na tela de Recarga, a URL muda para `/app/recarga/configuracoes` mas a tela continua mostrando a página de Recarga — parece que "não vai a lugar nenhum".

## Causa

No TanStack Router, `src/routes/app.recarga.tsx` é a rota **pai** de `src/routes/app.recarga.configuracoes.tsx` (por causa do naming flat `app.recarga.configuracoes`). Quando uma rota tem filhos, o componente pai precisa renderizar `<Outlet />` — caso contrário, a rota filha é "casada" mas nunca aparece em tela.

O arquivo `app.recarga.tsx` atual **não** tem `<Outlet />`, então ao navegar para `/app/recarga/configuracoes`, a página de Recarga continua sendo renderizada por cima.

## Correção

Renomear `src/routes/app.recarga.tsx` → `src/routes/app.recarga.index.tsx` e atualizar a declaração de rota de `createFileRoute("/app/recarga")` para `createFileRoute("/app/recarga/")`.

Assim, `app.recarga.index.tsx` (página principal de Recarga) e `app.recarga.configuracoes.tsx` (Configurações) ficam como **rotas-irmãs** sob `/app/recarga`, sem precisar de pai-com-Outlet. O `routeTree.gen.ts` é regerado automaticamente pelo plugin do Vite.

Nenhuma outra alteração de lógica, UI ou backend é necessária — o `<Link to="/app/recarga/configuracoes">` já está correto e a rota de configurações já existe.