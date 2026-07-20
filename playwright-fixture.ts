// `lovable-agent-playwright-config` é um pacote interno do ambiente Lovable,
// injetado só quando os testes rodam dentro da infraestrutura deles — não
// está publicado no npm registry público, então um `npm install`/CI comum
// falha ao resolvê-lo e as specs que importam daqui nem chegam a coletar
// (0 testes coletados, sem nenhum erro claro de asserção).
//
// Nenhuma spec deste repo usa fixtures além de `test`/`expect`/`page`
// padrão do Playwright, então reexportar direto de @playwright/test mantém
// o mesmo comportamento sem a dependência externa não resolvível.
// Override ou extensão de test/expect, se algum dia precisar, vai aqui.
export { test, expect } from "@playwright/test";
