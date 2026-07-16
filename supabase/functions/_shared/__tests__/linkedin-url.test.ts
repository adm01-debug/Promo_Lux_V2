import { describe, it, expect } from "vitest";
import { publicIdFromLinkedInUrl } from "../linkedin-url";

describe("publicIdFromLinkedInUrl", () => {
  const ok: Array<[string, string, string]> = [
    ["www padrão", "https://www.linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["trailing slash", "https://www.linkedin.com/in/joaquim-ataides/", "joaquim-ataides"],
    ["duplo slash", "https://www.linkedin.com/in/joaquim-ataides//", "joaquim-ataides"],
    ["sem www", "https://linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["http", "http://www.linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["subdomínio br", "https://br.linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["subdomínio de", "https://de.linkedin.com/in/hans-mueller", "hans-mueller"],
    ["query string", "https://www.linkedin.com/in/joaquim-ataides?originalSubdomain=br", "joaquim-ataides"],
    ["trk + slash", "https://www.linkedin.com/in/joaquim-ataides/?trk=abc", "joaquim-ataides"],
    ["fragment", "https://www.linkedin.com/in/joaquim-ataides#exp", "joaquim-ataides"],
    ["maiúsculas no host", "https://WWW.LINKEDIN.COM/in/Joaquim-Ataides", "Joaquim-Ataides"],
    ["acentos", "https://www.linkedin.com/in/joão-silva", "joão-silva"],
    ["percent-encoded", "https://www.linkedin.com/in/jo%C3%A3o-silva", "joão-silva"],
    ["sem scheme com www", "www.linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["sem scheme", "linkedin.com/in/joaquim-ataides", "joaquim-ataides"],
    ["path cru", "/in/joaquim-ataides", "joaquim-ataides"],
    ["publicId puro", "joaquim-ataides", "joaquim-ataides"],
    ["urn ACwAAA", "https://www.linkedin.com/in/ACwAAABc12345", "ACwAAABc12345"],
  ];

  for (const [nome, entrada, esperado] of ok) {
    it(`extrai de ${nome}`, () => {
      expect(publicIdFromLinkedInUrl(entrada)).toBe(esperado);
    });
  }

  const vazio: Array<[string, string | null | undefined]> = [
    ["URL /pub/ antiga", "https://www.linkedin.com/pub/joaquim/1/2/3"],
    ["página de empresa", "https://www.linkedin.com/company/promobrindes"],
    ["domínio alheio", "https://facebook.com/in/xyz"],
    ["string vazia", ""],
    ["null", null],
    ["undefined", undefined],
  ];

  for (const [nome, entrada] of vazio) {
    it(`retorna vazio para ${nome}`, () => {
      expect(publicIdFromLinkedInUrl(entrada as string)).toBe("");
    });
  }
});
