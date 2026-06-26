import { useCallback, useMemo, useState } from 'react'

type ListSelectionId = number | string

export function useListSelection<TItem, TId extends ListSelectionId>(
  items: TItem[],
  getItemId: (item: TItem) => TId,
) {
  const [selectedIds, setSelectedIds] = useState<TId[]>([])

  const visibleIds = useMemo(() => items.map(getItemId), [getItemId, items])
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds])

  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => visibleIdSet.has(id)),
    [selectedIds, visibleIdSet],
  )
  const selectedIdSet = useMemo(() => new Set(selectedVisibleIds), [selectedVisibleIds])
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIdSet.has(getItemId(item))),
    [getItemId, items, selectedIdSet],
  )
  const selectedVisibleCount = selectedVisibleIds.length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  const setItemSelected = useCallback((id: TId, selected: boolean) => {
    setSelectedIds((current) => {
      const hasId = current.includes(id)

      if (selected) {
        return hasId ? current : [...current, id]
      }

      return current.filter((currentId) => currentId !== id)
    })
  }, [])

  const toggleItemSelection = useCallback((id: TId) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    )
  }, [])

  const setVisibleSelected = useCallback(
    (selected: boolean) => {
      setSelectedIds((current) => {
        if (!selected) {
          return current.filter((id) => !visibleIdSet.has(id))
        }

        const next = new Set(current)
        visibleIds.forEach((id) => next.add(id))
        return Array.from(next)
      })
    },
    [visibleIdSet, visibleIds],
  )

  return {
    allVisibleSelected,
    clearSelection,
    isSelected: (id: TId) => selectedIdSet.has(id),
    selectedCount: selectedVisibleIds.length,
    selectedIds: selectedVisibleIds,
    selectedIdSet,
    selectedItems,
    selectedVisibleCount,
    setItemSelected,
    setVisibleSelected,
    someVisibleSelected,
    toggleItemSelection,
    visibleCount: visibleIds.length,
    visibleIds,
  }
}
