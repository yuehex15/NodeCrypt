export function $(selector, parent = document) {
	return parent.querySelector(selector)
}
export function $$(selector, parent = document) {
	return parent.querySelectorAll(selector)
}
export function $id(id) {
	return document.getElementById(id)
}
export function createElement(tag, attrs = {}, content = '') {
	const el = document.createElement(tag);
	Object.entries(attrs).forEach(([key, value]) => {
		if (key === 'class' || key === 'className') {
			el.className = value
		} else if (key === 'style' && typeof value === 'object') {
			Object.assign(el.style, value)
		} else if (key.startsWith('on') && typeof value === 'function') {
			el.addEventListener(key.slice(2).toLowerCase(), value)
		} else {
			el.setAttribute(key, value)
		}
	});
	if (typeof content === 'string') {
		el.innerHTML = content
	} else if (content instanceof Element) {
		el.appendChild(content)
	}
	return el
}
export function on(target, event, handler, options) {
	const el = typeof target === 'string' ? $(target) : target;
	if (el) el.addEventListener(event, handler, options)
}
export function off(target, event, handler) {
	const el = typeof target === 'string' ? $(target) : target;
	if (el) el.removeEventListener(event, handler)
}
export function addClass(el, ...classNames) {
	el.classList.add(...classNames)
}
export function removeClass(el, ...classNames) {
	el.classList.remove(...classNames)
}
export function toggleClass(el, className, force) {
	el.classList.toggle(className, force)
}