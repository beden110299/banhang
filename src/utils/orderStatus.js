export const ORDER_STATUS_OPTIONS = [
  { value: 'offered', label: 'Chờ khách mua (đẩy đơn)' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'shipping', label: 'Đang giao hàng' },
  { value: 'completed', label: 'Thành công (đã duyệt)' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export function getOrderStatusLabel(status) {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

export function getOrderStatusBadgeClass(status) {
  switch (status) {
    case 'completed':
      return 'user';
    case 'rejected':
    case 'cancelled':
      return 'delete';
    case 'offered':
      return 'admin';
    case 'shipping':
      return 'admin';
    case 'processing':
      return 'admin';
    default:
      return 'user';
  }
}
