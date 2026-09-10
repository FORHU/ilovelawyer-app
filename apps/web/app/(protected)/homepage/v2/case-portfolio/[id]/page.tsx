"use client";
import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/** This route was folded into the unified case-detail page (case-portfolio/[id], Workspace
 * tab) — kept as a redirect only so existing bookmarks/links still land somewhere real. */
export default function LegacyCaseWorkspaceRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/homepage/case-portfolio/${id}${qs ? `?${qs}` : ""}`);
  }, [id, router, searchParams]);

  return null;
}
