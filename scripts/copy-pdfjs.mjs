// Copia o pdf.js para public/pdfjs: o site serve o leitor de PDF do próprio domínio,
// e ele só é baixado quando alguém importa um PDF.
import { copyFileSync, mkdirSync } from "node:fs";
const from = "node_modules/pdfjs-dist/legacy/build";
mkdirSync("public/pdfjs", { recursive: true });
// Salvos como .js: a hospedagem do Expo não publica arquivos .mjs.
for (const f of ["pdf.min", "pdf.worker.min"]) copyFileSync(`${from}/${f}.mjs`, `public/pdfjs/${f}.js`);
console.log("pdf.js copiado para public/pdfjs");
