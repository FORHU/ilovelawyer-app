import { Skeleton } from "@workspace/ui/components/skeleton"

// Default Next.js loading.tsx UI for routes that don't yet have a
// content-shaped skeleton of their own (see consultation/case-portfolio/
// library/terminal for those). Only covers the route's JS-chunk download on
// navigation — the page's own isLoading branch handles its data fetch.
export default function RouteLoadingFallback() {
  return (
    <div className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 flex flex-col gap-8">
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
