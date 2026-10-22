"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { refreshAccessToken } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useOrganizationsQuery, useMyInviteQuery, usePortfolioQuery } from "@/lib/organizations/queries"
import { toActiveOrg } from "@/lib/auth/mutations"
import { useTenantCodeHint } from "@/components/tenant-code-provider"
import { hostForTenantCode } from "@/lib/tenant-code/resolve-host"
import { LoadingScreen } from "@/components/loading-screen"
import { TourLayer } from "@/components/tour/tour-layer"
import { SharedWorkspaceGuard } from "@/components/shared-workspace"
import { WorkspaceSetup } from "@/app/(auth)/_components/workspace-setup"
import { OnboardingLoading, OnboardingShell } from "@/components/onboarding/onboarding-shell"
import AiConsentPrompt from "@/components/account/ai-consent-prompt"
import { FeedbackDrawer } from "@/components/feedback/feedback-drawer"

const ORGANIZATION_PATH = "/homepage/organization"
const ONBOARDING_PATH = "/onboarding"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [hydrating, setHydrating] = useState(() => !accessToken)

  useEffect(() => {
    if (accessToken) {
      return
    }

    // No in-memory access token (fresh tab or reload) — the refresh token only
    // lives in the httpOnly cookie, so ask the server to mint a new access token.
    // Goes through the shared single-flight refreshAccessToken (not a raw fetch)
    // so this can't race the auth layout's own refresh call and burn the
    // one-time refresh cookie, which would spuriously 401 whichever call loses.
    refreshAccessToken()
      .then(() => setHydrating(false))
      .catch(() => {
        clearAuth()
        // Keep the deep link (e.g. the org-invite email's /homepage/organization) so login
        // lands back on it instead of the default /homepage.
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <CurrentUserSync hydrating={hydrating} setAuth={setAuth} clearAuth={clearAuth}>{children}</CurrentUserSync>
}

function CurrentUserSync({
  hydrating,
  setAuth,
  clearAuth,
  children,
}: {
  hydrating: boolean
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  clearAuth: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.organization)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const portfolio = useAuthStore((s) => s.portfolio)
  const setPortfolio = useAuthStore((s) => s.setPortfolio)
  const workspace = useAuthStore((s) => s.workspace)
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  const hostTenantCode = useTenantCodeHint()
  const { data: currentUser, isError, error } = useCurrentUserQuery()
  // Rehydrates the active org after a fresh tab/reload — the store has no persist
  // middleware, so `organization` resets to null even though accessToken/user come back
  // via the refresh-token flow. Without this, every resource-route call 400s with
  // "X-Organization-Id header is required" until the next login. See
  // docs/organization-feature-frontend-handoff.md §3.
  const orgsQuery = useOrganizationsQuery({ enabled: !!accessToken && !!user && !organization })
  const { data: orgs } = orgsQuery
  // A user with no active org but a pending invite has nothing else to do in the app —
  // the accept/decline UI lives on the Organization page, so route them there directly
  // instead of leaving them stranded wherever they landed post-login.
  const inviteQuery = useMyInviteQuery({ enabled: !!accessToken && !!user && !organization })
  const { data: pendingInvite } = inviteQuery
  // A user with no org and no invite (skipped onboarding by closing the tab, or arrived via
  // a reload or the approval email's login link) would otherwise land in an app where every
  // resource route 400s. Latched rather than derived: WorkspaceSetup's create-org path sets
  // the org *before* its invite-your-team step, and that step must stay on screen until onDone.
  const [workspaceSetupOpen, setWorkspaceSetupOpen] = useState(false)
  // A missing/expired token is a real 401/403 from the API. Anything else (a
  // dropped connection, a CORS misconfiguration, a 500) is transient and
  // shouldn't sign the user out — apiFetch already throws with `.status` unset
  // for those, since the underlying fetch() rejects before an HTTP response
  // ever comes back to inspect.
  const isAuthError = isError && ((error as { status?: number })?.status === 401 || (error as { status?: number })?.status === 403)

  useEffect(() => {
    if (!accessToken || user || !currentUser) return
    setAuth({
      accessToken,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user, currentUser])

  useEffect(() => {
    if (isAuthError) {
      clearAuth()
      router.replace("/login")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthError])

  // A PENDING/DENIED/BLOCKED user has a valid session (needed to finish solo/org setup
  // and to see /account-pending) but no business in the actual app — send them there
  // instead of ever rendering a protected page.
  const needsApproval = !!currentUser && currentUser.approvalStatus !== "ACTIVE"

  useEffect(() => {
    if (needsApproval) router.replace("/account-pending")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsApproval])

  // Account setup isn't finished (invites, the Lawyer Application): send an approved lawyer to
  // /onboarding. Only once they have a workspace (before that, WorkspaceSetup below shows instead,
  // and a user with only a pending invite goes to the Organization page), and never a trial guest.
  const needsSetup =
    !!currentUser &&
    !needsApproval &&
    !!organization &&
    !currentUser.setupCompletedAt &&
    !currentUser.trialExpiresAt &&
    pathname !== ONBOARDING_PATH

  useEffect(() => {
    if (needsSetup) router.replace(ONBOARDING_PATH)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSetup])

  useEffect(() => {
    if (organization || !orgs?.[0]) return
    setOrganization(toActiveOrg(orgs[0]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, orgs])

  // The portfolio (the user's personal workspace) sits alongside their organization. Someone
  // who's *in* their personal workspace has no separate portfolio to switch to.
  const inOrganization = !!organization && !organization.isPersonal
  const portfolioQuery = usePortfolioQuery({ enabled: inOrganization })
  const { data: portfolioData } = portfolioQuery

  useEffect(() => {
    if (!portfolioData || portfolio?.id === portfolioData.id) return
    setPortfolio(toActiveOrg(portfolioData))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioData, portfolio])

  // A portfolio view restored after a reload that can't be (no portfolio, or now in the personal
  // workspace itself) falls back to the organization rather than blocking on it.
  const portfolioUnavailable = !!organization && (organization.isPersonal || portfolioQuery.isError)
  useEffect(() => {
    if (workspace === "portfolio" && portfolioUnavailable) setWorkspace("organization")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, portfolioUnavailable])

  useEffect(() => {
    if (organization || !pendingInvite || pathname === ORGANIZATION_PATH) return
    router.replace(ORGANIZATION_PATH)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, pendingInvite, pathname])

  // Only on a successful (empty) org list — a failed lookup isn't proof of "no org".
  const noWorkspace =
    !organization && !needsApproval && orgsQuery.isSuccess && !orgs?.length && inviteQuery.isFetched && !pendingInvite

  if (noWorkspace && !workspaceSetupOpen) setWorkspaceSetupOpen(true)

  // Domain/tenant mismatch: the organization's persisted Tenant is authoritative and
  // never changes because of which subdomain the browser happens to be on — if they disagree
  // (including an unresolved host: the bare apex, app.ilovelawyer.com, or anything else that
  // isn't ph./uk.), redirect to the organization's correct subdomain rather than silently
  // rendering under the wrong one. This is a UX redirect only; it does not and cannot change
  // which tenant's legal engine/prompts the backend uses for this organization — that's
  // resolved server-side from Organization.tenantId regardless of hostname.
  useEffect(() => {
    if (!organization || typeof window === "undefined") return
    if (hostTenantCode === organization.tenantCode) return
    const targetHost = hostForTenantCode(organization.tenantCode, window.location.host)
    if (targetHost === window.location.host) return
    window.location.href = `${window.location.protocol}//${targetHost}${window.location.pathname}${window.location.search}`
  }, [organization, hostTenantCode])

  // Renders children only once we actually KNOW the approval status — not just once
  // `user` (a minimal object, set immediately by login/verifyOtp/WorkspaceSetup) exists.
  // `currentUser` (this layout's own /api/users/me fetch, which carries approvalStatus)
  // can still be in flight at that point; blocking on `user` alone let a PENDING/DENIED/
  // BLOCKED account render one frame of real app content before the redirect effect
  // below had a chance to fire. Bails out on `isError` (any failure, not just auth)
  // rather than blocking forever on a transient error — isAuthError's own effect
  // handles the redirect; other errors fall through to render children as before.
  const statusUnknown = !!accessToken && !currentUser && !isError
  // Resource routes (chat, cases, events, ...) 400 with "X-Organization-Id header is
  // required" until `organization` is set — block children (which fire those requests on
  // mount, e.g. the chat sidebar) until it's actually set, not just until the fetch that
  // feeds the `setOrganization` effect above has resolved (that effect runs one render/
  // commit after `orgsQuery` resolves, and child effects — e.g. the chat sidebar's own
  // mount-time fetch — can run before it does). Once `orgsQuery` has fetched and truly
  // found no org (e.g. a pending-invite-only user), stop blocking so the redirect effect
  // above can send them to the organization page instead of loading forever. With no org, also
  // wait for the invite lookup, which decides between that redirect and WorkspaceSetup.
  const orgResolved = !!organization || (orgsQuery.isFetched && !orgs?.length && inviteQuery.isFetched)
  const orgUnknown = !!accessToken && !!currentUser && !needsApproval && !orgResolved
  // Viewing the portfolio (restored after a reload): resource requests must go to it, so wait
  // until it's known rather than let children fetch the organization's data first.
  const portfolioUnknown = workspace === "portfolio" && inOrganization && !portfolio && !portfolioQuery.isError

  if (hydrating || (accessToken && !user && !isError) || statusUnknown || needsApproval || needsSetup || isAuthError || orgUnknown || portfolioUnknown)
    // On /onboarding (or on the way to it), keep setup's own layout instead of the full-screen
    // loader, so the steps don't flash between two different screens.
    return pathname === ONBOARDING_PATH || needsSetup ? <OnboardingLoading /> : <LoadingScreen />

  if (workspaceSetupOpen)
    return (
      <OnboardingShell>
        <WorkspaceSetup defaultOrgName={user?.name ?? ""} onDone={() => setWorkspaceSetupOpen(false)} />
      </OnboardingShell>
    )

  return (
    <>
      {/* Page transitions live in homepage/layout.tsx, below its persistent header. */}
      {children}
      <SharedWorkspaceGuard />
      {/* The onboarding tour and Ask the guide, over every signed-in page. */}
      <TourLayer />
      {/* The header's Feedback drawer. */}
      <FeedbackDrawer />
      {/* First login: everyone answers for AI processing once. Not during account setup: it waits
          until the lawyer reaches the app, so it never covers a setup step. */}
      {pathname !== ONBOARDING_PATH && <AiConsentPrompt />}
    </>
  )
}
