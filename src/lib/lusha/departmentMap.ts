// Re-exporta o mapa canônico de departamentos para consumo no front-end (Vite).
// Fonte de verdade: supabase/functions/_shared/departmentMap.ts
// Mantido como cópia sincronizada porque Vite não resolve caminhos fora de src/.
// Ao alterar um, altere o outro — coberto por teste em src/lib/lusha/__tests__.
export {
  DEPT_MAP,
  SUGGESTED_DEPARTMENTS_PT,
  resolveDepartments,
  findPtLabelForEn,
  type DepartmentResolution,
} from "./departmentMap.data";
