export const getReverseMap = <T extends string | number, U extends string | number>(entry: Record<T, U | U[]>) => {
  const reverseMap: Record<U, T[]> = Object.create(null);
  for (const [key, values] of Object.entries(entry) as [T, U | U[]][]) {
    for (const value of Array.isArray(values) ? values : [values]) {
      let array = reverseMap[value];
      if (!array) {
        array = [];
        reverseMap[value] = array;
      }
      array.push(key);
    }
  }
  return reverseMap;
};
