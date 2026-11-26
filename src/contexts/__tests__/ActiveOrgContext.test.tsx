import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ACTIVE_ORG_STORAGE_KEY } from "@/integrations/supabase/withOrg";

const { mockInvalidate, mockSetActiveOrgId, mockSetItem } = vi.hoisted(() => ({
  mockInvalidate: vi.fn(),
  mockSetActiveOrgId: vi.fn(),
  mockSetItem: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

vi.mock("@/integrations/supabase/withOrg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/supabase/withOrg")>();
  return {
    ...actual,
    setActiveOrgId: mockSetActiveOrgId,
  };
});

vi.mock("@/hooks/useOrganizations", () => ({
  useMyOrganizations: () => ({
    data: [
      { organization_id: "org-a", role: "owner", organizations: { id: "org-a", name: "A", slug: "a", owner_id: "u" } },
      { organization_id: "org-b", role: "admin", organizations: { id: "org-b", name: "B", slug: "b", owner_id: "u" } },
    ],
  }),
}));

import { ActiveOrgProvider } from "../ActiveOrgContext";
import { useActiveOrganization } from "../active-org-context";

function Probe() {
  const { activeOrgId, setActive } = useActiveOrganization();
  return (
    <button type="button" onClick={() => setActive("org-b")}>
      {activeOrgId ?? "nenhuma"}
    </button>
  );
}

describe("ActiveOrgProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("invalida o cache uma única vez por troca de organização", () => {
    render(
      <ActiveOrgProvider>
        <Probe />
      </ActiveOrgProvider>
    );

    expect(screen.getByRole("button").textContent).toBe("org-a");
    mockInvalidate.mockClear();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("org-b");
    // Sem a marca de origem no evento sintético, o escutador da própria aba
    // recebia o eco e invalidava de novo (2 chamadas).
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("continua aplicando a troca vinda de outra aba", () => {
    render(
      <ActiveOrgProvider>
        <Probe />
      </ActiveOrgProvider>
    );
    mockInvalidate.mockClear();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: ACTIVE_ORG_STORAGE_KEY, newValue: "org-b" })
      );
    });

    expect(screen.getByRole("button").textContent).toBe("org-b");
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("ignora eventos de outras chaves", () => {
    render(
      <ActiveOrgProvider>
        <Probe />
      </ActiveOrgProvider>
    );
    mockInvalidate.mockClear();

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "outra-chave", newValue: "x" }));
    });

    expect(screen.getByRole("button").textContent).toBe("org-a");
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});