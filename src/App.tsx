import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoProvider, useDemo } from "@/contexts/DemoContext";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { ErrorBoundary } from "@/components/lux/ErrorBoundary";
import { PageTransition } from "@/components/lux/PageTransition";
import { OrgErrorBanner } from "@/components/lux/OrgErrorBanner";
import { AutoTopProgressBar } from "@/components/lux/AutoTopProgressBar";
import { UnsavedChangesDialog } from "@/components/lux/UnsavedChangesDialog";
import { useEffect } from "react";
import {
  registerQueryClient,
  installGlobalOrgErrorHandler,
  handleOrgError,
} from "@/lib/orgErrorHandler";
import { setOrgErrorListener } from "@/integrations/supabase/withOrg";

const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: (failureCount, error) => {
        // Don't retry on 401/403 (auth issues)
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Registra o QueryClient e conecta o listener síncrono que `withOrg.ts`
// usa para disparar toasts no momento exato em que a operação é bloqueada.
registerQueryClient(queryClient);
setOrgErrorListener((err) => { handleOrgError(err); });

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" role="status" aria-label="Carregando">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3l1.912 5.813L20 10.125l-4.587 3.89L16.824 20 12 16.5 7.176 20l1.411-6.172L4 10.125l6.088-1.312z" />
        </svg>
      </div>
      <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: "40%" }} />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  if (isDemoMode) return <>{children}</>;
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  if (isDemoMode) return <Navigate to="/" replace />;
  if (loading) return <PageLoader />;
  if (user) {
    const pendingInvite = sessionStorage.getItem("lux:pending-invite");
    if (pendingInvite) {
      sessionStorage.removeItem("lux:pending-invite");
      return <Navigate to={`/invite/${pendingInvite}`} replace />;
    }
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicRoute><PageTransition><Login /></PageTransition></PublicRoute>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/invite/:token" element={<PageTransition><AcceptInvite /></PageTransition>} />
        <Route path="/" element={<ProtectedRoute><PageTransition><Index /></PageTransition></ProtectedRoute>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <DemoProvider>
              <GlobalOrgErrorListener />
              <AutoTopProgressBar />
              <UnsavedChangesDialog />
              <OrgErrorBanner />
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <UnsavedChangesProvider>
                  <Suspense fallback={<PageLoader />}>
                    <AnimatedRoutes />
                  </Suspense>
                </UnsavedChangesProvider>
              </BrowserRouter>
            </DemoProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

/** Instala o listener de unhandledrejection apenas no client. */
function GlobalOrgErrorListener() {
  useEffect(() => installGlobalOrgErrorHandler(), []);
  return null;
}
