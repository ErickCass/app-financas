import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { cellDate, cellText, isZip, readXlsx } from "./xlsx";

/** Monta um .xlsx mínimo, como o que os bancos exportam. */
function xlsx(sheet: string, shared: string[] = [], styles = ""): Uint8Array {
  return zipSync({
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
    "xl/sharedStrings.xml": strToU8(`<sst>${shared.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`),
    "xl/styles.xml": strToU8(styles || `<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`),
  });
}

describe("planilha .xlsx", () => {
  it("reconhece o zip e lê texto, número e data", () => {
    const bytes = xlsx(
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>12.5</v></c><c r="C1" s="1"><v>46325</v></c></row>`,
      ["Lançamento"],
    );
    expect(isZip(bytes)).toBe(true);
    const [row] = readXlsx(bytes);
    expect(cellText(row![0])).toBe("Lançamento");
    expect(row![1]).toBe(12.5);
    expect(cellDate(row![2])).toBe("2026-10-30");
  });

  it("célula vazia não desloca as seguintes", () => {
    // <c .../> autofechada: o erro clássico é engolir a célula seguinte.
    const [row] = readXlsx(xlsx(`<row r="1"><c r="A1"><v>1</v></c><c r="B1" s="0"/><c r="C1"><v>3</v></c><c r="D1" s="0"/><c r="E1" t="s"><v>0</v></c></row>`, ["fim"]));
    expect(row).toEqual([1, null, 3, null, "fim"]);
  });

  it("linha vazia e texto com entidades", () => {
    const rows = readXlsx(xlsx(`<row r="1"/><row r="2"><c r="A2" t="inlineStr"><is><t>A &amp; B</t></is></c></row>`));
    expect(rows).toEqual([[], ["A & B"]]);
  });

  it("recusa arquivo que não é planilha", () => {
    expect(() => readXlsx(zipSync({ "leiame.txt": strToU8("oi") }))).toThrow(/planilha/i);
  });
});
