import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useNavigationHistory, View } from "@/hooks/useNavigationHistory";
import { useBottomNavSwipe } from "@/hooks/useBottomNavSwipe";
import { useRecentViews } from "@/hooks/useRecentViews";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useAuth } from "@/contexts/auth-context";
import { useDemo } from "@/contexts/demo-context";
import { useUnsavedChanges } from "@/hooks/unsaved-changes-context";
import { TopProgressBar } from "@/components/lux/TopProgressBar";
import { CommandPalette } from "@/components/lux/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/lux/KeyboardShortcutsDialog";
import { useRealtimeCompanies } from "@/hooks/useRealtimeCompanies";
import { useRealtimeScrapeJobs } from "@/hooks/useRealtimeScrapeJobs";
import { OnboardingTour } from "@/components/lux/OnboardingTour";
import { getViewSkeleton } from "@/components/lux/ViewSkeleton";
import { Sidebar } from "@/components/lux/layout/Sidebar";
import { Header } from "@/components/lux/layout/Header";
import { MobileBottomNav } from "@/components/lux/layout/MobileBottomNav";
import { ConnectionStatus } from "@/components/lux/ConnectionStatus";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { VIEW_MAP } from "@/lib/viewRegistry";
import { Minimize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const slideVariants = {
  initial: (dir: string) => ({
    opacity: 0,
    x: dir === "forward" ? 30 : -30,
    y: 0,
    scale: 0.985,
    filter: "blur(4px)",
    willChange: "transform, opacity, filter",
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (dir: string) => ({
    opacity: 0,
    x: dir === "forward" ? -15 : 15,
    y: 0,
    scale: 0.99,
    filter: "blur(2px)",
  }),
};

const Index = () => {
  const { activeView, navigate, goBack, canGoBack, breadcrumbs, currentLabel, direction } = useNavigationHistory();
  const { recentViews, trackView } = useRecentViews();
  const { collapsed, mobileOpen, toggleCollapse, openMobile, closeMobile } = useSidebarState();
  const { focusMode, toggleFocusMode } = useFocusMode();
  const { user, signOut } = useAuth();
  const { isDemoMode } = useDemo();
  const { confirmNavigation, showConfirmDialog, handleConfirm, handleCancel } = useUnsavedChanges();
  useRealtimeCompanies();
  useRealtimeScrapeJobs();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevView = useRef(activeView);

  // Keyboard shortcuts (Ctrl+B, Alt+1-9)
  const handleNav = useCallback(
    (id: View) => {
      confirmNavigation(() => {
        trackView(id);
        navigate(id);
        closeMobile();
      });
    },
    [confirmNavigation, trackView, navigate, closeMobile]
  );

  // Swipe between bottom-nav tabs on mobile
  useBottomNavSwipe(activeView, handleNav);

  useKeyboardShortcuts({
    onNavigate: handleNav,
    onToggleSidebar: toggleCollapse,
    onBack: goBack,
  });

  // Track view transitions for progress bar + scroll to top + dynamic title
  useEffect(() => {
    if (activeView !== prevView.current) {
      setIsTransitioning(true);
      prevView.current = activeView;
      const main = document.getElementById("main-content");
      if (main) main.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
      const timer = setTimeout(() => setIsTransitioning(false), 350);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  // Dynamic document title
  useEffect(() => {
    document.title = `${currentLabel} — LUX IA`;
    return () => { document.title = "LUX IA — Sales Intelligence Platform"; };
  }, [currentLabel]);

  const mainMargin = collapsed ? "lg:ml-16" : "lg:ml-64";
  const ActiveComponent = VIEW_MAP[activeView];
  const ActiveSkeleton = getViewSkeleton(activeView);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Skip nav is in index.html — no duplicate needed here */}

      <ConnectionStatus />
      {/* AutoTopProgressBar está no App.tsx para escopo global, o local trata apenas navegação suave se necessário */}
      {/* <TopProgressBar isAnimating={isTransitioning} /> */}
      <CommandPalette onNavigate={handleNav} recentViews={recentViews} />
      <KeyboardShortcutsDialog />
      <OnboardingTour />

      {/* Unsaved changes dialog é gerenciado globalmente no App.tsx */}

      {/* Mobile overlay with backdrop blur */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — hidden in focus mode on desktop */}
      {!focusMode && (
        <Sidebar
          activeView={activeView}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onNavigate={handleNav}
          onMobileClose={closeMobile}
          onToggleCollapse={toggleCollapse}
        />
      )}

      {/* Main area */}
      <div className={cn("flex-1 transition-all duration-300", !focusMode && mainMargin)}>
        {!focusMode && (
          <Header
            breadcrumbs={breadcrumbs}
            canGoBack={canGoBack}
            currentLabel={currentLabel}
            userEmail={isDemoMode ? "demo@luxia.app" : (user?.email ?? undefined)}
            userAvatarUrl={isDemoMode ? undefined : user?.user_metadata?.avatar_url}
            onGoBack={goBack}
            onNavigate={handleNav}
            onOpenMobileSidebar={openMobile}
            onSignOut={signOut}
            onToggleFocusMode={toggleFocusMode}
          />
        )}

        {/* Focus mode exit bar */}
        {focusMode && (
          <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground font-medium">
              Modo Foco — <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/50">⌘⇧F</kbd> para sair
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleFocusMode}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Sair do Modo Foco</TooltipContent>
            </Tooltip>
          </div>
        )}

        <main id="main-content" className="p-4 lg:p-6 pb-24 lg:pb-6" role="main" aria-label={currentLabel} aria-live="polite">
          <Suspense fallback={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveSkeleton />
            </motion.div>
          }>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeView}
                custom={direction}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{
                  duration: 0.36,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 0.22 },
                  filter: { duration: 0.28 },
                  scale: { type: "spring", stiffness: 300, damping: 30 },
                }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {!focusMode && (
        <MobileBottomNav
          activeView={activeView}
          onNavigate={handleNav}
          onOpenMenu={openMobile}
        />
      )}
    </div>
  );
};

export default Index;
