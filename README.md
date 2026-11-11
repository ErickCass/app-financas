# Finia (nome provisório)

App de finanças pessoais para iPhone e web, com o mesmo código (Expo / React Native).

## Como rodar

```bash
npm install
npm run web          # abre no navegador
npm run ios          # simulador (precisa de Mac) ou Expo Go no iPhone
npm test             # testes da lógica financeira
npm run typecheck
```

## Configuração do Supabase

1. Copie `.env.example` para `.env` e preencha a URL e a chave **publishable** do projeto
   (Project Settings › API). Nunca use a chave `service_role`/secret no app.
2. Rode o SQL de `supabase/migrations/` no SQL Editor do Supabase.
3. Em **Authentication › Emails › Magic Link**, inclua o código no corpo do e-mail
   (por exemplo `Seu código: {{ .Token }}`), para o login por código funcionar (o Supabase envia 8 dígitos por padrão).
4. Sem as variáveis de ambiente, o app abre direto no modo demonstração.

## Estrutura

```
src/
  app/                 telas (Expo Router: cada arquivo é uma rota)
    (tabs)/            Início, Orçamento, Lançamentos, Assistente
    categoria/[id].tsx orçamento da categoria aberto até cada transação
    fatura/[id].tsx    composição da fatura do cartão
  domain/              regras financeiras puras, sem tela, com testes
    money.ts           valores em centavos inteiros e formatação em reais
    budget.ts          as quatro cores do orçamento, ritmo pelo histórico, previsão
    projection.ts      saldo projetado do mês e do ano, despesas e renda
    dedup.ts           remoção de duplicados (Apple Pay + extrato + Open Finance)
    cardPayment.ts     pagamento de fatura não conta como despesa
  data/                camada de dados: Supabase quando logado, demonstração quando não
    auth.tsx           login por e-mail com código
    remote.ts          leitura e gravação no Supabase (RLS por usuário)
    mappers.ts         conversão banco ↔ domínio, com testes
  ui/                  tema, componentes, gráficos
supabase/migrations/   estrutura do banco com segurança por usuário (RLS)
```

## Decisões que valem para todo o código

- **Dinheiro é sempre centavo inteiro.** Nunca `float` para valores.
- **Compras no cartão entram no orçamento na data da compra.** O pagamento da fatura é uma transferência e não conta de novo como despesa.
- **Previsto e realizado são coisas diferentes.** "A pagar" vem de lançamentos previstos com vencimento, nunca de "orçamento menos gasto".
- **Cores do orçamento:** verde (vai sobrar, previsão abaixo de 85%), azul (no ritmo, 85% a 100%), amarelo (vai estourar), vermelho (estourou).
- **O ritmo esperado vem do histórico da própria categoria.** Assinaturas cobradas no dia 1 não disparam alerta; mercado com 80% no dia 2 dispara.
- Identificadores técnicos são neutros (`com.erickalmeida.financas`) para o nome do produto poder mudar antes do lançamento.

## Próximos passos (fase 1)

1. Importação de extratos: portar os leitores de PDF e Excel do Itaú do app antigo, com os testes.
2. Contas fixas (regras recorrentes que geram os lançamentos previstos de cada mês).
3. Login com Apple e Google (exige configurar os provedores no Supabase).

## Login com Google e Apple

Os botões aparecem sozinhos quando o provedor é ligado no Supabase (Authentication › Sign In / Providers);
não é preciso publicar de novo.

- **URL Configuration** do Supabase: Site URL `https://erick0303-app-financas.expo.app`; Redirect URLs
  `https://erick0303-app-financas.expo.app/**` e `appfinancas://**` (app do iPhone).
- **Google**: cliente OAuth do tipo "Aplicativo da Web" no Google Cloud, com a URI de redirecionamento
  `https://zqthktwzjrvggopuxyfv.supabase.co/auth/v1/callback`; Client ID e Secret vão no provedor Google do Supabase.
- **Apple**: exige o Apple Developer Program. No iPhone o login usa a folha nativa (`expo-apple-authentication`);
  no navegador usa um Services ID + chave .p8 configurados no provedor Apple do Supabase.

## Importação de faturas e extratos

Tela **Importar** (aba Lançamentos, Início e Ajustes). Lê no próprio aparelho, mostra uma prévia e só então grava.

- Fatura do cartão Itaú (PDF): compras nacionais e internacionais, IOF, tarifas e parcelas; confere cada subtotal
  e o total da fatura. Parcela n entra no orçamento n−1 meses depois da compra.
- Extrato da conta Itaú (PDF): confere com os saldos diários; o saldo final vira o saldo da conta; pagamento de
  fatura e PIX para o próprio titular são transferências internas (não contam como despesa).
- Fatura do Nubank (CSV): vencimento vem do nome do arquivo; a fatura aberta entra como previsto estimado.
- Cada lançamento tem uma chave estável (`external_id`): reimportar o mesmo arquivo não duplica.
- Categoria: regra aprendida → palavras-chave → categoria do banco. Ao mudar a categoria de uma compra, o app
  aplica às compras iguais sem categoria e guarda a regra para as próximas importações.
- PDFs usam o pdf.js servido de `public/pdfjs` (copiado de `node_modules` no `postinstall`); no iPhone, por
  enquanto, só CSV.

## Regra: compra no cartão é paga no próprio mês

Por decisão do produto, toda compra no cartão conta como despesa **a pagar no mês da compra** (orçamento e
saldo projetado). A fatura não entra no saldo projetado (seria contar duas vezes); o pagamento dela é
transferência interna e já aparece no saldo real da conta quando acontece.

## Contas previstas e baixa automática

- Conta fixa com valor previsto (categoria do tipo "conta fixa" com limite no mês) entra em "a pagar" pelo que falta.
  Quando o pago no mês chega a 90% do previsto, é dada como quitada (condomínio de 1.191,72 contra 1.200 não deixa resto).
- Previsto avulso ou mensal (tabela `planned`) é baixado automaticamente quando, na importação, chega um lançamento do
  mesmo mês, mesmo sinal, valor dentro de 15% (25% se "valor aproximado") e mesma categoria ou descrição parecida.
  O lançamento fica ligado pelo `planned_id`. Regras em `src/domain/reconcile.ts`.
