export const PASSWORD_MIN_LENGTH = 10;

export type PasswordRuleKey = "length" | "uppercase" | "lowercase" | "number" | "special";

export const PASSWORD_RULES: { key: PasswordRuleKey; test: (password: string) => boolean }[] = [
  { key: "length", test: (password) => password.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", test: (password) => /[A-Z]/.test(password) },
  { key: "lowercase", test: (password) => /[a-z]/.test(password) },
  { key: "number", test: (password) => /[0-9]/.test(password) },
  { key: "special", test: (password) => /[^a-zA-Z0-9]/.test(password) },
];

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
