/**
 * Named content-width tiers — pick one instead of guessing a new pixel value per page.
 * See DESIGN.md. Tailwind's scanner picks these up from this file's literal text (the
 * `@source` globs in globals.css cover apps/web), so importing the constant still emits
 * the class even though the literal string doesn't appear at each call site.
 */
export const CONTENT_WIDTH_SM = "max-w-[1000px]"; // legal/reference pages, forms
export const CONTENT_WIDTH_MD = "max-w-[1280px]"; // case list/detail
export const CONTENT_WIDTH_LG = "max-w-[1440px]"; // calendar, terminal, transcription, header
