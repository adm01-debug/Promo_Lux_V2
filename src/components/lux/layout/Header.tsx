import { Bell, Menu, Search, Settings, LogOut, Keyboard, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppBreadcrumbs } from "@/components/lux/AppBreadcrumbs";
import { ThemeToggle } from "@/components/lux/ThemeToggle";
import { GradientAvatar } from "@/components/lux/GradientAvatar";
import { NotificationsPanel, useNotificationCount } from "@/components/lux/NotificationsPanel";
import { WorkspaceSwitcher } from "@/components/lux/organizations/WorkspaceSwitcher";
import { View } from "@/hooks/useNavigationHistory";
import { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BreadcrumbItem {
  label: string;
  view?: View;
}

interface HeaderProps {
  breadcrumbs: BreadcrumbItem[];
  canGoBack: boolean;
  currentLabel: string;
  userEmail?: string;
  userAvatarUrl?: string;
  onGoBack: () => void;
  onNavigate: (view: View) => void;
  onOpenMobileSidebar: () => void;
  onSignOut: () => void;
  onToggleFocusMode?: () => void;
}

export const Header = memo(({
  breadcrumbs,
  canGoBack,
  currentLabel,
  userEmail,
  userAvatarUrl,
  onGoBack,
  onNavigate,
  onOpenMobileSidebar,
  onSignOut,
  onToggleFocusMode,
}: HeaderProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const unreadCount = useNotificationCount();

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const handler = () => setScrolled(main.scrollTop > 8);
    main.addEventListener("scroll", handler, { passive: true });
    return () => main.removeEventListener("scroll", handler);
  }, []);

  // Focus input when search expands
  useEffect(() => {
    if (searchExpanded) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchExpanded]);

  const openCommandPalette = () => {
    setSearchExpanded(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header
      className={cn(
        "border-b border-border/40 sticky top-0 z-30 transition-all duration-300",
        scrolled
          ? "shadow-lg shadow-black/10 backdrop-blur-xl bg-background/85 border-border/50"
          : "backdrop-blur-md bg-background/60"
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Left: Menu + Breadcrumbs */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AppBreadcrumbs
            breadcrumbs={breadcrumbs}
            canGoBack={canGoBack}
            onGoBack={onGoBack}
            onNavigate={onNavigate}
            currentLabel={currentLabel}
          />
          <WorkspaceSwitcher onManage={() => onNavigate("organizations")} />
        </div>

        {/* Center: Search bar */}
        <div className="hidden sm:flex items-center justify-center flex-1 max-w-md mx-4">
          <AnimatePresence mode="wait">
            {searchExpanded ? (
              <motion.div
                key="expanded"
                initial={{ width: 160, opacity: 0.8 }}
                animate={{ width: "100%", opacity: 1 }}
                exit={{ width: 160, opacity: 0.8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar empresas, pipelines, workflows..."
                  autoComplete="off"
                  className="w-full h-9 pl-9 pr-20 rounded-xl bg-secondary/40 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openCommandPalette();
                    if (e.key === "Escape") setSearchExpanded(false);
                  }}
                  onBlur={() => setSearchExpanded(false)}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded-md bg-muted/60 text-[9px] font-mono border border-border/40 text-muted-foreground">
                    Enter
                  </kbd>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchExpanded(false); }}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="collapsed"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.8 }}
                data-tour="search"
                onClick={() => setSearchExpanded(true)}
                className="flex items-center gap-2.5 rounded-xl bg-secondary/30 border border-border/30 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 hover:border-border/50 transition-all duration-200 cursor-pointer group"
              >
                <Search className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
                <span>Buscar...</span>
                <kbd className="ml-4 px-1.5 py-0.5 rounded-md bg-muted/40 text-[9px] font-mono border border-border/40 group-hover:border-primary/30 group-hover:text-primary/80 transition-colors">
                  ⌘K
                </kbd>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Actions */}
        <div data-tour="header-actions" className="flex items-center gap-1 flex-1 justify-end">
          {/* Mobile search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground sm:hidden"
                onClick={openCommandPalette}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Buscar (⌘K)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atalhos de teclado (?)</TooltipContent>
          </Tooltip>
          {onToggleFocusMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                  onClick={onToggleFocusMode}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Modo Foco (⌘⇧F)</TooltipContent>
            </Tooltip>
          )}
          <ThemeToggle />

          {/* Notification bell with animated badge */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <motion.div
                animate={unreadCount > 0 ? {
                  rotate: [0, -15, 12, -10, 8, -4, 0],
                } : {}}
                transition={{
                  duration: 0.6,
                  delay: 1.5,
                  repeat: unreadCount > 0 ? Infinity : 0,
                  repeatDelay: 8,
                }}
              >
                <Bell className={cn(
                  "h-4 w-4 transition-all duration-300",
                  unreadCount > 0 && "text-primary"
                )} />
              </motion.div>
            </Button>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
                >
                  <span className="absolute h-5 w-5 rounded-full bg-primary/30 animate-ping" />
                  <span className="relative h-4 min-w-[16px] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.5)]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <NotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-transform hover:scale-105 active:scale-95">
                <GradientAvatar
                  src={userAvatarUrl}
                  email={userEmail}
                  size="md"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs text-muted-foreground truncate">{userEmail ?? "Usuário"}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNavigate("settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
});
