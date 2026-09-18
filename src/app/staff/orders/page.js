'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function OrdersPage() {
  return <Suspense fallback={<LoadingSpinner />}><OrdersContent /></Suspense>;
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const linkedOrderId = searchParams.get('order');
  const isManualOrder = searchParams.get('manual') === '1' || searchParams.get('legacy') === '1';
  const { authFetch } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fullScreenshotUrl, setFullScreenshotUrl] = useState(null);

  // States for prompt forms
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  const [showSpecialActionForm, setShowSpecialActionForm] = useState(null); // 'cancel' | 'refund' | null
  const [specialActionNote, setSpecialActionNote] = useState('');

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const fetchOrders = useCallback(async () => {
    try {
      let url = filter === 'all' ? '/api/orders' : `/api/orders?status=${filter}`;

      const from = appliedDates.from;
      const to = appliedDates.to;
      if (from) url += `${url.includes('?') ? '&' : '?'}dateFrom=${from}`;
      if (to) url += `${url.includes('?') ? '&' : '?'}dateTo=${to}`;

      const res = await authFetch(url);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders.filter(order => isManualOrder ? order.is_manual_order : !order.is_manual_order));
      }
    } catch (error) {
      toast.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [filter, appliedDates, authFetch, toast, isManualOrder]);

  // Load external API data; state updates occur after the request completes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDateFilter = () => {
    setLoading(true);
    setAppliedDates({ from: dateFrom, to: dateTo });
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setLoading(true);
    setAppliedDates({ from: '', to: '' });
  };

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    setShowDenyForm(false);
    setDenyReason('');
    setShowSpecialActionForm(null);
    setSpecialActionNote('');
    setIsEditing(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!linkedOrderId) return;
    let cancelled = false;
    const loadLinkedOrder = async () => {
      try {
        const res = await authFetch(`/api/orders/${encodeURIComponent(linkedOrderId)}`);
        const data = await res.json();
        if (!res.ok || !data.order) throw new Error('Order unavailable');
        if (!cancelled) openOrderModal(data.order);
      } catch {
        if (!cancelled) toast.error('无法打开此订单，请在订单列表中查找。');
      }
    };
    loadLinkedOrder();
    return () => { cancelled = true; };
  }, [linkedOrderId, authFetch, toast]);

  const updateOrderStatus = async (orderId, updates) => {
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '订单状态已成功更新');
        setSelectedOrder(data.order);

        // Update order in list
        setOrders(prev => prev.map(o => o.order_id === orderId ? data.order : o));

        // Reset local form states
        setShowDenyForm(false);
        setDenyReason('');
        setShowSpecialActionForm(null);
        setSpecialActionNote('');
      } else {
        toast.error(data.error || '更新订单失败');
      }
    } catch (error) {
      toast.error('更新订单时出错');
    } finally {
      setActionLoading(false);
    }
  };

  // Flow Step 1: Accept -> Automatically start preparing
  const handleAcceptOrder = () => {
    updateOrderStatus(selectedOrder.order_id, {
      payment_status: 'verified',
      order_status: 'preparing'
    });
  };

  // Flow Step 1 alternative: Deny / Reject with comment
  const handleConfirmDeny = () => {
    if (!denyReason.trim()) {
      toast.error('请输入拒绝订单的原因');
      return;
    }
    updateOrderStatus(selectedOrder.order_id, {
      payment_status: 'rejected',
      order_status: 'rejected',
      reject_reason: denyReason.trim()
    });
  };

  // Flow Step 2: Done preparing -> delivering / ready for pickup
  const handleDonePreparing = () => {
    const nextStatus = selectedOrder.order_type === 'delivery' ? 'out_delivery' : 'ready_pickup';
    updateOrderStatus(selectedOrder.order_id, {
      order_status: nextStatus
    });
  };

  // Flow Step 3: Delivered or Picked Up -> Completed
  const handleMarkCompleted = () => {
    updateOrderStatus(selectedOrder.order_id, {
      order_status: 'completed',
      completed_at: new Date().toISOString()
    });
  };

  // Flow Step 4: Cancel or Refund (Customer requested manually)
  const handleConfirmSpecialAction = () => {
    if (showSpecialActionForm === 'cancel') {
      updateOrderStatus(selectedOrder.order_id, {
        order_status: 'cancelled',
        staff_note: specialActionNote.trim() || '应顾客要求取消订单'
      });
    } else if (showSpecialActionForm === 'refund') {
      updateOrderStatus(selectedOrder.order_id, {
        order_status: 'refunded',
        payment_status: 'refunded',
        staff_note: specialActionNote.trim() || '应顾客要求退款处理'
      });
    }
  };

  // Edit handlers
  const startEditing = () => {
    setEditData({
      customer_name: selectedOrder.customer_name || '',
      phone: selectedOrder.phone || '',
      email: selectedOrder.email || '',
      order_type: selectedOrder.order_type || 'pickup',
      address: selectedOrder.address || '',
      staff_note: selectedOrder.staff_note || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const saveEditing = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/orders/${selectedOrder.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('订单信息更新成功');
        setSelectedOrder(data.order);
        setOrders(prev => prev.map(o => o.order_id === selectedOrder.order_id ? data.order : o));
        setIsEditing(false);
      } else {
        toast.error(data.error || '更新订单失败');
      }
    } catch {
      toast.error('更新订单时出错');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isManualOrder ? '手动录入订单' : '线上预购订单管理'}</h1>
          <p className={styles.subtitle}>{isManualOrder ? '查看与处理店内现场、电话预订等手工录入的订单记录。' : '官网线上订单：审核付款凭证、制作曲奇、安排顾客自取或送货上门。'}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.filters}>
            <select
              aria-label="订单状态筛选"
              value={filter}
              onChange={(e) => { setLoading(true); setFilter(e.target.value); }}
              className={styles.filterSelect}
            >
              <option value="all">全部订单</option>
              <option value="pending_verification">⏳ 待核验付款</option>
              <option value="preparing">🧑‍🍳 烘焙制作中</option>
              <option value="ready_or_delivery">🛍️ 待自取 / 🚚 配送中</option>
              <option value="completed">✅ 已完成订单</option>
              <option value="denied_cancelled_refunded">❌ 已拒绝 / 已取消 / 已退款</option>
            </select>
            <button onClick={() => { setLoading(true); fetchOrders(); }} className="btn btnSecondary">↻ 刷新</button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <details className={styles.dateFilters}>
        <summary>按日期筛选{(dateFrom || dateTo) ? " · 已选日期" : ""}</summary>
        <div className={styles.dateFilterBar}>
          <div className={styles.dateFilterGroup}>
            <label htmlFor="order-date-from">从:</label>
            <input id="order-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className={styles.dateFilterGroup}>
            <label htmlFor="order-date-to">至:</label>
            <input id="order-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btnPrimary" onClick={handleDateFilter} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            筛选
          </button>
          {(dateFrom || dateTo) && (
            <button className="btn btnSecondary" onClick={clearDateFilter} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              重置日期
            </button>
          )}
        </div>

      </details>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>订单编号</th>
                  <th>下单时间</th>
                  <th>完成时间</th>
                  <th>顾客信息</th>
                  <th>配送方式</th>
                  <th>总金额</th>
                  <th>订单状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="textCenter" style={{ padding: '30px', color: 'var(--color-text-light)' }}>
                      暂无符合条件的订单记录
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className={order.order_status === 'pending_verification' ? styles.highlightRow : ''}>
                      <td className={styles.orderIdCell}>
                        <div>{order.order_id}</div>
                        {order.is_manual_order && (
                          <span className={styles.manualTag}>堂食 / 手工录入</span>
                        )}
                      </td>
                      <td>
                        {order.created_at ? (
                          <>
                            <div>{new Date(order.created_at).toLocaleDateString()}</div>
                            <small style={{ color: 'var(--color-text-light)' }}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                          </>
                        ) : '—'}
                      </td>
                      <td>
                        {order.order_status === 'completed' ? (
                          (order.completed_at || order.updated_at) ? (
                            <>
                              <div>{new Date(order.completed_at || order.updated_at).toLocaleDateString()}</div>
                              <small style={{ color: '#16a34a', fontWeight: 600 }}>{new Date(order.completed_at || order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>已完成</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--color-text-light)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.customerName}>{order.customer_name}</div>
                        <div className={styles.customerPhone}>{order.phone}</div>
                      </td>
                      <td>
                        <span className={order.order_type === 'delivery' ? styles.deliveryBadge : styles.pickupBadge}>
                          {order.order_type === 'delivery' ? '🚚 送货上门' : '🛍️ 到店自取'}
                        </span>
                      </td>
                      <td className={styles.totalCell}>RM{order.total.toFixed(2)}</td>
                      <td><OrderStatusBadge status={order.order_status} /></td>
                      <td>
                        <button
                          className="btn btnSecondary"
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => openOrderModal(order)}
                        >
                          查看与处理
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail & Processing Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`订单详情 - #${selectedOrder?.order_id}`}
      >
        {selectedOrder && (
          <div className={styles.modalContent}>

            {/* 1. Customer Info + Payment Proof (TOP) */}
            <div className={styles.grid2}>
              {/* Customer Info */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>
                  顾客基本信息
                  {!isEditing && (
                    <button className={styles.editBtn} onClick={startEditing}>✏️ 编辑</button>
                  )}
                </div>
                {isEditing ? (
                  <div className={styles.editForm}>
                    <div className={styles.editField}>
                      <label>姓名</label>
                      <input type="text" value={editData.customer_name} onChange={e => setEditData({ ...editData, customer_name: e.target.value })} />
                    </div>
                    <div className={styles.editField}>
                      <label>联系电话</label>
                      <input type="tel" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                    </div>
                    <div className={styles.editField}>
                      <label>电子邮箱</label>
                      <input type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                    </div>
                    <div className={styles.editField}>
                      <label>配送方式</label>
                      <select value={editData.order_type} onChange={e => setEditData({ ...editData, order_type: e.target.value })}>
                        <option value="pickup">到店自取</option>
                        <option value="delivery">送货上门</option>
                      </select>
                    </div>
                    {editData.order_type === 'delivery' && (
                      <div className={styles.editField}>
                        <label>送货地址</label>
                        <textarea rows="2" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                      </div>
                    )}
                    <div className={styles.editField}>
                      <label>员工内部备注</label>
                      <textarea rows="2" value={editData.staff_note} onChange={e => setEditData({ ...editData, staff_note: e.target.value })} />
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.btnSaveEdit} onClick={saveEditing} disabled={actionLoading}>
                        {actionLoading ? '保存中...' : '保存修改'}
                      </button>
                      <button className="btn btnSecondary" onClick={cancelEditing} disabled={actionLoading}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p><strong>姓名:</strong> {selectedOrder.customer_name}</p>
                    <p><strong>电话:</strong> {selectedOrder.phone}</p>
                    {selectedOrder.email && <p><strong>邮箱:</strong> {selectedOrder.email}</p>}
                    <p><strong>下单时间:</strong> {selectedOrder.created_at ? `${new Date(selectedOrder.created_at).toLocaleDateString()} ${new Date(selectedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</p>
                    {selectedOrder.order_status === 'completed' && (
                      <p><strong>完成时间:</strong> <span style={{ color: '#16a34a', fontWeight: 600 }}>{(selectedOrder.completed_at || selectedOrder.updated_at) ? `${new Date(selectedOrder.completed_at || selectedOrder.updated_at).toLocaleDateString()} ${new Date(selectedOrder.completed_at || selectedOrder.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '已完成'}</span></p>
                    )}
                    <p><strong>履约方式:</strong> {selectedOrder.order_type === 'delivery' ? '送货上门' : '到店自取'}</p>
                    {selectedOrder.order_type === 'delivery' && (
                      <p><strong>送货地址:</strong> {selectedOrder.address}</p>
                    )}
                  </>
                )}
              </div>

              {/* Payment Proof */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>付款凭证截图</div>
                {selectedOrder.payment_screenshot ? (
                  <div className={styles.screenshotBox}>
                    <img
                      src={selectedOrder.payment_screenshot}
                      alt="付款凭证"
                      className={styles.screenshot}
                      style={{ cursor: 'zoom-in' }}
                      onClick={() => setFullScreenshotUrl(selectedOrder.payment_screenshot)}
                      title="点击放大查看大图"
                    />
                    <div className={styles.screenshotHint}>点击图片可全屏放大查看</div>
                  </div>
                ) : (
                  <p className={styles.noData}>未上传付款凭证截图。</p>
                )}
              </div>
            </div>

            {/* 2. Payment Summary (Items -> Subtotal -> Discount -> Total) */}
            <div className={styles.infoBlock}>
              <div className={styles.sectionHeader}>费用结算明细</div>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>商品口味</th>
                    <th className="textRight">数量</th>
                    <th className="textRight">小计</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{item.product_name}</td>
                      <td className="textRight">{item.quantity}</td>
                      <td className="textRight">RM{item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.paymentSummaryTotals}>
                <div className={styles.summaryRow}>
                  <span>商品小计</span>
                  <span>RM{selectedOrder.subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className={`${styles.summaryRow} ${styles.textSuccess}`}>
                    <span>折扣扣减 ({selectedOrder.voucher_code || '优惠券'})</span>
                    <span>-RM{selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>实付总额</span>
                  <span>RM{selectedOrder.total.toFixed(2)}</span>
                </div>
                <div className={styles.paymentStatusLine}>
                  <strong>付款状态:</strong> {selectedOrder.payment_status === 'verified' ? '已核验' : selectedOrder.payment_status === 'rejected' ? '已拒绝' : selectedOrder.payment_status === 'refunded' ? '已退款' : '待核验'}
                </div>
              </div>
            </div>

            {/* 3. Current Order Status + Actions (BOTTOM) */}
            <div className={styles.flowSection}>
              <div className={styles.flowHeader}>
                <div>
                  <span className={styles.flowHeaderSubtitle}>当前订单流转状态</span>
                  <div className={styles.currentStatusRow}>
                    <OrderStatusBadge status={selectedOrder.order_status} />
                    <span className={styles.orderTypeTag}>
                      {selectedOrder.order_type === 'delivery' ? '🚚 送货上门' : '🛍️ 到店自取'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION STAGE 1: Pending Verification */}
              {selectedOrder.order_status === 'pending_verification' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>待办提醒：</strong> 请核对上方顾客上传的付款截图凭证。核验无误后点击接单即可开始烘焙制作，或附上原因拒绝此单。
                  </div>

                  {!showDenyForm ? (
                    <div className={styles.actionButtonGroup}>
                      <button
                        className={styles.btnAccept}
                        onClick={handleAcceptOrder}
                        disabled={actionLoading}
                      >
                        ✓ 确认收款并开始制作
                      </button>
                      <button
                        className={styles.btnDeny}
                        onClick={() => setShowDenyForm(true)}
                        disabled={actionLoading}
                      >
                        ✕ 拒绝此订单
                      </button>
                    </div>
                  ) : (
                    <div className={styles.denyBox}>
                      <label className={styles.denyLabel}>
                        拒绝原因 <span className={styles.requiredStar}>*</span>（顾客将看到此说明）：
                      </label>
                      <textarea
                        className={styles.denyTextarea}
                        rows="3"
                        placeholder="例如：付款截图不清晰/金额不符，请重新上传或通过 WhatsApp 联系我们..."
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        disabled={actionLoading}
                      />
                      <div className={styles.denyActions}>
                        <button
                          className={styles.btnConfirmDeny}
                          onClick={handleConfirmDeny}
                          disabled={actionLoading || !denyReason.trim()}
                        >
                          确认拒绝并通知顾客
                        </button>
                        <button
                          className="btn btnSecondary"
                          onClick={() => { setShowDenyForm(false); setDenyReason(''); }}
                          disabled={actionLoading}
                        >
                          返回
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION STAGE 2: Preparing */}
              {(selectedOrder.order_status === 'preparing' || selectedOrder.order_status === 'accepted') && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>烘焙制作中：</strong> 厨房正在新鲜烘焙与打包曲奇。制作完成后，请点击下方按钮更新状态。
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button
                      className={styles.btnPreparingDone}
                      onClick={handleDonePreparing}
                      disabled={actionLoading}
                    >
                      {selectedOrder.order_type === 'delivery'
                        ? '🚚 制作完成 → 标记为配送中'
                        : '🛍️ 制作完成 → 标记为待自取'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION STAGE 3: Out for Delivery or Ready for Pickup */}
              {selectedOrder.order_status === 'out_delivery' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>配送中：</strong> 曲奇正在配送至顾客指定地址。送达交付后，请标记为已完成。
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button
                      className={styles.btnComplete}
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                    >
                      ✅ 已送达 → 标记为已完成
                    </button>
                  </div>
                </div>
              )}

              {selectedOrder.order_status === 'ready_pickup' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>待自取：</strong> 曲奇已打包完毕，正等待顾客来店提取。顾客取货后，请标记为已完成。
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button
                      className={styles.btnComplete}
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                    >
                      ✅ 顾客已取货 → 标记为已完成
                    </button>
                  </div>
                </div>
              )}

              {/* COMPLETED BANNER */}
              {selectedOrder.order_status === 'completed' && (
                <div className={styles.completedNotice}>
                  <div>🎉 本订单已全部履约完成。</div>
                  {(selectedOrder.completed_at || selectedOrder.updated_at) && (
                    <div style={{ marginTop: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#047857' }}>
                      完成时间：{new Date(selectedOrder.completed_at || selectedOrder.updated_at).toLocaleDateString()} {new Date(selectedOrder.completed_at || selectedOrder.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}

              {/* REJECTED BANNER & COMMENT */}
              {selectedOrder.order_status === 'rejected' && (
                <div className={styles.rejectedNotice}>
                  <div className={styles.rejectedTitle}>✕ 订单已被拒绝</div>
                  {selectedOrder.reject_reason ? (
                    <div className={styles.reasonText}>
                      <strong>已通知顾客原因：</strong> &quot;{selectedOrder.reject_reason}&quot;
                    </div>
                  ) : (
                    <p className={styles.noData}>未记录具体拒绝原因说明。</p>
                  )}
                </div>
              )}

              {/* CANCELLED BANNER & NOTE */}
              {selectedOrder.order_status === 'cancelled' && (
                <div className={styles.cancelledNotice}>
                  <div className={styles.cancelledTitle}>🚫 订单已取消</div>
                  {selectedOrder.staff_note && (
                    <div className={styles.reasonText}>
                      <strong>员工备注：</strong> &quot;{selectedOrder.staff_note}&quot;
                    </div>
                  )}
                </div>
              )}

              {/* REFUNDED BANNER & NOTE */}
              {selectedOrder.order_status === 'refunded' && (
                <div className={styles.refundedNotice}>
                  <div className={styles.refundedTitle}>💳 订单已退款</div>
                  {selectedOrder.staff_note && (
                    <div className={styles.reasonText}>
                      <strong>员工备注：</strong> &quot;{selectedOrder.staff_note}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Cancellation / Refund Actions */}
            {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'rejected' && selectedOrder.order_status !== 'refunded' && (
              <div className={styles.specialActionsSection}>
                <div className={styles.specialActionsHeader}>
                  <span>顾客手动申请处理（取消与退款）</span>
                  <small>如顾客通过 WhatsApp/电话联系提出取消或退款诉求</small>
                </div>

                {!showSpecialActionForm ? (
                  <div className={styles.specialButtonsRow}>
                    <button
                      className={styles.btnSecondaryCancel}
                      onClick={() => { setShowSpecialActionForm('cancel'); setSpecialActionNote(''); }}
                      disabled={actionLoading}
                    >
                      标记为已取消
                    </button>
                    <button
                      className={styles.btnSecondaryRefund}
                      onClick={() => { setShowSpecialActionForm('refund'); setSpecialActionNote(''); }}
                      disabled={actionLoading}
                    >
                      标记为已退款
                    </button>
                  </div>
                ) : (
                  <div className={styles.specialActionForm}>
                    <p className={styles.specialActionTitle}>
                      {showSpecialActionForm === 'cancel' ? '确认取消订单' : '确认订单退款'}
                    </p>
                    <input
                      type="text"
                      className={styles.specialActionInput}
                      placeholder={showSpecialActionForm === 'cancel' ? "输入取消原因或顾客沟通备注..." : "输入退款凭证编号或详细说明..."}
                      value={specialActionNote}
                      onChange={(e) => setSpecialActionNote(e.target.value)}
                      disabled={actionLoading}
                    />
                    <div className={styles.denyActions}>
                      <button
                        className={showSpecialActionForm === 'cancel' ? styles.btnConfirmDeny : styles.btnConfirmRefund}
                        onClick={handleConfirmSpecialAction}
                        disabled={actionLoading}
                      >
                        {showSpecialActionForm === 'cancel' ? '确认取消此单' : '确认完成退款'}
                      </button>
                      <button
                        className="btn btnSecondary"
                        onClick={() => setShowSpecialActionForm(null)}
                        disabled={actionLoading}
                      >
                        返回
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </Modal>

      {/* Full Size Screenshot Lightbox */}
      {fullScreenshotUrl && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, cursor: 'zoom-out' }}
          onClick={() => setFullScreenshotUrl(null)}
        >
          <img src={fullScreenshotUrl} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} alt="付款凭证大图" />
        </div>
      )}


    </div>
  );
}
