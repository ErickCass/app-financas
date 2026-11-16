import { describe, expect, it } from "vitest";
import { defaultAccount, NEW } from "./defaultAccount";
import type { Account } from "@/domain/types";

const acc = (id: string, name: string, kind: Account["kind"], last4?: string): Account => ({
  id,
  name,
  kind,
  last4,
  balance: 0,
  balanceUpdatedAt: "2026-11-16T00:00:00Z",
});
const visa = acc("visa", "Cartão Itaú •••• 9265", "credit_card", "9265");
const nubank = acc("nu", "Cartão Nubank", "credit_card");
const conta = acc("cc", "Itaú", "checking");

describe("conta sugerida na importação", () => {
  it("fatura de outro cartão do mesmo banco vira cartão novo, não cai no que já existe", () => {
    expect(defaultAccount({ institution: "itau", kind: "credit_card", last4: "9121" }, [visa, nubank, conta])).toBe(NEW);
  });

  it("fatura do mesmo cartão vai para a conta com o mesmo final", () => {
    expect(defaultAccount({ institution: "itau", kind: "credit_card", last4: "9265" }, [visa, nubank, conta])).toBe("visa");
  });

  it("reconhece o final pelo nome quando a conta não guardou o campo", () => {
    const semCampo = { ...visa, last4: undefined };
    expect(defaultAccount({ institution: "itau", kind: "credit_card", last4: "9265" }, [semCampo])).toBe("visa");
  });

  it("arquivo sem final usa o cartão do banco", () => {
    expect(defaultAccount({ institution: "nubank", kind: "credit_card" }, [visa, nubank])).toBe("nu");
  });

  it("extrato da conta corrente vai para a conta do banco", () => {
    expect(defaultAccount({ institution: "itau", kind: "checking" }, [visa, conta])).toBe("cc");
  });
});
