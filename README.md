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
  data/                camada de dados (hoje: demonstração em memória; próximo: Supabase)
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

1. Ligar o Supabase: aplicar `supabase/migrations`, login com Apple, Google e e-mail.
2. Importação de extratos: portar os leitores de PDF e Excel do Itaú do app antigo, com os testes.
3. Lançamento manual e contas fixas.
