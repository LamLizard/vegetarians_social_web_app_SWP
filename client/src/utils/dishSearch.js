export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterAdminDishes(dishes, query) {
  const needle = normalizeText(query);
  if (!needle) return dishes;

  return dishes
    .map((dish, index) => {
      const name = normalizeText(dish.name);
      const categories = (dish.categories || []).map((category) => normalizeText(category.name));
      let rank = Number.POSITIVE_INFINITY;

      if (name === needle) rank = 0;
      else if (name.startsWith(needle)) rank = 1;
      else if (name.includes(needle)) rank = 2;
      else if (categories.some((category) => category.includes(needle))) rank = 3;

      return { dish, index, rank };
    })
    .filter((result) => Number.isFinite(result.rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ dish }) => dish);
}
