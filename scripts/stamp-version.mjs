// Grava a identidade da build em dois lugares com o mesmo valor:
//   public/version.json  -> servido pelo site, lido a cada "puxar para atualizar"
//   src/buildId.ts       -> embutido no bundle
// Se os dois diferirem, o navegador está com uma versão antiga em cache.
import { mkdirSync, writeFileSync } from "node:fs";

const buildId = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

mkdirSync("public", { recursive: true });
writeFileSync("public/version.json", `${JSON.stringify({ buildId })}\n`);
writeFileSync(
  "src/buildId.ts",
  `// Gerado por scripts/stamp-version.mjs a cada build. Não edite à mão.\nexport const BUILD_ID = "${buildId}";\n`,
);

console.log(`versão da build: ${buildId}`);
