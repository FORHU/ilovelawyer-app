/** Account setup's shared look, so every step (Choose, Firm, Invite, Apply) matches the sign-in
 * page's: a serif heading, a muted line under it, and full-width stacked buttons. */
export const setupHeadingClass = "font-['Libre_Caslon_Text'] font-normal text-[32px] text-foreground leading-10";
export const setupSubtitleClass = "text-muted-foreground text-sm";

export const setupPrimaryButtonClass =
  "w-full bg-primary text-primary-foreground rounded-xl text-base tracking-[1.6px] uppercase font-semibold py-4 cursor-pointer hover:opacity-90 transition-opacity border-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2";
export const setupSecondaryButtonClass =
  "w-full rounded-xl border border-border text-foreground text-sm tracking-[1.2px] uppercase font-semibold py-3.5 cursor-pointer hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
