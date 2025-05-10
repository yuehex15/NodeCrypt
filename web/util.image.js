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
    dataUrl = canvas.toDataURL('image/webp', 0.90);
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

// 国际化提示已移除，默认英文提示
function t(key) {
  const messages = {
    tooLarge: 'Image is too large (over 5MB)',
  };
  return messages[key] || key;
}

/**
 * 统一图片发送与粘贴处理
 * @param {Object} opts
 * @param {string} opts.inputSelector 聊天输入框选择器
 * @param {string} opts.attachBtnSelector 附件按钮选择器
 * @param {string} opts.fileInputSelector 文件input选择器
 * @param {function} opts.onSend 发送图片回调(dataUrl)
 */
export function setupImageSend({ inputSelector, attachBtnSelector, fileInputSelector, onSend }) {
  const input = document.querySelector(inputSelector);
  const attachBtn = document.querySelector(attachBtnSelector);
  const fileInput = document.querySelector(fileInputSelector);
  if (fileInput) fileInput.setAttribute('accept', 'image/*');
  if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = async function() {
      if (!fileInput.files || !fileInput.files.length) return;
      const file = fileInput.files[0];
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        alert(t('tooLarge'));
        return;
      }
      processImage(file, (dataUrl) => {
        if (typeof onSend === 'function') onSend(dataUrl);
      });
      fileInput.value = '';
    };
  }
  // 粘贴图片支持
  if (input) {
    input.addEventListener('paste', function(e) {
      if (!e.clipboardData) return;
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          if (file.size > 5 * 1024 * 1024) {
            alert(t('tooLarge'));
            continue;
          }
          processImage(file, (dataUrl) => {
            if (typeof onSend === 'function') onSend(dataUrl);
          });
          e.preventDefault();
          break;
        }
      }
    });
  }
}
