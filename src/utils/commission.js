/** Lấy % hoa hồng từ tên danh mục, VD: "Mỹ Phẩm 10%" → 10 */
export function parseCategoryCommissionPercent(categoryName) {
  const match = String(categoryName || '').match(/(\d+)\s*%/);
  return match ? Number(match[1]) : 0;
}

export function calcCommissionAmount(principal, percent) {
  const p = Number(principal) || 0;
  const r = Number(percent) || 0;
  return Math.floor((p * r) / 100);
}
