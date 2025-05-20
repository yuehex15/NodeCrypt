// util.dom.js
// DOM操作工具库

/**
 * 获取DOM元素
 * @param {string} selector - CSS选择器
 * @param {Element} [parent=document] - 父元素，默认为document
 * @returns {Element|null} 找到的元素或null
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 获取DOM元素集合
 * @param {string} selector - CSS选择器
 * @param {Element} [parent=document] - 父元素，默认为document
 * @returns {NodeList} 找到的元素列表
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * 通过ID获取元素
 * @param {string} id - 元素ID
 * @returns {Element|null} 找到的元素或null
 */
export function $id(id) {
  return document.getElementById(id);
}

/**
 * 创建DOM元素
 * @param {string} tag - 标签名称
 * @param {Object} [attrs={}] - 元素属性
 * @param {string|Element} [content=''] - 内容或子元素
 * @returns {Element} 创建的元素
 */
export function createElement(tag, attrs = {}, content = '') {
  const el = document.createElement(tag);
  
  // 设置属性
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class' || key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  });
  
  // 添加内容
  if (typeof content === 'string') {
    el.innerHTML = content;
  } else if (content instanceof Element) {
    el.appendChild(content);
  }
  
  return el;
}

/**
 * 设置元素样式
 * @param {Element} el - 目标元素
 * @param {Object} styles - 样式对象
 */
export function setStyles(el, styles) {
  Object.assign(el.style, styles);
}

/**
 * 添加事件监听器
 * @param {string|Element} target - 目标元素或选择器
 * @param {string} event - 事件名称
 * @param {Function} handler - 处理函数
 * @param {Object} [options] - 事件选项
 */
export function on(target, event, handler, options) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el) el.addEventListener(event, handler, options);
}

/**
 * 移除事件监听器
 * @param {string|Element} target - 目标元素或选择器
 * @param {string} event - 事件名称
 * @param {Function} handler - 处理函数
 */
export function off(target, event, handler) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el) el.removeEventListener(event, handler);
}

/**
 * 向元素添加类
 * @param {Element} el - 目标元素
 * @param {...string} classNames - 类名
 */
export function addClass(el, ...classNames) {
  el.classList.add(...classNames);
}

/**
 * 从元素移除类
 * @param {Element} el - 目标元素
 * @param {...string} classNames - 类名
 */
export function removeClass(el, ...classNames) {
  el.classList.remove(...classNames);
}

/**
 * 切换元素的类
 * @param {Element} el - 目标元素
 * @param {string} className - 类名
 * @param {boolean} [force] - 强制添加或移除
 */
export function toggleClass(el, className, force) {
  el.classList.toggle(className, force);
}
