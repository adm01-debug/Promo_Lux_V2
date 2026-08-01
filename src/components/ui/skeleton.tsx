import { cn } from "@/lib/utils";

function Skeleton({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("rounded-md skeleton-gold", className)}
      {...props}
    />
  );
}

export { Skeleton };
