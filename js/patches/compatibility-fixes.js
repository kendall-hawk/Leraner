// js/patches/compatibility-patches.js - 兼容性补丁
// 🚀 修复特定API兼容性问题

(function(global) {
    'use strict';

    /**
     * 🎯 CompatibilityPatches - 兼容性补丁集合
     * 修复：CSS.supports、URL构造函数、其他API问题
     */
    
    // 🔧 安全的CSS.supports检测
    function safeCSSSupports(property, value) {
        if (window.CSS && typeof CSS.supports === 'function') {
            try {
                return CSS.supports(property, value);
            } catch (e) {
                // CSS.supports调用失败，降级检测
                console.warn('[CompatibilityPatch] CSS.supports failed, using fallback');
            }
        }
        
        // 降级方案：创建测试元素
        try {
            var testElement = document.createElement('div');
            var originalValue = testElement.style[property];
            testElement.style[property] = value;
            var supported = testElement.style[property] !== originalValue && testElement.style[property] !== '';
            return supported;
        } catch (e) {
            console.warn('[CompatibilityPatch] CSS fallback detection failed for:', property, value);
            return false;
        }
    }
    
    // 🔧 安全的URL解析
    function safeURLParse(url) {
        // 优先使用原生URL构造函数
        if (typeof URL !== 'undefined') {
            try {
                return new URL(url);
            } catch (e) {
                // URL构造函数失败，使用降级方案
                console.warn('[CompatibilityPatch] URL constructor failed, using fallback for:', url);
            }
        }
        
        // 降级方案：使用anchor元素
        try {
            var anchor = document.createElement('a');
            anchor.href = url;
            
            // 构造类似URL对象的结构
            return {
                href: anchor.href,
                protocol: anchor.protocol,
                hostname: anchor.hostname,
                port: anchor.port,
                pathname: anchor.pathname,
                search: anchor.search,
                hash: anchor.hash,
                host: anchor.host,
                origin: anchor.protocol + '//' + anchor.host,
                toString: function() { return anchor.href; }
            };
        } catch (e) {
            console.error('[CompatibilityPatch] URL fallback failed for:', url, e);
            return {
                href: url,
                hostname: 'unknown',
                protocol: '',
                port: '',
                pathname: '',
                search: '',
                hash: '',
                host: 'unknown',
                origin: 'unknown',
                toString: function() { return url; }
            };
        }
    }
    
    // 🔧 安全的域名提取
    function extractHostname(url) {
        try {
            var urlObj = safeURLParse(url);
            return urlObj.hostname || 'unknown';
        } catch (e) {
            console.warn('[CompatibilityPatch] Hostname extraction failed for:', url);
            return 'unknown';
        }
    }
    
    // 🔧 修复mobile-utils.js中的CSS检测
    function patchMobileUtilsCSSDetection() {
        // 确保在mobile-utils加载后进行补丁
        if (global.EnglishSite && global.EnglishSite.MobileUtils) {
            var mobileUtils = global.EnglishSite.MobileUtils;
            
            // 如果MobileUtils有CSS检测方法，进行增强
            if (mobileUtils.device && typeof mobileUtils.device === 'object') {
                // 重新检测hasNotch，使用更安全的方法
                try {
                    mobileUtils.device.hasNotch = safeCSSSupports('padding', 'max(0px)') && 
                                                 safeCSSSupports('padding', 'env(safe-area-inset-top)');
                } catch (e) {
                    mobileUtils.device.hasNotch = false;
                }
            }
        }
    }
    
    // 🔧 修复performance.js中的URL使用
    function patchPerformanceURLUsage() {
        // 如果PerformanceUtils已存在，增强其URL处理能力
        if (global.EnglishSite && global.EnglishSite.PerformanceUtils) {
            // 为PerformanceUtils添加安全的域名提取方法
            global.EnglishSite.PerformanceUtils.safeExtractHostname = extractHostname;
        }
    }
    
    // 🔧 增强的send beacon方法
    function enhancedSendBeacon(url, data) {
        // 首先尝试原生sendBeacon
        if (navigator.sendBeacon) {
            try {
                return navigator.sendBeacon(url, data);
            } catch (e) {
                console.warn('[CompatibilityPatch] sendBeacon failed, trying fetch fallback');
            }
        }
        
        // 降级1：使用fetch with keepalive
        if (typeof fetch !== 'undefined') {
            try {
                fetch(url, {
                    method: 'POST',
                    body: data,
                    keepalive: true,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).catch(function(error) {
                    console.warn('[CompatibilityPatch] Fetch keepalive failed:', error);
                });
                return true;
            } catch (e) {
                console.warn('[CompatibilityPatch] Fetch fallback failed, trying XHR');
            }
        }
        
        // 降级2：同步XHR（最后手段）
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
            return xhr.status >= 200 && xhr.status < 300;
        } catch (e) {
            console.error('[CompatibilityPatch] All beacon methods failed:', e);
            return false;
        }
    }
    
    // 🔧 为error-boundary.js提供增强的发送方法
    function patchErrorBoundarySending() {
        // 等待ErrorBoundary加载
        if (global.EnglishSite && global.EnglishSite.ErrorBoundary) {
            // 为ErrorBoundary添加增强的发送方法
            var ErrorBoundaryPrototype = global.EnglishSite.ErrorBoundary.prototype;
            if (ErrorBoundaryPrototype) {
                ErrorBoundaryPrototype.enhancedSendBeacon = enhancedSendBeacon;
            }
        }
    }
    
    // 🔧 修复Array.prototype.slice.call的现代化
    function createSafeArrayFrom(arrayLike) {
        if (Array.from && !Array.from._isPolyfill) {
            return Array.from(arrayLike);
        } else {
            // 降级到slice方法
            try {
                return Array.prototype.slice.call(arrayLike);
            } catch (e) {
                // 最后的降级方案
                var result = [];
                for (var i = 0; i < arrayLike.length; i++) {
                    result.push(arrayLike[i]);
                }
                return result;
            }
        }
    }
    
    // 🔧 修复字符串repeat方法（某些polyfill可能需要）
    if (!String.prototype.repeat) {
        String.prototype.repeat = function(count) {
            if (count < 0 || count === Infinity) {
                throw new RangeError('Invalid count value');
            }
            count = Math.floor(count);
            var result = '';
            for (var i = 0; i < count; i++) {
                result += this;
            }
            return result;
        };
    }
    
    // 🔧 修复数组find方法（iOS 12可能需要）
    if (!Array.prototype.find) {
        Array.prototype.find = function(predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var thisArg = arguments[1];
            var O = Object(this);
            var len = parseInt(O.length) || 0;
            for (var i = 0; i < len; i++) {
                if (i in O) {
                    var element = O[i];
                    if (predicate.call(thisArg, element, i, O)) {
                        return element;
                    }
                }
            }
            return undefined;
        };
    }
    
    // 🎯 统一的补丁应用函数
    function applyCompatibilityPatches() {
        try {
            // 应用各种补丁
            patchMobileUtilsCSSDetection();
            patchPerformanceURLUsage();
            patchErrorBoundarySending();
            
            console.log('[CompatibilityPatch] All patches applied successfully');
            return true;
        } catch (error) {
            console.error('[CompatibilityPatch] Failed to apply patches:', error);
            return false;
        }
    }
    
    // 🎯 延迟应用补丁（等待其他模块加载）
    function delayedPatchApplication() {
        // 立即应用基础补丁
        applyCompatibilityPatches();
        
        // 延迟应用需要等待其他模块的补丁
        setTimeout(function() {
            applyCompatibilityPatches();
        }, 1000);
        
        // 在DOM加载完成后再次应用
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(applyCompatibilityPatches, 500);
            });
        }
    }
    
    // 🔗 导出API
    var CompatibilityPatches = {
        safeCSSSupports: safeCSSSupports,
        safeURLParse: safeURLParse,
        extractHostname: extractHostname,
        enhancedSendBeacon: enhancedSendBeacon,
        createSafeArrayFrom: createSafeArrayFrom,
        applyPatches: applyCompatibilityPatches,
        applyDelayed: delayedPatchApplication
    };
    
    // 导出到全局
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CompatibilityPatches;
    } else if (typeof global !== 'undefined') {
        global.CompatibilityPatches = CompatibilityPatches;
        
        // 添加到EnglishSite命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.CompatibilityPatches = CompatibilityPatches;
        
        // 立即开始应用补丁
        delayedPatchApplication();
    }
    
})(typeof window !== 'undefined' ? window : this);