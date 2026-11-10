-- Estrutura inicial do banco (Supabase / Postgres).
-- Regras:
--   * Todo valor monetário é bigint em CENTAVOS. Negativo = saída, positivo = entrada.
--   * Toda tabela tem user_id e Row Level Security: cada usuário só enxerga o que é dele.
--   * Datas de compra são "date" (sem fuso); carimbos de tempo são timestamptz.

create extension if not exists "pgcrypto";

-- Contas: corrente, cartão, investimento, dinheiro
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('checking', 'credit_card', 'investment', 'cash')),
  balance_cents bigint not null default 0,
  balance_updated_at timestamptz not null default now(),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Categorias: variáveis (com limite), fixas (contas do mês) e renda
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('variable', 'fixed', 'income')),
  color text not null default '#0E4A5C',
  icon text,
  pace_alerts boolean not null default true, -- false = "sem alerta de ritmo" (ex.: Assinaturas)
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Limite mensal por categoria. month = primeiro dia do mês.
-- applies_from permite "todo mês (padrão)" e "só este mês" (override).
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  limit_cents bigint not null check (limit_cents >= 0),
  only_this_month boolean not null default false,
  unique (user_id, category_id, month)
);

-- Contas fixas e receitas recorrentes (geram os lançamentos previstos de cada mês)
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount_cents bigint not null,
  amount_is_estimate boolean not null default false, -- energia, água...
  day_of_month smallint not null check (day_of_month between 1 and 31),
  starts_on date not null,
  ends_on date, -- "até dez/26"
  created_at timestamptz not null default now()
);

-- Lote de importação (um extrato, uma fatura, uma sincronização)
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('file', 'apple_pay', 'open_finance', 'manual')),
  file_name text,
  storage_path text,
  created_at timestamptz not null default now()
);

-- Lançamentos previstos: o que vai acontecer (a pagar / a receber)
create table public.planned (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  due_date date not null,
  description text not null,
  amount_cents bigint not null,
  amount_is_estimate boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  -- Previsto de fatura: soma das compras do cartão naquele mês de fatura
  statement_account_id uuid references public.accounts(id) on delete cascade,
  statement_month date,
  created_at timestamptz not null default now()
);

-- Transações: o que já aconteceu
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  planned_id uuid references public.planned(id) on delete set null, -- previsto que esta transação baixou
  import_batch_id uuid references public.import_batches(id) on delete set null,
  date date not null, -- data da compra (competência)
  description text not null,
  merchant text,
  amount_cents bigint not null,
  source text not null check (source in ('manual', 'import', 'apple_pay', 'open_finance')),
  confirmed boolean not null default true, -- false = veio do Apple Pay e espera o extrato
  is_card_payment boolean not null default false, -- pagamento de fatura: não conta como despesa
  statement_month date, -- compra no cartão: fatura em que entra
  installment_number smallint,
  installment_total smallint,
  category_source text check (category_source in ('user', 'rule', 'ai')),
  external_id text, -- id no Open Finance, para não importar duas vezes
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- Divisão de uma transação entre categorias ("Dividir valor")
create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount_cents bigint not null
);

-- Regras aprendidas: "Posto Petrobrás" -> Transporte
create table public.classification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null, -- descrição normalizada (ver normalizeDescription)
  category_id uuid not null references public.categories(id) on delete cascade,
  confirmations integer not null default 1,
  always_apply boolean not null default false, -- "Sempre usar para esta loja"
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);

-- Preferências de alerta
create table public.alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pace_above_usual boolean not null default true,
  forecast_overrun boolean not null default true,
  at_80_percent boolean not null default true,
  over_limit boolean not null default true,
  large_purchase_cents bigint, -- null = desligado
  ask_category text not null default 'when_unsure' check (ask_category in ('always', 'when_unsure', 'never'))
);

-- Índices para as consultas das telas
create index on public.transactions (user_id, date desc);
create index on public.transactions (user_id, category_id, date);
create index on public.transactions (user_id, account_id, statement_month);
create index on public.planned (user_id, due_date) where status = 'pending';
create index on public.budgets (user_id, month);

-- Row Level Security: cada usuário só lê e grava os próprios dados
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'budgets', 'recurring_rules', 'import_batches',
    'planned', 'transactions', 'transaction_splits', 'classification_rules', 'alert_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono le e grava" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
