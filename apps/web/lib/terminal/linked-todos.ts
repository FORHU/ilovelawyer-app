import { useCaseSnapshotQuery, useCreateProcedureItemMutation } from "@/lib/terminal/mutations"
import type { ProcedureSourceKind, SnapshotProcedureItem } from "@/lib/terminal/types"

export interface TodoSource {
  kind: ProcedureSourceKind
  id: string
  /** A witness need's key, for WITNESS_NEED only. */
  key?: string
}

export function isSameSource(item: SnapshotProcedureItem, source: TodoSource) {
  return item.sourceKind === source.kind && item.sourceId === source.id && (item.sourceKey ?? null) === (source.key ?? null)
}

/**
 * "To checklist" across the Terminal: sends an item over to Case Strategy as a to-do that remembers
 * where it came from, so the API ticks it once the item is fixed (ilovelawyer-api
 * utils/procedure-link.ts). Whether an item is already on the checklist is read from the case's
 * to-dos, so it holds after a reload and for everyone on the case.
 */
export function useLinkedTodos(caseId: string) {
  const items = useCaseSnapshotQuery(caseId).data?.procedure.items ?? []
  const create = useCreateProcedureItemMutation(caseId)
  const pending = create.isPending ? create.variables : undefined

  return {
    /** An open to-do already raised on this item. */
    isOnChecklist: (source: TodoSource) => items.some((item) => !item.done && isSameSource(item, source)),
    isSending: (source: TodoSource) =>
      !!pending && pending.sourceKind === source.kind && pending.sourceId === source.id && pending.sourceKey === source.key,
    send: (source: TodoSource, label: string, sourceLabel: string) =>
      create.mutate({ kind: "TODO", label, sourceLabel, sourceKind: source.kind, sourceId: source.id, sourceKey: source.key }),
    isError: create.isError,
  }
}
