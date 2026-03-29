---
name: Design tokens
description: Gold/dark palette with light mode, glass morphism, glow utilities, scrollbar, selection
type: design
---

## Theme
- Dark: bg 222/5%, primary gold 45/58%, borders 222/16%
- Light: bg 45/97%, cards white, primary gold 40/35%, stronger borders 42/76%
- Glass: dark=translucent lux-surface, light=white card with subtle shadow
- Charts use theme-aware colors via useTheme hook

## Fonts
- Space Grotesk (headings/body), JetBrains Mono (code/numbers)
- Antialiased rendering on both themes

## Utilities
- `.glass` / `.glass-interactive` — auto-adapt to light/dark
- `.glow-primary` / `.glow-text` — gold glow effects
- `.card-hover` — lift on hover
- Custom scrollbar, text selection color
- Animations: fade-in, slide-in-right, pulse-glow, scan-line
