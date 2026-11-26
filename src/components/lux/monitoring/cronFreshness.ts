/**
 * Frescor dos agendamentos do pg_cron.
 *
 * O painel já mostra `last_status`, mas "succeeded" de cinco dias atrás é
 * indistinguível de "ok": um job que parou de rodar (cron.deschedule acidental,
 * worker morto, migração que não recriou o schedule) mantém `succeeded` na
 * última linha para sempre. A morte só aparece comparando a **idade** da última
 * execução com a cadência declarada na própria expressão cron do job — é o que
 * esta função faz. Job cuja expressão não é suportada não recebe veredito: sem
 * cadência conhecida, alertar seria chute.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface CronScheduleEntry {
  jobname: string;
  schedule: string;
  last_run: string | null;
  last_status?: string | null;
}

export interface CronFreshness {
  /** Idade da última execução, em segundos. null quando nunca executou. */
  ageSecs: number | null;
  /** Cadência esperada, em segundos. null quando a expressão não é suportada. */
  intervalSecs: number | null;
  /** Idade máxima aceita antes de considerar parado. null junto com intervalSecs. */
  limitSecs: number | null;
  /** true quando a idade passou do limite — job provavelmente morto. */
  stale: boolean;
}

/** Quantidade de disparos por período que um campo aceita. */
function occurrenceCount(field: string, period: number): number | null {
  if (field === "*") return period;
  const step = /^\*\/(\d+)$/.exec(field);
  if (step) {
    const n = Number(step[1]);
    return n > 0 ? Math.max(1, Math.floor(period / n)) : null;
  }
  if (/^\d+$/.test(field)) return 1;
  if (/^(\d+)(,\d+)+$/.test(field)) return field.split(",").length;
  return null;
}

/**
 * Intervalo esperado entre execuções, em segundos, a partir da expressão cron
 * de 5 campos. Cobre as formas realmente usadas no projeto: passo de N minutos,
 * hora cheia, hora fixa todo dia e dia da semana fixo. Qualquer outra devolve
 * null em vez de chutar uma cadência.
 */
export function expectedIntervalSecs(schedule: string): number | null {
  const parts = String(schedule ?? "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (month !== "*") return null;

  if (dayOfWeek !== "*") {
    const n = occurrenceCount(dayOfWeek, 7);
    return n ? Math.round((7 * DAY) / n) : null;
  }
  if (dayOfMonth !== "*") {
    const n = occurrenceCount(dayOfMonth, 30);
    return n ? Math.round((30 * DAY) / n) : null;
  }

  if (hour === "*") {
    const perHour = occurrenceCount(minute, 60);
    return perHour ? Math.round(HOUR / perHour) : null;
  }
  const perDay = occurrenceCount(hour, 24);
  if (!perDay) return null;
  const minuteOk = /^[\d*/,]+$/.test(minute) && occurrenceCount(minute, 60) !== null;
  if (!minuteOk) return null;
  return Math.round(DAY / perDay);
}

/**
 * Avalia um agendamento contra o relógio. Tolerância de 50% da cadência com
 * piso de 15 min: absorve jitter do pg_cron sem deixar um job de 10 min passar
 * horas calado.
 */
export function evaluateCronFreshness(
  cron: CronScheduleEntry,
  now: number = Date.now(),
): CronFreshness {
  const intervalSecs = expectedIntervalSecs(cron.schedule);
  const limitSecs = intervalSecs === null
    ? null
    : intervalSecs + Math.max(900, Math.round(intervalSecs / 2));

  const lastRun = cron.last_run ? new Date(cron.last_run).getTime() : Number.NaN;
  const ageSecs = Number.isFinite(lastRun) ? Math.max(0, Math.round((now - lastRun) / 1000)) : null;

  return {
    ageSecs,
    intervalSecs,
    limitSecs,
    stale: ageSecs !== null && limitSecs !== null && ageSecs > limitSecs,
  };
}

/** Nomes dos jobs parados, na ordem recebida. */
export function staleCronNames(crons: CronScheduleEntry[], now: number = Date.now()): string[] {
  return crons.filter((c) => evaluateCronFreshness(c, now).stale).map((c) => c.jobname);
}