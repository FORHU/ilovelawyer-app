/** After a failed submit: moves focus to the first field the form marked aria-invalid. Deferred a
 * frame so it runs after React has rendered the error state. */
export function focusFirstInvalid(form: ParentNode | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
