# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar;
quando confirmar, movo para "Feito" com a data.

Os scripts SQL abaixo estão **com o conteúdo completo**: é copiar o bloco e colar
no SQL Editor do Supabase. Todos são seguros para rodar mais de uma vez.
Se aparecer "Success. No rows returned", deu certo.

---

## 1. Supabase — conta do tipo "benefício" (cartão Flash)

```sql
-- Cartão de benefício (vale-alimentação/refeição): saldo próprio, fora do caixa.
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check check (kind in ('checking', 'credit_card', 'investment', 'cash', 'benefit'));
```

## 2. Supabase — cópias automáticas diárias (backup)

```sql
-- Cópia automática dos dados, dentro do próprio banco.
-- Protege contra o que já aconteceu uma vez: um comando errado apagando tudo.
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  row_count integer not null default 0,
  payload jsonb not null
);

create index if not exists backups_user_created on public.backups (user_id, created_at desc);

alter table public.backups enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'backups' and policyname = 'backups_own') then
    create policy backups_own on public.backups
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Mantém as 7 cópias mais recentes e nunca descarta a cópia mais recente que
-- tenha dados: se algo apagar o banco, as cópias vazias não empurram a boa para fora.
create or replace function public.prune_backups() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  keep_good uuid;
begin
  select id into keep_good
    from public.backups
   where user_id = new.user_id and row_count > 0
   order by created_at desc
   limit 1;

  delete from public.backups
   where user_id = new.user_id
     and id <> coalesce(keep_good, '00000000-0000-0000-0000-000000000000'::uuid)
     and id not in (
       select id from public.backups
        where user_id = new.user_id
        order by created_at desc
        limit 7
     );
  return null;
end $$;

drop trigger if exists prune_backups_after_insert on public.backups;
create trigger prune_backups_after_insert
  after insert on public.backups
  for each row execute function public.prune_backups();
```

## 3. Supabase — recriar as categorias e os orçamentos de novembro

Só se você ainda não refez as categorias à mão no app. Se já refez, pule.

```sql
-- Recria categorias e limites de novembro/2026 para o usuário erick.cassinoni,
-- a partir das listas vistas ontem. Seguro para rodar quantas vezes quiser:
-- só cria o que falta e atualiza os limites; não apaga nada.
do $$
declare
  u uuid := 'e9d3bab5-0238-435c-8d80-52aa3235197f';
  m date := '2026-11-01';
  r record;
  cid uuid;
  cores text[] := array['#0E4A5C','#C2410C','#E7A36B','#4D8A9A','#C98BB9','#8C8C94','#7C6FB0','#2E9E5B','#2F6FD6','#B45309','#0F766E','#9D174D','#4338CA','#65A30D','#1E7A46','#D23B2A'];
  i int := 0;
begin
  for r in
    select * from (values
      -- nome, tipo, limite em centavos (0 = sem limite)
      ('Mercado',                  'variable', 300000),
      ('Restaurantes / Lazer',     'variable', 100000),
      ('Combustível / Uber',       'variable', 100000),
      ('SAP Trip',                 'variable', 347483),
      ('Saúde',                    'variable',  90000),
      ('Medicamentos e Vitaminas', 'variable',  50000),
      ('Viagens',                  'variable',  50000),
      ('Compras',                  'variable',      0),
      ('Assinaturas',              'variable',      0),
      ('Casa e serviços',          'variable',      0),
      ('Academia',                 'variable',      0),
      ('Cuidados Dani',            'variable',      0),
      ('Lavanderia',               'variable',      0),
      ('Manutenção Casa',          'variable',      0),
      ('Presentes',                'variable',      0),
      ('Zé Luiz',                  'variable',      0),
      ('Apple iCloud',             'variable',      0),
      ('Youtube Premium',          'variable',      0),
      ('MEI',                      'variable',      0),
      ('Condomínio FG',            'fixed',    120000),
      ('Escola Sarah',             'fixed',    192000),
      ('Conta de Energia',         'fixed',     50000),
      ('Doações',                  'fixed',     10000),
      ('Dízimo',                   'fixed',    350000),
      ('F1 Parts',                 'fixed',     32000),
      ('Prudential',               'fixed',     90000),
      ('Celular + Internet',       'fixed',     27000),
      ('PET',                      'fixed',     70000),
      ('Moradia',                  'fixed',    400000),
      ('Ajuda Mae',                'fixed',     70000),
      ('Amazon',                   'fixed',      5000),
      ('Cabelo e Barba',           'fixed',     15000),
      ('Google Storage',           'fixed',      7000),
      ('Claude',                   'fixed',     10000),
      ('ChatGPT',                  'fixed',     10000),
      ('Manus',                    'fixed',     10000),
      ('IPTU',                     'fixed',     30000),
      ('Lentes de Contato',        'fixed',     25000),
      ('Educação',                 'fixed',         0),
      ('Renda',                    'income',  3400000)
    ) as t(nome, tipo, limite)
  loop
    i := i + 1;
    insert into public.categories (user_id, name, kind, color)
    values (u, r.nome, r.tipo, cores[1 + (i % array_length(cores, 1))])
    on conflict (user_id, name) do update set kind = excluded.kind, archived = false
    returning id into cid;

    if r.limite > 0 then
      insert into public.budgets (user_id, category_id, month, limit_cents)
      values (u, cid, m, r.limite)
      on conflict (user_id, category_id, month) do update set limit_cents = excluded.limit_cents;
    end if;
  end loop;

  -- Categorias padrão que você não usava: ficam arquivadas (somem das telas).
  update public.categories set archived = true
   where user_id = u and name in ('Transporte', 'Lazer');
end $$;

select kind, count(*) from public.categories where user_id = 'e9d3bab5-0238-435c-8d80-52aa3235197f' and not archived group by kind;
```

## 4. Reimportar os 5 extratos

Depois dos scripts acima, em **Importar** no app: fatura Itaú (PDF), extrato Itaú
(PDF), extrato do app Itaú (PDF), Nubank (CSV) e Flash (CSV). As regras de
classificação aprendidas se perderam junto; reclassifique uma vez e o app reaprende.

## 5. Testar o backup de ponta a ponta

**Ajustes → Seus dados → Backup e restauração**: toque em *Baixar backup agora*,
depois em *Restaurar de um arquivo* com esse mesmo arquivo. Se tudo continuar
igual, a restauração funciona — eu testei a lógica, não o seu banco.

## 6. Google — login no domínio novo

Adicionar `https://finiapp.pages.dev` em:
- Google Cloud Console → Credentials → o cliente OAuth → **Authorized JavaScript origins**
- Supabase → Authentication → URL Configuration → **Redirect URLs** (`https://finiapp.pages.dev/**`)

Pré-requisito: a conta erick.cassinoni não consegue editar o projeto do Google
Cloud. Ou entre com a conta noreply, ou dê a ela o papel **Owner** em IAM.

## 7. Apple — Sign in with Apple

Em developer.apple.com: marcar a capacidade **Sign in with Apple** no App ID
`com.erickalmeida.financas` (a sincronização automática falhou; precisa ser à mão),
criar um **Services ID** e uma chave `.p8` para o login, e cadastrar os dois no
Supabase → Authentication → Providers → Apple. A Apple exige renovar o segredo a
cada 6 meses; eu aviso quando chegar perto.

## 8. Fatura do Mastercard Personnalité

Exportar pelo app do Itaú e me mandar. Esse cartão está sem lançamentos no app.

## 9. TestFlight

Quando eu avisar que o build subiu: instalar o app **TestFlight** da App Store e
aceitar o convite que chega por e-mail.

---

## Feito

- 14/11 — Chave de API do App Store Connect (`.p8`, Key ID, Issuer ID) e Team ID.
- 14/11 — Domínios da Apple e `storage.googleapis.com` liberados no meu ambiente.

## Observações

- A chave de API da Apple fica fora do repositório, com leitura restrita. Você
  pode revogá-la quando quiser em App Store Connect → Users and Access → Integrations.
- Se algum dia eu te mandar um script que **não** seja seguro de repetir, eu aviso
  em letras garrafais. Não foi o que fiz em novembro, e não vai se repetir.
