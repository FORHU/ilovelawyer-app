"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_RULES, type PasswordRuleKey } from "@/lib/auth/password-policy";

interface PasswordRequirementsProps {
  password: string;
  labels: Record<PasswordRuleKey, string>;
}

export function PasswordRequirements({ password, labels }: PasswordRequirementsProps) {
  return (
    <ul className="flex flex-col gap-1 pt-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.key}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {met ? (
              <Check size={12} className="shrink-0" aria-hidden="true" />
            ) : (
              <X size={12} className="shrink-0 opacity-50" aria-hidden="true" />
            )}
            {labels[rule.key]}
          </li>
        );
      })}
    </ul>
  );
}
