'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { uploadImageToImgBB } from '@/lib/imgbb';
import styles from './page.module.css';

export default function ProductsPage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const fileInputRef = useRef(null);

  const defaultForm = {
    name: '',
    description: '',
    price: 10.00,
    available: true,
    has_box_options: true,
    is_byob: false,
    box_4_price: '',
    box_5_price: '',
    box_6_price: '',
    box_8_price: '',
    box_12_price: '',
  };

  const [formData, setFormData] = useState(defaultForm);
  // Array of image items: [{ url, file, isNew }]
  const [imageList, setImageList] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch (error) {
      toast.error('加载曲奇商品失败');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(defaultForm);
    setImageList([]);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price || 10.00,
      available: product.available !== false && product.available !== 0,
      has_box_options: product.has_box_options !== false,
      is_byob: Boolean(product.is_byob),
      box_4_price: product.box_4_price !== undefined && product.box_4_price !== null ? product.box_4_price : '',
      box_5_price: product.box_5_price !== undefined && product.box_5_price !== null ? product.box_5_price : '',
      box_6_price: product.box_6_price !== undefined && product.box_6_price !== null ? product.box_6_price : '',
      box_8_price: product.box_8_price !== undefined && product.box_8_price !== null ? product.box_8_price : '',
      box_12_price: product.box_12_price !== undefined && product.box_12_price !== null ? product.box_12_price : '',
    });

    // Populate existing images
    const existingUrls = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : (product.image ? [product.image] : []);

    setImageList(existingUrls.map(url => ({ url, file: null, isNew: false })));
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextVal = value;
    if (type === 'checkbox') {
      nextVal = checked;
    } else if (type === 'number') {
      if (value === '' || value === null || value === undefined) {
        nextVal = '';
      } else {
        const parsed = parseFloat(value);
        nextVal = isNaN(parsed) ? '' : parsed;
      }
    }
    setFormData(prev => ({
      ...prev,
      [name]: nextVal
    }));
  };

  // Multi-image selection
  const handleMultipleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = [];
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        toast.warning(`图片 ${file.name} 过大（请选择小于 25MB 的照片）`);
        continue;
      }
      newItems.push({
        url: URL.createObjectURL(file),
        file: file,
        isNew: true
      });
    }

    setImageList(prev => [...prev, ...newItems]);
    // Reset input so user can pick the same file again if desired
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageList(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetCover = (indexToCover) => {
    setImageList(prev => {
      const selected = prev[indexToCover];
      const rest = prev.filter((_, idx) => idx !== indexToCover);
      return [selected, ...rest];
    });
  };

  // Toggle available/unavailable directly from table
  const handleToggleAvailable = async (product) => {
    const currentStatus = product.available !== false && product.available !== 0;
    const newStatus = !currentStatus;

    try {
      const res = await authFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newStatus })
      });

      if (res.ok) {
        toast.success('商品上架状态已更新');
        setProducts(prev => prev.map(p =>
          p.id === product.id ? { ...p, available: newStatus } : p
        ));
      } else {
        toast.error('更新状态失败');
      }
    } catch (error) {
      toast.error('操作出错');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('请输入曲奇名称');
      return;
    }
    if (formData.price == null || formData.price < 0) {
      toast.error('请输入有效的价格');
      return;
    }

    setActionLoading(true);

    try {
      // Upload any new image files to ImgBB
      const finalImageUrls = [];
      for (const item of imageList) {
        if (item.isNew && item.file) {
          try {
            const uploadedUrl = await uploadImageToImgBB(item.file);
            finalImageUrls.push(uploadedUrl);
          } catch (uploadError) {
            console.error('ImgBB upload error:', uploadError);
            toast.error(`无法上传图片 ${item.file.name}`);
          }
        } else if (item.url) {
          finalImageUrls.push(item.url);
        }
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        available: Boolean(formData.available),
        has_box_options: Boolean(formData.has_box_options),
        is_byob: Boolean(formData.is_byob),
        box_4_price: formData.box_4_price !== '' && formData.box_4_price !== null ? Number(formData.box_4_price) : null,
        box_5_price: formData.box_5_price !== '' && formData.box_5_price !== null ? Number(formData.box_5_price) : null,
        box_6_price: formData.box_6_price !== '' && formData.box_6_price !== null ? Number(formData.box_6_price) : null,
        box_8_price: formData.box_8_price !== '' && formData.box_8_price !== null ? Number(formData.box_8_price) : null,
        box_12_price: formData.box_12_price !== '' && formData.box_12_price !== null ? Number(formData.box_12_price) : null,
        images: finalImageUrls,
        image: finalImageUrls[0] || null
      };

      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';

      const method = editingProduct ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(editingProduct ? '曲奇商品已更新' : '曲奇商品已创建');
        setIsModalOpen(false);
        fetchProducts();
      } else {
        toast.error(data.error || '保存商品失败');
      }
    } catch (error) {
      toast.error('操作出错');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除此曲奇商品吗？')) return;

    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('商品已成功删除');
        fetchProducts();
      } else {
        toast.error('删除商品失败');
      }
    } catch (error) {
      toast.error('操作出错');
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>曲奇菜单管理</h1>
          <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginTop: '4px' }}>
            管理曲奇口味目录、展示照片、价格及上架售卖状态
          </p>
        </div>
        <button onClick={openAddModal} className="btn btnPrimary">+ 新增曲奇口味</button>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>曲奇商品</th>
                  <th>单价</th>
                  <th>售卖状态 (点击切换)</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="textCenter">暂无曲奇商品</td>
                  </tr>
                ) : (
                  products.map(product => {
                    const isAvailable = product.available !== false && product.available !== 0;
                    const imgCount = Array.isArray(product.images) && product.images.length > 0
                      ? product.images.length
                      : (product.image ? 1 : 0);
                    const primaryThumb = (product.images && product.images[0]) || product.image;

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className={styles.productCell}>
                            <div className={styles.imageThumbWrapper}>
                              <div className={styles.imageThumb}>
                                {primaryThumb ? (
                                  <img src={primaryThumb} alt={product.name} />
                                ) : (
                                  '🍪'
                                )}
                              </div>
                              {imgCount > 1 && (
                                <span className={styles.photoCountBadge} title={`${imgCount} 张照片`}>
                                  📸 {imgCount}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className={styles.productName}>{product.name}</div>
                              {product.description && (
                                <div className={styles.productDesc}>{product.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>RM{Number(product.price).toFixed(2)} <span style={{ fontSize: '0.8rem', color: '#666' }}>/片</span></div>
                          {product.is_byob ? (
                            <span style={{ fontSize: '0.72rem', color: '#7c2d12', background: '#ffedd5', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', fontWeight: 600 }}>
                              自选混装盒 (BYOB 4/5/6/8/12片)
                            </span>
                          ) : product.has_box_options !== false && (
                            <span style={{ fontSize: '0.72rem', color: '#854d0e', background: '#fef9c3', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                              📦 盒装可选 (4/6/12片)
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleToggleAvailable(product)}
                            className={isAvailable ? styles.statusBtnActive : styles.statusBtnInactive}
                            title="点击切换上架状态"
                          >
                            {isAvailable ? '● 上架售卖中' : '○ 已下架 / 售罄'}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap1">
                            <button onClick={() => openEditModal(product)} className="btn btnSecondary" style={{ padding: '6px 12px' }}>编辑</button>
                            <button onClick={() => handleDelete(product.id)} className="btn btnDanger" style={{ padding: '6px 12px' }}>删除</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !actionLoading && setIsModalOpen(false)}
        title={editingProduct ? '编辑曲奇口味' : '新增曲奇口味'}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Multiple Photos Gallery */}
          <div className={styles.gallerySection}>
            <div className={styles.sectionLabel}>📸 曲奇展示照片 ({imageList.length})</div>
            <div className={styles.sectionHint}>
              可为此款曲奇上传多张照片。排在第一张的照片将作为主封面展示。
            </div>

            <div className={styles.imagesGrid}>
              {imageList.map((imgItem, idx) => (
                <div key={idx} className={`${styles.imageTile} ${idx === 0 ? styles.coverTile : ''}`}>
                  <img src={imgItem.url} alt={`照片 ${idx + 1}`} />

                  {idx === 0 ? (
                    <span className={styles.coverBadge}>★ 主封面</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.makeCoverBtn}
                      onClick={() => handleSetCover(idx)}
                      title="设为主封面照片"
                    >
                      设为封面
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.removeImageBtn}
                    onClick={() => handleRemoveImage(idx)}
                    title="移除此照片"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add more button */}
              <div
                className={styles.addImageTile}
                onClick={() => fileInputRef.current?.click()}
                title="点击选择图片文件"
              >
                <span className={styles.addImageIcon}>+</span>
                <span>添加照片</span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleMultipleImagesChange}
              accept="image/*"
              multiple
              className={styles.hiddenInput}
            />
          </div>

          <div className="formGroup mb2">
            <label htmlFor="name">曲奇口味名称 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="例如：开心果抹茶大曲奇"
              required
            />
          </div>

          <div className="formGroup mb2">
            <label htmlFor="description">风味描述与配料介绍</label>
            <textarea
              id="description"
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="描述风味特色、夹心原料及口感等..."
            ></textarea>
          </div>

          <div className={styles.priceGroup}>
            <div className="formGroup">
              <label htmlFor="price">单片售价 (Per piece) *</label>
              <input
                type="number"
                id="price"
                name="price"
                min="0"
                step="0.01"
                value={Number.isNaN(formData.price) || formData.price == null ? '' : formData.price}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* BYOB or Box Packaging Options */}
          <div style={{ background: 'var(--color-bg-alt, #faf7f2)', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ebd8c0', margin: '14px 0' }}>
            <div style={{ marginBottom: '10px' }}>
              <label className={styles.checkboxLabel} style={{ fontWeight: 600, color: '#7c2d12' }}>
                <input
                  type="checkbox"
                  name="is_byob"
                  checked={formData.is_byob}
                  onChange={handleInputChange}
                />
                <span>这是自选混装礼盒 (Build Your Own Box - BYOB)</span>
              </label>
              <p style={{ margin: '4px 0 10px 24px', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                开启后，顾客点击该商品将进入自选盒装配制弹窗，可从全部上架口味中自由搭配（支持 4、5、6、8、12 片盒装）。
              </p>
            </div>

            {formData.is_byob ? (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text)' }}>
                  设置各规格盒装总价（若留空将使用默认预设价格）：
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  <div className="formGroup">
                    <label htmlFor="box_4_price" style={{ fontSize: '0.8rem' }}>4片装 (RM)</label>
                    <input
                      type="number"
                      id="box_4_price"
                      name="box_4_price"
                      min="0"
                      step="0.01"
                      placeholder="默认 RM35"
                      value={Number.isNaN(formData.box_4_price) || formData.box_4_price == null ? '' : formData.box_4_price}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="formGroup">
                    <label htmlFor="box_5_price" style={{ fontSize: '0.8rem' }}>5片装 (RM)</label>
                    <input
                      type="number"
                      id="box_5_price"
                      name="box_5_price"
                      min="0"
                      step="0.01"
                      placeholder="默认 RM44"
                      value={Number.isNaN(formData.box_5_price) || formData.box_5_price == null ? '' : formData.box_5_price}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="formGroup">
                    <label htmlFor="box_6_price" style={{ fontSize: '0.8rem' }}>6片装 (RM)</label>
                    <input
                      type="number"
                      id="box_6_price"
                      name="box_6_price"
                      min="0"
                      step="0.01"
                      placeholder="默认 RM52"
                      value={Number.isNaN(formData.box_6_price) || formData.box_6_price == null ? '' : formData.box_6_price}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="formGroup">
                    <label htmlFor="box_8_price" style={{ fontSize: '0.8rem' }}>8片装 (RM)</label>
                    <input
                      type="number"
                      id="box_8_price"
                      name="box_8_price"
                      min="0"
                      step="0.01"
                      placeholder="默认 RM70"
                      value={Number.isNaN(formData.box_8_price) || formData.box_8_price == null ? '' : formData.box_8_price}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="formGroup">
                    <label htmlFor="box_12_price" style={{ fontSize: '0.8rem' }}>12片装 (RM)</label>
                    <input
                      type="number"
                      id="box_12_price"
                      name="box_12_price"
                      min="0"
                      step="0.01"
                      placeholder="默认 RM100"
                      value={Number.isNaN(formData.box_12_price) || formData.box_12_price == null ? '' : formData.box_12_price}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className={styles.checkboxLabel} style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  <input
                    type="checkbox"
                    name="has_box_options"
                    checked={formData.has_box_options}
                    onChange={handleInputChange}
                  />
                  <span>📦 开启单品盒装选项（同口味 4片 / 6片 / 12片 盒装购买）</span>
                </label>
                <p style={{ margin: '4px 0 10px 24px', fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                  顾客在前台可选择单片购买或按盒购买。仅有填写了价格的盒装规格才会对顾客开放，留空则不提供该盒装。
                </p>

                {formData.has_box_options && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '10px' }}>
                    <div className="formGroup">
                      <label htmlFor="box_4_price" style={{ fontSize: '0.82rem' }}>Box of 4 价格</label>
                      <input
                        type="number"
                        id="box_4_price"
                        name="box_4_price"
                        min="0"
                        step="0.01"
                        placeholder="留空则不提供"
                        value={Number.isNaN(formData.box_4_price) || formData.box_4_price == null ? '' : formData.box_4_price}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="formGroup">
                      <label htmlFor="box_6_price" style={{ fontSize: '0.82rem' }}>Box of 6 价格</label>
                      <input
                        type="number"
                        id="box_6_price"
                        name="box_6_price"
                        min="0"
                        step="0.01"
                        placeholder="留空则不提供"
                        value={Number.isNaN(formData.box_6_price) || formData.box_6_price == null ? '' : formData.box_6_price}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="formGroup">
                      <label htmlFor="box_12_price" style={{ fontSize: '0.82rem' }}>Box of 12 价格</label>
                      <input
                        type="number"
                        id="box_12_price"
                        name="box_12_price"
                        min="0"
                        step="0.01"
                        placeholder="留空则不提供"
                        value={Number.isNaN(formData.box_12_price) || formData.box_12_price == null ? '' : formData.box_12_price}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Availability Status */}
          <div className="formGroup">
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="available"
                checked={formData.available}
                onChange={handleInputChange}
              />
              <span>曲奇当前上架可供顾客订购</span>
            </label>
          </div>

          <div className="flex gap1">
            <button
              type="button"
              className="btn btnSecondary"
              style={{ flex: 1 }}
              onClick={() => setIsModalOpen(false)}
              disabled={actionLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btnPrimary"
              style={{ flex: 1 }}
              disabled={actionLoading}
            >
              {actionLoading ? '保存中...' : (editingProduct ? '更新曲奇' : '确认新增')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
