// Remove o entitlement "Sign in with Apple" que o expo-apple-authentication
// adiciona sozinho ao ser instalado. O perfil de assinatura ainda não tem essa
// capacidade (item 7 do PENDENCIAS.md); com o entitlement presente, o Xcode
// recusa o build. Apagar este plugin quando o login com Apple for ativado.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults["com.apple.developer.applesignin"];
    return c;
  });
};
