import { motion } from "framer-motion";

interface TourSpotlightProps {
  rect: DOMRect;
  onClick: () => void;
}

export function TourSpotlight({ rect, onClick }: TourSpotlightProps) {
  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - 6}
              y={rect.top - 6}
              width={rect.width + 12}
              height={rect.height + 12}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-spotlight)"
          onClick={onClick}
          style={{ cursor: "pointer" }}
        />
      </svg>

      {/* Highlight ring with glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute rounded-xl border-2 border-primary/60 pointer-events-none"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 24px -4px hsl(var(--primary) / 0.3)",
        }}
      />
    </>
  );
}
