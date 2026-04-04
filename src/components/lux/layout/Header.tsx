import { Bell, Menu, Search, Settings, LogOut, Keyboard, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppBreadcrumbs } from "@/components/lux/AppBreadcrumbs";
import { ThemeToggle } from "@/components/lux/ThemeToggle";
import { GradientAvatar } from "@/components/lux/GradientAvatar";
import { NotificationsPanel, useNotificationCount } from "@/components/lux/NotificationsPanel";
import { View } from "@/hooks/useNavigationHistory";
import { useState } from "react";
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
  onToggleFocusMode,
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

          {/* Avatar dropdown with settings + logout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <GradientAvatar
                  src={userAvatarUrl}
                  email={userEmail}
                  size="md"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
};
