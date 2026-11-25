import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import * as prettier from "prettier";

/**
 * Arquivo cuja versao no indice ja estava fora do formato nao e reformatado:
 * isso so trocaria a divida antiga de lugar e inflaria um diff de 1 linha para
 * o arquivo inteiro. Arquivo novo (ou ainda nao versionado) nasce formatado.
 */
async function jaEraForaDoFormato(file) {
  if (!existsSync(file)) return true;
  // O lint-staged pode entregar caminho absoluto; o git exige caminho do repo.
  const rel = path
    .relative(process.cwd(), path.resolve(file))
    .split(path.sep)
    .join("/");
  const prev = spawnSync("git", ["show", `HEAD:${rel}`], {
    encoding: "utf8",
    maxBuffer: 1e7,
  });
  if (prev.status !== 0) return false;
  try {
    const info = await prettier.getFileInfo(rel);
    if (!info.inferredParser) return true;
    return !(await prettier.check(prev.stdout, { filepath: rel }));
  } catch {
    return false;
  }
}

try {
  const formatOnly = process.argv.includes("--format-only");
  const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (files.length === 0) throw new Error("Nenhum arquivo staged recebido.");

  if (!formatOnly) {
    const eslint = new ESLint({ fix: true });
    const results = await eslint.lintFiles(files);
    if (results.some((result) => result.fatalErrorCount > 0)) {
      const formatter = await eslint.loadFormatter("stylish");
      console.error(formatter.format(results));
      throw new Error(
        "ESLint encontrou erro de analise; correcao interrompida.",
      );
    }
    await ESLint.outputFixes(results);
  }

  const aFormatar = [];
  for (const file of files) {
    if (await jaEraForaDoFormato(file)) continue;
    aFormatar.push(file);
  }

  // A divida antiga e julgada pelo ratchet, depois da formatacao. O lint-staged
  // esconde alteracoes nao staged e restaura tudo se qualquer etapa falhar.
  const etapas = [];
  if (aFormatar.length > 0) {
    etapas.push([
      "node_modules/prettier/bin/prettier.cjs",
      "--write",
      "--",
      ...aFormatar,
    ]);
  }
  if (!formatOnly) etapas.push(["scripts/ci/lint-ratchet.mjs", "--staged"]);

  for (const args of etapas) {
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
