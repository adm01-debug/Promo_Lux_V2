import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const packageConfig = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);

function fixture(t, initial = "export const value = 0;\n", baseline = false) {
  const cwd = mkdtempSync(path.join(tmpdir(), "lux staged autofix "));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, HUSKY: "0" };
  function run(command, args, expected = 0) {
    const result = spawnSync(command, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(
      result.status,
      expected,
      `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    );
    return result;
  }
  const git = (...args) => run("git", args).stdout;
  mkdirSync(path.join(cwd, "scripts/ci"), { recursive: true });
  mkdirSync(path.join(cwd, "scripts/lib"), { recursive: true });
  mkdirSync(path.join(cwd, "src"));
  cpSync(
    path.join(root, "scripts/staged-autofix"),
    path.join(cwd, "scripts/staged-autofix"),
    { recursive: true },
  );
  for (const file of [
    "scripts/ci/lint-ratchet.mjs",
    "scripts/lib/seguranca-processo.mjs",
  ]) {
    cpSync(path.join(root, file), path.join(cwd, file));
  }
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(cwd, "node_modules"),
    "dir",
  );
  writeFileSync(path.join(cwd, ".gitignore"), "node_modules/\n");
  writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({
      type: "module",
      "lint-staged": packageConfig["lint-staged"],
    }),
  );
  writeFileSync(
    path.join(cwd, "eslint.config.js"),
    'export default [{ files: ["src/**/*.js"], rules: { "prefer-const": "error", "no-undef": "error" } }];\n',
  );
  const file = "src/arquivo com espaco.js";
  const write = (content) => writeFileSync(path.join(cwd, file), content);
  write(initial);
  git("init", "--quiet");
  git("config", "user.name", "Fixture local");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.hooksPath", "/dev/null");
  if (!baseline) write("export const value = 0;\n");
  run(process.execPath, ["scripts/ci/lint-ratchet.mjs", "--update-baseline"]);
  write(initial);
  git("add", ".");
  git("commit", "--quiet", "-m", "fixture inicial");
  return {
    cwd,
    file,
    git,
    write,
    staged: () => git("show", `:${file}`),
    working: () => readFileSync(path.join(cwd, file), "utf8"),
    hook: (expected = 0) =>
      run("sh", ["-e", path.join(root, ".husky/pre-commit")], expected),
  };
}

test("corrige e formata arquivo staged com espacos no caminho", (t) => {
  const f = fixture(t);
  f.write("let value=1\nexport {value}\n");
  f.git("add", f.file);
  f.hook();
  assert.equal(f.staged(), "const value = 1;\nexport { value };\n");
  assert.equal(f.working(), f.staged());
});

test("preserva alteracao nao staged do mesmo arquivo e nao adiciona WIP", (t) => {
  const context = Array.from(
    { length: 20 },
    (_, index) => `// contexto ${index}\n`,
  ).join("");
  const f = fixture(
    t,
    `export const value = 0;\n${context}export const draft = 0;\n`,
  );
  f.write(`let value=1\nexport {value}\n${context}export const draft = 0;\n`);
  f.git("add", f.file);
  f.write(f.working().replace("draft = 0", "draft = 99"));
  writeFileSync(path.join(f.cwd, "src/wip.js"), "broken(\n");
  f.hook();
  assert.match(f.staged(), /^const value = 1;/);
  assert.match(f.staged(), /draft = 0/);
  assert.match(f.working(), /draft = 99/);
  assert.equal(f.git("ls-files", "src/wip.js"), "");
  assert.equal(
    readFileSync(path.join(f.cwd, "src/wip.js"), "utf8"),
    "broken(\n",
  );
});

test("rejeita erro staged mesmo se a copia nao staged ja foi corrigida", (t) => {
  const f = fixture(t);
  const staged = "export const value = missing;\n";
  const working = "export const value = 1;\n";
  f.write(staged);
  f.git("add", f.file);
  f.write(working);
  f.hook(1);
  assert.equal(f.staged(), staged);
  assert.equal(f.working(), working);
});

test("mantem divida antiga permitida pelo ratchet", (t) => {
  const initial = "legacy();\n\nexport const value = 0;\n";
  const f = fixture(t, initial, true);
  f.write(initial.replace("value = 0", "value = 1"));
  f.git("add", f.file);
  f.hook();
  assert.equal(f.staged(), initial.replace("value = 0", "value = 1"));
});

test("erro de analise bloqueia commit e preserva indice", (t) => {
  const f = fixture(t);
  const invalid = "export const value = (\n";
  f.write(invalid);
  f.git("add", f.file);
  f.hook(1);
  assert.equal(f.staged(), invalid);
});
