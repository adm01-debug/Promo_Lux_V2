import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolverExecutavel } from './seguranca-processo.mjs';

const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-executavel-'));
const ESTADO = { PATH: process.env.PATH, PATHEXT: process.env.PATHEXT };

function comPath(novoPath, novoPathext) {
  process.env.PATH = novoPath;
  if (novoPathext === undefined) delete process.env.PATHEXT;
  else process.env.PATHEXT = novoPathext;
}

function comandoEm(pasta, nome) {
  fs.mkdirSync(pasta, { recursive: true });
  const alvo = path.join(pasta, nome);
  fs.writeFileSync(alvo, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(alvo, 0o755);
  return alvo;
}

test.after(() => {
  comPath(ESTADO.PATH, ESTADO.PATHEXT);
  fs.rmSync(RAIZ, { recursive: true, force: true });
});

test('resolve o binario pela extensao do PATHEXT (git -> git.exe, node -> node.exe)', () => {
  const pasta = path.join(RAIZ, 'bin-pathext');
  const alvo = comandoEm(pasta, process.platform === 'win32' ? 'probe.cmd' : 'probe.exe');
  comPath(pasta, '.COM;.EXE;.CMD');
  assert.equal(resolverExecutavel('probe'), alvo);
});

test('sem PATHEXT a extensao nao e inferida; com extensao explicita resolve', () => {
  const pasta = path.join(RAIZ, 'bin-explicito');
  const alvo = comandoEm(pasta, 'probe2.cmd');
  comPath(pasta, undefined);
  assert.throws(() => resolverExecutavel('probe2'), /comando nao encontrado no PATH: probe2/);
  assert.equal(resolverExecutavel('probe2.cmd'), alvo);
});

test('lanca quando nenhuma extensao do PATHEXT existe na pasta', () => {
  const pasta = path.join(RAIZ, 'bin-vazio');
  fs.mkdirSync(pasta, { recursive: true });
  comPath(pasta, '.CMD');
  assert.throws(() => resolverExecutavel('ausente'), /comando nao encontrado no PATH: ausente/);
});

test('o PATH real deste ambiente resolve node e git', () => {
  comPath(ESTADO.PATH, ESTADO.PATHEXT);
  assert.ok(path.isAbsolute(resolverExecutavel('node')));
  assert.ok(path.isAbsolute(resolverExecutavel('git')));
});
