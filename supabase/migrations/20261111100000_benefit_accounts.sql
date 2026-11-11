-- Cartão de benefício (vale-alimentação/refeição): saldo próprio, fora do caixa.
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check check (kind in ('checking', 'credit_card', 'investment', 'cash', 'benefit'));
