import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useNavigationHistory, View } from "@/hooks/useNavigationHistory";
import { useRecentViews } from "@/hooks/useRecentViews";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useAuth } from "@/contexts/AuthContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
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
  initial: (dir: string) => ({ opacity: 0, x: dir === "forward" ? 40 : -40 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: string) => ({ opacity: 0, x: dir === "forward" ? -20 : 20 }),
};

const Index = () => {
  const { activeView, navigate, goBack, canGoBack, breadcrumbs, currentLabel, direction } = useNavigationHistory();
  const { recentViews, trackView } = useRecentViews();
  const { collapsed, mobileOpen, toggleCollapse, openMobile, closeMobile } = useSidebarState();
  const { focusMode, toggleFocusMode } = useFocusMode();
  const { user, signOut } = useAuth();
  const { confirmNavigation, showConfirmDialog, handleConfirm, handleCancel } = useUnsavedChanges();
  useRealtimeCompanies();
  useRealtimeScrapeJobs();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevView = useRef(activeView);

  // Swipe gestures for mobile
  useSwipeGesture({
    onSwipeRight: openMobile,
    onSwipeLeft: closeMobile,
  });

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

  useKeyboardShortcuts({
    onNavigate: handleNav,
    onToggleSidebar: toggleCollapse,
  });

  // Track view transitions for progress bar
  useEffect(() => {
    if (activeView !== prevView.current) {
      setIsTransitioning(true);
      prevView.current = activeView;
      const timer = setTimeout(() => setIsTransitioning(false), 350);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  const mainMargin = collapsed ? "lg:ml-16" : "lg:ml-64";
  const ActiveComponent = VIEW_MAP[activeView];
  const ActiveSkeleton = getViewSkeleton(activeView);

  return (
    <div className="min-h-screen bg-background flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Pular para o conteúdo
      </a>

      <TopProgressBar isAnimating={isTransitioning} />
      <CommandPalette onNavigate={handleNav} recentViews={recentViews} />
      <KeyboardShortcutsDialog />
      <OnboardingTour />

      {/* Unsaved changes dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações que não foram salvas. Deseja sair sem salvar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <div id="main-content" className={cn("flex-1 transition-all duration-300", !focusMode && mainMargin)}>
        {!focusMode && (
          <Header
            breadcrumbs={breadcrumbs}
            canGoBack={canGoBack}
            currentLabel={currentLabel}
            userEmail={user?.email ?? undefined}
            userAvatarUrl={user?.user_metadata?.avatar_url}
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

        <main id="main-content" className="p-4 lg:p-6" aria-label={currentLabel}>
          <Suspense fallback={<ActiveSkeleton />}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeView}
                custom={direction}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
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
