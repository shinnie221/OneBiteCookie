import Link from 'next/link';
import styles from '@/components/BusinessChannel/BusinessChannel.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>系统设置</h1>
          <p>店铺基础业务配置与运营管理工具。</p>
        </div>
      </header>
      <section className={styles.panel}>
        <h2>店铺与运营配置</h2>
        <div className={styles.history}>
          <Link className={styles.historyRow} href="/staff/qr-payment">
            <div>
              <strong>店铺信息与收款设置</strong>
              <p>收款二维码、联系方式及配送选项配置</p>
            </div>
            <span>前往 →</span>
          </Link>
          <Link className={styles.historyRow} href="/staff/vouchers">
            <div>
              <strong>优惠券与促销代码</strong>
              <p>为官网预购创建与管理折扣优惠码</p>
            </div>
            <span>前往 →</span>
          </Link>
          <Link className={styles.historyRow} href="/staff/customers">
            <div>
              <strong>官网注册会员名录</strong>
              <p>查看与检索已注册顾客联系信息</p>
            </div>
            <span>前往 →</span>
          </Link>
          <Link className={styles.historyRow} href="/staff/orders?manual=1">
            <div>
              <strong>手动录入订单</strong>
              <p>查看与处理店内、电话等手工录入的订单记录</p>
            </div>
            <span>前往 →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
