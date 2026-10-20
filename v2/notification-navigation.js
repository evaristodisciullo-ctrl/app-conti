export function resolveNotificationRoute(state, notification, currentMonth) {
  const extra = notification?.extra || {};
  const id = String(extra.itemId || '');
  if (extra.kind === 'finance') {
    const pending = (state.entries || []).find(item => String(item.id) === id);
    const completed = (state.history || []).find(item => String(item.id) === id);
    const item = pending || completed;
    const kind = item?.kind || extra.entryKind;
    if (kind !== 'income' && kind !== 'expense') return { screen: 'money', found: false };
    return {
      screen: kind,
      itemId: item ? id : null,
      month: item?.date?.slice(0, 7) || extra.month || currentMonth,
      found: Boolean(item),
      completed: Boolean(completed && !pending)
    };
  }
  if (extra.kind === 'todo') {
    const pending = (state.todo?.tasks || []).find(item => String(item.id) === id);
    const completed = (state.todo?.done || []).find(item => String(item.id) === id);
    const item = pending || completed;
    return {
      screen: completed && !pending ? 'todo-done' : 'todo-active',
      itemId: item ? id : null,
      found: Boolean(item),
      completed: Boolean(completed && !pending)
    };
  }
  return { screen: 'landing', found: false };
}
