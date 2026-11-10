import { spawnSync } from "node:child_process";
import path from "node:path";
import { ESLint } from "eslint";

try {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("Nenhum arquivo staged recebido.");

  const eslint = new ESLint({ fix: true });
  const results = await eslint.lintFiles(files);
  if (results.some((result) => result.fatalErrorCount > 0)) {
    const formatter = await eslint.loadFormatter("stylish");
    console.error(formatter.format(results));
    throw new Error("ESLint encontrou erro de analise; correcao interrompida.");
  }
  await ESLint.outputFixes(results);

  // A divida antiga e julgada pelo ratchet, depois da formatacao. O lint-staged
  // esconde alteracoes nao staged e restaura tudo se qualquer etapa falhar.
  for (const args of [
    ["node_modules/prettier/bin/prettier.cjs", "--write", "--", ...files],
    ["scripts/ci/lint-ratchet.mjs", "--staged"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.resolve(args[0]), ...args.slice(1)],
      {
        stdio: "inherit",
        shell: false,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} catch (error) {
  console.error(`ERRO na autocorrecao staged: ${error.message}`);
  process.exitCode = 1;
}
