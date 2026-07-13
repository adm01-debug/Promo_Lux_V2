import type { TourStep } from "./TourSteps";

export interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

/** Compute tooltip position relative to a target rect */
export function getTooltipPosition(
  targetRect: DOMRect,
  placement: TourStep["placement"] = "bottom",
  tooltipWidth = 360,
  tooltipHeight = 240
): TooltipPosition {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  let arrowSide: TooltipPosition["arrowSide"] = "top";

  switch (placement) {
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.right + gap;
      arrowSide = "left";
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - tooltipWidth - gap;
      arrowSide = "right";
      break;
    case "top":
      top = targetRect.top - tooltipHeight - gap;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      arrowSide = "bottom";
      break;
    case "bottom":
    default:
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      arrowSide = "top";
      break;
  }

  top = Math.max(8, Math.min(top, vh - tooltipHeight - 8));
  left = Math.max(8, Math.min(left, vw - tooltipWidth - 8));

  return { top, left, arrowSide };
}
