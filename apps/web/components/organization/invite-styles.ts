/** The invite form's look, shared by the Organization page and onboarding's invite step. */

export const inviteLabelClass = "text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground";

/** Leaves room on the left for the mail icon (inviteMailIconClass). */
export const inviteInputClass =
  "w-full rounded-lg border border-border bg-background/60 py-2 pl-9 pr-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60";

export const inviteMailIconClass = "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground";

/** A solid background (not a translucent one) and the theme's own colors, on the select and its
 * options: the browser's open list takes them, so it's never white text on white in dark mode. */
export const inviteSelectClass =
  "cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:cursor-not-allowed disabled:opacity-60";

export const inviteOptionClass = "bg-background text-foreground";
