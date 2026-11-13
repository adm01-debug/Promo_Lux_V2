import { describe, it, expect } from "vitest";
import {
  isBlockedLookupDomain,
  isNullMx,
  usableMx,
  isRevokedDkim,
} from "../dns-guard.ts";

describe("isBlockedLookupDomain", () => {
  it.each([
    "localhost",
    "localhost.",
    "foo.localhost",
    "LOCALHOST",
    "127.0.0.1",
    "10.0.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.1.2.3",
    "2130706433",
    "0x7f.1",
    "0x7f000001",
    "017700000001",
    "foo.local",
    "printer.lan",
    "x.internal",
    "metadata.google.internal",
    "svc.cluster.local",
    "router.home.arpa",
    "",
    "com",
    "-bad.com",
    "bad-.com",
    "a..b.com",
    "dominio com espaco.com",
    "a".repeat(64) + ".com",
  ])("bloqueia %s", (d) => expect(isBlockedLookupDomain(d)).toBe(true));

  it.each([
    "promobrindes.com.br",
    "gmail.com",
    "localhostshop.com.br",
    "10.example.com",
    "internal-tools.com",
    "mail.example.co.uk",
    "xn--caf-dma.com",
    "example.xn--p1ai",
    "Example.COM",
    "example.com.",
  ])("permite %s", (d) => expect(isBlockedLookupDomain(d)).toBe(false));
});

describe("MX nulo (RFC 7505)", () => {
  it("reconhece '.' e vazio", () => {
    expect(isNullMx(".")).toBe(true);
    expect(isNullMx("")).toBe(true);
    expect(isNullMx("mx.example.com")).toBe(false);
  });
  it("usableMx descarta o MX nulo e ordena por preferência", () => {
    expect(usableMx([{ preference: 0, exchange: "." }])).toEqual([]);
    expect(
      usableMx([
        { preference: 20, exchange: "b.mx" },
        { preference: 10, exchange: "a.mx" },
        { preference: 0, exchange: "." },
      ]),
    ).toEqual(["a.mx", "b.mx"]);
  });
});

describe("isRevokedDkim", () => {
  it("p= vazio é chave revogada", () => {
    expect(isRevokedDkim("v=DKIM1; k=rsa; p=")).toBe(true);
    expect(isRevokedDkim("v=DKIM1; p= ; k=rsa")).toBe(true);
  });
  it("p= com chave não é revogada", () => {
    expect(isRevokedDkim("v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB")).toBe(false);
    expect(isRevokedDkim("v=DKIM1; k=rsa; p=MIGf MA0G")).toBe(false);
  });
  it("sem p= não é tratada como revogada", () => {
    expect(isRevokedDkim("v=DKIM1; k=rsa")).toBe(false);
  });
});
