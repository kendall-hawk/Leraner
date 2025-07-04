// js/patches/compatibility-fixes.js - 兼容性修复补丁集合
// 🚀 修复iOS Safari 12+兼容性问题

(function(global) {
    'use strict';

    /**
     * 🎯 CompatibilityFixes - 兼容性修复补丁
     * 功能：修复发现的所有兼容性问题
     * 优先级：高优先级问题的完整修复方案
     */

    // ============================================================================
    // 🔴 高优先级修复
    // ============================================================================

    // 1. Object.assign Polyfill
    if (!Object.assign) {
        Object.assign = function(target) {
            if (target == null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            
            var to = Object(target);
            
            for (var index = 1; index < arguments.length; index++) {
                var nextSource = arguments[index];
                
                if (nextSource != null) {
                    for (var nextKey in nextSource) {
                        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            
            return to;
        };
    }

    // 2. Array.from Polyfill
    if (!Array.from) {
        Array.from = function(arrayLike, mapFn, thisArg) {
            if (arrayLike == null) {
                throw new TypeError('Array.from requires an array-like object');
            }
            
            var items = Object(arrayLike);
            var len = parseInt(items.length) || 0;
            var result = [];
            var k = 0;
            
            while (k < len) {
                var kValue = items[k];
                if (mapFn) {
                    result[k] = mapFn.call(thisArg, kValue, k);
                } else {
                    result[k] = kValue;
                }
                k++;
            }
            
            return result;
        };
    }

    // 3. URL 构造函数兼容性修复
    function createURLParser() {
        if (typeof URL !== 'undefined') {
            return function(url) {
                try {
                    return new URL(url);
                } catch (e) {
                    return parseURLFallback(url);
                }
            };
        } else {
            return parseURLFallback;
        }
    }

    function parseURLFallback(url) {
        var a = document.createElement('a');
        a.href = url;
        
        return {
            href: a.href,
            protocol: a.protocol,
            hostname: a.hostname,
            port: a.port,
            pathname: a.pathname,
            search: a.search,
            hash: a.hash,
            host: a.host,
            origin: a.protocol + '//' + a.host
        };
    }

    var parseURL = createURLParser();

    // 4. navigator.sendBeacon 增强降级
    function enhancedSendBeacon(url, data) {
        // 优先使用原生 sendBeacon
        if (navigator.sendBeacon) {
            try {
                return navigator.sendBeacon(url, data);
            } catch (e) {
                // 原生方法失败，降级
            }
        }
        
        // 降级策略1: 使用 fetch with keepalive
        if (typeof fetch !== 'undefined') {
            try {
                fetch(url, {
                    method: 'POST',
                    body: data,
                    keepalive: true,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                return true;
            } catch (e) {
                // fetch 失败，继续降级
            }
        }
        
        // 降级策略2: 同步 XMLHttpRequest (最后手段)
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
            return xhr.status >= 200 && xhr.status < 300;
        } catch (e) {
            console.warn('[CompatibilityFix] All beacon methods failed:', e);
            return false;
        }
    }

    // 5. CSS.supports 安全检测
    function safeCSSSupports(property, value) {
        if (window.CSS && CSS.supports) {
            try {
                return CSS.supports(property, value);
            } catch (e) {
                // CSS.supports 抛出异常，降级
            }
        }
        
        // 降级方案：创建测试元素
        try {
            var element = document.createElement('div');
            var originalValue = element.style[property];
            element.style[property] = value;
            var supported = element.style[property] !== originalValue;
            return supported;
        } catch (e) {
            return false;
        }
    }

    // ============================================================================
    // 🟡 中等优先级修复
    // ============================================================================

    // 6. 增强的 Passive 事件监听器检测
    function createPassiveDetector() {
        var passiveSupported = false;
        var testOptions = null;
        
        try {
            testOptions = Object.defineProperty({}, 'passive', {
                get: function() {
                    passiveSupported = true;
                    return false;
                }
            });
            
            // 测试 passive 支持
            window.addEventListener('test-passive', null, testOptions);
            window.removeEventListener('test-passive', null, testOptions);
        } catch (e) {
            passiveSupported = false;
        }
        
        return {
            supported: passiveSupported,
            getOptions: function(options) {
                if (!passiveSupported) {
                    return false;
                }
                
                if (typeof options === 'boolean') {
                    return options;
                }
                
                return options || { passive: true };
            }
        };
    }

    var passiveDetector = createPassiveDetector();

    // 7. IntersectionObserver Polyfill (简化版)
    if (typeof IntersectionObserver === 'undefined') {
        global.IntersectionObserver = function(callback, options) {
            this.callback = callback;
            this.options = options || {};
            this.elements = [];
            this.running = false;
        };

        global.IntersectionObserver.prototype.observe = function(element) {
            if (this.elements.indexOf(element) === -1) {
                this.elements.push(element);
                this.startPolling();
            }
        };

        global.IntersectionObserver.prototype.unobserve = function(element) {
            var index = this.elements.indexOf(element);
            if (index > -1) {
                this.elements.splice(index, 1);
            }
            
            if (this.elements.length === 0) {
                this.stopPolling();
            }
        };

        global.IntersectionObserver.prototype.startPolling = function() {
            if (this.running) return;
            
            this.running = true;
            var self = this;
            
            function poll() {
                if (!self.running) return;
                
                var entries = [];
                self.elements.forEach(function(element) {
                    var rect = element.getBoundingClientRect();
                    var isIntersecting = rect.top < window.innerHeight && 
                                       rect.bottom > 0 && 
                                       rect.left < window.innerWidth && 
                                       rect.right > 0;
                    
                    entries.push({
                        target: element,
                        isIntersecting: isIntersecting,
                        boundingClientRect: rect,
                        intersectionRatio: isIntersecting ? 1 : 0
                    });
                });
                
                if (entries.length > 0) {
                    self.callback(entries);
                }
                
                setTimeout(poll, 100); // 100ms polling
            }
            
            poll();
        };

        global.IntersectionObserver.prototype.stopPolling = function() {
            this.running = false;
        };
    }

    // ============================================================================
    // 🎯 iOS 特殊修复
    // ============================================================================

    // 8. iOS 视口高度修复增强版
    function enhancedIOSViewportFix() {
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!isIOS) return;

        var lastHeight = window.innerHeight;
        var viewportHeight = window.innerHeight;
        var keyboardThreshold = 150; // 键盘高度阈值

        function updateViewportHeight(force) {
            var currentHeight = window.innerHeight;
            var heightDiff = Math.abs(currentHeight - lastHeight);
            
            // 只在显著变化时更新，避免频繁重绘
            if (force || heightDiff > 50) {
                // 检测是否是键盘弹起
                var isKeyboard = currentHeight < viewportHeight - keyboardThreshold;
                
                if (!isKeyboard) {
                    viewportHeight = currentHeight;
                }
                
                var vh = viewportHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
                document.documentElement.style.setProperty('--current-vh', (currentHeight * 0.01) + 'px');
                
                lastHeight = currentHeight;
            }
        }

        // 初始设置
        updateViewportHeight(true);

        // 监听多种事件
        var events = ['resize', 'orientationchange'];
        events.forEach(function(event) {
            window.addEventListener(event, function() {
                // 延迟执行，等待浏览器完成布局更新
                setTimeout(function() {
                    updateViewportHeight();
                }, 100);
            });
        });

        // Visual Viewport API (现代浏览器)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', function() {
                updateViewportHeight();
            });
        }

        // 处理页面显示/隐藏
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                setTimeout(function() {
                    updateViewportHeight(true);
                }, 300);
            }
        });
    }

    // 9. iOS 滚动优化
    function optimizeIOSScrolling() {
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!isIOS) return;

        // 启用硬件加速的惯性滚动
        var scrollContainers = document.querySelectorAll('[data-scroll]');
        for (var i = 0; i < scrollContainers.length; i++) {
            var container = scrollContainers[i];
            container.style.webkitOverflowScrolling = 'touch';
            container.style.overflowScrolling = 'touch';
        }

        // 防止橡皮筋效果
        var startY = 0;
        
        document.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                startY = e.touches[0].pageY;
            }
        }, passiveDetector.getOptions({ passive: true }));

        document.addEventListener('touchmove', function(e) {
            if (e.touches.length === 1) {
                var y = e.touches[0].pageY;
                var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                var scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                var clientHeight = document.documentElement.clientHeight || window.innerHeight;

                // 防止顶部和底部过度滚动
                if ((scrollTop <= 0 && y > startY) || 
                    (scrollTop + clientHeight >= scrollHeight && y < startY)) {
                    e.preventDefault();
                }
            }
        }, passiveDetector.getOptions({ passive: false }));
    }

    // 10. iOS 输入缩放防护增强
    function preventIOSInputZoom() {
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!isIOS) return;

        // 确保所有输入字段字体大小 >= 16px
        function fixInputFontSize() {
            var inputs = document.querySelectorAll('input, textarea, select');
            for (var i = 0; i < inputs.length; i++) {
                var input = inputs[i];
                var computedStyle = window.getComputedStyle(input);
                var fontSize = parseFloat(computedStyle.fontSize);
                
                if (fontSize < 16) {
                    input.style.fontSize = '16px';
                }
            }
        }

        // 初始修复
        fixInputFontSize();

        // 监听DOM变化
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        fixInputFontSize();
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // 防止双击缩放
        var lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            var now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    // ============================================================================
    // 🛠️ 工具函数修复
    // ============================================================================

    // 11. 安全的 JSON 操作
    function safeJSONParse(str, fallback) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('[CompatibilityFix] JSON parse failed:', e);
            return fallback || null;
        }
    }

    function safeJSONStringify(obj, fallback) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            console.warn('[CompatibilityFix] JSON stringify failed:', e);
            return fallback || '{}';
        }
    }

    // 12. 增强的事件监听器
    function addEventListenerSafe(element, event, handler, options) {
        if (!element || !event || !handler) return null;

        var actualOptions = passiveDetector.getOptions(options);
        
        try {
            element.addEventListener(event, handler, actualOptions);
            
            return function removeListener() {
                try {
                    element.removeEventListener(event, handler, actualOptions);
                } catch (e) {
                    console.warn('[CompatibilityFix] Remove event listener failed:', e);
                }
            };
        } catch (e) {
            console.warn('[CompatibilityFix] Add event listener failed:', e);
            return function() {}; // 空函数，避免调用时出错
        }
    }

    // 13. 安全的 requestAnimationFrame
    function createSafeRAF() {
        var raf = window.requestAnimationFrame || 
                 window.webkitRequestAnimationFrame || 
                 window.mozRequestAnimationFrame || 
                 window.oRequestAnimationFrame || 
                 window.msRequestAnimationFrame;

        var caf = window.cancelAnimationFrame || 
                 window.webkitCancelAnimationFrame || 
                 window.mozCancelAnimationFrame || 
                 window.oCancelAnimationFrame || 
                 window.msCancelAnimationFrame;

        if (!raf) {
            var lastTime = 0;
            raf = function(callback) {
                var currentTime = Date.now();
                var timeToCall = Math.max(0, 16 - (currentTime - lastTime));
                var id = setTimeout(function() {
                    callback(currentTime + timeToCall);
                }, timeToCall);
                lastTime = currentTime + timeToCall;
                return id;
            };
        }

        if (!caf) {
            caf = function(id) {
                clearTimeout(id);
            };
        }

        return {
            request: raf,
            cancel: caf
        };
    }

    var safeRAF = createSafeRAF();

    // ============================================================================
    // 🚀 统一导出和初始化
    // ============================================================================

    var CompatibilityFixes = {
        // Polyfills
        objectAssign: Object.assign,
        arrayFrom: Array.from,
        
        // URL 处理
        parseURL: parseURL,
        
        // 网络
        sendBeacon: enhancedSendBeacon,
        
        // CSS
        cssSupports: safeCSSSupports,
        
        // 事件
        passiveDetector: passiveDetector,
        addEventListenerSafe: addEventListenerSafe,
        
        // 动画
        requestAnimationFrame: safeRAF.request,
        cancelAnimationFrame: safeRAF.cancel,
        
        // JSON
        safeJSONParse: safeJSONParse,
        safeJSONStringify: safeJSONStringify,
        
        // iOS 修复
        enhancedIOSViewportFix: enhancedIOSViewportFix,
        optimizeIOSScrolling: optimizeIOSScrolling,
        preventIOSInputZoom: preventIOSInputZoom,
        
        // 初始化所有修复
        applyAll: function() {
            enhancedIOSViewportFix();
            optimizeIOSScrolling();
            preventIOSInputZoom();
            
            // 添加全局CSS类标识兼容性状态
            var classes = [];
            if (!Object.assign.isPolyfill) classes.push('has-object-assign');
            if (!Array.from.isPolyfill) classes.push('has-array-from');
            if (passiveDetector.supported) classes.push('has-passive-events');
            if (window.CSS && CSS.supports) classes.push('has-css-supports');
            
            document.documentElement.className += ' ' + classes.join(' ');
            
            console.log('[CompatibilityFixes] All fixes applied successfully');
        }
    };

    // 自动标记 polyfill
    if (Object.assign.toString().indexOf('[native code]') === -1) {
        Object.assign.isPolyfill = true;
    }
    
    if (Array.from.toString().indexOf('[native code]') === -1) {
        Array.from.isPolyfill = true;
    }

    // 导出到全局
    global.CompatibilityFixes = CompatibilityFixes;
    
    // 添加到 EnglishSite 命名空间
    if (global.EnglishSite) {
        global.EnglishSite.CompatibilityFixes = CompatibilityFixes;
    }

    // DOM ready 后自动应用修复
    function applyFixesWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                CompatibilityFixes.applyAll();
            });
        } else {
            CompatibilityFixes.applyAll();
        }
    }

    applyFixesWhenReady();

})(typeof window !== 'undefined' ? window : this);
