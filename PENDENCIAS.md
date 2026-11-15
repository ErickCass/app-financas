# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar;
quando confirmar, movo para "Feito" com a data.

*Atualizado em 14/11/2026, 21h.*

---

## 1. TestFlight: instalar o Finia no iPhone ⏳ agora

O build já foi enviado e a Apple está processando (5–10 min; chega um e-mail).

1. No iPhone, baixe o app **TestFlight** da App Store.
2. No Mac, abra `appstoreconnect.apple.com/apps/6834956660/testflight/ios` e confira
   se o seu e-mail está no grupo **Team (Expo)**. Se não estiver, adicione.
3. Se a Apple perguntar sobre criptografia, responda que o app **não usa**
   criptografia além da padrão.
4. Aceite o convite no iPhone e toque em **Instalar**.

No app nativo, entre com o **código por e-mail** (Google e Apple ainda não
funcionam nele).

## 2. Reimportar os 5 extratos

Pelo **navegador** (`finiapp.pages.dev`), porque o app nativo ainda não lê PDF.
Em **Importar**: fatura Itaú (PDF), extrato Itaú (PDF), extrato do app Itaú (PDF),
Nubank (CSV) e Flash (CSV). As regras de classificação aprendidas se perderam;
reclassifique uma vez e o app reaprende.

## 3. Testar o backup de ponta a ponta

Depois da reimportação: **Ajustes → Seus dados → Backup e restauração** →
*Baixar backup agora*, depois *Restaurar de um arquivo* com esse mesmo arquivo.
Se tudo continuar igual, a restauração funciona. Eu testei a lógica, não o seu banco.

## 4. Fatura do Mastercard Personnalité

Exportar pelo app do Itaú e me mandar. Esse cartão está sem lançamentos no app.

## 5. Google: login no domínio novo

Adicionar `https://finiapp.pages.dev` em:
- Google Cloud Console → Credentials → o cliente OAuth → **Authorized JavaScript origins**
- Supabase → Authentication → URL Configuration → **Redirect URLs** (`https://finiapp.pages.dev/**`)

Pré-requisito: a conta erick.cassinoni não consegue editar o projeto do Google
Cloud. Entre com a conta noreply ou dê à sua o papel **Owner** em IAM.

## 6. Apple: Sign in with Apple

Em developer.apple.com:
- Marcar a capacidade **Sign in with Apple** no App ID `com.erickalmeida.financas`
  (a sincronização automática falhou e precisa ser feita à mão).
- Criar um **Services ID** e uma chave `.p8` para o login.
- Cadastrar os dois no Supabase → Authentication → Providers → Apple.

Depois disso eu removo o plugin `withoutAppleSignIn` e gero um novo build. A Apple
exige renovar o segredo a cada 6 meses, e eu aviso quando chegar perto.

## 7. Apagar o registro antigo FINITY (opcional, sem pressa)

No App Store Connect existe o app **FINITY** (`com.autonomousfinance.app`) do
projeto antigo. Não atrapalha, mas pode ser removido quando quiser.

---

## Feito

- 14/11: Registro do app Finia no App Store Connect; primeiro build enviado ao TestFlight.
- 14/11: Scripts SQL (conta "benefício", cópias automáticas de backup, recriação das categorias).
- 14/11: Chave de API do App Store Connect (`.p8`, Key ID, Issuer ID) e Team ID.
- 14/11: Domínios da Apple e `storage.googleapis.com` liberados no meu ambiente.

## Observações

- A chave de API da Apple fica fora do repositório, com leitura restrita. Você
  pode revogá-la quando quiser em App Store Connect → Users and Access → Integrations.
- Scripts SQL deste projeto são sempre seguros de repetir. Se algum dia eu mandar
  um que não seja, eu aviso em destaque.
