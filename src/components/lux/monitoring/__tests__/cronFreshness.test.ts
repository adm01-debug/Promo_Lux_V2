import { describe, it, expect } from "vitest";
import { evaluateCronFreshness, expectedIntervalSecs, staleCronNames } from "../cronFreshness";

const AGORA = Date.parse("2026-11-26T12:00:00Z");
const atras = (secs: number) => new Date(AGORA - secs * 1000).toISOString();

describe("expectedIntervalSecs", () => {
  it("lê a cadência das formas usadas no projeto", () => {
    expect(expectedIntervalSecs("*/10 * * * *")).toBe(600);
    expect(expectedIntervalSecs("*/15 * * * *")).toBe(900);
    expect(expectedIntervalSecs("0 * * * *")).toBe(3600);
    expect(expectedIntervalSecs("20 4 * * *")).toBe(86400);
    expect(expectedIntervalSecs("0 */6 * * *")).toBe(6 * 3600);
  });

  it("devolve null para expressão fora do subconjunto suportado", () => {
    expect(expectedIntervalSecs("20 4 * *")).toBeNull();
    expect(expectedIntervalSecs("0 4 1 * *")).toBe(30 * 86400);
    expect(expectedIntervalSecs("")).toBeNull();
  });
});

describe("evaluateCronFreshness", () => {
  it("não marca job de 10 min executado há 8 min", () => {
    const r = evaluateCronFreshness(
      { jobname: "captura", schedule: "*/10 * * * *", last_run: atras(8 * 60) },
      AGORA,
    );
    expect(r.stale).toBe(false);
    expect(r.ageSecs).toBe(480);
    expect(r.limitSecs).toBe(600 + 900);
  });

  it("marca job de 10 min parado há 3 h — o caso que o last_status esconde", () => {
    const r = evaluateCronFreshness(
      { jobname: "captura", schedule: "*/10 * * * *", last_run: atras(3 * 3600), last_status: "succeeded" },
      AGORA,
    );
    expect(r.stale).toBe(true);
  });

  it("deixa o expurgo diário passar até 36 h e marca depois disso", () => {
    const cron = { jobname: "job-exports-retencao-diaria", schedule: "20 4 * * *" };
    expect(evaluateCronFreshness({ ...cron, last_run: atras(30 * 3600) }, AGORA).stale).toBe(false);
    expect(evaluateCronFreshness({ ...cron, last_run: atras(40 * 3600) }, AGORA).stale).toBe(true);
  });

  it("não inventa alerta sem cadência conhecida nem sem execução registrada", () => {
    expect(
      evaluateCronFreshness({ jobname: "x", schedule: "0 4 1 * * */2", last_run: atras(90 * 86400) }, AGORA).stale,
    ).toBe(false);
    expect(evaluateCronFreshness({ jobname: "y", schedule: "*/5 * * * *", last_run: null }, AGORA).stale).toBe(false);
  });

  it("lista somente os nomes parados", () => {
    const nomes = staleCronNames(
      [
        { jobname: "vivo", schedule: "*/15 * * * *", last_run: atras(20 * 60) },
        { jobname: "morto", schedule: "*/15 * * * *", last_run: atras(9 * 3600) },
      ],
      AGORA,
    );
    expect(nomes).toEqual(["morto"]);
  });
});