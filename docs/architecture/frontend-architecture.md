# I Love Lawyer — Frontend Architecture

**Scope:** the `ilovelawyer-app` pnpm workspace only (Next.js 16 app in `apps/web` plus the shared `packages/*` it consumes). Complements `system-architecture.md` (full-stack trust boundaries) and `feature-architecture.md` (product/feature map) with a code-level map of how the frontend itself is organized. Paths are relative to `ilovelawyer-app/`.

## 1. Workspace structure

```
ilovelawyer-app/
├── apps/
│   └── web/                    Next.js 16 app — the only app in the workspace today
└── packages/
    ├── ui/                     @workspace/ui — shared shadcn/ui-style component library
    ├── eslint-config/          @workspace/eslint-config — flat ESLint configs
    └── typescript-config/      @workspace/typescript-config — shared tsconfig presets
```

`pnpm-workspace.yaml` declares `apps/*` and `packages/*`; these four directories are everything currently present. `apps/web/package.json` references the other three via `workspace:*`/`workspace:^`. `next.config.ts` sets `transpilePackages: ["@workspace/ui"]` so the untranspiled workspace source compiles through Next's own pipeline rather than needing a separate build step for the UI package. 85 files in `apps/web` import from `@workspace/ui`.

Stack: Next.js 16 (App Router, `output: "standalone"`), React 19, TanStack Query v5, Zustand v5, Tailwind v4, Radix UI primitives, Socket.IO client, react-i18next, next-themes, Vitest.

## 2. Routing (`apps/web/app/`)

App Router with two route groups and no middleware, no `error.tsx`/`not-found.tsx`, no parallel/intercepting routes anywhere in the tree.

```
app/
├── layout.tsx                 root layout (fonts, metadata, <Providers>)
├── page.tsx                   "/" — marketing landing (only page with indexable metadata)
├── files/[token]/route.ts     same-origin signed file streaming proxy
├── account-pending/page.tsx   real segment, outside both groups
├── (auth)/                    route group — signup/login/reset flows
│   ├── layout.tsx             redirects an already-authenticated user away from login/signup
│   ├── login/, login-link/, signup/, forgot-password/, reset-password/
└── (protected)/                route group — everything behind the auth gate
    ├── layout.tsx             the auth gate (see §3)
    └── homepage/
        ├── page.tsx                          AI consultation/chat landing
        ├── case-portfolio/, [id]/            case list + case detail/workspace
        ├── terminal/, [caseId]/, [caseId]/panel/[panelId]/   Case Terminal + per-panel pop-out
        ├── create-case/                      new-case wizard
        ├── calendar/                         case/event calendar
        ├── transcription/, library/          audio → transcription jobs, saved library
        ├── organization/                     org/member/invite management
        ├── library/, documents/, [id], laws/[id]/            legal research (RAG search + law viewer)
        ├── civil-code, family-code, labor-code, revised-penal-code, constitution/
        ├── administrative-issuances, judicial-issuances, persuasive-rulings,
        │   presidential-issuances, scra-archive/             static statute/jurisprudence browsers
        ├── profile/                          account settings
        ├── notifications/                    notification inbox
        ├── term/                             Terms of Service
        └── v2/case-portfolio/[id]/           legacy route, client-redirects into case-portfolio/[id]
```

Route groups carry no URL segment: `(auth)` and `(protected)` organize layouts only. `[token]`, `[id]`, `[caseId]`, `[panelId]` are the dynamic segments in the tree. The static statute/issuance browsers all share one `LegalCodePage` component driven by per-book data rather than being independently built pages.

`app/files/[token]/route.ts` is worth calling out on its own: it resolves an opaque token against the API (`/api/files/resolve`), forwards the browser's `Range` header to the resulting presigned S3 URL, and streams the upstream body straight through. It exists because `<img>`/`<a>`/`<audio>`/`<iframe>` src attributes can't carry a Bearer token — this route is the one place file access uses a signed-token-in-URL model instead of the header-based auth everything else uses.

## 3. Auth gate and provider tree

`app/layout.tsx` (root, async server component) sets up fonts, tenant-aware metadata (`metadataBase` resolved from request origin, default-deny `robots`), and wraps `children` in exactly one component: `<Providers tenantCodeHint>`.

**Provider nesting (`components/providers.tsx`), outermost → innermost:**

```
GoogleOAuthProvider
  → QueryClientProvider
    → ThemeProvider (next-themes)
      → I18nProvider
        → TenantCodeProvider
          → TooltipProvider
            → {children}
```

`NotificationSocketBridge` (headless, calls `useNotificationSocket()`) and `ReactQueryDevtools` mount as siblings inside `QueryClientProvider`, after `children` — not wrapping it. `Toaster` sits outside `QueryClientProvider` but inside `GoogleOAuthProvider`. No React context is added beyond these; cross-cutting client state goes through Zustand instead (§4).

`app/(protected)/layout.tsx` is the actual auth gate, and it's a client component, not a route-level redirect:

1. If no in-memory `accessToken` (Zustand `auth.store`), call the shared single-flight `refreshAccessToken()` against the httpOnly refresh cookie (same-origin proxy — see `system-architecture.md` §3). Failure → clear auth, `router.replace("/login")`.
2. `CurrentUserSync` fetches `/api/users/me`, syncs it into the auth store, and handles four redirect cases: unauthenticated → `/login`; non-`ACTIVE` approval status → `/account-pending`; pending org invite with no active org → `/homepage/organization`; wrong tenant subdomain → hard `window.location.href` redirect (not a Next transition, since it crosses origins).
3. Auto-selects the user's first organization via `useOrganizationsQuery`.
4. Renders `<LoadingScreen/>` until auth/org/approval are all resolved, then `<PageTransition>{children}</PageTransition>`.

Because Zustand state isn't persisted (§4) and the QueryClient is a per-tab singleton (§5), this entire sequence re-runs on every fresh tab/window/reload — there is no faster path that skips it. This is the behavior the Tauri multi-window plan (see the desktop-shell plan doc) relies on: each new window independently re-authenticates via the shared cookie rather than needing any cross-window state sync.

## 4. State management — Zustand stores

All under `lib/store/*.store.ts`, seven total, all plain `create()` — **none use Zustand's `persist` middleware**:

| Store | Holds | Durability | Consumers |
| --- | --- | --- | --- |
| `auth.store.ts` | `accessToken`, `user`, `organization` | None — rebuilt each load via refresh-cookie round trip | 69 refs / 23 files |
| `language.store.ts` | `language` | Manual `localStorage.setItem("displayLanguage", …)` | 7 / 3 |
| `terminal-display.store.ts` | `highDensity`, `panelLabels` | Manual localStorage (same hand-rolled pattern, not `persist`) | 11 / 4 |
| `media-queue.store.ts` | `transcripts: QueuedTranscript[]` (contains `Blob`s) | Hand-rolled IndexedDB sync, since `persist`'s JSON serialization can't hold Blobs | 14 / 4 |
| `sending-consultations.store.ts` | `sendingConsultationIds: Set<string>` | None | 13 / 6 |
| `mobile-nav.store.ts` | `isOpen` | None | 10 / 4 |
| `active-highlight.store.ts` | `activeHighlightId` | None | 6 / 3 |

The three stores that need durability all hand-roll their own sync (localStorage or IndexedDB) instead of the `persist` middleware, each initializing to a fixed default so SSR and first client render match, then reconciling in a `useEffect` post-mount (`I18nProvider` for language, `TerminalDisplayProvider` for display prefs). This is a deliberate, repeated pattern in this codebase, not an oversight in one place — worth following if a new store needs durable state.

## 5. Data-fetching layer

### API client (`lib/fetch.ts`, `lib/api-version.ts`)

- `AUTH_PATHS` (`lib/api-version.ts`) is the single shared list of paths that must go through the same-origin Next.js rewrite (see `system-architecture.md` §3) — both `fetch.ts` and `next.config.ts`'s `rewrites()` import it. The file is dependency-free by design so `next.config.ts` can import it without pulling in `fetch.ts`'s Zustand dependency.
- `versioned(path)` reads `NEXT_PUBLIC_API_VERSION_PREFIX` at **call time** (not module scope) and rewrites `/api/...` → `${prefix}/...`; currently a no-op since the backend doesn't yet serve a versioned prefix by default.
- `buildHeaders()` attaches `Authorization: Bearer <accessToken>` and `X-Organization-Id` from the auth store; omits `Content-Type` when the body is `FormData` so the browser sets its own multipart boundary.
- `apiFetchRaw()` retries once after a 401 via the single-flight `refreshAccessToken()`, unless `skipAuthRefresh` is set in options (used for calls where a 401 is an expected/handled outcome, not a session failure).
- Errors surface as a plain `Error` with an extra `.status: number` property (`Object.assign(new Error(message), {status})`) — there's no dedicated error class/type; callers check `.status` directly.
- Chat responses are **not** consumed as a streamed HTTP body through this client at all — routing a stream through the Next rewrite would buffer it (see `next.config.ts`'s `compress: false` comment), so chat generation is delivered entirely over Socket.IO events instead (§6).

### TanStack Query

`getQueryClient()` in `providers.tsx`: server always builds fresh; client reuses a module-scope singleton (`browserQueryClient`) — one instance per tab/JS context, same lifetime as the Zustand stores. Defaults: `staleTime: 5min`, `retry: 1`, `mutations.throwOnError: false`.

Convention repeated across every feature's query/mutation module (`lib/cases/mutations.ts`, `lib/terminal/mutations.ts`, `lib/chat/mutations.ts`, `lib/organizations/mutations.ts`, etc.): a per-domain `xKeys` factory (`caseKeys`, `chatKeys`, `terminalKeys`, …) with `all`/`lists`/`list(filters)`/`details`/`detail(id)` builders that nest via spreads, enabling prefix-match invalidation. Mutations call `invalidateQueries({queryKey: xKeys.lists()})` for a broad refetch and/or `setQueryData(xKeys.detail(id), updated)` for a write-through with no refetch; several do both in the same `onSuccess`. Cross-domain invalidation is normal — e.g. a terminal timeline mutation also invalidates the case-graph query keys.

Optimistic updates are the exception, not the default, but two concrete examples exist: `lib/chat/optimistic-messages.ts` pushes a temp-id message into the query cache before the POST resolves and swaps in the real id once it returns (done manually, not via `onMutate`); `useUploadDocumentsMutation` in `cases/mutations.ts` splices confirmed documents directly into the cache in `onSuccess` rather than only invalidating.

## 6. Realtime (Socket.IO)

One socket per tab: `getNotificationSocket()` (`lib/notifications/socket.ts`) lazily creates a module-scope singleton with `autoConnect: false` and a callback-based `auth` that reads the current access token fresh on each (re)connect. `lib/cases/case-room.ts` (per-case room join/leave) and `lib/cases/document-socket.ts` (per-document indexing state) both layer on this same shared socket rather than opening their own connections; connection status itself is exposed via a hand-rolled `useSyncExternalStore`-compatible external store.

Event names currently handled across the app:

| Area | Events |
| --- | --- |
| Notifications | `connect`, `disconnect`, `notification:new`, `chat:title-updated` |
| Documents | `document:started`, `document:ready`, `document:failed`, `document:retrying` |
| Chat | `chat:started`, `chat:chunk`, `chat:done`, `chat:error`, `chat:cancelled`, `chat:answer-complete`, `chat:session-rotated` |
| Terminal / AI jobs | `ai-job:started`, `ai-job:done`, `ai-job:failed` |

Because the socket is a tab-scoped singleton with no cross-tab/window sync, every browser tab or (in the Tauri desktop shell) every native window independently connects, authenticates, and re-subscribes to whatever case rooms it needs.

## 7. Component architecture and design system

### `packages/ui` (`@workspace/ui`)

Flat `src/components/` (no nested `components/ui`), 16 shadcn/ui-style primitives (`button`, `card`, `dialog`, `dropdown-menu`, `select`, `sheet`, `sonner`, `tooltip`, etc.) built on `radix-ui` + `class-variance-authority` + `tailwind-merge`; a `shadcn` devDependency confirms the provenance. Subpath exports: `./globals.css`, `./postcss.config`, `./lib/*`, `./components/*`, `./hooks/*`. Consumed in `apps/web` as `@workspace/ui/components/<name>`.

Theming is CSS custom properties plus a Tailwind v4 `@theme inline` block in `packages/ui/src/styles/globals.css` — there is no `tailwind.config.js`. Standard shadcn tokens (`--background`, `--card`, `--primary`, `--sidebar-*`, `--chart-1..5`) sit alongside custom brand tokens: `--brand-navy-950/900/800`, `--brand-gold`, `--brand-status-green`, `--brand-oxblood`, and status tokens `--ok`/`--warn`/`--danger`/`--riskmed`.

### `apps/web/components/`

| Directory | Purpose |
| --- | --- |
| `terminal/` | The Case Terminal workspace itself — panels, panel-kit, `TerminalDisplayProvider` |
| `chat/` | Consultation chat — messages, attachments, grounding, decision drawer |
| `case-workspace/` | Split-pane case workspace (sources/studio panels, resize handle) |
| `cases/` | Case & document CRUD/archive modals, timeline |
| `case-brief/` | Case Brief export UI |
| `citation-map/` | Citation graph visualization |
| `library/` | Statute/law viewer, search, PDF/full-text viewers |
| `calendar/` | Time picker and calendar UI |
| `notifications/` | Bell, panel, item |
| `account/`, `auth/` | Account-deletion/password modals, password-requirement UI |
| `shared/` | Cross-cutting: annotation thread, attributed-text/decision-anchor matchers (with tests) |
| `landing/` | Marketing page sections |
| `ui/` | Local overrides not in `@workspace/ui` (`custom-select`, `pagination`) |

Plus top-level shell components: `page-shell.tsx`, `global-header.tsx`, `providers.tsx`, `theme-provider.tsx`, `i18n-provider.tsx`, `tenant-code-provider.tsx`, `mobile-drawer.tsx`.

`feature-architecture.md` §6 already covers the Terminal's domain/data mapping panel-by-panel; the convention worth restating here is structural: put domain logic in the service/model layer the panel calls, not in the React panel or the API controller.

## 8. Theming

`next-themes` (`components/theme-provider.tsx`): `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. A mount-guarded `ThemeToggle` avoids hydration mismatch. All actual color tokens live in `packages/ui`'s `globals.css` (§7), not duplicated in the app.

## 9. Internationalization

`lib/i18n/`: per-feature JSON files under `locales/{en,ko,tl}/`, 12 namespaces per locale (auth, calendar, case-portfolio, common, create-case, homepage, landing, library, organization, profile, term, terminal, transcription), statically imported and assembled in `resources.ts`; `namespaces.ts` declares the canonical `Namespace` type. `i18n.ts` initializes once (`if (!i18next.isInitialized)`), `defaultNS: "common"`, `react.useSuspense: false`. Language switching goes through `language.store.ts`'s manual localStorage persistence (§4), not i18next's own language-detector/cache plugin — `I18nProvider` reconciles the stored value on mount and calls `i18n.changeLanguage()` in a `useEffect`.

## 10. Testing and tooling

- **Vitest** (`apps/web/vitest.config.ts`): `environment: "node"`, scoped by the config's own comment to "pure-function/unit tests only... no component/E2E harness"; includes only `**/__tests__/**/*.test.ts`. 20 test files exist, all `.test.ts` (no `.test.tsx`), covering pure logic — tenant-code resolution, chat helpers (optimistic messages, transcript scroll, composer actions), case-room/document-socket state machines, mind-map collapse logic, library link/config helpers, the `files/[token]` route. No MSW despite `allowBuilds: { msw: false }` in `pnpm-workspace.yaml` — that entry just disables an unrelated transitive dependency's install script; grep hits for "msw" are false positives on the string `application/msword`.
- **ESLint** (`@workspace/eslint-config`): flat config, three exports (`./base`, `./next-js`, `./react-internal`), built on `typescript-eslint` + `eslint-plugin-react`/`react-hooks` + `eslint-plugin-turbo`.
- **TypeScript** (`@workspace/typescript-config`): `base.json`/`nextjs.json`/`react-library.json` presets, extended by path (no package `exports` map).
- **Build**: `next.config.ts` sets `output: "standalone"`, `compress: false` (streaming), tenant-subdomain `allowedDevOrigins`, and pins `turbopack.root` to the `ilovelawyer-app` workspace root so Turbopack doesn't infer it from an unrelated `package-lock.json` one level further up.

## 11. Frontend-specific invariants

These sit alongside (not instead of) the cross-feature invariants in `feature-architecture.md` §13:

1. Auth/org state is memory-only and re-derived per tab/window from the refresh cookie — never assume it survives a reload without the `(protected)` layout's hydration sequence running first (§3).
2. Any Zustand store that needs to survive a reload hand-rolls its own localStorage/IndexedDB sync rather than using `persist` — follow that existing pattern, don't introduce a second one.
3. Chat is consumed via Socket.IO events, not a streamed fetch response — don't route chat through `apiFetch`/`apiFetchRaw` expecting incremental chunks.
4. Query key objects (`xKeys`) are the unit of cache invalidation — a new mutation should extend an existing domain's `xKeys`, not invent an ad hoc key shape.
5. Terminal panel domain logic belongs in the service/model layer, not the React panel component.
6. The Socket.IO connection, the QueryClient, and every Zustand store are scoped per tab/window with no built-in cross-window sync — `legal-terminal.tsx`'s panel pop-out (`window.open`) and the planned Tauri multi-window shell both rely on this already being true rather than needing to build it.
