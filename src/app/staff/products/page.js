'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
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
    stock: 0,
    available: true,
    image: null
  };
  
  const [formData, setFormData] = useState(defaultForm);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products);
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
    setPreviewImage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      available: product.available === 1,
      image: product.image
    });
    setPreviewImage(product.image);
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setFormData(prev => ({ ...prev, image: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      const url = editingProduct 
        ? `/api/products/${editingProduct.id}` 
        : '/api/products';
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
        <h1 className={styles.title}>Products & Stock</h1>
        <button onClick={openAddModal} className="btn btnPrimary">+ Add Product</button>
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
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="textCenter">No products found</td>
                  </tr>
                ) : (
                  products.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className={styles.productCell}>
                          <div className={styles.imageThumb}>
                            {product.image ? (
                              <img src={product.image} alt={product.name} />
                            ) : (
                              '🍪'
                            )}
                          </div>
                          <div>
                            <div className={styles.productName}>{product.name}</div>
                          </div>
                        </div>
                      </td>
                      <td>RM{product.price.toFixed(2)}</td>
                      <td>
                        <span className={`${styles.stockBadge} ${product.stock <= 5 ? styles.lowStock : ''}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${product.available ? styles.statusActive : styles.statusInactive}`}>
                          {product.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap1">
                          <button onClick={() => openEditModal(product)} className="btn btnSecondary" style={{ padding: '6px 12px' }}>Edit</button>
                          <button onClick={() => handleDelete(product.id)} className="btn btnDanger" style={{ padding: '6px 12px' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !actionLoading && setIsModalOpen(false)} 
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.imageUploadSection}>
            <div 
              className={styles.imagePreview} 
              onClick={() => fileInputRef.current?.click()}
            >
              {previewImage ? (
                <img src={previewImage} alt="Preview" />
              ) : (
                <div className={styles.uploadPrompt}>
                  <span className={styles.uploadIcon}>📸</span>
                  <span>Click to upload image</span>
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleImageChange} 
              className={styles.hiddenInput}
            />
            <button 
              type="button" 
              className="btn btnSecondary mt1" 
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Image
            </button>
          </div>

          <div className="formGroup mb2">
            <label htmlFor="name">Product Name *</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleInputChange} 
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
            ></textarea>
          </div>

          <div className={styles.grid2}>
            <div className="formGroup mb2">
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
            
            <div className="formGroup mb2">
              <label htmlFor="stock">Stock Quantity *</label>
              <input 
                type="number" 
                id="stock" 
                name="stock" 
                min="0" 
                step="1" 
                value={formData.stock} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="formGroup mb3">
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                name="available" 
                checked={formData.available} 
                onChange={handleInputChange} 
              />
              <span>Product is visible and available for purchase</span>
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
              style={{ flex: 2 }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
