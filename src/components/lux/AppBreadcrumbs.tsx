import React, { forwardRef } from "react";
import { ChevronLeft, Home } from "lucide-react";
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
import { NAV_ITEMS } from "@/components/lux/layout/nav-items";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  if (view === "dashboard") return <Home className="h-3.5 w-3.5" />;
  const item = NAV_ITEMS.find((n) => n.id === view);
  if (!item) return null;
  const Icon = item.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

export const AppBreadcrumbs = forwardRef<HTMLDivElement, AppBreadcrumbsProps>(
  ({ breadcrumbs, canGoBack, onGoBack, onNavigate }, ref) => {
    return (
      <div ref={ref} className="flex items-center gap-2 lg:gap-3 overflow-hidden select-none">
        <AnimatePresence mode="popLayout">
          {canGoBack && (
            <motion.div
              key="back-button"
              initial={{ opacity: 0, x: -10, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex-shrink-0"
            >
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg bg-background/50 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:border-border/80 transition-all duration-200 active:scale-90 shadow-sm"
                      onClick={onGoBack}
                      aria-label="Voltar para tela anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[10px] font-medium">Voltar (Esc)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>

        <Breadcrumb className="hidden sm:block overflow-hidden">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              const icon = getViewIcon(crumb.view);
              return (
                <React.Fragment key={`${i}-${crumb.label}`}>
                  {i > 0 && (
                    <BreadcrumbSeparator className="flex-shrink-0">
                      <motion.span 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="text-muted-foreground/30"
                      >/</motion.span>
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem className="flex-shrink-0">
                    {isLast ? (
                      <BreadcrumbPage className="text-foreground font-semibold text-sm flex items-center gap-1.5 truncate max-w-[120px] lg:max-w-[200px]">
                        <motion.div
                          layoutId="breadcrumb-active"
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          {icon && <span className="text-primary flex-shrink-0">{icon}</span>}
                          <span className="truncate">{crumb.label}</span>
                        </motion.div>
                      </BreadcrumbPage>
                    ) : crumb.view ? (
                      <BreadcrumbLink
                        className={cn(
                          "cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all truncate max-w-[100px] group",
                          i === 0 && "font-medium"
                        )}
                        onClick={() => onNavigate(crumb.view!)}
                      >
                        {icon && <span className="text-muted-foreground/60 group-hover:text-primary transition-colors flex-shrink-0">{icon}</span>}
                        <span className="truncate group-hover:translate-x-0.5 transition-transform">{crumb.label}</span>
                      </BreadcrumbLink>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 flex items-center gap-1.5 truncate max-w-[100px] italic">
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
        <div className="sm:hidden flex items-center gap-2 font-semibold text-sm truncate text-foreground">
          <AnimatePresence mode="wait">
            <motion.span
              key={breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].label : "LUX IA"}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="truncate"
            >
              {breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].label : "LUX IA"}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    );
  }
);

AppBreadcrumbs.displayName = "AppBreadcrumbs";
