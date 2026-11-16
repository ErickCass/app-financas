# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar;
quando confirmar, movo para "Feito" com a data.

*Atualizado em 16/11/2026. Cada item diz onde fazer: no app do iPhone, no site (navegador), no Supabase etc.*

---

## 1. Separar as compras do Mastercard 9121 — **no Supabase → SQL Editor**

Rodar o script `separar-mastercard.sql` (enviado no chat em 16/11). Ele cria o cartão
9121 e move para ele as 38 compras da fatura de novembro que entraram por engano no
Visa 9265. Não apaga nada e pode rodar mais de uma vez. Esperado na tabelinha final:
9121 com 38 compras somando −1117.07. Se vier com 0, importar a fatura **no site**.

## 2. Testar o login com Google — **no site (navegador)**

Sair e entrar com o Google em `finiapp.pages.dev`. Configuração no Supabase já feita.

## 3. Sign in with Apple — **em developer.apple.com, depois no Supabase**

- Em developer.apple.com: marcar **Sign in with Apple** no App ID
  `com.erickalmeida.financas`, criar um **Services ID** e uma chave `.p8` de login.
- No Supabase → Authentication → Providers → Apple: cadastrar os dois.

Depois eu removo o plugin `withoutAppleSignIn` e gero um build novo. A Apple exige
renovar o segredo a cada 6 meses; eu aviso quando chegar perto.

## 4. Apagar o registro antigo FINITY — **no App Store Connect** (opcional)

O app **FINITY** (`com.autonomousfinance.app`) é do projeto antigo. Não atrapalha.

---

## Feito

- 16/11: Endereços novos cadastrados no Supabase (Site URL e Redirect URLs).
- 16/11: Fatura do Mastercard Personnalité enviada.
- 16/11: Backup testado de ponta a ponta: 515 registros restaurados.
- 14/11: Finia instalado pelo TestFlight; atualizações automáticas funcionando no iPhone.
- 14/11: Domínio das atualizações automáticas liberado.
- 14/11: Extratos reimportados; app TestFlight instalado.
- 14/11: Registro do app Finia no App Store Connect; primeiro build enviado ao TestFlight.
- 14/11: Scripts SQL (conta "benefício", cópias automáticas de backup, recriação das categorias).
- 14/11: Chave de API do App Store Connect (`.p8`, Key ID, Issuer ID) e Team ID.
- 14/11: Domínios da Apple e `storage.googleapis.com` liberados no meu ambiente.

## Observações

- A chave de API da Apple fica fora do repositório, com leitura restrita. Você
  pode revogá-la quando quiser em App Store Connect → Users and Access → Integrations.
- Scripts SQL deste projeto são sempre seguros de repetir. Se algum dia eu mandar
  um que não seja, eu aviso em destaque.
