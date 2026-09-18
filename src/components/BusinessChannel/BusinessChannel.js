'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { businessDate, money, normalizeBusinessRecord, normalizeBuyer } from '@/lib/business.mjs';
import styles from './BusinessChannel.module.css';

function formatDMY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

function getYesterday(baseDate = businessDate()) {
  const [y, m, d] = baseDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return businessDate(dt);
}

const blankItem = booth => ({ name: '', quantity: booth ? 0 : 1, unitPrice: '', ...(booth ? { prepared: '', waste: 0 } : {}) });
export default function BusinessChannel({ channel }) {
  const booth = channel === 'booth';
  const { authFetch } = useAuth();
  const [records, setRecords] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('records');
  const [filterMode, setFilterMode] = useState('month');
  const [filterDate, setFilterDate] = useState(businessDate());
  const [filterMonth, setFilterMonth] = useState(businessDate().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [buyerDraft, setBuyerDraft] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/business');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data.records);
      setBuyers(data.buyers);
      setError('');
    } catch (err) { setError(err.message || 'Unable to load records. Please retry.'); }
    finally { setLoading(false); }
  }, [authFetch]);
  // Fetch external records; state changes occur after the request settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    authFetch('/api/products').then(res => res.ok ? res.json() : null).then(data => {
      if (active && data?.products) setProducts(data.products);
    }).catch(() => { }); // Flavour names can still be entered if menu suggestions are unavailable.
    return () => { active = false; };
  }, [authFetch]);
  const visible = records.filter(r => {
    if (r.channel !== channel) return false;
    if (filterMode === 'date' && filterDate) {
      if (r.date !== filterDate) return false;
    } else if (filterMode === 'month' && filterMonth) {
      if (!r.date.startsWith(filterMonth)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDate = (r.date || '').includes(q) || formatDMY(r.date).includes(q);
      const matchFlavour = (r.items || []).some(it => (it.name || '').toLowerCase().includes(q));
      if (!matchTitle && !matchDate && !matchFlavour) return false;
    }
    return true;
  });
  const totals = visible.reduce((sum, r) => ({ sales: sum.sales + r.sales, expenses: sum.expenses + r.expenseTotal, outstanding: sum.outstanding + r.outstanding }), { sales: 0, expenses: 0, outstanding: 0 });
  const totalPiecesSold = visible.reduce((sum, r) => sum + r.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0), 0);
  const totalPiecesPrepared = booth ? visible.reduce((sum, r) => sum + r.items.reduce((s, it) => s + (Number(it.prepared) || 0), 0), 0) : 0;
  const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const updateItem = (index, key, value) => setDraft(prev => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const start = () => {
    setError(''); setNotice('');
    setDraft({
      id: crypto.randomUUID(),
      revision: 0,
      channel,
      date: businessDate(),
      title: '',
      buyerId: '',
      contact: '',
      items: [blankItem(booth)],
      expenses: [],
      discount: 0,
      received: 0,
      notes: '',
      ...(booth ? { status: 'preparing' } : {})
    });
  };
  const save = async (event, kind) => {
    event.preventDefault();
    setError(''); setNotice('');
    const source = kind === 'buyer' ? buyerDraft : draft;
    let clean;
    try { clean = kind === 'buyer' ? normalizeBuyer(source) : normalizeBusinessRecord(source); }
    catch (err) { setError(err.message); return; }
    setSaving(true);
    try {
      const res = await authFetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: source.id, revision: source.revision || 0, record: clean }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save record.');
      if (kind === 'buyer') {
        setBuyers(prev => [...prev.filter(b => b.id !== source.id), data.record].sort((a, b) => a.name.localeCompare(b.name)));
        setBuyerDraft(null);
      } else {
        setRecords(prev => [...prev.filter(r => r.id !== source.id), data.record].sort((a, b) => b.date.localeCompare(a.date)));
        setFilterDate(source.date);
        setFilterMonth(source.date.slice(0, 7));
        setDraft(null);
      }
      setNotice(
        kind === 'buyer'
          ? '批发商联系人已保存。'
          : source.status === 'preparing'
            ? '出摊准备记录已保存！摆摊结束后可点击“🏁 摆摊结束结单”录入售出数量。'
            : '业务记录已保存。'
      );
    } catch (err) { setError(err.message || '保存失败，请重试。'); }
    finally { setSaving(false); }
  };
  const closeForm = () => { setDraft(null); setBuyerDraft(null); setError(''); };
  let preview = null;
  if (draft) { try { preview = normalizeBusinessRecord(draft); } catch { } }
  const header = booth ? '摆摊销售' : '批发供货';
  const isBoothPreparing = booth && draft?.status === 'preparing';

  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>销售渠道</p><h1>{header}</h1><p>{booth ? '单次摆摊独立记账。支持出摊前录入准备数量，收摊后录入售出数量及现场费用。' : '集中管理您的合作批发商、采购订单与收款结算进度。'}</p></div>
      {!draft && !buyerDraft && <button className="btn btnPrimary" disabled={loading} onClick={tab === 'buyers' ? () => { setError(''); setBuyerDraft({ id: crypto.randomUUID(), revision: 0, name: '', contact: '', notes: '' }); } : start}>{tab === 'buyers' ? '+ 新增批发商' : booth ? '+ 新增摆摊记录' : '+ 新增批发订单'}</button>}
    </header>
    {error && !draft && !buyerDraft && <div className={styles.error} role="alert">{error}</div>}
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {!booth && !draft && !buyerDraft && <div className={styles.tabs} aria-label="批发视图切换"><button aria-pressed={tab === 'records'} onClick={() => setTab('records')}>订单记录</button><button aria-pressed={tab === 'buyers'} onClick={() => setTab('buyers')}>合作商联系录</button></div>}
    {buyerDraft && <form className={styles.panel} onSubmit={e => save(e, 'buyer')}><fieldset disabled={saving}><legend>{buyerDraft.revision ? '编辑批发商' : '新增批发商'}</legend>
      <div className={styles.fields}><label>店铺 / 批发商名称<input required maxLength={1000} value={buyerDraft.name} onChange={e => setBuyerDraft({ ...buyerDraft, name: e.target.value })} /></label><label>联系人、电话或邮箱<input required maxLength={1000} value={buyerDraft.contact} onChange={e => setBuyerDraft({ ...buyerDraft, contact: e.target.value })} /></label></div>
      <label>备注说明<textarea maxLength={1000} value={buyerDraft.notes} onChange={e => setBuyerDraft({ ...buyerDraft, notes: e.target.value })} /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button className="btn btnPrimary">{saving ? '保存中...' : '保存批发商'}</button><button type="button" className="btn btnSecondary" onClick={closeForm}>取消</button></div>
    </fieldset></form>}
    {draft && <form className={styles.panel} onSubmit={e => save(e, 'record')}><fieldset disabled={saving}><legend>{draft.revision ? '编辑' : '新增'}{booth ? '摆摊记录' : '批发订单'}</legend>
      {booth && (
        <div className={styles.stageToggle} role="tablist" aria-label="摆摊记录阶段">
          <button
            type="button"
            role="tab"
            aria-selected={draft.status === 'preparing'}
            className={`${styles.stageBtn} ${draft.status === 'preparing' ? styles.stageBtnActive : ''}`}
            onClick={() => update('status', 'preparing')}
          >
            📦 第一阶段：出摊前准备 (仅填写准备数量)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={draft.status !== 'preparing'}
            className={`${styles.stageBtn} ${draft.status !== 'preparing' ? styles.stageBtnActive : ''}`}
            onClick={() => update('status', 'completed')}
          >
            🏁 第二阶段：收摊结单 (填写售出数量与结算)
          </button>
        </div>
      )}
      {isBoothPreparing && (
        <div className={styles.stageNotice}>
          <span aria-hidden="true">💡</span>
          <div>
            <strong>第一阶段：出摊前准备</strong>
            <p style={{ margin: '4px 0 0' }}>请在下方添加今日准备售卖的曲奇口味、出摊准备总片数及单价。售出数量及现场开销将在摆摊结束后进行收摊结单时录入。</p>
          </div>
        </div>
      )}
      {!isBoothPreparing && booth && (
        <div className={styles.stageNotice} style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
          <span aria-hidden="true">🏁</span>
          <div>
            <strong>第二阶段：收摊结单</strong>
            <p style={{ margin: '4px 0 0' }}>摆摊已结束，请核对各口味并填写最终售出片数、试吃/损耗及现场支出。系统将自动计算当日总销售额与净营收。</p>
          </div>
        </div>
      )}
      <div className={styles.fields}><label>{booth ? '活动日期' : '订单日期'}<input required type="date" value={draft.date} onChange={e => update('date', e.target.value)} /></label>
        {booth ? <label>摆摊名称 / 地点<input required maxLength={1000} placeholder="例如：吉隆坡周末市集 / 商场展销" value={draft.title} onChange={e => update('title', e.target.value)} /></label> : <label htmlFor="wholesale-buyer">批发采购商<select id="wholesale-buyer" aria-label="批发采购商" required value={draft.buyerId} onChange={e => { const buyer = buyers.find(b => b.id === e.target.value); setDraft(prev => ({ ...prev, buyerId: buyer?.id || '', title: buyer?.name || '', contact: buyer?.contact || '' })); }}><option value="">请选择批发商</option>{buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}</div>
      {!booth && <><label>本单联系方式<input required maxLength={1000} value={draft.contact} onChange={e => update('contact', e.target.value)} /></label>{!buyers.length && <p className={styles.hint}>请先取消此单，并在“合作商联系录”中添加合作商。</p>}</>}
      <h2>各口味曲奇明细</h2>
      <p className={styles.hint}>
        {isBoothPreparing
          ? '第一阶段：只需输入出摊准备总片数与单价。售出数量与试吃损耗将在收摊结单时填写。'
          : booth
            ? '第二阶段：请确认准备片数，并输入最终售出片数与试吃/损耗。系统将自动计算结余库存。'
            : '输入每种口味协商一致的单价。价格将保存在本订单中。'}
      </p>
      <datalist id="cookie-flavours">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
      {isBoothPreparing ? (
        <div className={styles.itemList}>
          {draft.items.map((item, index) => (
            <div className={styles.item} key={index}>
              <label className={styles.flavour}>
                口味
                <input required list="cookie-flavours" maxLength={1000} placeholder="请选择或输入曲奇口味" value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} />
              </label>
              <label>
                准备出摊数量 (片)
                <input required type="number" min="0" max="1000000" step="1" placeholder="如：50" value={item.prepared} onChange={e => updateItem(index, 'prepared', e.target.value)} />
              </label>
              <label>
                售出单价 (RM / 片)
                <input required type="number" min="0" max="1000000" step="0.01" placeholder="如：5.00" value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', e.target.value)} />
              </label>
              <div className={styles.rowTotal}>
                <strong>预计货值 {money((Number(item.prepared) || 0) * (Number(item.unitPrice) || 0))}</strong>
                <small>准备 {Number(item.prepared) || 0} 片</small>
              </div>
              <button type="button" className={styles.remove} aria-label={`删除第 ${index + 1} 项口味`} disabled={draft.items.length === 1} onClick={() => update('items', draft.items.filter((_, i) => i !== index))}>删除</button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.itemList}>
          {draft.items.map((item, index) => (
            <div className={styles.item} key={index}>
              <label className={styles.flavour}>
                口味
                <input required list="cookie-flavours" maxLength={1000} value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} />
              </label>
              {booth && <label>准备数量 (片)<input required type="number" min="0" max="1000000" step="1" value={item.prepared} onChange={e => updateItem(index, 'prepared', e.target.value)} /></label>}
              <label>{booth ? '售出数量 (片)' : '订购数量 (片)'}<input required type="number" min={booth ? '0' : '1'} max="1000000" step="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} /></label>
              {booth && <label>试吃 / 损耗 (片)<input required type="number" min="0" max="1000000" step="1" value={item.waste} onChange={e => updateItem(index, 'waste', e.target.value)} /></label>}
              <label>单价 (RM / 片)<input required type="number" min="0" max="1000000" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', e.target.value)} /></label>
              <div className={styles.rowTotal}><strong>{money(Number(item.quantity) * Number(item.unitPrice))}</strong>{booth && <small>剩余 {Number(item.prepared || 0) - Number(item.quantity || 0) - Number(item.waste || 0)} 片</small>}</div>
              <button type="button" className={styles.remove} aria-label={`删除第 ${index + 1} 项口味`} disabled={draft.items.length === 1} onClick={() => update('items', draft.items.filter((_, i) => i !== index))}>删除</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btnSecondary" onClick={() => update('items', [...draft.items, blankItem(booth)])}>+ 添加曲奇口味</button>

      {!isBoothPreparing && (
        <>
          <h2>支出明细 (Expenses)</h2>
          <p className={styles.hint}>{booth ? '添加此摆摊日的相关费用（如摊位费、包装或运输）。若无请留空。' : '添加此订单的相关费用（如包装或物流运费）。若无请留空。'}</p>
          {draft.expenses.map((expense, index) => <div className={styles.expense} key={index}><label>支出项目说明<input required maxLength={1000} value={expense.description} onChange={e => update('expenses', draft.expenses.map((v, i) => i === index ? { ...v, description: e.target.value } : v))} /></label><label>金额 (RM)<input required type="number" min="0" max="1000000" step="0.01" value={expense.amount} onChange={e => update('expenses', draft.expenses.map((v, i) => i === index ? { ...v, amount: e.target.value } : v))} /></label><button className={styles.remove} type="button" aria-label={`删除第 ${index + 1} 项支出`} onClick={() => update('expenses', draft.expenses.filter((_, i) => i !== index))}>删除</button></div>)}
          <button type="button" className="btn btnSecondary" onClick={() => update('expenses', [...draft.expenses, { description: '', amount: '' }])}>+ 添加支出项目</button>
          <h2>结算与备注</h2>
          <div className={styles.fields}><label>优惠折扣扣减 (RM)<input required type="number" min="0" max="1000000" step="0.01" value={draft.discount} onChange={e => update('discount', e.target.value)} /><small>从曲奇总额中扣除优惠折扣或满减。</small></label>{!booth && <label>已收金额 (RM)<input required type="number" min="0" max="1000000" step="0.01" value={draft.received} onChange={e => update('received', e.target.value)} /><small>批发商付款后可随时更新此收款金额。</small></label>}</div>
        </>
      )}

      <label>{isBoothPreparing ? '出摊前备忘说明' : '备注说明'}<textarea maxLength={1000} placeholder={isBoothPreparing ? '选填：当日摆摊备忘、摊位分配、天气等' : booth ? '选填：当日活动备注、人流天气等' : '选填：订单参考号、特殊配送说明等'} value={draft.notes} onChange={e => update('notes', e.target.value)} /></label>

      {isBoothPreparing ? (
        <div className={styles.totals} aria-live="polite">
          <span>准备总片数 <strong>{draft.items.reduce((s, it) => s + (Number(it.prepared) || 0), 0)} 片</strong></span>
          <span>口味种类 <strong>{draft.items.filter(i => i.name && i.name.trim()).length} 种</strong></span>
          <span>预计总货值 <strong>{money(draft.items.reduce((s, it) => s + ((Number(it.prepared) || 0) * (Number(it.unitPrice) || 0)), 0))}</strong></span>
        </div>
      ) : preview ? (
        <div className={styles.totals} aria-live="polite"><span>总销售额 <strong>{money(preview.sales)}</strong></span><span>已记支出 <strong>{money(preview.expenseTotal)}</strong></span><span>{booth ? '营收净额 (扣除支出)' : '待结清尾款'}<strong>{money(booth ? preview.sales - preview.expenseTotal : preview.outstanding)}</strong></span></div>
      ) : <p className={styles.hint}>填写必要信息后将自动计算最终统计。</p>}

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className="btn btnPrimary">
          {saving ? '保存中...' : isBoothPreparing ? '💾 保存出摊准备 (开始摆摊)' : booth ? '✅ 完成收摊并保存结单' : '保存订单'}
        </button>
        <button type="button" className="btn btnSecondary" onClick={closeForm}>取消</button>
      </div>
    </fieldset></form>}
    {!draft && !buyerDraft && <>
      {tab === 'records' && <>
        <div className={styles.controlPanel}>
          <div className={styles.toolbarTopRow}>
            <div className={styles.dateModeGroup} role="tablist" aria-label="日期筛选方式">
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'date'}
                className={`${styles.modeTab} ${filterMode === 'date' ? styles.modeTabActive : ''}`}
                onClick={() => setFilterMode('date')}
              >
                📅 按具体日期 (DD/MM/YYYY)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'month'}
                className={`${styles.modeTab} ${filterMode === 'month' ? styles.modeTabActive : ''}`}
                onClick={() => setFilterMode('month')}
              >
                🗓️ 按月份 (月度汇总)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'all'}
                className={`${styles.modeTab} ${filterMode === 'all' ? styles.modeTabActive : ''}`}
                onClick={() => setFilterMode('all')}
              >
                📋 全部历史记录
              </button>
            </div>

            <div className={styles.toolbarActionBtns}>
              <button
                type="button"
                className={styles.quickDateBtn}
                onClick={() => {
                  setFilterMode('date');
                  setFilterDate(businessDate());
                }}
              >
                今天 ({formatDMY(businessDate())})
              </button>
              <button
                type="button"
                className={styles.quickDateBtn}
                onClick={() => {
                  setFilterMode('date');
                  setFilterDate(getYesterday());
                }}
              >
                昨天
              </button>
              <button
                type="button"
                className={styles.quickDateBtn}
                onClick={() => {
                  setFilterMode('month');
                  setFilterMonth(businessDate().slice(0, 7));
                }}
              >
                本月
              </button>
              <button
                type="button"
                className="btn btnSecondary"
                onClick={load}
                title="重新加载数据"
              >
                🔄 刷新
              </button>
            </div>
          </div>

          <div className={styles.toolbarBottomRow}>
            {filterMode === 'date' ? (
              <div className={styles.datePickerWrapper}>
                <input
                  type="date"
                  className={styles.styledDateInput}
                  value={filterDate}
                  title="按具体日期筛选 (DD/MM/YYYY)"
                  aria-label="按具体日期筛选"
                  onChange={e => {
                    setFilterDate(e.target.value);
                    setFilterMode('date');
                  }}
                />
              </div>
            ) : filterMode === 'month' ? (
              <div className={styles.datePickerWrapper}>
                <input
                  type="month"
                  className={styles.styledDateInput}
                  value={filterMonth}
                  title="按月份筛选"
                  aria-label="按月份筛选"
                  onChange={e => {
                    setFilterMonth(e.target.value);
                    setFilterMode('month');
                  }}
                />
              </div>
            ) : (
              <div className={styles.datePickerWrapper}>
                <button
                  type="button"
                  className={styles.styledDateInput}
                  style={{ cursor: 'pointer', textAlign: 'center', background: '#f8fafc', color: 'var(--color-text-light)' }}
                  onClick={() => setFilterMode('date')}
                  title="点击切换到按具体日期筛选"
                >
                  📅 全部历史记录
                </button>
              </div>
            )}

            <div className={styles.searchWrapper}>
              <input
                type="search"
                className={styles.styledSearchInput}
                placeholder={booth ? "🔍 搜索摆摊地点、曲奇口味或日期..." : "🔍 搜索批发商名称、曲奇口味或日期..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {booth && visible.some(r => r.status === 'preparing') && (
          <div className={styles.boothAlertBanner}>
            <div>
              <strong>⏳ 有 {visible.filter(r => r.status === 'preparing').length} 场摆摊正在进行中 (待收摊结单)</strong>
              <p style={{ margin: '4px 0 0', fontSize: '.85rem' }}>出摊准备已记录。摆摊活动结束后，请点击对应记录右侧的“🏁 摆摊结束结单”录入实际售出片数与现场开销。</p>
            </div>
          </div>
        )}

        {/* Graphical KPI Summary Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>总销售额</span>
              <span className={styles.statIcon}>💰</span>
            </div>
            <strong className={styles.statValue}>{money(totals.sales)}</strong>
            <span className={styles.statSubtext}>共 {visible.length} 笔{booth ? '摆摊' : '供货'}记录</span>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>已记支出</span>
              <span className={styles.statIcon}>🧾</span>
            </div>
            <strong className={styles.statValue} style={{ color: totals.expenses > 0 ? '#dc2626' : 'var(--color-primary)' }}>
              {money(totals.expenses)}
            </strong>
            <span className={styles.statSubtext}>{booth ? '现场摊位费与杂费开销' : '包装与物流配送支出'}</span>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>{booth ? '营收净额 (扣除支出)' : '待收尾款'}</span>
              <span className={styles.statIcon}>{booth ? '📈' : '⏳'}</span>
            </div>
            <strong
              className={styles.statValue}
              style={{
                color: booth
                  ? (totals.sales - totals.expenses >= 0 ? '#16a34a' : '#dc2626')
                  : (totals.outstanding > 0 ? '#ea580c' : '#16a34a')
              }}
            >
              {money(booth ? totals.sales - totals.expenses : totals.outstanding)}
            </strong>
            <span className={styles.statSubtext}>
              {booth ? '销售额扣减现场支出后净额' : (totals.outstanding > 0 ? '尚未收回货款' : '所有订单均已结清')}
            </span>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>{booth ? '售出曲奇总量' : '批发供货总量'}</span>
              <span className={styles.statIcon}>🍪</span>
            </div>
            <strong className={styles.statValue}>{totalPiecesSold} 片</strong>
            <span className={styles.statSubtext}>
              {booth ? `准备出摊共 ${totalPiecesPrepared} 片` : `累计出库 ${totalPiecesSold} 片`}
            </span>
          </div>
        </div>

        <section className={styles.panel}>
          <h2>{booth ? '摆摊历史记录' : '订单历史记录'}</h2>
          {loading ? (
            <p>正在加载记录...</p>
          ) : !visible.length ? (
            <p className={styles.empty}>
              {filterMode === 'date' && filterDate
                ? `在 ${formatDMY(filterDate)} 暂无${booth ? '摆摊记录' : '批发订单'}`
                : filterMode === 'month' && filterMonth
                  ? `本月暂无${booth ? '摆摊记录' : '批发订单'}`
                  : `暂无${booth ? '摆摊记录' : '批发订单'}`}。点击上方按钮添加第一条记录。
            </p>
          ) : (
            <div className={styles.history}>
              {visible.map(record => {
                const isPrep = booth && record.status === 'preparing';
                const totalPrepared = record.items.reduce((sum, item) => sum + (Number(item.prepared) || 0), 0);
                const totalSold = record.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                const totalLeftover = record.items.reduce((sum, item) => sum + (Number(item.leftover) || 0), 0);
                return (
                  <div className={styles.historyRow} key={record.id}>
                    <div className={styles.historyRowLeft}>
                      <div className={styles.historyRowTitleLine}>
                        <strong className={styles.recordTitle}>{record.title}</strong>
                        {booth && (
                          isPrep
                            ? <span className={styles.badgePreparing}>⏳ 摆摊中 · 待结单</span>
                            : <span className={styles.badgeCompleted}>✅ 已结单</span>
                        )}
                        {!booth && (
                          record.outstanding > 0
                            ? <span className={styles.badgeOutstanding}>待收尾款 {money(record.outstanding)}</span>
                            : <span className={styles.badgeCompleted}>✅ 已结清</span>
                        )}
                      </div>

                      <div className={styles.historyRowSubtext}>
                        <span className={styles.dateBadge}>📅 {formatDMY(record.date)}</span>
                        <span>·</span>
                        <span>
                          {booth
                            ? (isPrep ? `准备出摊共 ${totalPrepared} 片 (待收摊结单)` : `${totalSold} 片 已售出`)
                            : `${record.items.reduce((sum, item) => sum + item.quantity, 0)} 片 已订购`}
                        </span>
                        {booth && !isPrep && (
                          <>
                            <span>·</span>
                            <span>准备 {totalPrepared} 片 · 剩余 {totalLeftover} 片</span>
                          </>
                        )}
                      </div>

                      {record.items && record.items.length > 0 && (
                        <div className={styles.flavourPills}>
                          {record.items.map((item, idx) => (
                            <span key={idx} className={styles.flavourPill}>
                              {item.name}: {booth ? (isPrep ? `备${item.prepared}片` : `售${item.quantity}/备${item.prepared}片`) : `${item.quantity}片`}
                            </span>
                          ))}
                        </div>
                      )}

                      {record.notes && (
                        <div className={styles.historyNotes}>
                          📝 {record.notes}
                        </div>
                      )}
                    </div>

                    <div className={styles.historyRowRight}>
                      <div className={styles.historyPriceBox}>
                        <span className={styles.historyPriceLabel}>{isPrep ? '状态' : '销售额'}</span>
                        <strong className={styles.historyPriceValue}>{isPrep ? '待结单' : money(record.sales)}</strong>
                        {record.expenseTotal > 0 && (
                          <span className={styles.historyExpenseNote}>支出 {money(record.expenseTotal)}</span>
                        )}
                      </div>

                      <div className={styles.historyActions}>
                        {isPrep ? (
                          <>
                            <button
                              type="button"
                              className={`btn btnPrimary ${styles.finalizeBtn}`}
                              onClick={() => {
                                setError('');
                                setNotice('');
                                setDraft({ ...structuredClone(record), status: 'completed' });
                              }}
                            >
                              🏁 摆摊结束结单
                            </button>
                            <button
                              type="button"
                              className="btn btnSecondary"
                              onClick={() => {
                                setError('');
                                setNotice('');
                                setDraft(structuredClone(record));
                              }}
                            >
                              修改出摊准备
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btnSecondary"
                            onClick={() => {
                              setError('');
                              setNotice('');
                              setDraft(structuredClone(record));
                            }}
                          >
                            查看 / 编辑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>}
      {tab === 'buyers' && (
        <section className={styles.panel}>
          <h2>合作商联系录</h2>
          <p className={styles.hint}>在此统一维护合作批发商及店铺联系信息。每笔订单均可单独设置不同口味的供货价格。</p>
          {loading ? (
            <p>正在加载批发商...</p>
          ) : !buyers.length ? (
            <p className={styles.empty}>暂无合作商。录入首笔批发订单前请先在此添加合作商。</p>
          ) : (
            <div className={styles.history}>
              {buyers.map(buyer => (
                <div className={styles.historyRow} key={buyer.id}>
                  <div className={styles.historyRowLeft}>
                    <div className={styles.historyRowTitleLine}>
                      <strong className={styles.recordTitle}>{buyer.name}</strong>
                    </div>
                    <p className={styles.historyRowSubtext}>📞 {buyer.contact || '暂无联系信息'}</p>
                    {buyer.notes && <div className={styles.historyNotes}>📝 {buyer.notes}</div>}
                  </div>
                  <div className={styles.historyRowRight}>
                    <div className={styles.historyActions}>
                      <button
                        className="btn btnSecondary"
                        onClick={() => {
                          setError('');
                          setBuyerDraft({ ...buyer, notes: buyer.notes || '', contact: buyer.contact || '' });
                        }}
                      >
                        编辑联系人
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>}
  </div>;
}
