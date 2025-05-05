// 图片压缩与格式转换工具
export async function processImage(file, callback) {
  // 检查webp支持
  let webpSupported = await checkWebpSupport();
  const img = new Image();
  img.onload = function() {
    // 限制最大宽高
    const maxW = 1280, maxH = 1280;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxW || h > maxH) {
      const scale = Math.min(maxW / w, maxH / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let dataUrl;
    if (webpSupported) {
      dataUrl = canvas.toDataURL('image/webp', 0.95);
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    }
    callback(dataUrl);
  };
  const reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function checkWebpSupport() {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = function() {
      resolve(img.width === 1);
    };
    img.onerror = function() {
      resolve(false);
    };
    img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
  });
}
