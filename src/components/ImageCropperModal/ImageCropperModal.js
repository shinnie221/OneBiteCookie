'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ImageCropperModal.module.css';

/**
 * ImageCropperModal
 * 
 * Interactive canvas-based image cropper with pan, zoom, rotation, flip,
 * rule-of-thirds grid, circular mask preview for logos, and multiple aspect ratios.
 */
export default function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  cropType = 'banner', // 'banner' | 'avatar' | 'general'
  title,
  onConfirmCrop,
  onSkipCrop,
  isProcessing = false
}) {
  // Preset Aspect Ratios
  let aspectPresets;
  if (cropType === 'avatar') {
    aspectPresets = [
      { label: '1:1 (推荐Logo)', value: 1 },
      { label: '4:3', value: 4 / 3 },
      { label: '16:9', value: 16 / 9 },
      { label: '自由比例', value: null }
    ];
  } else if (cropType === 'product' || cropType === 'cookie') {
    aspectPresets = [
      { label: '1:1 (推荐方形商品)', value: 1 },
      { label: '4:3 (经典比例)', value: 4 / 3 },
      { label: '3:4 (竖构图)', value: 3 / 4 },
      { label: '16:9 (宽屏展示)', value: 16 / 9 },
      { label: '自由比例', value: null }
    ];
  } else {
    aspectPresets = [
      { label: '2:1 (推荐横幅)', value: 2 },
      { label: '16:9 (标准宽屏)', value: 16 / 9 },
      { label: '3:1 (超宽条幅)', value: 3 },
      { label: '4:3 (经典比例)', value: 4 / 3 },
      { label: '1:1 (方形)', value: 1 },
      { label: '自由比例', value: null }
    ];
  }

  const defaultRatio = (cropType === 'avatar' || cropType === 'product' || cropType === 'cookie') ? 1 : 2;
  const [aspectRatio, setAspectRatio] = useState(defaultRatio);
  const [showCircleMask, setShowCircleMask] = useState(cropType === 'avatar');

  // Image Transformations
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef(null);

  // Stage & Image refs
  const stageRef = useRef(null);
  const imageObjRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 560, height: 360 });

  // Reset transforms whenever a new image is loaded or modal opens
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setImageLoaded(false);
      return;
    }

    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
    setAspectRatio(cropType === 'avatar' ? 1 : 2);
    setShowCircleMask(cropType === 'avatar');

    // For remote URLs (http/https), route through our proxy to prevent canvas CORS taint
    const targetSrc = (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'))
      ? `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`
      : imageSrc;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.onerror = () => {
      // If proxy fails or image is local, fallback to direct src
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.onload = () => {
        imageObjRef.current = fallbackImg;
        setImageNaturalSize({ width: fallbackImg.naturalWidth, height: fallbackImg.naturalHeight });
        setImageLoaded(true);
      };
      fallbackImg.src = imageSrc;
    };
    img.src = targetSrc;
  }, [isOpen, imageSrc, cropType]);

  // Measure stage size on mount & resize
  useEffect(() => {
    if (!isOpen) return;

    const updateStageSize = () => {
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        setStageSize({
          width: Math.max(rect.width, 300),
          height: Math.max(rect.height, 240)
        });
      }
    };

    updateStageSize();
    window.addEventListener('resize', updateStageSize);
    return () => window.removeEventListener('resize', updateStageSize);
  }, [isOpen]);

  // Lock body scroll & listen for Escape key when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isProcessing) {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, isProcessing, onClose]);

  // Calculate Crop Box Dimensions inside the Stage
  const cropBox = useCallback(() => {
    const padding = 28;
    const availW = Math.max(stageSize.width - padding * 2, 200);
    const availH = Math.max(stageSize.height - padding * 2, 160);

    let targetRatio = aspectRatio;
    if (!targetRatio) {
      // Free aspect ratio: default to image ratio or 16:9
      targetRatio = imageNaturalSize.width && imageNaturalSize.height
        ? imageNaturalSize.width / imageNaturalSize.height
        : (cropType === 'avatar' ? 1 : 16 / 9);
    }

    let boxW = availW;
    let boxH = boxW / targetRatio;

    if (boxH > availH) {
      boxH = availH;
      boxW = boxH * targetRatio;
    }

    return {
      width: Math.round(boxW),
      height: Math.round(boxH),
      x: Math.round((stageSize.width - boxW) / 2),
      y: Math.round((stageSize.height - boxH) / 2),
      ratio: targetRatio
    };
  }, [stageSize, aspectRatio, imageNaturalSize, cropType]);

  const currentCropBox = cropBox();

  // Mouse / Touch Dragging Handlers
  const handlePointerDown = (clientX, clientY) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { ...pan };
  };

  const handlePointerMove = (clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomDelta = -e.deltaY * 0.0015;
    setZoom(prev => Math.min(Math.max(prev + zoomDelta, 0.5), 4));
  };

  // Touch pinch handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && pinchStartDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = dist / pinchStartDistRef.current;
      setZoom(prev => Math.min(Math.max(prev * factor, 0.5), 4));
      pinchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchStartDistRef.current = null;
  };

  // Rotate 90 degrees
  const handleRotate = (dir = 1) => {
    setRotation(prev => (prev + dir * 90 + 360) % 360);
  };

  // Reset adjustments
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
  };

  // Execute High-Resolution Canvas Crop
  const handleConfirm = () => {
    if (!imageObjRef.current || !imageLoaded) return;

    const img = imageObjRef.current;
    const box = currentCropBox;

    // Determine target canvas resolution
    // High-definition export: min 1200px width for banner, 900px for products, 600px for avatar
    const exportWidth = cropType === 'avatar' ? 600 : (cropType === 'product' || cropType === 'cookie' ? 900 : 1200);
    const exportHeight = Math.round(exportWidth / box.ratio);

    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Enable smooth bicubic scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Scale factor from stage crop box to output canvas
    const scaleToExport = exportWidth / box.width;

    // Calculate base fit of the image inside the crop box
    const isRotated90or270 = rotation === 90 || rotation === 270;
    const effectiveImgW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
    const effectiveImgH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

    const coverScale = Math.max(box.width / effectiveImgW, box.height / effectiveImgH);
    const finalScreenScale = coverScale * zoom;

    // Center of canvas
    ctx.save();
    ctx.translate(
      exportWidth / 2 + pan.x * scaleToExport,
      exportHeight / 2 + pan.y * scaleToExport
    );
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, 1);

    const drawW = img.naturalWidth * finalScreenScale * scaleToExport;
    const drawH = img.naturalHeight * finalScreenScale * scaleToExport;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Export to Blob & Data URL with robust error handling
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            onConfirmCrop(blob, dataUrl);
          } catch {
            onConfirmCrop(blob, null);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.warn('Canvas toBlob failed, attempting dataURL fallback:', err);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => onConfirmCrop(blob, dataUrl))
          .catch(() => alert('无法导出图片，请重试'));
      } catch (e2) {
        console.error('All canvas exports failed:', e2);
        alert('此图片受安全策略限制，请重新选择图片');
      }
    }
  };

  if (!isOpen) return null;

  // Compute CSS transform for live display on stage
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const effectiveImgW = isRotated90or270 ? imageNaturalSize.height : imageNaturalSize.width;
  const effectiveImgH = isRotated90or270 ? imageNaturalSize.width : imageNaturalSize.height;

  const coverScale = (effectiveImgW && effectiveImgH && currentCropBox.width && currentCropBox.height)
    ? Math.max(currentCropBox.width / effectiveImgW, currentCropBox.height / effectiveImgH)
    : 1;

  const displayScale = coverScale * zoom;
  const imgWidth = imageNaturalSize.width * displayScale;
  const imgHeight = imageNaturalSize.height * displayScale;

  const imageTransform = `
    translate(${currentCropBox.x + currentCropBox.width / 2 + pan.x - imgWidth / 2}px, 
              ${currentCropBox.y + currentCropBox.height / 2 + pan.y - imgHeight / 2}px)
    rotate(${rotation}deg)
    scaleX(${flipH ? -1 : 1})
  `;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              {title || (cropType === 'avatar' ? '✂️ 裁剪圆形Logo / 头像' : (cropType === 'product' || cropType === 'cookie' ? '✂️ 裁剪曲奇展示照片' : '✂️ 裁剪店铺横幅背景'))}
            </h2>
            <p className={styles.subtitle}>
              支持拖拽移动画面、双指/滚轮缩放、旋转及切换比例
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* Aspect Ratio Selector Toolbar */}
        <div className={styles.ratioBar}>
          <span className={styles.ratioBarLabel}>裁剪比例:</span>
          {aspectPresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className={`${styles.ratioBtn} ${aspectRatio === preset.value ? styles.ratioBtnActive : ''}`}
              onClick={() => {
                setAspectRatio(preset.value);
                if (preset.value === 1 && cropType === 'avatar') {
                  setShowCircleMask(true);
                }
              }}
            >
              {preset.label}
            </button>
          ))}

          {/* Circle Mask Toggle for Logo */}
          {cropType === 'avatar' && aspectRatio === 1 && (
            <button
              type="button"
              className={`${styles.ratioBtn} ${showCircleMask ? styles.ratioBtnActive : ''}`}
              onClick={() => setShowCircleMask(prev => !prev)}
              title="切换圆形透视参考遮罩"
            >
              {showCircleMask ? '🟢 圆形参考遮罩: 开' : '⚪ 圆形参考遮罩: 关'}
            </button>
          )}
        </div>

        {/* Interactive Cropper Stage */}
        <div
          ref={stageRef}
          className={styles.stage}
          onMouseDown={e => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={e => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* Image Layer */}
          {imageLoaded && (
            <img
              src={imageSrc}
              alt="待裁剪原图"
              className={styles.stageImage}
              style={{
                width: `${imgWidth}px`,
                height: `${imgHeight}px`,
                transform: imageTransform,
                transformOrigin: 'center center'
              }}
              draggable={false}
            />
          )}

          {/* Dimmed Overlay Around Crop Box */}
          <div
            className={styles.dimmedOverlay}
            style={{
              clipPath: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                ${currentCropBox.x}px ${currentCropBox.y}px,
                ${currentCropBox.x}px ${currentCropBox.y + currentCropBox.height}px,
                ${currentCropBox.x + currentCropBox.width}px ${currentCropBox.y + currentCropBox.height}px,
                ${currentCropBox.x + currentCropBox.width}px ${currentCropBox.y}px,
                ${currentCropBox.x}px ${currentCropBox.y}px
              )`
            }}
          />

          {/* Crop Boundary Box & Rule-of-Thirds Grid */}
          <div
            className={`${styles.cropBox} ${showCircleMask && aspectRatio === 1 ? styles.cropBoxCircle : ''}`}
            style={{
              width: `${currentCropBox.width}px`,
              height: `${currentCropBox.height}px`,
              left: `${currentCropBox.x}px`,
              top: `${currentCropBox.y}px`
            }}
          >
            {/* Grid Lines */}
            <div className={styles.gridLineH1} />
            <div className={styles.gridLineH2} />
            <div className={styles.gridLineV1} />
            <div className={styles.gridLineV2} />

            {/* Corner Markers */}
            <div className={`${styles.cornerMarker} ${styles.cornerTL}`} />
            <div className={`${styles.cornerMarker} ${styles.cornerTR}`} />
            <div className={`${styles.cornerMarker} ${styles.cornerBL}`} />
            <div className={`${styles.cornerMarker} ${styles.cornerBR}`} />

            {/* Circular Mask Outline Overlay */}
            {showCircleMask && aspectRatio === 1 && (
              <div className={styles.circleGuide} />
            )}
          </div>
        </div>

        {/* Adjustment Controls Bar */}
        <div className={styles.controlsBar}>
          {/* Zoom Slider */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>缩放:</span>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.5))}
              title="缩小"
            >
              ➖
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className={styles.zoomSlider}
            />
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setZoom(prev => Math.min(prev + 0.15, 3))}
              title="放大"
            >
              ➕
            </button>
            <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
          </div>

          {/* Rotate & Flip Tools */}
          <div className={styles.controlGroup}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => handleRotate(-1)}
              title="向左旋转90°"
            >
              ⟲ 左转90°
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => handleRotate(1)}
              title="向右旋转90°"
            >
              ⟳ 右转90°
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setFlipH(prev => !prev)}
              title="水平镜像翻转"
            >
              ⇄ 水平镜像
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleReset}
              title="还原缩放与位置"
            >
              ↺ 重置原状
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {onSkipCrop && (
              <button
                type="button"
                className={styles.btnSkip}
                onClick={onSkipCrop}
                disabled={isProcessing}
                title="不进行裁剪，直接上传并应用整张原图"
              >
                ⚡ 直接使用原图 (不裁剪)
              </button>
            )}
          </div>

          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isProcessing}
            >
              取消
            </button>
            <button
              type="button"
              className={styles.btnConfirm}
              onClick={handleConfirm}
              disabled={!imageLoaded || isProcessing}
            >
              {isProcessing ? '⏳ 正在处理并上传...' : '✂️ 确认裁剪并应用'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
