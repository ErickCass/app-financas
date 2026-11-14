import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

const { TABLES, chunk, countRows, dueForSnapshot, backupFileName, parseBackupFile, withOwner } = await import("./backup");

const file = (rows: Record<string, unknown[]>) =>
  JSON.stringify({ app: "finia", version: 1, exportedAt: "2026-11-14T12:00:00.000Z", rows });

describe("arquivo de backup", () => {
  it("aceita um backup do Finia e conta os registros", () => {
    const parsed = parseBackupFile(file({ accounts: [{ id: "a" }], transactions: [{ id: "t" }, { id: "u" }] }));
    expect(countRows(parsed)).toBe(3);
  });

  it("recusa um arquivo que não é JSON", () => {
    expect(() => parseBackupFile("isto não é json")).toThrow(/não é um backup/i);
  });

  it("recusa o backup de outro aplicativo", () => {
    expect(() => parseBackupFile(JSON.stringify({ app: "outro", version: 1, rows: {} }))).toThrow(/não é um backup/i);
  });

  it("recusa uma versão futura, em vez de gravar errado", () => {
    expect(() => parseBackupFile(JSON.stringify({ app: "finia", version: 9, rows: {} }))).toThrow(/versão 9/i);
  });

  it("recusa tabela com formato inesperado", () => {
    expect(() => parseBackupFile(file({ accounts: {} as unknown as unknown[] }))).toThrow(/tabela accounts/i);
  });

  it("restaura em outra conta trocando o dono das linhas", () => {
    expect(withOwner([{ id: "a", user_id: "antigo" }], "novo")).toEqual([{ id: "a", user_id: "novo" }]);
  });

  it("grava as tabelas na ordem das dependências", () => {
    const order = (t: string) => TABLES.indexOf(t as (typeof TABLES)[number]);
    expect(order("accounts")).toBeLessThan(order("transactions"));
    expect(order("categories")).toBeLessThan(order("budgets"));
    expect(order("planned")).toBeLessThan(order("transactions"));
    expect(order("transactions")).toBeLessThan(order("transaction_splits"));
  });

  it("parte lotes grandes para não estourar a requisição", () => {
    const parts = chunk(Array.from({ length: 901 }, (_, i) => i), 400);
    expect(parts.map((p) => p.length)).toEqual([400, 400, 101]);
  });

  it("dá ao arquivo um nome com data e hora", () => {
    expect(backupFileName("2026-11-14T12:30:05.123Z")).toBe("finia-backup-20261114-123005.json");
  });
});

describe("cópia automática diária", () => {
  const now = new Date("2026-11-14T12:00:00.000Z");

  it("copia quando nunca houve cópia", () => {
    expect(dueForSnapshot(null, now)).toBe(true);
  });

  it("não copia duas vezes no mesmo dia", () => {
    expect(dueForSnapshot("2026-11-14T06:00:00.000Z", now)).toBe(false);
  });

  it("copia de novo no dia seguinte", () => {
    expect(dueForSnapshot("2026-11-13T11:00:00.000Z", now)).toBe(true);
  });

  it("copia se a data guardada estiver corrompida", () => {
    expect(dueForSnapshot("ontem", now)).toBe(true);
  });
});
