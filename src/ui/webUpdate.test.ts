import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("@/buildId", () => ({ BUILD_ID: "VERSAO-ATUAL" }));

const { hasNewWebVersion } = await import("./webUpdate");

function respondWith(body: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
}

afterEach(() => vi.unstubAllGlobals());

describe("aviso de versão nova na web", () => {
  it("avisa quando o servidor publicou outra versão", async () => {
    respondWith({ buildId: "VERSAO-NOVA" });
    expect(await hasNewWebVersion()).toBe(true);
  });

  it("não avisa quando é a mesma versão", async () => {
    respondWith({ buildId: "VERSAO-ATUAL" });
    expect(await hasNewWebVersion()).toBe(false);
  });

  it("na dúvida, não recarrega: resposta sem versão", async () => {
    respondWith({});
    expect(await hasNewWebVersion()).toBe(false);
  });

  it("na dúvida, não recarrega: servidor respondeu erro", async () => {
    respondWith({ buildId: "VERSAO-NOVA" }, false);
    expect(await hasNewWebVersion()).toBe(false);
  });

  it("na dúvida, não recarrega: rede falhou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await hasNewWebVersion()).toBe(false);
  });
});
