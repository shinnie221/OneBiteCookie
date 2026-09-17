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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  // Multi-image selection
  const handleMultipleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = [];
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        toast.warning(`图片 ${file.name} 过大（不能超过 8MB）`);
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
                        <td style={{ fontWeight: 600 }}>RM{Number(product.price).toFixed(2)}</td>
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
              <label htmlFor="price">单价售价 (RM) *</label>
              <input 
                type="number" 
                id="price" 
                name="price" 
                min="0" 
                step="0.01" 
                value={formData.price} 
                onChange={handleInputChange} 
                required 
              />
            </div>
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
