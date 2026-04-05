import { forwardRef } from "react";
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
      <div ref={ref} className="flex items-center gap-2">
        {canGoBack && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onGoBack}
              aria-label="Voltar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              const icon = getViewIcon(crumb.view);
              return (
                <React.Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="text-foreground font-semibold text-sm flex items-center gap-1.5">
                        {icon && <span className="text-primary">{icon}</span>}
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : crumb.view ? (
                      <BreadcrumbLink
                        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                        onClick={() => onNavigate(crumb.view!)}
                      >
                        {icon && <span className="text-muted-foreground/60">{icon}</span>}
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
                        {icon}
                        {crumb.label}
                      </span>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    );
  }
);

AppBreadcrumbs.displayName = "AppBreadcrumbs";
