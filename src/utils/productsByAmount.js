/** Sắp sản phẩm theo độ gần với số tiền admin nhập */
export function getProductsNearPrice(products, amount, limit = 8) {
  const target = Math.floor(Number(String(amount).replace(/\D/g, '')) || 0);
  if (!target || !Array.isArray(products)) return [];
  return [...products]
    .map((p) => ({
      ...p,
      priceDiff: Math.abs(Number(p.price) - target),
    }))
    .sort((a, b) => a.priceDiff - b.priceDiff)
    .slice(0, limit);
}
