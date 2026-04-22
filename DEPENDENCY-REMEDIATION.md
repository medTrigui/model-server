# Dependency Remediation Strategy

This plan prioritizes low-risk fixes first, then provides migration options to remove residual vulnerabilities rooted in the legacy CRA toolchain.

## Current Status (April 2026)

- Frontend vulnerabilities: 16 total (6 high, 1 moderate, 9 low)
- Safe `npm audit fix` applied in `frontend/`
- `follow-redirects` updated to `1.16.0`

Remaining issues are anchored in `react-scripts@5.0.1` transitive dependencies, primarily:
- `svgo@1.x` / `nth-check` chain
- `webpack-dev-server@4.x`
- legacy `jest` + `jsdom` chain (`@tootallnate/once` via `http-proxy-agent`)

## Phase 1: Safe Actions (No Build-System Break)

1. Keep `frontend/package-lock.json` updated using periodic:
   - `cd frontend && npm audit fix`
2. Keep existing `overrides` in `frontend/package.json` and review monthly.
3. Restrict exposure of known dev-server advisories by avoiding public access to development server environments.
4. Continue CI checks:
   - `cd frontend && npm run build`
   - `cd frontend && npm audit --omit=dev`

## Phase 2: Targeted Security Reduction (Moderate Change)

Option A: Migrate frontend from CRA to Vite while preserving React + Apollo architecture.
- Benefits:
  - Removes `react-scripts` vulnerability bottleneck
  - Faster dev/build tooling
  - Cleaner modern dependency graph
- Work items:
  1. Scaffold Vite React app
  2. Port Apollo setup and proxy config (`/graphql`, `/graphqlws`)
  3. Move static assets and CSS
  4. Verify subscription behavior and production nginx routing

Option B: Migrate to Next.js (if SSR or structured routing is desired).
- Benefits:
  - Long-term ecosystem support
  - Better production optimization defaults
- Trade-off:
  - Larger app architecture shift than Vite

## Recommended Path

1. Keep current frontend stable with Phase 1 actions immediately.
2. Start Option A (Vite migration) in a dedicated branch.
3. Decommission CRA after parity checks on:
   - query/mutation/subscription behavior
   - production build output behind nginx
   - room/device rendering from `model.deviceCount`

## Acceptance Criteria for Migration Completion

- `npm audit` in frontend shows no high vulnerabilities in active runtime toolchain.
- All existing UI flows are functionally equivalent.
- Production deployment docs and scripts are updated.
