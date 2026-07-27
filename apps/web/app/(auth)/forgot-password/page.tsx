"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recovery now lives as a tab on the unified /login page; this route stays so
// existing links/bookmarks to /forgot-password keep working.
export default function ForgotPasswordRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?tab=recover");
  }, [router]);

  return null;
}
