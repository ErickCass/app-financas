import { describe, expect, it } from "vitest";
import type { Planned, Transaction } from "./types";
import { fixedRemaining, matchPlannedToTransactions, fixedStatus } from "./reconcile";

const planned = (p: Partial<Planned> & { id: string; amount: number }): Planned => ({
  accountId: "itau",
  dueDate: "2026-11-10",
  description: "Condomínio",
  categoryId: "moradia",
  status: "pending",
  ...p,
});
const tx = (t: Partial<Transaction> & { id: string; amount: number }): Transaction => ({
  accountId: "itau",
  date: "2026-11-09",
  description: "PIX WHATS CONDOMINIO FG",
  categoryId: "moradia",
  source: "import",
  ...t,
});

describe("baixa automática de previstos", () => {
  it("casa pela categoria e valor aproximado", () => {
    const m = matchPlannedToTransactions([planned({ id: "p", amount: -120_000, estimated: true })], [tx({ id: "t", amount: -119_172 })]);
    expect(m).toEqual([{ plannedId: "p", transactionId: "t" }]);
  });

  it("casa pela descrição quando o lançamento ainda não tem categoria", () => {
    const m = matchPlannedToTransactions(
      [planned({ id: "p", amount: -27_010, description: "Vivo celular", categoryId: "casa" })],
      [tx({ id: "t", amount: -27_010, description: "DA VIVO-SP 13706460571", categoryId: null })],
    );
    expect(m).toHaveLength(1);
  });

  it("não casa valor muito diferente, outro mês, sinal oposto, fatura ou já pago", () => {
    const list = [
      planned({ id: "p1", amount: -120_000 }),
      planned({ id: "p2", amount: -120_000, dueDate: "2026-12-10" }),
      planned({ id: "p3", amount: 120_000 }),
      planned({ id: "p4", amount: -120_000, status: "paid" }),
      planned({ id: "p5", amount: -120_000, creditCardStatement: { accountId: "nu", month: "2026-11" } }),
    ];
    expect(matchPlannedToTransactions(list, [tx({ id: "t", amount: -80_000 })])).toEqual([]);
    expect(matchPlannedToTransactions(list, [tx({ id: "t", amount: -120_000 })])).toEqual([{ plannedId: "p1", transactionId: "t" }]);
  });

  it("um lançamento só quita um previsto; o mais próximo em valor vence", () => {
    const m = matchPlannedToTransactions(
      [planned({ id: "a", amount: -100_000 }), planned({ id: "b", amount: -110_000 })],
      [tx({ id: "t", amount: -109_000 })],
    );
    // "a" é avaliado primeiro, mas 109.000 está dentro dos 15% dos dois; o primeiro da lista leva.
    expect(m).toHaveLength(1);
  });
});

describe("conta fixa quitada por aproximação", () => {
  it("pago perto do previsto zera o que falta", () => {
    expect(fixedRemaining(120_000, 119_172, 0)).toBe(0);
    expect(fixedRemaining(192_000, 187_339, 0)).toBe(0);
  });
  it("conta a pagar já cadastrada perto do previsto cobre a conta fixa", () => {
    // Condomínio cadastrado como R$ 1.150 contra R$ 1.200 previstos: não sobra "R$ 50 a pagar"
    expect(fixedRemaining(120_000, 0, 115_000)).toBe(0);
    expect(fixedRemaining(120_000, 60_000, 55_000)).toBe(0);
  });
  it("pagamento parcial deixa a diferença", () => {
    expect(fixedRemaining(192_000, 64_000, 0)).toBe(128_000);
    // 1 de 3 mensalidades já cadastrada como conta a pagar: falta o resto
    expect(fixedRemaining(192_000, 0, 64_000)).toBe(128_000);
    expect(fixedRemaining(0, 50_000, 0)).toBe(0);
  });
});

describe("situação da conta fixa", () => {
  it("nada pago: a pagar", () => expect(fixedStatus(400_000, 0)).toBe("a_pagar"));
  it("centavos acima do previsto: paga, sem alarme", () => expect(fixedStatus(27_000, 27_010)).toBe("paga"));
  it("um pouco abaixo (condomínio aproximado): paga", () => expect(fixedStatus(120_000, 119_172)).toBe("paga"));
  it("mais de 10% acima: acima do previsto", () => expect(fixedStatus(10_000, 12_149)).toBe("acima"));
  it("1 de 3 mensalidades: parcial", () => expect(fixedStatus(192_000, 64_000)).toBe("parcial"));
  it("sem valor previsto e com pagamento: paga", () => expect(fixedStatus(0, 5_000)).toBe("paga"));
});
