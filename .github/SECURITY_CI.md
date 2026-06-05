# Segurança no CI

O workflow [`security.yml`](./workflows/security.yml) roda em todo push para `main`, em todo PR para `main` e diariamente às 03:00 UTC. Ele executa três varreduras independentes e um gate final:

| Job | Ferramenta | O que bloqueia |
|-----|------------|----------------|
| `dependency-audit` | `bun audit --audit-level=high` | Vulnerabilidades HIGH ou CRITICAL em dependências de produção |
| `secret-scan` | [gitleaks](https://github.com/gitleaks/gitleaks-action) | Qualquer segredo detectado no diff/histórico |
| `codeql` | [GitHub CodeQL](https://codeql.github.com/) (JS/TS, suite `security-and-quality`) | Alertas de severidade `error` |
| `security-gate` | — | Falha se qualquer um dos jobs acima falhar |

## Como bloquear merges (passo manual no GitHub)

Para que regressões de segurança realmente impeçam o merge é preciso marcar o gate como *required status check*:

1. No GitHub, abra **Settings → Branches → Branch protection rules**.
2. Crie/edite a regra para `main`.
3. Habilite **Require status checks to pass before merging**.
4. Em **Status checks that are required**, selecione:
   - `Security gate`
   - (opcional) `Dependency audit (high/critical)`, `Secret scan (gitleaks)`, `CodeQL (JS/TS)`
5. Habilite **Require branches to be up to date before merging** para que o scan rode contra o estado pós-merge.
6. Salve.

A partir daí, qualquer PR com vulnerabilidade nova, segredo vazado ou alerta CodeQL fica com o botão **Merge** bloqueado até a regressão ser corrigida.

## Rodar localmente antes de abrir PR

```bash
bun install --frozen-lockfile
bun audit --prod --audit-level=high
```

Para gitleaks local: `brew install gitleaks && gitleaks detect --source . -v`.
