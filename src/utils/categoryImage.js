const DEFAULT_CATEGORY_IMAGE =
  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=120&auto=format&fit=crop&q=80';

export const isCategoryImageUrl = (icon) =>
  Boolean(icon && (icon.startsWith('http') || icon.startsWith('data:') || icon.startsWith('/')));

export function getCategoryFallbackImage(categoryName) {
  const lowerCat = String(categoryName || '').toLowerCase();
  if (lowerCat === 'tất cả') {
    return 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=80';
  }
  if (lowerCat.includes('mỹ phẩm') || lowerCat.includes('son') || lowerCat.includes('serum')) {
    return 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=120&auto=format&fit=crop&q=80';
  }
  if (lowerCat.includes('điện tử')) {
    return 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=120&auto=format&fit=crop&q=80';
  }
  if (lowerCat.includes('điện lạnh')) {
    return 'https://images.unsplash.com/photo-1571175432247-508b9818816f?w=120&auto=format&fit=crop&q=80';
  }
  if (lowerCat.includes('vip')) {
    return 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=120&auto=format&fit=crop&q=80';
  }
  if (lowerCat.includes('đặc biệt')) {
    return 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=120&auto=format&fit=crop&q=80';
  }
  return DEFAULT_CATEGORY_IMAGE;
}

export function resolveCategoryImage(categoryName, iconFromDb) {
  if (isCategoryImageUrl(iconFromDb)) return iconFromDb;
  return getCategoryFallbackImage(categoryName);
}
