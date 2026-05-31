import type { SortMode, Todo } from '@/types/todo'

function compareTodoOrder(
  left: Todo,
  right: Todo,
  sortOrder: 'asc' | 'desc',
): number {
  const leftHasManualOrder = typeof left.sortIndex === 'number'
  const rightHasManualOrder = typeof right.sortIndex === 'number'

  if (leftHasManualOrder && rightHasManualOrder && left.sortIndex !== right.sortIndex) {
    return (left.sortIndex ?? 0) - (right.sortIndex ?? 0)
  }

  if (leftHasManualOrder !== rightHasManualOrder) {
    return leftHasManualOrder ? 1 : -1
  }

  if (sortOrder === 'asc') {
    return left.createdAt - right.createdAt
  }

  return right.createdAt - left.createdAt
}

export function sortTodos(todos: Todo[], sortMode: SortMode, sortOrder: 'asc' | 'desc'): Todo[] {
  return [...todos].sort((a, b) => {
    const starredDelta = Number(Boolean(b.starred)) - Number(Boolean(a.starred))
    if (starredDelta !== 0) {
      return starredDelta
    }

    switch (sortMode) {
      case 'manual':
        return compareTodoOrder(a, b, sortOrder)
      case 'oldest':
        return a.createdAt - b.createdAt
      case 'title':
        return a.title.localeCompare(b.title, 'fr-FR', { sensitivity: 'base' })
      case 'dueDate': {
        const leftDue = a.reminderAt
        const rightDue = b.reminderAt
        if (typeof leftDue === 'number' && typeof rightDue === 'number') {
          if (leftDue !== rightDue) {
            return leftDue - rightDue
          }
          return b.createdAt - a.createdAt
        }
        if (typeof leftDue === 'number') {
          return -1
        }
        if (typeof rightDue === 'number') {
          return 1
        }
        return b.createdAt - a.createdAt
      }
      case 'recent':
      default:
        return b.createdAt - a.createdAt
    }
  })
}
