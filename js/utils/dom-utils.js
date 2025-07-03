// js/utils/dom-utils.js - iOS兼容版DOM工具库
// 🚀 DOM操作工具，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    /**
     * 🎯 DOMUtils - DOM操作工具库
     * 功能：元素选择、操作、事件处理、性能优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function DOMUtils() {
        var compatibilityUtils = global.CompatibilityUtils || global.EnglishSite.CompatibilityUtils;
        
        // 🔍 元素选择器
        function $(selector, context) {
            context = context || document;
            
            if (typeof selector === 'string') {
                // 支持基本的选择器
                if (selector.charAt(0) === '#') {
                    return context.getElementById(selector.slice(1));
                } else if (selector.charAt(0) === '.') {
                    var className = selector.slice(1);
                    if (context.getElementsByClassName) {
                        return context.getElementsByClassName(className)[0];
                    } else {
                        // 降级支持
                        var elements = context.getElementsByTagName('*');
                        for (var i = 0; i < elements.length; i++) {
                            if (hasClass(elements[i], className)) {
                                return elements[i];
                            }
                        }
                    }
                } else {
                    if (context.querySelector) {
                        return context.querySelector(selector);
                    } else {
                        // 降级到基础选择器
                        return context.getElementsByTagName(selector)[0];
                    }
                }
            } else if (selector && selector.nodeType) {
                return selector;
            }
            
            return null;
        }
        
        function $$(selector, context) {
            context = context || document;
            var results = [];
            
            if (typeof selector === 'string') {
                if (selector.charAt(0) === '.') {
                    var className = selector.slice(1);
                    if (context.getElementsByClassName) {
                        return Array.prototype.slice.call(context.getElementsByClassName(className));
                    } else {
                        // 降级支持
                        var elements = context.getElementsByTagName('*');
                        for (var i = 0; i < elements.length; i++) {
                            if (hasClass(elements[i], className)) {
                                results.push(elements[i]);
                            }
                        }
                        return results;
                    }
                } else if (context.querySelectorAll) {
                    return Array.prototype.slice.call(context.querySelectorAll(selector));
                } else {
                    // 降级到基础选择器
                    return Array.prototype.slice.call(context.getElementsByTagName(selector));
                }
            }
            
            return results;
        }
        
        // 🎨 CSS类操作
        function hasClass(element, className) {
            if (!element || !className) return false;
            
            if (compatibilityUtils && compatibilityUtils.features.classList) {
                return element.classList.contains(className);
            } else {
                return new RegExp('(^|\\s)' + className + '(\\s|$)').test(element.className);
            }
        }
        
        function addClass(element, className) {
            if (!element || !className) return;
            
            if (compatibilityUtils && compatibilityUtils.addClass) {
                compatibilityUtils.addClass(element, className);
            } else {
                if (!hasClass(element, className)) {
                    element.className += (element.className ? ' ' : '') + className;
                }
            }
        }
        
        function removeClass(element, className) {
            if (!element || !className) return;
            
            if (compatibilityUtils && compatibilityUtils.removeClass) {
                compatibilityUtils.removeClass(element, className);
            } else {
                element.className = element.className.replace(
                    new RegExp('(^|\\s)' + className + '(\\s|$)', 'g'), ' '
                ).replace(/^\s+|\s+$/g, '');
            }
        }
        
        function toggleClass(element, className) {
            if (!element || !className) return;
            
            if (compatibilityUtils && compatibilityUtils.toggleClass) {
                compatibilityUtils.toggleClass(element, className);
            } else {
                if (hasClass(element, className)) {
                    removeClass(element, className);
                } else {
                    addClass(element, className);
                }
            }
        }
        
        // 🎯 属性操作
        function attr(element, name, value) {
            if (!element || !name) return null;
            
            if (typeof value !== 'undefined') {
                // 设置属性
                element.setAttribute(name, value);
                return element;
            } else {
                // 获取属性
                return element.getAttribute(name);
            }
        }
        
        function removeAttr(element, name) {
            if (element && name) {
                element.removeAttribute(name);
            }
        }
        
        function data(element, key, value) {
            if (!element || !key) return null;
            
            var dataKey = 'data-' + key;
            
            if (typeof value !== 'undefined') {
                // 设置数据
                if (element.dataset && compatibilityUtils.features.dataset) {
                    element.dataset[key] = value;
                } else {
                    element.setAttribute(dataKey, value);
                }
                return element;
            } else {
                // 获取数据
                if (element.dataset && compatibilityUtils.features.dataset) {
                    return element.dataset[key];
                } else {
                    return element.getAttribute(dataKey);
                }
            }
        }
        
        // 🎨 样式操作
        function css(element, property, value) {
            if (!element || !property) return null;
            
            if (typeof value !== 'undefined') {
                // 设置样式
                if (typeof property === 'object') {
                    // 批量设置
                    for (var prop in property) {
                        if (property.hasOwnProperty(prop)) {
                            element.style[prop] = property[prop];
                        }
                    }
                } else {
                    element.style[property] = value;
                }
                return element;
            } else {
                // 获取样式
                if (window.getComputedStyle) {
                    return window.getComputedStyle(element)[property];
                } else if (element.currentStyle) {
                    // IE降级
                    return element.currentStyle[property];
                } else {
                    return element.style[property];
                }
            }
        }
        
        function show(element) {
            if (element) {
                element.style.display = '';
                if (css(element, 'display') === 'none') {
                    element.style.display = 'block';
                }
            }
        }
        
        function hide(element) {
            if (element) {
                element.style.display = 'none';
            }
        }
        
        function toggle(element) {
            if (element) {
                if (css(element, 'display') === 'none') {
                    show(element);
                } else {
                    hide(element);
                }
            }
        }
        
        // 📐 尺寸和位置
        function offset(element) {
            if (!element) return { top: 0, left: 0 };
            
            var rect = element.getBoundingClientRect();
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
            
            return {
                top: rect.top + scrollTop,
                left: rect.left + scrollLeft
            };
        }
        
        function position(element) {
            if (!element) return { top: 0, left: 0 };
            
            return {
                top: element.offsetTop,
                left: element.offsetLeft
            };
        }
        
        function width(element, value) {
            if (!element) return 0;
            
            if (typeof value !== 'undefined') {
                element.style.width = typeof value === 'number' ? value + 'px' : value;
                return element;
            } else {
                return element.offsetWidth;
            }
        }
        
        function height(element, value) {
            if (!element) return 0;
            
            if (typeof value !== 'undefined') {
                element.style.height = typeof value === 'number' ? value + 'px' : value;
                return element;
            } else {
                return element.offsetHeight;
            }
        }
        
        function outerWidth(element, includeMargin) {
            if (!element) return 0;
            
            var w = element.offsetWidth;
            
            if (includeMargin) {
                var style = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;
                if (style) {
                    w += parseInt(style.marginLeft || 0, 10) + parseInt(style.marginRight || 0, 10);
                }
            }
            
            return w;
        }
        
        function outerHeight(element, includeMargin) {
            if (!element) return 0;
            
            var h = element.offsetHeight;
            
            if (includeMargin) {
                var style = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;
                if (style) {
                    h += parseInt(style.marginTop || 0, 10) + parseInt(style.marginBottom || 0, 10);
                }
            }
            
            return h;
        }
        
        // 🚀 DOM操作
        function createElement(tagName, attributes, content) {
            var element = document.createElement(tagName);
            
            if (attributes) {
                for (var attr in attributes) {
                    if (attributes.hasOwnProperty(attr)) {
                        if (attr === 'className') {
                            element.className = attributes[attr];
                        } else if (attr === 'style' && typeof attributes[attr] === 'object') {
                            css(element, attributes[attr]);
                        } else {
                            element.setAttribute(attr, attributes[attr]);
                        }
                    }
                }
            }
            
            if (content) {
                if (typeof content === 'string') {
                    element.innerHTML = content;
                } else if (content.nodeType) {
                    element.appendChild(content);
                } else if (Array.isArray(content)) {
                    content.forEach(function(child) {
                        if (typeof child === 'string') {
                            element.appendChild(document.createTextNode(child));
                        } else if (child.nodeType) {
                            element.appendChild(child);
                        }
                    });
                }
            }
            
            return element;
        }
        
        function append(parent, child) {
            if (parent && child) {
                if (typeof child === 'string') {
                    parent.innerHTML += child;
                } else if (child.nodeType) {
                    parent.appendChild(child);
                } else if (Array.isArray(child)) {
                    child.forEach(function(c) {
                        append(parent, c);
                    });
                }
            }
        }
        
        function prepend(parent, child) {
            if (parent && child) {
                if (typeof child === 'string') {
                    parent.innerHTML = child + parent.innerHTML;
                } else if (child.nodeType) {
                    parent.insertBefore(child, parent.firstChild);
                }
            }
        }
        
        function remove(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }
        
        function empty(element) {
            if (element) {
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
            }
        }
        
        function clone(element, deep) {
            if (element) {
                return element.cloneNode(deep !== false);
            }
            return null;
        }
        
        // 🎯 事件处理
        function on(element, eventType, handler, options) {
            if (!element || !eventType || !handler) return;
            
            // 支持多个事件类型
            if (eventType.indexOf(' ') > -1) {
                var events = eventType.split(' ');
                events.forEach(function(event) {
                    on(element, event.trim(), handler, options);
                });
                return;
            }
            
            // 支持事件委托
            if (options && options.delegate) {
                var originalHandler = handler;
                handler = function(e) {
                    var target = e.target || e.srcElement;
                    while (target && target !== element) {
                        if (matches(target, options.delegate)) {
                            originalHandler.call(target, e);
                            break;
                        }
                        target = target.parentNode;
                    }
                };
            }
            
            if (element.addEventListener) {
                var eventOptions = false;
                if (options && typeof options === 'object') {
                    if (compatibilityUtils && compatibilityUtils.features.passive && options.passive) {
                        eventOptions = { passive: true };
                    }
                }
                element.addEventListener(eventType, handler, eventOptions);
            } else if (element.attachEvent) {
                // IE降级
                element.attachEvent('on' + eventType, handler);
            }
        }
        
        function off(element, eventType, handler) {
            if (!element || !eventType) return;
            
            if (element.removeEventListener) {
                element.removeEventListener(eventType, handler);
            } else if (element.detachEvent) {
                // IE降级
                element.detachEvent('on' + eventType, handler);
            }
        }
        
        function trigger(element, eventType, data) {
            if (!element || !eventType) return;
            
            var event;
            
            if (document.createEvent) {
                event = document.createEvent('HTMLEvents');
                event.initEvent(eventType, true, true);
                if (data) {
                    event.detail = data;
                }
                element.dispatchEvent(event);
            } else if (document.createEventObject) {
                // IE降级
                event = document.createEventObject();
                if (data) {
                    event.detail = data;
                }
                element.fireEvent('on' + eventType, event);
            }
        }
        
        // 🔍 匹配和查找
        function matches(element, selector) {
            if (!element || !selector) return false;
            
            var matchesMethod = element.matches || 
                               element.webkitMatchesSelector || 
                               element.mozMatchesSelector || 
                               element.msMatchesSelector;
            
            if (matchesMethod) {
                return matchesMethod.call(element, selector);
            } else {
                // 降级实现
                var parent = element.parentNode || document;
                var nodes = parent.querySelectorAll ? 
                           parent.querySelectorAll(selector) : 
                           parent.getElementsByTagName(selector);
                
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i] === element) {
                        return true;
                    }
                }
                return false;
            }
        }
        
        function closest(element, selector) {
            if (!element || !selector) return null;
            
            if (element.closest) {
                return element.closest(selector);
            } else {
                // 降级实现
                while (element && element.nodeType === 1) {
                    if (matches(element, selector)) {
                        return element;
                    }
                    element = element.parentNode;
                }
                return null;
            }
        }
        
        function siblings(element) {
            if (!element || !element.parentNode) return [];
            
            var siblings = [];
            var sibling = element.parentNode.firstChild;
            
            while (sibling) {
                if (sibling.nodeType === 1 && sibling !== element) {
                    siblings.push(sibling);
                }
                sibling = sibling.nextSibling;
            }
            
            return siblings;
        }
        
        function next(element) {
            if (!element) return null;
            
            var nextSibling = element.nextSibling;
            while (nextSibling && nextSibling.nodeType !== 1) {
                nextSibling = nextSibling.nextSibling;
            }
            return nextSibling;
        }
        
        function prev(element) {
            if (!element) return null;
            
            var prevSibling = element.previousSibling;
            while (prevSibling && prevSibling.nodeType !== 1) {
                prevSibling = prevSibling.previousSibling;
            }
            return prevSibling;
        }
        
        function parent(element) {
            return element ? element.parentNode : null;
        }
        
        function children(element) {
            if (!element) return [];
            
            var children = [];
            var child = element.firstChild;
            
            while (child) {
                if (child.nodeType === 1) {
                    children.push(child);
                }
                child = child.nextSibling;
            }
            
            return children;
        }
        
        // 🎯 内容操作
        function text(element, content) {
            if (!element) return '';
            
            if (typeof content !== 'undefined') {
                // 设置文本
                if (element.textContent !== undefined) {
                    element.textContent = content;
                } else {
                    element.innerText = content; // IE降级
                }
                return element;
            } else {
                // 获取文本
                return element.textContent || element.innerText || '';
            }
        }
        
        function html(element, content) {
            if (!element) return '';
            
            if (typeof content !== 'undefined') {
                // 设置HTML
                element.innerHTML = content;
                return element;
            } else {
                // 获取HTML
                return element.innerHTML;
            }
        }
        
        function val(element, value) {
            if (!element) return '';
            
            if (typeof value !== 'undefined') {
                // 设置值
                element.value = value;
                return element;
            } else {
                // 获取值
                return element.value || '';
            }
        }
        
        // 🎯 动画辅助
        function fadeIn(element, duration, callback) {
            if (!element) return;
            
            duration = duration || 300;
            element.style.opacity = '0';
            element.style.display = 'block';
            
            var start = Date.now();
            var fade = function() {
                var elapsed = Date.now() - start;
                var progress = elapsed / duration;
                
                if (progress < 1) {
                    element.style.opacity = progress;
                    if (compatibilityUtils && compatibilityUtils.getRequestAnimationFrame) {
                        compatibilityUtils.getRequestAnimationFrame()(fade);
                    } else {
                        setTimeout(fade, 16);
                    }
                } else {
                    element.style.opacity = '1';
                    if (callback) callback();
                }
            };
            
            fade();
        }
        
        function fadeOut(element, duration, callback) {
            if (!element) return;
            
            duration = duration || 300;
            var start = Date.now();
            var initialOpacity = parseFloat(css(element, 'opacity')) || 1;
            
            var fade = function() {
                var elapsed = Date.now() - start;
                var progress = elapsed / duration;
                
                if (progress < 1) {
                    element.style.opacity = initialOpacity * (1 - progress);
                    if (compatibilityUtils && compatibilityUtils.getRequestAnimationFrame) {
                        compatibilityUtils.getRequestAnimationFrame()(fade);
                    } else {
                        setTimeout(fade, 16);
                    }
                } else {
                    element.style.opacity = '0';
                    element.style.display = 'none';
                    if (callback) callback();
                }
            };
            
            fade();
        }
        
        // 🎯 滚动操作
        function scrollTop(element, value) {
            if (!element) return 0;
            
            if (typeof value !== 'undefined') {
                element.scrollTop = value;
                return element;
            } else {
                return element.scrollTop;
            }
        }
        
        function scrollLeft(element, value) {
            if (!element) return 0;
            
            if (typeof value !== 'undefined') {
                element.scrollLeft = value;
                return element;
            } else {
                return element.scrollLeft;
            }
        }
        
        function scrollIntoView(element, options) {
            if (!element) return;
            
            if (element.scrollIntoView) {
                if (typeof options === 'object') {
                    element.scrollIntoView(options);
                } else {
                    element.scrollIntoView(options !== false);
                }
            } else {
                // 降级实现
                var elementTop = offset(element).top;
                var elementHeight = height(element);
                var windowHeight = window.innerHeight || document.documentElement.clientHeight;
                var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                if (elementTop < scrollTop || elementTop + elementHeight > scrollTop + windowHeight) {
                    window.scrollTo(0, elementTop - (windowHeight - elementHeight) / 2);
                }
            }
        }
        
        // 🎯 工具函数
        function isElement(obj) {
            return obj && obj.nodeType === 1;
        }
        
        function isVisible(element) {
            if (!element) return false;
            
            return element.offsetWidth > 0 && 
                   element.offsetHeight > 0 && 
                   css(element, 'display') !== 'none' && 
                   css(element, 'visibility') !== 'hidden';
        }
        
        function contains(parent, child) {
            if (!parent || !child) return false;
            
            if (parent.contains) {
                return parent.contains(child);
            } else {
                // 降级实现
                while (child) {
                    if (child === parent) {
                        return true;
                    }
                    child = child.parentNode;
                }
                return false;
            }
        }
        
        // 返回公开API
        return {
            // 选择器
            $: $,
            $$: $$,
            
            // CSS类操作
            hasClass: hasClass,
            addClass: addClass,
            removeClass: removeClass,
            toggleClass: toggleClass,
            
            // 属性操作
            attr: attr,
            removeAttr: removeAttr,
            data: data,
            
            // 样式操作
            css: css,
            show: show,
            hide: hide,
            toggle: toggle,
            
            // 尺寸和位置
            offset: offset,
            position: position,
            width: width,
            height: height,
            outerWidth: outerWidth,
            outerHeight: outerHeight,
            
            // DOM操作
            createElement: createElement,
            append: append,
            prepend: prepend,
            remove: remove,
            empty: empty,
            clone: clone,
            
            // 事件处理
            on: on,
            off: off,
            trigger: trigger,
            
            // 匹配和查找
            matches: matches,
            closest: closest,
            siblings: siblings,
            next: next,
            prev: prev,
            parent: parent,
            children: children,
            
            // 内容操作
            text: text,
            html: html,
            val: val,
            
            // 动画
            fadeIn: fadeIn,
            fadeOut: fadeOut,
            
            // 滚动
            scrollTop: scrollTop,
            scrollLeft: scrollLeft,
            scrollIntoView: scrollIntoView,
            
            // 工具
            isElement: isElement,
            isVisible: isVisible,
            contains: contains
        };
    }
    
    // 创建全局实例
    var domUtils = new DOMUtils();
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = domUtils;
    } else if (typeof global !== 'undefined') {
        global.DOMUtils = domUtils;
        
        // 添加到EnglishSite命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.DOMUtils = domUtils;
    }
    
})(typeof window !== 'undefined' ? window : this);