import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../AuthContext";
import { useAuth } from "../auth-context";
import { setActiveOrgId, getActiveOrgId, ACTIVE_ORG_STORAGE_KEY } from "@/integrations/supabase/withOrg";

const signOutMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      signOut: () => signOutMock(),
    },
  },
}));

function TestConsumer() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>sign out</button>;
}

describe("AuthProvider.signOut", () => {
  beforeEach(() => {
    signOutMock.mockClear();
    localStorage.clear();
  });

  it("clears the React Query cache and the active org before calling supabase.auth.signOut", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["companies-list"], [{ id: "leaked-from-previous-user" }]);
    const clearSpy = vi.spyOn(queryClient, "clear");

    setActiveOrgId("org-from-previous-user");
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, "org-from-previous-user");

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText("sign out"));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());

    expect(clearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(["companies-list"])).toBeUndefined();
    expect(getActiveOrgId()).toBeNull();
    expect(localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)).toBeNull();
  });
});
