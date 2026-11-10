// Copia o pdf.js para public/pdfjs: o site serve o leitor de PDF do próprio domínio,
// e ele só é baixado quando alguém importa um PDF.
import { copyFileSync, mkdirSync } from "node:fs";
const from = "node_modules/pdfjs-dist/legacy/build";
mkdirSync("public/pdfjs", { recursive: true });
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) copyFileSync(`${from}/${f}`, `public/pdfjs/${f}`);
console.log("pdf.js copiado para public/pdfjs");
