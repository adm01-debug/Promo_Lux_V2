#!/usr/bin/env node
/**
 * Testes de `mudou-conteudo.mjs`: o comparador que decide se o PR semanal do inventario abre.
 * Portado de `scripts/ci/inventario-mudou.unit.mjs` do Zapp_Web_V2, com os casos que valem para a
 * versao reduzida deste repo (so `edges.json`, so os carimbos `medido_em`/`gerado_em`).
 *
 * Rodar: node --test scripts/inventario/mudou-conteudo.unit.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mudou, semCarimbos, PADRAO } from './mudou-conteudo.mjs';

const comparar = (antes, depois) => mudou(['x.json'], () => antes, () => depois);

test('o padrao e o edges.json deste repo', () => {
  assert.deepEqual(PADRAO, ['inventario/estado/edges.json']);
});

test('so a data mudou (arquivo numa linha, como o gerador grava) -> false', () => {
  const antes = JSON.stringify({ gerado_em: '2026-11-01T00:00:00.000Z', total: 58, sem_chamador_no_repo: ['a'] });
  const depois = JSON.stringify({ gerado_em: '2026-11-08T00:00:00.000Z', total: 58, sem_chamador_no_repo: ['a'] });
  assert.equal(comparar(antes, depois), false);
});

test('mudanca real na mesma linha da data -> true', () => {
  const antes = JSON.stringify({ gerado_em: '2026-11-01T00:00:00.000Z', total: 58, sem_chamador_no_repo: ['a'] });
  const depois = JSON.stringify({ gerado_em: '2026-11-08T00:00:00.000Z', total: 59, sem_chamador_no_repo: ['a'] });
  assert.equal(comparar(antes, depois), true);
});

test('carimbo aninhado e ordem de chaves nao contam; valor aninhado conta', () => {
  const antes = JSON.stringify({ a: { medido_em: 'x', linhas: 10 }, b: 1 });
  const soCarimbo = JSON.stringify({ b: 1, a: { linhas: 10, medido_em: 'y' } });
  const comValor = JSON.stringify({ b: 1, a: { linhas: 11, medido_em: 'y' } });
  assert.equal(comparar(antes, soCarimbo), false);
  assert.equal(comparar(antes, comValor), true);
});

test('arquivo novo ou apagado conta; ausente nos dois lados nao', () => {
  assert.equal(comparar(null, '{"a":1}'), true);
  assert.equal(comparar('{"a":1}', null), true);
  assert.equal(comparar(null, null), false);
});

test('texto que nao e JSON e comparado cru, sem quebrar', () => {
  assert.equal(semCarimbos('nao e json'), 'nao e json');
  assert.equal(comparar('nao e json', 'nao e json'), false);
  assert.equal(comparar('nao e json', 'outro texto'), true);
});

test('ordem de itens dentro de array conta (lista de edges e ordenada pelo gerador)', () => {
  assert.equal(comparar('{"l":["a","b"]}', '{"l":["b","a"]}'), true);
});
