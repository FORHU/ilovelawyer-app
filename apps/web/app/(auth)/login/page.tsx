"use client";

import { Suspense } from "react";
import UnifiedAuthPage from "../_components/unified-auth";

export default function LoginPage() {
  return (
    <Suspense>
      <UnifiedAuthPage />
    </Suspense>
  );
}
