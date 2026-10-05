import { panelGroupOf, type PanelId, type PanelLayout } from "./types"

/** Where a new pane should go so it sits with its group-mates (PANEL_GROUPS): the slot (column or tab group) holding the
 * most panes of its group that still has room, else the least-full slot. Panes with no group have no mates, so they get
 * the least-full slot, same as before grouping. */
export function slotForGroup(slots: PanelLayout[][], id: PanelId, maxPerSlot = Infinity): number {
  const group = panelGroupOf(id)
  let best = -1
  let bestMates = 0
  slots.forEach((slot, i) => {
    if (slot.length >= maxPerSlot) return
    const mates = group === -1 ? 0 : slot.filter((p) => panelGroupOf(p.id) === group).length
    if (mates > bestMates || (mates > 0 && mates === bestMates && slot.length < slots[best]!.length)) {
      best = i
      bestMates = mates
    }
  })
  if (best !== -1) return best
  let target = 0
  for (let i = 1; i < slots.length; i++) if (slots[i]!.length < slots[target]!.length) target = i
  return target
}
