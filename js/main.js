// js/main.js - iOS兼容版应用入口
// 🚀 统一初始化和启动，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    // ⚡ 关键Polyfills - 在所有代码之前执行
    // Object.assign Polyfill for iOS Safari 12
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
        
        // 标记为polyfill
        Object.assign._isPolyfill = true;
    }

    // Array.from Polyfill (如果需要)
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
        
        Array.from._isPolyfill = true;
    }

    /**
     * 🎯 应用启动器 - Mobile-First Architecture
     * 功能：系统初始化、模块集成、用户体验优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    
    // 全局配置
    var APP_CONFIG = {
        name: 'LearnerEn',
        version: '2.0.0',
        debug: false, // 生产环境设为false
        features: {
            navigation: true,
            audioSync: true,
            glossary: true,
            wordFrequency: true,
            analytics: false
        }
    };
    
    // DOM就绪检测
    var isReady = false;
    var readyCallbacks = [];
    
    function checkReady() {
        if (document.readyState === 'loading') {
            return false;
        }
        return true;
    }
    
    function onReady(callback) {
        if (isReady || checkReady()) {
            callback();
        } else {
            readyCallbacks.push(callback);
        }
    }
    
    function fireReady() {
        isReady = true;
        readyCallbacks.forEach(function(callback) {
            try {
                callback();
            } catch (error) {
                console.error('[Main] Ready callback error:', error);
            }
        });
        readyCallbacks = [];
    }
    
    // 监听DOM就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fireReady);
    } else {
        setTimeout(fireReady, 0);
    }

    /**
     * 🎯 应用初始化器
     */
    function AppInitializer() {
        var appController = null;
        var startTime = Date.now();
        var initPromises = [];
        
        // 兼容性检查
        function checkCompatibility() {
            var issues = [];
            
            // 检查基本JS支持
            if (typeof Array.prototype.forEach === 'undefined') {
                issues.push('Array.forEach not supported');
            }
            
            if (typeof JSON === 'undefined') {
                issues.push('JSON not supported');
            }
            
            // 检查DOM API
            if (typeof document.querySelector === 'undefined') {
                issues.push('querySelector not supported');
            }
            
            if (issues.length > 0) {
                showCompatibilityError(issues);
                return false;
            }
            
            // 验证polyfill是否生效
            try {
                var testAssign = Object.assign({}, { test: 1 }, { test: 2 });
                if (testAssign.test !== 2) {
                    issues.push('Object.assign polyfill failed');
                }
            } catch (e) {
                issues.push('Object.assign polyfill failed: ' + e.message);
            }
            
            if (issues.length > 0) {
                showCompatibilityError(issues);
                return false;
            }
            
            return true;
        }
        
        function showCompatibilityError(issues) {
            var errorHtml = [
                '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; margin: 20px; border-radius: 4px;">',
                '<h3>浏览器兼容性问题</h3>',
                '<p>您的浏览器版本过低，请升级到以下版本：</p>',
                '<ul>',
                '<li>iOS Safari 12.0+</li>',
                '<li>Android Chrome 80+</li>',
                '<li>Firefox 80+</li>',
                '</ul>',
                '<p>检测到的问题：' + issues.join(', ') + '</p>',
                '</div>'
            ].join('');
            
            document.body.innerHTML = errorHtml;
        }
        
        // 初始化应用配置
        function initializeConfig() {
            try {
                // 从URL参数读取配置
                var urlParams = getUrlParams();
                if (urlParams.debug === 'true') {
                    APP_CONFIG.debug = true;
                }
                
                // 从localStorage读取用户配置 - 使用兼容的方式
                var userConfig = getUserConfig();
                if (userConfig) {
                    // 使用我们的polyfill
                    Object.assign(APP_CONFIG, userConfig);
                }
                
                // 设置全局配置
                global.LEARNER_CONFIG = APP_CONFIG;
                
                return true;
            } catch (error) {
                console.error('[Main] Config initialization failed:', error);
                return false;
            }
        }
        
        // 其余代码保持不变...
        // (preloadResources, initializeAppController等函数保持原样)
        
        function preloadResources() {
            var resources = [
                { type: 'data', url: 'data/navigation.json', critical: true },
                { type: 'data', url: 'data/terms/common.json', critical: false }
            ];
            
            resources.forEach(function(resource) {
                if (resource.critical) {
                    // 关键资源立即加载
                    loadResource(resource);
                } else {
                    // 非关键资源延迟加载
                    setTimeout(function() {
                        loadResource(resource);
                    }, 1000);
                }
            });
        }
        
        function loadResource(resource) {
            if (resource.type === 'data') {
                loadDataResource(resource.url);
            }
        }
        
        function loadDataResource(url) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            cacheResource(url, data);
                        } catch (parseError) {
                            console.warn('[Main] Resource parse failed:', url, parseError);
                        }
                    }
                };
                xhr.send();
            } catch (error) {
                console.warn('[Main] Resource load failed:', url, error);
            }
        }
        
        function cacheResource(url, data) {
            if (global.EnglishSite && global.EnglishSite.CacheManager) {
                try {
                    var cache = new global.EnglishSite.CacheManager();
                    cache.set('preload:' + url, data, { ttl: 24 * 60 * 60 * 1000 });
                } catch (error) {
                    console.warn('[Main] Resource cache failed:', error);
                }
            }
        }
        
        // 初始化应用控制器
        function initializeAppController() {
            try {
                if (!global.EnglishSite || !global.EnglishSite.AppController) {
                    throw new Error('AppController not available');
                }
                
                appController = new global.EnglishSite.AppController({
                    name: APP_CONFIG.name,
                    version: APP_CONFIG.version,
                    debug: APP_CONFIG.debug,
                    autoStart: false // 手动控制启动
                });
                
                return true;
            } catch (error) {
                console.error('[Main] AppController initialization failed:', error);
                showFallbackInterface();
                return false;
            }
        }
        
        // 配置模块选项
        function getModuleConfigs() {
            return {
                navigation: {
                    container: 'nav-container',
                    breakpoint: 768,
                    enableTouch: true,
                    dataUrl: 'data/navigation.json'
                },
                audioSync: {
                    contentArea: 'content-area',
                    audioPlayer: 'audio-player',
                    srtText: '', // 动态加载
                    enableTouch: true,
                    enableKeyboard: true
                },
                glossary: {
                    container: 'content-area',
                    triggerEvent: 'click',
                    enableTouch: true,
                    enableAudio: true,
                    dataUrl: 'data/terms/common.json'
                }
            };
        }
        
        // 启动应用
        function startApplication() {
            try {
                if (!appController) {
                    throw new Error('AppController not initialized');
                }
                
                var moduleConfigs = getModuleConfigs();
                
                appController.start({
                    modules: moduleConfigs
                });
                
                // 设置应用事件处理
                setupApplicationEvents();
                
                // 性能监控
                monitorPerformance();
                
                return true;
            } catch (error) {
                console.error('[Main] Application start failed:', error);
                return false;
            }
        }
        
        // 其余函数保持不变...
        // (setupApplicationEvents, handleApplicationError等)
        
        function setupApplicationEvents() {
            if (!appController) return;
            
            var eventHub = appController.getModule('EventHub');
            if (!eventHub) return;
            
            // 全局错误处理
            eventHub.on('app:error', function(errorInfo) {
                if (APP_CONFIG.debug) {
                    console.error('[App Error]', errorInfo);
                }
                handleApplicationError(errorInfo);
            });
            
            // 应用状态变化
            eventHub.on('app:started', function(data) {
                hideLoadingScreen();
                console.log('[Main] Application started in', data.loadTime + 'ms');
            });
            
            // 模块错误处理
            eventHub.on('*:error', function(data) {
                handleModuleError(data);
            });
            
            // 性能警告
            eventHub.on('app:performanceWarning', function(data) {
                if (APP_CONFIG.debug) {
                    console.warn('[Performance Warning]', data);
                }
            });
        }
        
        // 错误处理
        function handleApplicationError(errorInfo) {
            // 收集错误信息
            var errorData = {
                message: errorInfo.message,
                context: errorInfo.context,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            // 用户友好的错误提示
            if (errorInfo.severity === 'critical') {
                showErrorDialog('系统遇到问题，正在尝试恢复...');
                
                // 尝试自动恢复
                setTimeout(function() {
                    if (appController && appController.recover) {
                        appController.recover();
                    }
                }, 2000);
            }
        }
        
        function handleModuleError(data) {
            if (APP_CONFIG.debug) {
                console.warn('[Module Error]', data.context, data.message);
            }
            
            // 模块级降级处理
            var module = data.context.split(':')[0];
            disableModule(module);
        }
        
        function disableModule(moduleName) {
            APP_CONFIG.features[moduleName] = false;
            showModuleDisabledNotice(moduleName);
        }
        
        function showModuleDisabledNotice(moduleName) {
            var notice = document.createElement('div');
            notice.className = 'module-disabled-notice';
            notice.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #ffa; padding: 10px; border-radius: 4px; z-index: 10000;';
            notice.textContent = moduleName + ' 功能暂时不可用';
            document.body.appendChild(notice);
            
            setTimeout(function() {
                if (notice.parentNode) {
                    notice.parentNode.removeChild(notice);
                }
            }, 5000);
        }
        
        // 性能监控
        function monitorPerformance() {
            var perfData = {
                startTime: startTime,
                loadTime: Date.now() - startTime
            };
            
            // 内存使用监控（如果支持）
            if (performance && performance.memory) {
                perfData.memoryUsed = performance.memory.usedJSHeapSize;
                perfData.memoryLimit = performance.memory.jsHeapSizeLimit;
            }
            
            // 性能警告
            if (perfData.loadTime > 5000) {
                console.warn('[Performance] Slow startup:', perfData.loadTime + 'ms');
            }
            
            if (APP_CONFIG.debug) {
                console.log('[Performance]', perfData);
            }
        }
        
        // 降级界面
        function showFallbackInterface() {
            var fallbackHtml = [
                '<div style="padding: 20px; font-family: -apple-system, sans-serif;">',
                '<h2>LearnerEn</h2>',
                '<p>应用正在加载中，如果长时间未响应，请刷新页面。</p>',
                '<div style="margin-top: 20px;">',
                '<button onclick="location.reload()" style="padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 4px;">',
                '刷新页面',
                '</button>',
                '</div>',
                '</div>'
            ].join('');
            
            var container = document.getElementById('app-container') || document.body;
            container.innerHTML = fallbackHtml;
        }
        
        // 工具函数
        function getUrlParams() {
            var params = {};
            var search = window.location.search.slice(1);
            if (search) {
                search.split('&').forEach(function(pair) {
                    var parts = pair.split('=');
                    params[parts[0]] = decodeURIComponent(parts[1] || '');
                });
            }
            return params;
        }
        
        function getUserConfig() {
            try {
                var stored = localStorage.getItem('learner_config');
                return stored ? JSON.parse(stored) : null;
            } catch (error) {
                return null;
            }
        }
        
        function showErrorDialog(message) {
            alert(message); // 简单降级实现
        }
        
        function hideLoadingScreen() {
            var loader = document.getElementById('loading-screen');
            if (loader) {
                loader.style.display = 'none';
            }
        }
        
        // 公开API
        this.initialize = function() {
            try {
                // 兼容性检查
                if (!checkCompatibility()) {
                    return false;
                }
                
                // 初始化配置
                if (!initializeConfig()) {
                    return false;
                }
                
                // 预加载资源
                preloadResources();
                
                // 初始化应用控制器
                if (!initializeAppController()) {
                    return false;
                }
                
                // 启动应用
                if (!startApplication()) {
                    return false;
                }
                
                return true;
            } catch (error) {
                console.error('[Main] Initialization failed:', error);
                showFallbackInterface();
                return false;
            }
        };
        
        this.getAppController = function() {
            return appController;
        };
    }
    
    // 🎯 应用启动流程
    var appInitializer = null;
    
    function startApp() {
        try {
            console.log('[Main] Starting LearnerEn v' + APP_CONFIG.version);
            console.log('[Main] Object.assign polyfill:', Object.assign._isPolyfill ? 'active' : 'native');
            
            appInitializer = new AppInitializer();
            
            if (appInitializer.initialize()) {
                console.log('[Main] Application initialized successfully');
            } else {
                console.error('[Main] Application initialization failed');
            }
            
        } catch (error) {
            console.error('[Main] Critical startup error:', error);
            
            // 最后的降级方案
            setTimeout(function() {
                document.body.innerHTML = [
                    '<div style="padding: 40px; text-align: center; font-family: -apple-system, sans-serif;">',
                    '<h2>加载失败</h2>',
                    '<p>应用启动遇到问题，请刷新页面重试。</p>',
                    '<button onclick="location.reload()" style="padding: 12px 24px; background: #007AFF; color: white; border: none; border-radius: 6px; font-size: 16px;">',
                    '刷新页面',
                    '</button>',
                    '</div>'
                ].join('');
            }, 100);
        }
    }
    
    // 🚀 启动应用
    onReady(startApp);
    
    // 全局导出
    global.LearnerApp = {
        version: APP_CONFIG.version,
        config: APP_CONFIG,
        getInitializer: function() { return appInitializer; }
    };
    
    // 调试支持
    if (APP_CONFIG.debug) {
        global.LearnerDebug = {
            config: APP_CONFIG,
            restart: function() {
                location.reload();
            },
            getStats: function() {
                return appInitializer && appInitializer.getAppController() ? 
                       appInitializer.getAppController().getState() : null;
            }
        };
    }
    
})(typeof window !== 'undefined' ? window : this);