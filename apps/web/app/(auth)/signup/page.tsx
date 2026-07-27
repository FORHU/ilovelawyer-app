"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Sign up now lives as a tab on the unified /login page; this route stays so
// existing links/bookmarks to /signup keep working.
export default function SignupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?tab=signup");
  }, [router]);

  return null;
}
