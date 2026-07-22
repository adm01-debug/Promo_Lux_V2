// Injetor de Chaos determinístico para o motor de scrape web.
// Determinístico por task_id → possibilita reprodução em testes.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Retorna true se a task deve receber injeção sintética de falha.
 * Determinístico: mesma (task_id, rate) → mesmo resultado.
 */
export function shouldInjectChaos(taskId: string, rate = 0.01): boolean {
  if (!taskId || rate <= 0) return false;
  if (rate >= 1) return true;
  const seed = hashString(`chaos|${taskId}`);
  return mulberry32(seed)() < rate;
}
