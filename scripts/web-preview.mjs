// Gera um único index.html (JavaScript embutido) a partir de `expo export -p web`.
// Útil para publicar uma prévia estática em qualquer hospedagem simples.
// Uso: npm run build:web && node scripts/web-preview.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const match = html.match(/<script src="(\/_expo\/static\/js\/web\/[^"]+)"[^>]*><\/script>/);
if (!match) throw new Error("Bundle web não encontrado em dist/index.html");
const js = readFileSync(`dist${match[1]}`, "utf8").replaceAll("</script", "<\\/script");
const out = html.replace(match[0], () => `<script>${js}</script>`).replace(/<link rel="icon"[^>]*>/, "");
mkdirSync("web-preview", { recursive: true });
writeFileSync("web-preview/index.html", out);
console.log(`web-preview/index.html (${Math.round(out.length / 1024)} KB)`);
