# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar;
quando confirmar, movo para "Feito" com a data.

Os scripts SQL abaixo estão **com o conteúdo completo**: é copiar o bloco e colar
no SQL Editor do Supabase. Todos são seguros para rodar mais de uma vez.
Se aparecer "Success. No rows returned", deu certo.

---

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

- 14/11 — Registro do app Finia no App Store Connect; primeiro build enviado ao TestFlight.
- 14/11 — Scripts SQL: conta "benefício", cópias automáticas de backup e recriação das categorias.
- 14/11 — Chave de API do App Store Connect (`.p8`, Key ID, Issuer ID) e Team ID.
- 14/11 — Domínios da Apple e `storage.googleapis.com` liberados no meu ambiente.

## Observações

- A chave de API da Apple fica fora do repositório, com leitura restrita. Você
  pode revogá-la quando quiser em App Store Connect → Users and Access → Integrations.
- Se algum dia eu te mandar um script que **não** seja seguro de repetir, eu aviso
  em letras garrafais. Não foi o que fiz em novembro, e não vai se repetir.
