import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Prova que o envelopamento de estado (PainelComEstado) e os paineis que passaram a
 * usa-lo tratam carregamento, falha e vazio como estados distintos.
 */
const estado = vi.hoisted(() => {
  const erroFalso = { message: "falha simulada no banco" };
  const builder = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      if (prop === "then") {
        return (res: (v: unknown) => void) =>
          res({ data: null, error: erroFalso });
      }
      if (prop === "maybeSingle" || prop === "single") {
        return () => Promise.resolve({ data: null, error: erroFalso });
      }
      return () => builder;
    },
  });
  return { erroFalso, builder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => estado.builder,
    rpc: () => Promise.resolve({ data: null, error: estado.erroFalso }),
    functions: {
      invoke: () => Promise.resolve({ data: null, error: estado.erroFalso }),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: () => {} }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

import { PainelComEstado } from "../PainelComEstado";
import { RetryPolicyAdvisoriesPanel } from "../RetryPolicyAdvisoriesPanel";
import { InstagramEnqueuePanel } from "../InstagramEnqueuePanel";
import { VaultCookiesPanel } from "../VaultCookiesPanel";

function montar(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("PainelComEstado", () => {
  it("mostra a falha com nova tentativa e esconde o conteudo", () => {
    const tentar = vi.fn();
    montar(
      <PainelComEstado
        falhou
        mensagemErro="Falha simulada"
        aoTentarNovamente={tentar}
      >
        <span>conteudo real</span>
      </PainelComEstado>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Falha simulada")).toBeInTheDocument();
    expect(screen.queryByText("conteudo real")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("mostra o esqueleto enquanto carrega", () => {
    montar(
      <PainelComEstado carregando esqueleto={<span>carregando esqueleto</span>}>
        <span>conteudo real</span>
      </PainelComEstado>,
    );
    expect(screen.getByText("carregando esqueleto")).toBeInTheDocument();
    expect(screen.queryByText("conteudo real")).not.toBeInTheDocument();
  });

  it("mostra o vazio no lugar do conteudo", () => {
    montar(
      <PainelComEstado vazio mensagemVazio="nada aqui">
        <span>conteudo real</span>
      </PainelComEstado>,
    );
    expect(screen.getByText("nada aqui")).toBeInTheDocument();
    expect(screen.queryByText("conteudo real")).not.toBeInTheDocument();
  });

  it("mostra o conteudo quando ha dados", () => {
    montar(
      <PainelComEstado vazio={false}>
        <span>conteudo real</span>
      </PainelComEstado>,
    );
    expect(screen.getByText("conteudo real")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("paineis que adotaram o envelopamento de estado", () => {
  it("InstagramEnqueuePanel nao anuncia fila vazia quando a leitura falha", async () => {
    montar(<InstagramEnqueuePanel />);
    expect(
      await screen.findByText(
        /N\u00e3o foi poss\u00edvel ler o estado da fila/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Fila vazia.")).not.toBeInTheDocument();
  });

  it("RetryPolicyAdvisoriesPanel nao anuncia politica calibrada quando a leitura falha", async () => {
    montar(<RetryPolicyAdvisoriesPanel />);
    expect(
      await screen.findByText(
        /N\u00e3o foi poss\u00edvel carregar as recomenda/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma recomenda/)).not.toBeInTheDocument();
  });

  it("VaultCookiesPanel aponta falha nos cards e no historico de alertas", async () => {
    montar(<VaultCookiesPanel />);
    expect(
      await screen.findByText(
        /N\u00e3o foi poss\u00edvel carregar a sa\u00fade dos cookies/,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /N\u00e3o foi poss\u00edvel carregar o hist\u00f3rico de alertas/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Nenhum alerta disparado nos registros recentes/),
    ).not.toBeInTheDocument();
  });
});
