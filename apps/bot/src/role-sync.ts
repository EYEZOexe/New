export function diffRoles(opts: { desired: string[]; current: string[] }): { toAdd: string[]; toRemove: string[] } {
  const desired = new Set(opts.desired);
  const current = new Set(opts.current);

  const toAdd: string[] = [];
  const toRemove: string[] = [];

  for (const r of desired) {
    if (!current.has(r)) toAdd.push(r);
  }
  for (const r of current) {
    if (!desired.has(r)) toRemove.push(r);
  }

  return { toAdd, toRemove };
}

