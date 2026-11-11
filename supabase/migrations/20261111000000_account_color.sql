-- Cor da miniatura da conta/cartão (escolhida em Ajustes).
alter table public.accounts add column if not exists color text;
