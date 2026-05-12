export const diffRecord = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const added: string[] = [],
    removed: string[] = [],
    same: string[] = [];
  const before = Object.keys(a);
  const after = Object.keys(b);
  const aKeys = new Set(before);
  const bKeys = new Set(after);
  for (const key of before) {
    (bKeys.has(key) ? same : removed).push(key);
  }
  for (const key of after) {
    if (!aKeys.has(key)) {
      added.push(key);
    }
  }
  return { added, removed, same };
};

export const diffArrays = <T>(a: T[] | undefined = [], b: T[] | undefined = [], computeKey: (v: T) => string) => {
  const added: T[] = [],
    removed: T[] = [],
    same: T[] = [];
  const before = a.map(computeKey);
  const after = b.map(computeKey);
  const aKeys = new Set(before);
  const bKeys = new Set(after);
  for (let i = 0, l = a.length; i < l; i++) {
    const key = before[i];
    (bKeys.has(key) ? same : removed).push(a[i]);
  }
  for (let i = 0, l = b.length; i < l; i++) {
    const key = after[i];
    if (!aKeys.has(key)) {
      added.push(b[i]);
    }
  }
  return { added, removed, same };
};
