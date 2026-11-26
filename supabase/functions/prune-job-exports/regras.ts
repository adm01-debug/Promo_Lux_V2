/**
 * Regra de selecao dos arquivos orfaos do bucket `job-exports`.
 *
 * Fica separada do handler para poder ser testada: e a unica decisao desta
 * function que apaga byte de verdade sem ter uma linha de banco como
 * testemunha, entao cada trava precisa de prova propria.
 */
export type Arquivo = { caminho: string; idade: string };

// Nome de pasta no bucket e UUID (sem ponto); arquivo sempre tem extensao.
// Sem extensao = nao apaga: `remove()` sobre um prefixo levaria todos os CSVs
// daquele usuario junto.
const TEM_EXTENSAO = /\.[a-z0-9]{2,5}$/i;

export function ehArquivoApagavel(caminho: string): boolean {
  return TEM_EXTENSAO.test(caminho);
}

/**
 * @param arquivos   tudo que a varredura achou no bucket
 * @param conhecidos caminhos que alguma linha de `job_exports` ainda aponta
 * @param corte      ISO do limite de retencao; arquivo mais novo nunca entra
 */
export function selecionarOrfaos(
  arquivos: Arquivo[],
  conhecidos: Set<string>,
  corte: string,
  lote: number,
): Arquivo[] {
  return arquivos
    .filter((a) => ehArquivoApagavel(a.caminho))
    .filter((a) => !conhecidos.has(a.caminho))
    .filter((a) => a.idade < corte)
    .slice(0, lote);
}