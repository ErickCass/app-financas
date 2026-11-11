-- Miniatura da conta/cartão: cor escolhida e foto do cartão (data URL pequena), definidas em Ajustes.
alter table public.accounts add column if not exists color text;
alter table public.accounts add column if not exists image text;
