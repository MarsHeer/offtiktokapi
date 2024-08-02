type AnyObject = { [key: string]: any };

export const findObjectWithKey = (
  obj: AnyObject,
  key: string
): AnyObject | null => {
  if (obj.hasOwnProperty(key)) {
    return obj[key];
  }

  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      const result = findObjectWithKey(obj[k], key);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
};
