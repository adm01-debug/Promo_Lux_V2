import { Bell, Menu, Search, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppBreadcrumbs } from "@/components/lux/AppBreadcrumbs";
import { ThemeToggle } from "@/components/lux/ThemeToggle";
import { NotificationsPanel, useNotificationCount } from "@/components/lux/NotificationsPanel";
import { View } from "@/hooks/useNavigationHistory";
import { useState } from "react";

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
}

export const Header = ({
  breadcrumbs,
  canGoBack,
  currentLabel,
  userEmail,
  userAvatarUrl,
  onGoBack,
  onNavigate,
  onOpenMobileSidebar,
  onSignOut,
}: HeaderProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = useNotificationCount();

  return (
    <header className="border-b border-border glass sticky top-0 z-30">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground"
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
          <button
            data-tour="search"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
            }
            className="hidden sm:flex items-center gap-2 glass rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-2"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Buscar...</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono border border-border/50">
              ⌘K
            </kbd>
          </button>
        </div>

        <div data-tour="header-actions" className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>
          <NotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onNavigate("settings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair</TooltipContent>
          </Tooltip>
          {userAvatarUrl ? (
            <img src={userAvatarUrl} alt="Avatar" className="h-8 w-8 rounded-full ml-2" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary ml-2">
              {userEmail?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
