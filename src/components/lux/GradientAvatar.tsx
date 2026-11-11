import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface GradientAvatarProps {
  email?: string;
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-teal-600",
];

const SIZE_MAP = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const GradientAvatar = ({
  email,
  name,
  src,
  size = "md",
  className,
}: GradientAvatarProps) => {
  const seed = email || name || "U";
  const gradientIndex = useMemo(
    () => hashString(seed) % GRADIENTS.length,
    [seed],
  );
  const initials = useMemo(() => {
    if (name) {
      return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
    }
    return seed.charAt(0).toUpperCase();
  }, [name, seed]);

  if (src) {
    return (
      <img
        src={src}
        alt={name || email || "Avatar"}
        className={cn(
          "rounded-full object-cover ring-2 ring-primary/20 ring-offset-1 ring-offset-background",
          SIZE_MAP[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-inner",
        "ring-2 ring-primary/20 ring-offset-1 ring-offset-background",
        GRADIENTS[gradientIndex],
        SIZE_MAP[size],
        className,
      )}
      aria-label={name || email || "Avatar"}
    >
      {initials}
    </div>
  );
};
