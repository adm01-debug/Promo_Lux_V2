import React, { forwardRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { View } from "@/hooks/useNavigationHistory";
import { NAV_ITEMS } from "@/components/lux/layout/Sidebar";
import { motion } from "framer-motion";

interface BreadcrumbEntry {
  label: string;
  view?: View;
}

interface AppBreadcrumbsProps {
  breadcrumbs: BreadcrumbEntry[];
  canGoBack: boolean;
  onGoBack: () => void;
  onNavigate: (view: View) => void;
  currentLabel: string;
}

function getViewIcon(view?: View) {
  if (!view) return null;
  const item = NAV_ITEMS.find((n) => n.id === view);
  if (!item) return null;
  const Icon = item.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

export const AppBreadcrumbs = forwardRef<HTMLDivElement, AppBreadcrumbsProps>(
  ({ breadcrumbs, canGoBack, onGoBack, onNavigate }, ref) => {
    return (
      <div ref={ref} className="flex items-center gap-2 lg:gap-3 overflow-hidden">
        {canGoBack && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex-shrink-0"
          >
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg bg-background/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:border-border/80 transition-all duration-200 active:scale-90"
                    onClick={onGoBack}
                    aria-label="Voltar para tela anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Voltar (Esc)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        )}

        <Breadcrumb className="hidden sm:block overflow-hidden">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              const icon = getViewIcon(crumb.view);
              return (
                <React.Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator className="flex-shrink-0" />}
                  <BreadcrumbItem className="flex-shrink-0">
                    {isLast ? (
                      <BreadcrumbPage className="text-foreground font-semibold text-sm flex items-center gap-1.5 truncate max-w-[120px] lg:max-w-[200px]">
                        {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
                        <span className="truncate">{crumb.label}</span>
                      </BreadcrumbPage>
                    ) : crumb.view ? (
                      <BreadcrumbLink
                        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors truncate max-w-[100px]"
                        onClick={() => onNavigate(crumb.view!)}
                      >
                        {icon && <span className="text-muted-foreground/60 flex-shrink-0">{icon}</span>}
                        <span className="truncate">{crumb.label}</span>
                      </BreadcrumbLink>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 flex items-center gap-1.5 truncate max-w-[100px]">
                        {icon}
                        <span className="truncate">{crumb.label}</span>
                      </span>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Mobile Page Title when not dashboard */}
        <div className="sm:hidden font-medium text-sm truncate text-foreground">
          {breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].label : "LUX IA"}
        </div>
      </div>
    );
  }
);

AppBreadcrumbs.displayName = "AppBreadcrumbs";
