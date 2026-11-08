# ECC for Codex CLI

This supplements the root `AGENTS.md` with a repo-local baseline.

## Repo Skill

- Repo skill for Codex: `.agents/skills/promo-lux-v2/SKILL.md`
- Claude-facing companion skill: `.claude/skills/promo-lux-v2/SKILL.md`
- Keep user-specific credentials and private MCPs in `~/.codex/config.toml`, not in this repo.

## MCP Baseline

Treat `.codex/config.toml` as the default safe baseline for work in this repository.
The baseline enables GitHub, Context7, Exa, Memory, Playwright, and Sequential Thinking.

## Multi-Agent Support

- Explorer: read-only evidence gathering
- Reviewer: correctness, security, and regression review
- Docs researcher: API and release-note verification

## Repo-specific warnings

- The quality gate does not run: `.github/workflows/ci.yml` is stored as base64 and has never completed.
  Run `npm run lint`, `npx tsc --noEmit` and `npx vitest run <path>` locally — see `docs/agentes/github-ci.md`.
- Anything under `supabase/migrations/` is applied to production on push to `main`. Never touch it without
  the project owner.
- `supabase/config.toml` points at a project ref that is **not** the live database. See `docs/agentes/banco.md`.
