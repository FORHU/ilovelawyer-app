import { create } from "zustand"

/** Which prompt groups the user explicitly toggled open/closed in a topic list, keyed by a
 * caller-chosen scope (e.g. `topics:{consultationId}`). Lives outside the components because the
 * mobile Case Workspace mounts one tab at a time — switching Sources → Chat → Sources unmounts
 * the panel, which would otherwise reset local `useState` toggles back to "newest prompt only". */
interface PromptOpenOverridesState {
  overrides: Record<string, Record<number, boolean>>
  setOverride: (scope: string, promptIndex: number, open: boolean) => void
}

export const usePromptOpenOverridesStore = create<PromptOpenOverridesState>((set) => ({
  overrides: {},
  setOverride: (scope, promptIndex, open) =>
    set((s) => ({ overrides: { ...s.overrides, [scope]: { ...s.overrides[scope], [promptIndex]: open } } })),
}))
