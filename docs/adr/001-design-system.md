# ADR-001: Dark Gold Theme com Glass Morphism

## Status
Aceito

## Contexto
O sistema LUX IA precisa de uma identidade visual premium e diferenciada que transmita sofisticação para o público B2B.

## Decisão
- Tema dark com primary gold (#D4A520) sobre background ~#0A0D14
- Glass morphism para cards e superfícies (backdrop-blur + border translúcida)
- Tipografia: Space Grotesk para headings, JetBrains Mono para dados/código
- Design tokens em CSS custom properties (`index.css`) mapeados em `tailwind.config.ts`
- Todas as cores em HSL para consistência com shadcn/ui
- Utilitários de glow (`.gold-glow`, `.card-glass`) definidos globalmente

## Consequências
- **Positivo**: Identidade visual forte e consistente; tematização centralizada
- **Negativo**: Requer disciplina para usar tokens semânticos ao invés de cores diretas
- **Regra**: Nunca usar classes de cor hardcoded (ex: `text-white`, `bg-black`) nos componentes
