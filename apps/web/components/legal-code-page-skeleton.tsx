import { Skeleton } from "@workspace/ui/components/skeleton";

// Mirrors LegalCodePage's shape (back-link -> eyebrow/title/subtitle ->
// bespoke middle section -> AI CTA banner) so the ~10 static reference
// routes that share it don't flash a generic bar layout on navigation.
export default function LegalCodePageSkeleton() {
  return (
    <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
      <Skeleton className="h-3.5 w-32" />

      <div className="w-full flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-full max-w-[600px]" />
      </div>

      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 px-6 py-5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-8 md:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border border-border">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <Skeleton className="h-11 w-40 shrink-0 rounded-lg" />
      </div>
    </main>
  );
}
