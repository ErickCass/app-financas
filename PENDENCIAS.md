# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar.
Quando confirmar, eu movo para "Feito" com a data.

## Aberto

| # | O que | Por quê | Onde |
|---|-------|---------|------|
| 1 | Rodar `supabase/migrations/20261114000000_backups.sql` | Liga a cópia automática diária dos dados | SQL Editor do Supabase |
| 2 | Rodar `supabase/migrations/20261111100000_benefit_accounts.sql` (se ainda não rodou) | Aceita conta do tipo "benefício" (cartão Flash) | SQL Editor do Supabase |
| 3 | Rodar `recriar-categorias.sql` e reimportar os 5 extratos | Recuperar os dados perdidos em novembro | Supabase + tela de importar |
| 4 | Gerar a chave de API do App Store Connect (`.p8` + Key ID + Issuer ID), papel Admin | Sem ela não há build para o TestFlight | appstoreconnect.apple.com → Users and Access → Integrations |
| 5 | Adicionar `https://finiapp.pages.dev` nas origens autorizadas do Google e nas Redirect URLs do Supabase | Login com Google no domínio novo | Google Cloud Console + Supabase Auth |
| 6 | Dar acesso de Owner ao erick.cassinoni no projeto do Google Cloud (ou usar a conta noreply) | Hoje você não consegue editar as credenciais | Google Cloud IAM |
| 7 | Criar o App ID com a capacidade Sign in with Apple, Services ID e chave `.p8` | Login com Apple | developer.apple.com |
| 8 | Exportar a fatura do Mastercard Personnalité | Esse cartão está sem lançamentos no app | App do Itaú |
| 9 | Testar o backup de ponta a ponta: baixar um arquivo e restaurar com ele | Eu testei a lógica, não o seu banco | App → Ajustes → Backup |

## Feito

(nada ainda)

## Observações

- Scripts SQL deste projeto são sempre idempotentes: rodar duas vezes não causa
  dano. Se algum dia eu te mandar um que não seja, eu aviso em letras garrafais.
- A chave de API da Apple é sensível: guardo fora do repositório, com permissão
  restrita, e você pode revogar quando quiser.
