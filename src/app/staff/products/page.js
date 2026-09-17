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
      toast.error('Failed to load products');
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
        toast.warning(`${file.name} is too large (>8MB)`);
        continue;
      }
      newItems.push({
        url: URL.createObjectURL(file),
        file: file,
        isNew: true
      });
    }

    setImageList(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index) => {
    setImageList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSetCover = (index) => {
    setImageList(prev => {
      const selected = prev[index];
      const remaining = prev.filter((_, idx) => idx !== index);
      return [selected, ...remaining];
    });
  };

  // Toggle available/unavailable directly from table
  const handleToggleAvailable = async (product) => {
    const newStatus = !(product.available !== false && product.available !== 0);
    try {
      const res = await authFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newStatus })
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, available: newStatus } : p));
        toast.success(`"${product.name}" set to ${newStatus ? 'Available' : 'Unavailable'}`);
      } else {
        toast.error('Failed to update status');
      }
    } catch (e) {
      toast.error('Error updating status');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (formData.price == null || formData.price < 0) {
      toast.error('Please enter a valid price');
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
            toast.error(`Could not upload ${item.file.name}`);
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
        toast.success(editingProduct ? 'Product updated' : 'Product created');
        setIsModalOpen(false);
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product deleted');
        fetchProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Products Management</h1>
          <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage cookie catalog, photos, and availability status
          </p>
        </div>
        <button onClick={openAddModal} className="btn btnPrimary">+ Add Cookie</button>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Status (Click to toggle)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="textCenter">No products found</td>
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
                                <span className={styles.photoCountBadge} title={`${imgCount} photos`}>
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
                            title="Click to toggle availability"
                          >
                            {isAvailable ? '● Available' : '○ Unavailable'}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap1">
                            <button onClick={() => openEditModal(product)} className="btn btnSecondary" style={{ padding: '6px 12px' }}>Edit</button>
                            <button onClick={() => handleDelete(product.id)} className="btn btnDanger" style={{ padding: '6px 12px' }}>Delete</button>
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
        title={editingProduct ? 'Edit Cookie' : 'Add New Cookie'}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Multiple Photos Gallery */}
          <div className={styles.gallerySection}>
            <div className={styles.sectionLabel}>📸 Product Photos ({imageList.length})</div>
            <div className={styles.sectionHint}>
              You can upload more than one photo for this cookie. The first photo is the cover.
            </div>

            <div className={styles.imagesGrid}>
              {imageList.map((imgItem, idx) => (
                <div key={idx} className={`${styles.imageTile} ${idx === 0 ? styles.coverTile : ''}`}>
                  <img src={imgItem.url} alt={`Photo ${idx + 1}`} />
                  
                  {idx === 0 ? (
                    <span className={styles.coverBadge}>★ Cover</span>
                  ) : (
                    <button 
                      type="button" 
                      className={styles.makeCoverBtn}
                      onClick={() => handleSetCover(idx)}
                      title="Make this the cover photo"
                    >
                      Make Cover
                    </button>
                  )}

                  <button 
                    type="button" 
                    className={styles.removeImageBtn}
                    onClick={() => handleRemoveImage(idx)}
                    title="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add more button */}
              <div 
                className={styles.addImageTile}
                onClick={() => fileInputRef.current?.click()}
                title="Click to select image files"
              >
                <span className={styles.addImageIcon}>+</span>
                <span>Add Photo</span>
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
            <label htmlFor="name">Cookie Name *</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleInputChange} 
              placeholder="e.g. Pistachio Matcha Cookie"
              required 
            />
          </div>

          <div className="formGroup mb2">
            <label htmlFor="description">Description</label>
            <textarea 
              id="description" 
              name="description" 
              rows="3" 
              value={formData.description} 
              onChange={handleInputChange}
              placeholder="Describe flavors, fillings, and texture..."
            ></textarea>
          </div>

          <div className={styles.priceGroup}>
            <div className="formGroup">
              <label htmlFor="price">Price (RM) *</label>
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
              <span>Cookie is Available for customers to order</span>
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
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btnPrimary" 
              style={{ flex: 1 }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : (editingProduct ? 'Update Cookie' : 'Create Cookie')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
