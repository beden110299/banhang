export const DEFAULT_STORE_NAME = 'Miinto';

export function getStorePrefix(storeName) {
  const slug = String(storeName || DEFAULT_STORE_NAME).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return (slug || 'SHOP').slice(0, 8);
}
