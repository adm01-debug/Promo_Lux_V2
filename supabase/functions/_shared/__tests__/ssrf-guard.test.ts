import { describe, it, expect } from "vitest";
import {
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  isDisallowedHostLiteral,
  checkUrlSyncPart,
} from "../ssrf-guard";

describe("isPrivateOrReservedIPv4", () => {
  const blocked: Array<[string, string]> = [
    ["metadata AWS/GCP", "169.254.169.254"],
    ["loopback", "127.0.0.1"],
    ["loopback alto", "127.255.255.254"],
    ["unspecified", "0.0.0.0"],
    ["classe A privada", "10.0.0.1"],
    ["classe A privada topo", "10.255.255.255"],
    ["classe B privada início", "172.16.0.1"],
    ["classe B privada fim", "172.31.255.255"],
    ["classe C privada", "192.168.1.1"],
    ["link-local", "169.254.1.1"],
    ["CGNAT", "100.64.0.1"],
    ["CGNAT fim", "100.127.255.255"],
    ["TEST-NET-1", "192.0.2.1"],
    ["multicast", "224.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["reservado 240+", "240.0.0.1"],
    ["malformado — poucos octetos", "10.0.0"],
    ["malformado — não numérico", "10.0.0.abc"],
    ["malformado — octeto > 255", "999.1.1.1"],
  ];
  for (const [nome, ip] of blocked) {
    it(`bloqueia ${nome} (${ip})`, () => {
      expect(isPrivateOrReservedIPv4(ip)).toBe(true);
    });
  }

  const allowed: Array<[string, string]> = [
    ["DNS público Google", "8.8.8.8"],
    ["DNS público Cloudflare", "1.1.1.1"],
    ["IP público genérico", "203.0.113.50"],
    ["172.15 (fora da faixa privada 172.16-31)", "172.15.255.255"],
    ["172.32 (fora da faixa privada 172.16-31)", "172.32.0.1"],
    ["100.63 (fora do CGNAT)", "100.63.255.255"],
    ["100.128 (fora do CGNAT)", "100.128.0.1"],
  ];
  for (const [nome, ip] of allowed) {
    it(`permite ${nome} (${ip})`, () => {
      expect(isPrivateOrReservedIPv4(ip)).toBe(false);
    });
  }
});

describe("isPrivateOrReservedIPv6", () => {
  const blocked: Array<[string, string]> = [
    ["loopback", "::1"],
    ["unspecified", "::"],
    ["link-local", "fe80::1"],
    ["ULA fc", "fc00::1"],
    ["ULA fd", "fd12:3456::1"],
    ["IPv4-mapped para loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped para privado", "::ffff:192.168.1.1"],
  ];
  for (const [nome, ip] of blocked) {
    it(`bloqueia ${nome} (${ip})`, () => {
      expect(isPrivateOrReservedIPv6(ip)).toBe(true);
    });
  }

  const allowed: Array<[string, string]> = [
    ["Cloudflare público", "2606:4700:4700::1111"],
    ["Google público", "2001:4860:4860::8888"],
    ["IPv4-mapped para público", "::ffff:8.8.8.8"],
  ];
  for (const [nome, ip] of allowed) {
    it(`permite ${nome} (${ip})`, () => {
      expect(isPrivateOrReservedIPv6(ip)).toBe(false);
    });
  }
});

describe("isDisallowedHostLiteral", () => {
  it("bloqueia localhost", () => expect(isDisallowedHostLiteral("localhost")).toBe(true));
  it("bloqueia subdomínio de localhost", () => expect(isDisallowedHostLiteral("foo.localhost")).toBe(true));
  it("bloqueia localhost.localdomain", () => expect(isDisallowedHostLiteral("localhost.localdomain")).toBe(true));
  it("bloqueia metadata.google.internal", () => expect(isDisallowedHostLiteral("metadata.google.internal")).toBe(true));
  it("case-insensitive", () => expect(isDisallowedHostLiteral("LOCALHOST")).toBe(true));
  it("permite host normal", () => expect(isDisallowedHostLiteral("example.com")).toBe(false));
  it("não bloqueia host que só contém 'localhost' como substring", () =>
    expect(isDisallowedHostLiteral("notlocalhost.com")).toBe(false));
});

describe("checkUrlSyncPart", () => {
  it("rejeita URL inválida", () => {
    expect(checkUrlSyncPart("not a url")).toEqual({ safe: false, reason: "url_invalida" });
  });

  it("rejeita http (exige https)", () => {
    expect(checkUrlSyncPart("http://example.com/hook")).toEqual({
      safe: false,
      reason: "protocolo_deve_ser_https",
    });
  });

  it("rejeita host localhost", () => {
    expect(checkUrlSyncPart("https://localhost/hook")).toEqual({
      safe: false,
      reason: "host_nao_permitido",
    });
  });

  it("rejeita IP metadata literal (cenário real de ataque)", () => {
    expect(checkUrlSyncPart("https://169.254.169.254/latest/meta-data")).toEqual({
      safe: false,
      reason: "ip_privado_ou_reservado",
    });
  });

  it("rejeita IP privado literal (10.x)", () => {
    expect(checkUrlSyncPart("https://10.0.0.5:8080/internal")).toEqual({
      safe: false,
      reason: "ip_privado_ou_reservado",
    });
  });

  it("rejeita loopback literal", () => {
    expect(checkUrlSyncPart("https://127.0.0.1/admin")).toEqual({
      safe: false,
      reason: "ip_privado_ou_reservado",
    });
  });

  it("rejeita IPv6 loopback literal", () => {
    expect(checkUrlSyncPart("https://[::1]/hook")).toEqual({
      safe: false,
      reason: "ip_privado_ou_reservado",
    });
  });

  it("aceita IP público literal sem precisar de DNS", () => {
    expect(checkUrlSyncPart("https://8.8.8.8/hook")).toEqual({ safe: true });
  });

  it("retorna null para hostname (precisa resolver DNS)", () => {
    expect(checkUrlSyncPart("https://example.com/webhook")).toBeNull();
  });

  it("retorna null para hostname com path/query", () => {
    expect(checkUrlSyncPart("https://hooks.example.com/callback?id=1")).toBeNull();
  });
});
