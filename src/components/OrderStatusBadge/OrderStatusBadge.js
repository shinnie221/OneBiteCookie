import styles from './OrderStatusBadge.module.css';

const STATUS_MAP = {
  pending_verification: { label: 'Pending Verification', zh: '待核验', variant: 'warning' },
  accepted: { label: 'Accepted', zh: '已接单', variant: 'info' },
  preparing: { label: 'Preparing', zh: '制作中', variant: 'info' },
  ready_pickup: { label: 'Ready for Pickup', zh: '待自取', variant: 'success' },
  out_delivery: { label: 'Out for Delivery', zh: '配送中', variant: 'success' },
  completed: { label: 'Completed', zh: '已完成', variant: 'success' },
  rejected: { label: 'Rejected', zh: '已拒绝', variant: 'error' },
  cancelled: { label: 'Cancelled', zh: '已取消', variant: 'error' },
  refunded: { label: 'Refunded', zh: '已退款', variant: 'neutral' },
};

export default function OrderStatusBadge({ status, lang = 'en' }) {
  const config = STATUS_MAP[status] || { label: status, zh: status, variant: 'default' };
  const displayText = lang === 'zh' ? (config.zh || config.label) : config.label;
  
  return (
    <span className={`${styles.badge} ${styles[config.variant]}`}>
      {displayText}
    </span>
  );
}

