import styles from './OrderStatusBadge.module.css';

const STATUS_MAP = {
  pending_verification: { label: 'Pending Verification', variant: 'warning' },
  accepted: { label: 'Accepted', variant: 'info' },
  preparing: { label: 'Preparing', variant: 'info' },
  ready_pickup: { label: 'Ready for Pickup', variant: 'success' },
  out_delivery: { label: 'Out for Delivery', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

export default function OrderStatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, variant: 'default' };
  
  return (
    <span className={`${styles.badge} ${styles[config.variant]}`}>
      {config.label}
    </span>
  );
}
