# Pendências do Erick

Coisas que só você pode fazer. Eu cobro a cada conversa até você confirmar;
quando confirmar, movo para "Feito" com a data.

*Atualizado em 16/11/2026.*

---

## 1. Testar o backup de ponta a ponta

Depois da reimportação: **Ajustes → Seus dados → Backup e restauração** →
*Baixar backup agora*, depois *Restaurar de um arquivo* com esse mesmo arquivo.
Se tudo continuar igual, a restauração funciona. Eu testei a lógica, não o seu banco.

## 2. Fatura do Mastercard Personnalité

Exportar pelo app do Itaú e me mandar. Esse cartão está sem lançamentos no app.

## 3. Google: login no domínio novo

Adicionar `https://finiapp.pages.dev` em:
- Google Cloud Console → Credentials → o cliente OAuth → **Authorized JavaScript origins**
- Supabase → Authentication → URL Configuration → **Redirect URLs** (`https://finiapp.pages.dev/**`)

Pré-requisito: a conta erick.cassinoni não consegue editar o projeto do Google
Cloud. Entre com a conta noreply ou dê à sua o papel **Owner** em IAM.

## 4. Apple: Sign in with Apple

Em developer.apple.com:
- Marcar a capacidade **Sign in with Apple** no App ID `com.erickalmeida.financas`
  (a sincronização automática falhou e precisa ser feita à mão).
- Criar um **Services ID** e uma chave `.p8` para o login.
- Cadastrar os dois no Supabase → Authentication → Providers → Apple.

Depois disso eu removo o plugin `withoutAppleSignIn` e gero um novo build. A Apple
exige renovar o segredo a cada 6 meses, e eu aviso quando chegar perto.

## 5. Apagar o registro antigo FINITY (opcional, sem pressa)

No App Store Connect existe o app **FINITY** (`com.autonomousfinance.app`) do
projeto antigo. Não atrapalha, mas pode ser removido quando quiser.

---

## Feito

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
