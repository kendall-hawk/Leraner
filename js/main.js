// js/main.js - iOS兼容版应用入口
// 🚀 统一初始化和启动，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    // 🔧 环境检测和生产环境优化
    var IS_PRODUCTION = typeof window !== 'undefined' && 
        (window.location.hostname !== 'localhost' && 
         window.location.hostname !== '127.0.0.1' &&
         window.location.hostname !== '' &&
         !window.location.hostname.startsWith('192.168.') &&
         !window.location.hostname.startsWith('10.') &&
         !window.location.hostname.startsWith('172.'));

    var DEBUG_LOG = IS_PRODUCTION ? function(){} : console.log;
    var DEBUG_WARN = IS_PRODUCTION ? function(){} : console.warn;
    var DEBUG_ERROR = IS_PRODUCTION ? function(){} : console.error;

    /**
     * 🎯 应用启动器 - Mobile-First Architecture
     * 功能：系统初始化、模块集成、用户体验优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    
    // 全局配置
    var APP_CONFIG = {
        name: 'LearnerEn',
        version: '2.0.0',
        debug: !IS_PRODUCTION, // 生产环境自动关闭调试
        features: {
            navigation: true,
            audioSync: true,
            glossary: true,
            wordFrequency: true,
            analytics: false
        },
        timeouts: {
            startup: 15000,        // 启动超时15秒
            initialization: 5000,  // 初始化超时5秒
            moduleLoad: 3000       // 模块加载超时3秒
        },
        retries: {
            maxAttempts: 3,
            delay: 1000
        }
    };
    
    // DOM就绪检测
    var isReady = false;
    var readyCallbacks = [];
    var readyPromise = null;
    
    function checkReady() {
        if (typeof document === 'undefined') return false;
        return document.readyState === 'complete' || document.readyState === 'interactive';
    }
    
    function onReady(callback) {
        if (typeof callback !== 'function') {
            DEBUG_WARN('[Main] onReady: callback must be a function');
            return;
        }
        
        if (isReady || checkReady()) {
            // 异步执行，避免阻塞
            setTimeout(callback, 0);
        } else {
            readyCallbacks.push(callback);
        }
    }
    
    function fireReady() {
        if (isReady) return;
        
        isReady = true;
        DEBUG_LOG('[Main] DOM ready, firing callbacks');
        
        // 执行所有回调
        readyCallbacks.forEach(function(callback) {
            try {
                callback();
            } catch (error) {
                DEBUG_ERROR('[Main] Ready callback error:', error);
            }
        });
        readyCallbacks = [];
    }
    
    // 创建DOM就绪Promise
    function createReadyPromise() {
        if (readyPromise) return readyPromise;
        
        readyPromise = new Promise(function(resolve) {
            if (isReady || checkReady()) {
                resolve();
            } else {
                onReady(resolve);
            }
        });
        
        return readyPromise;
    }
    
    // 监听DOM就绪
    if (typeof document !== 'undefined') {
        if (checkReady()) {
            setTimeout(fireReady, 0);
        } else {
            document.addEventListener('DOMContentLoaded', fireReady);
            window.addEventListener('load', fireReady); // 双重保险
        }
    }

    /**
     * 🎯 应用初始化器
     */
    function AppInitializer() {
        var appController = null;
        var startTime = Date.now();
        var initPromises = [];
        var isDestroyed = false;
        var retryCount = 0;
        var startupTimer = null;
        var loadingIndicator = null;
        
        var self = this;
        
        // 兼容性检查
        function checkCompatibility() {
            var issues = [];
            var warnings = [];
            
            // 检查基本JS支持
            if (typeof Array.prototype.forEach === 'undefined') {
                issues.push('Array.forEach not supported');
            }
            
            if (typeof JSON === 'undefined') {
                issues.push('JSON not supported');
            }
            
            // 检查DOM API
            if (typeof document !== 'undefined') {
                if (typeof document.querySelector === 'undefined') {
                    issues.push('querySelector not supported');
                }
                
                if (typeof document.addEventListener === 'undefined') {
                    warnings.push('addEventListener not fully supported');
                }
            }
            
            // 检查Promise支持
            if (typeof Promise === 'undefined') {
                warnings.push('Promise not natively supported');
            }
            
            // 检查ES5特性
            if (typeof Object.keys === 'undefined') {
                issues.push('Object.keys not supported');
            }
            
            if (issues.length > 0) {
                showCompatibilityError(issues, warnings);
                return false;
            }
            
            if (warnings.length > 0 && APP_CONFIG.debug) {
                DEBUG_WARN('[Main] Compatibility warnings:', warnings);
            }
            
            return true;
        }
        
        function showCompatibilityError(issues, warnings) {
            var errorHtml = [
                '<div style="padding: 20px; background: #fee; border: 1px solid #fcc; margin: 20px; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">',
                '<h3 style="color: #c33; margin-top: 0;">浏览器兼容性问题</h3>',
                '<p>您的浏览器版本过低，请升级到以下版本：</p>',
                '<ul style="margin: 10px 0;">',
                '<li>iOS Safari 12.0+</li>',
                '<li>Android Chrome 80+</li>',
                '<li>Firefox 80+</li>',
                '<li>Edge 80+</li>',
                '</ul>',
                '<p style="margin-bottom: 0;"><strong>检测到的问题：</strong> ' + issues.join(', ') + '</p>',
                warnings.length > 0 ? '<p style="margin-bottom: 0;"><strong>警告：</strong> ' + warnings.join(', ') + '</p>' : '',
                '</div>'
            ].join('');
            
            if (typeof document !== 'undefined' && document.body) {
                document.body.innerHTML = errorHtml;
            }
        }
        
        // 初始化应用配置
        function initializeConfig() {
            try {
                // 从URL参数读取配置
                var urlParams = getUrlParams();
                if (urlParams.debug === 'true') {
                    APP_CONFIG.debug = true;
                }
                
                // 设置功能开关
                Object.keys(APP_CONFIG.features).forEach(function(feature) {
                    if (urlParams[feature] === 'false') {
                        APP_CONFIG.features[feature] = false;
                    }
                });
                
                // 从localStorage读取用户配置
                var userConfig = getUserConfig();
                if (userConfig) {
                    // 安全合并配置
                    mergeConfig(APP_CONFIG, userConfig);
                }
                
                // 设置全局配置
                global.LEARNER_CONFIG = APP_CONFIG;
                
                DEBUG_LOG('[Main] 配置初始化完成:', APP_CONFIG);
                return true;
            } catch (error) {
                DEBUG_ERROR('[Main] Config initialization failed:', error);
                return false;
            }
        }
        
        function mergeConfig(target, source) {
            try {
                // 只合并安全的配置项
                var safeKeys = ['features', 'debug'];
                safeKeys.forEach(function(key) {
                    if (source[key] && typeof source[key] === typeof target[key]) {
                        if (typeof source[key] === 'object') {
                            Object.assign(target[key], source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    }
                });
            } catch (error) {
                DEBUG_WARN('[Main] Config merge failed:', error);
            }
        }
        
        // 创建加载指示器
        function createLoadingIndicator() {
            if (typeof document === 'undefined') return null;
            
            try {
                loadingIndicator = document.createElement('div');
                loadingIndicator.id = 'app-loading-screen';
                loadingIndicator.style.cssText = [
                    'position: fixed',
                    'top: 0',
                    'left: 0',
                    'right: 0', 
                    'bottom: 0',
                    'background: rgba(255,255,255,0.95)',
                    'display: flex',
                    'align-items: center',
                    'justify-content: center',
                    'z-index: 10000',
                    'font-family: -apple-system, BlinkMacSystemFont, sans-serif'
                ].join(';');
                
                loadingIndicator.innerHTML = [
                    '<div style="text-align: center; max-width: 300px; padding: 20px;">',
                        '<div class="loading-spinner" style="',
                            'width: 40px;',
                            'height: 40px;',
                            'border: 4px solid #f3f3f3;',
                            'border-top: 4px solid #007AFF;',
                            'border-radius: 50%;',
                            'animation: spin 1s linear infinite;',
                            'margin: 0 auto 20px;',
                        '"></div>',
                        '<div class="loading-text" style="color: #333; font-size: 16px; margin-bottom: 10px;">',
                            '正在启动应用...',
                        '</div>',
                        '<div class="loading-progress" style="',
                            'width: 100%;',
                            'height: 4px;',
                            'background: #f0f0f0;',
                            'border-radius: 2px;',
                            'overflow: hidden;',
                        '">',
                            '<div class="loading-bar" style="',
                                'width: 0%;',
                                'height: 100%;',
                                'background: #007AFF;',
                                'transition: width 0.3s ease;',
                            '"></div>',
                        '</div>',
                    '</div>'
                ].join('');
                
                // 添加CSS动画
                addLoadingStyles();
                
                document.body.appendChild(loadingIndicator);
                
                return loadingIndicator;
            } catch (error) {
                DEBUG_ERROR('[Main] Failed to create loading indicator:', error);
                return null;
            }
        }
        
        function addLoadingStyles() {
            if (document.getElementById('loading-styles')) return;
            
            var style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = [
                '@keyframes spin {',
                '  0% { transform: rotate(0deg); }',
                '  100% { transform: rotate(360deg); }',
                '}',
                '.loading-spinner {',
                '  animation: spin 1s linear infinite;',
                '}'
            ].join('');
            
            document.head.appendChild(style);
        }
        
        function updateLoadingProgress(text, progress) {
            if (!loadingIndicator) return;
            
            try {
                var textElement = loadingIndicator.querySelector('.loading-text');
                var progressBar = loadingIndicator.querySelector('.loading-bar');
                
                if (textElement && text) {
                    textElement.textContent = text;
                }
                
                if (progressBar && typeof progress === 'number') {
                    progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
                }
            } catch (error) {
                DEBUG_ERROR('[Main] Failed to update loading progress:', error);
            }
        }
        
        function hideLoadingIndicator() {
            if (!loadingIndicator) return;
            
            try {
                loadingIndicator.style.opacity = '0';
                loadingIndicator.style.transition = 'opacity 0.3s ease';
                
                setTimeout(function() {
                    if (loadingIndicator && loadingIndicator.parentNode) {
                        loadingIndicator.parentNode.removeChild(loadingIndicator);
                        loadingIndicator = null;
                    }
                }, 300);
            } catch (error) {
                DEBUG_ERROR('[Main] Failed to hide loading indicator:', error);
            }
        }
        
        // 预加载关键资源
        function preloadResources() {
            return new Promise(function(resolve) {
                try {
                    var resources = [
                        { type: 'data', url: 'data/navigation.json', critical: true },
                        { type: 'data', url: 'data/terms/common.json', critical: false }
                    ];
                    
                    var criticalResources = resources.filter(function(r) { return r.critical; });
                    var loaded = 0;
                    var total = criticalResources.length;
                    
                    if (total === 0) {
                        resolve();
                        return;
                    }
                    
                    function onResourceLoaded() {
                        loaded++;
                        if (loaded >= total) {
                            resolve();
                        }
                    }
                    
                    criticalResources.forEach(function(resource) {
                        loadResource(resource, onResourceLoaded);
                    });
                    
                    // 非关键资源延迟加载
                    setTimeout(function() {
                        resources.filter(function(r) { return !r.critical; }).forEach(function(resource) {
                            loadResource(resource);
                        });
                    }, 1000);
                    
                } catch (error) {
                    DEBUG_ERROR('[Main] Preload failed:', error);
                    resolve(); // 继续启动，不阻塞
                }
            });
        }
        
        function loadResource(resource, callback) {
            if (resource.type === 'data') {
                loadDataResource(resource.url, callback);
            }
        }
        
        function loadDataResource(url, callback) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = APP_CONFIG.timeouts.moduleLoad;
                
                xhr.onload = function() {
                    if (xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            cacheResource(url, data);
                            if (callback) callback();
                        } catch (parseError) {
                            DEBUG_WARN('[Main] Resource parse failed:', url, parseError);
                            if (callback) callback(); // 继续执行
                        }
                    } else {
                        DEBUG_WARN('[Main] Resource load failed:', url, xhr.status);
                        if (callback) callback(); // 继续执行
                    }
                };
                
                xhr.onerror = function() {
                    DEBUG_WARN('[Main] Resource network error:', url);
                    if (callback) callback(); // 继续执行
                };
                
                xhr.ontimeout = function() {
                    DEBUG_WARN('[Main] Resource timeout:', url);
                    if (callback) callback(); // 继续执行
                };
                
                xhr.send();
            } catch (error) {
                DEBUG_WARN('[Main] Resource load failed:', url, error);
                if (callback) callback(); // 继续执行
            }
        }
        
        function cacheResource(url, data) {
            try {
                if (global.EnglishSite && global.EnglishSite.CacheManager) {
                    var cache = new global.EnglishSite.CacheManager();
                    cache.set('preload:' + url, data, { ttl: 24 * 60 * 60 * 1000 });
                }
            } catch (error) {
                DEBUG_WARN('[Main] Resource cache failed:', error);
            }
        }
        
        // 初始化应用控制器
function initializeAppController() {
    return new Promise(function(resolve, reject) {
        // 等待依赖就绪
        var maxRetries = 50;
        var retries = 0;
        
        function waitForDependencies() {
            try {
                if (global.EnglishSite && global.EnglishSite.AppController) {
                    appController = new global.EnglishSite.AppController({
                        name: APP_CONFIG.name,
                        version: APP_CONFIG.version,
                        debug: APP_CONFIG.debug,
                        autoStart: false
                    });
                    resolve(appController);
                } else if (retries < maxRetries) {
                    retries++;
                    setTimeout(waitForDependencies, 100);
                } else {
                    reject(new Error('AppController not available after timeout'));
                }
            } catch (error) {
                DEBUG_ERROR('[Main] AppController initialization failed:', error);
                reject(error);
            }
        }
        
        waitForDependencies();
    });
}
        
        // 配置模块选项
        function getModuleConfigs() {
            var configs = {};
            
            if (APP_CONFIG.features.navigation) {
                configs.navigation = {
                    container: 'nav-container',
                    breakpoint: 768,
                    enableTouch: true,
                    dataUrl: 'data/navigation.json'
                };
            }
            
            if (APP_CONFIG.features.audioSync) {
                configs.audioSync = {
                    contentArea: 'content-area',
                    audioPlayer: 'audio-player',
                    srtText: '', // 动态加载
                    enableTouch: true,
                    enableKeyboard: true
                };
            }
            
            if (APP_CONFIG.features.glossary) {
                configs.glossary = {
                    container: 'content-area',
                    triggerEvent: 'click',
                    enableTouch: true,
                    enableAudio: true,
                    dataUrl: 'data/terms/common.json'
                };
            }
            
            return configs;
        }
        
        // 启动应用
        function startApplication() {
            return new Promise(function(resolve, reject) {
                try {
                    if (!appController) {
                        throw new Error('AppController not initialized');
                    }
                    
                    var moduleConfigs = getModuleConfigs();
                    
                    updateLoadingProgress('启动应用模块...', 80);
                    
                    appController.start({
                        modules: moduleConfigs
                    });
                    
                    // 设置应用事件处理
                    setupApplicationEvents();
                    
                    // 性能监控
                    monitorPerformance();
                    
                    resolve();
                } catch (error) {
                    DEBUG_ERROR('[Main] Application start failed:', error);
                    reject(error);
                }
            });
        }
        
        // 设置应用级事件处理
        function setupApplicationEvents() {
            if (!appController) return;
            
            try {
                var eventHub = appController.getModule('EventHub');
                if (!eventHub) return;
                
                // 全局错误处理
                eventHub.on('app:error', function(errorInfo) {
                    if (APP_CONFIG.debug) {
                        DEBUG_ERROR('[App Error]', errorInfo);
                    }
                    handleApplicationError(errorInfo);
                });
                
                // 应用状态变化
                eventHub.on('app:started', function(data) {
                    hideLoadingIndicator();
                    DEBUG_LOG('[Main] Application started in', data.loadTime + 'ms');
                });
                
                // 模块错误处理
                eventHub.on('*:error', function(data) {
                    handleModuleError(data);
                });
                
                // 性能警告
                eventHub.on('app:performanceWarning', function(data) {
                    if (APP_CONFIG.debug) {
                        DEBUG_WARN('[Performance Warning]', data);
                    }
                });
                
                // 页面可见性变化
                if (typeof document !== 'undefined') {
                    document.addEventListener('visibilitychange', function() {
                        eventHub.emit('app:visibilityChange', {
                            hidden: document.hidden
                        });
                    });
                }
                
            } catch (error) {
                DEBUG_ERROR('[Main] Event setup failed:', error);
            }
        }
        
        // 错误处理
        function handleApplicationError(errorInfo) {
            try {
                // 收集错误信息
                var errorData = {
                    message: errorInfo.message,
                    context: errorInfo.context,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    appVersion: APP_CONFIG.version
                };
                
                // 用户友好的错误提示
                if (errorInfo.severity === 'critical') {
                    showErrorDialog('系统遇到问题，正在尝试恢复...');
                    
                    // 尝试自动恢复
                    setTimeout(function() {
                        if (appController && appController.recover) {
                            if (!appController.recover()) {
                                // 恢复失败，提供重启选项
                                showRestartDialog();
                            }
                        }
                    }, 2000);
                }
            } catch (error) {
                DEBUG_ERROR('[Main] Error handling failed:', error);
            }
        }
        
        function handleModuleError(data) {
            if (APP_CONFIG.debug) {
                DEBUG_WARN('[Module Error]', data.context, data.message);
            }
            
            // 模块级降级处理
            var module = data.context.split(':')[0];
            if (APP_CONFIG.features[module]) {
                APP_CONFIG.features[module] = false;
                showModuleDisabledNotice(module);
            }
        }
        
        function showModuleDisabledNotice(moduleName) {
            try {
                var notice = document.createElement('div');
                notice.className = 'module-disabled-notice';
                notice.style.cssText = [
                    'position: fixed',
                    'top: 10px',
                    'right: 10px',
                    'background: #ffa',
                    'padding: 10px',
                    'border-radius: 4px',
                    'z-index: 10000',
                    'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
                    'font-size: 14px',
                    'box-shadow: 0 2px 10px rgba(0,0,0,0.1)'
                ].join(';');
                notice.textContent = moduleName + ' 功能暂时不可用';
                
                document.body.appendChild(notice);
                
                setTimeout(function() {
                    if (notice.parentNode) {
                        notice.parentNode.removeChild(notice);
                    }
                }, 5000);
            } catch (error) {
                DEBUG_ERROR('[Main] Failed to show module notice:', error);
            }
        }
        
        // 性能监控
        function monitorPerformance() {
            try {
                var perfData = {
                    startTime: startTime,
                    loadTime: Date.now() - startTime,
                    retryCount: retryCount
                };
                
                // 内存使用监控（如果支持）
                if (typeof performance !== 'undefined' && performance.memory) {
                    perfData.memoryUsed = performance.memory.usedJSHeapSize;
                    perfData.memoryLimit = performance.memory.jsHeapSizeLimit;
                }
                
                // 性能警告
                if (perfData.loadTime > 10000) {
                    DEBUG_WARN('[Performance] Very slow startup:', perfData.loadTime + 'ms');
                } else if (perfData.loadTime > 5000) {
                    DEBUG_WARN('[Performance] Slow startup:', perfData.loadTime + 'ms');
                }
                
                if (APP_CONFIG.debug) {
                    DEBUG_LOG('[Performance]', perfData);
                }
                
                // 保存性能数据
                savePerformanceData(perfData);
                
            } catch (error) {
                DEBUG_ERROR('[Main] Performance monitoring failed:', error);
            }
        }
        
        function savePerformanceData(perfData) {
            try {
                if (typeof localStorage !== 'undefined') {
                    var existing = localStorage.getItem('app_performance') || '[]';
                    var data = JSON.parse(existing);
                    data.push(perfData);
                    
                    // 保持最近10次记录
                    if (data.length > 10) {
                        data = data.slice(-10);
                    }
                    
                    localStorage.setItem('app_performance', JSON.stringify(data));
                }
            } catch (error) {
                // 忽略存储错误
            }
        }
        
        // 降级界面
        function showFallbackInterface() {
            if (typeof document === 'undefined') return;
            
            try {
                var fallbackHtml = [
                    '<div style="padding: 40px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">',
                    '<h2 style="color: #333; margin-bottom: 20px;">LearnerEn</h2>',
                    '<p style="color: #666; margin-bottom: 30px;">应用启动遇到问题，请尝试以下解决方案：</p>',
                    '<div style="margin-bottom: 20px;">',
                    '<button onclick="location.reload()" style="',
                        'padding: 12px 24px;',
                        'background: #007AFF;',
                        'color: white;',
                        'border: none;',
                        'border-radius: 6px;',
                        'font-size: 16px;',
                        'cursor: pointer;',
                        'margin: 0 10px;',
                    '">刷新页面</button>',
                    '<button onclick="clearAppData()" style="',
                        'padding: 12px 24px;',
                        'background: #FF9500;',
                        'color: white;',
                        'border: none;',
                        'border-radius: 6px;',
                        'font-size: 16px;',
                        'cursor: pointer;',
                        'margin: 0 10px;',
                    '">清除数据</button>',
                    '</div>',
                    '<p style="color: #999; font-size: 14px;">如果问题持续存在，请联系技术支持</p>',
                    '</div>'
                ].join('');
                
                var container = document.getElementById('app-container') || document.body;
                container.innerHTML = fallbackHtml;
                
                // 添加清除数据功能
                global.clearAppData = function() {
                    try {
                        if (typeof localStorage !== 'undefined') {
                            localStorage.clear();
                        }
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.clear();
                        }
                        setTimeout(function() {
                            location.reload();
                        }, 500);
                    } catch (error) {
                        location.reload();
                    }
                };
                
            } catch (error) {
                DEBUG_ERROR('[Main] Failed to show fallback interface:', error);
            }
        }
        
        function showErrorDialog(message) {
            if (typeof window !== 'undefined') {
                if (window.alert) {
                    window.alert(message);
                } else {
                    DEBUG_ERROR('[Main] Error:', message);
                }
            }
        }
        
        function showRestartDialog() {
            if (typeof window !== 'undefined' && window.confirm) {
                if (window.confirm('应用需要重新启动。是否立即重启？')) {
                    window.location.reload();
                }
            } else {
                setTimeout(function() {
                    window.location.reload();
                }, 3000);
            }
        }
        
        // 工具函数
        function getUrlParams() {
            var params = {};
            if (typeof window !== 'undefined' && window.location) {
                var search = window.location.search.slice(1);
                if (search) {
                    search.split('&').forEach(function(pair) {
                        var parts = pair.split('=');
                        if (parts.length >= 2) {
                            params[parts[0]] = decodeURIComponent(parts[1] || '');
                        }
                    });
                }
            }
            return params;
        }
        
        function getUserConfig() {
            try {
                if (typeof localStorage !== 'undefined') {
                    var stored = localStorage.getItem('learner_config');
                    return stored ? JSON.parse(stored) : null;
                }
            } catch (error) {
                DEBUG_WARN('[Main] Failed to load user config:', error);
            }
            return null;
        }
        
        // 主要初始化流程
        function executeInitialization() {
            return new Promise(function(resolve, reject) {
                try {
                    // 设置启动超时
                    startupTimer = setTimeout(function() {
                        reject(new Error('Startup timeout exceeded'));
                    }, APP_CONFIG.timeouts.startup);
                    
                    var steps = [
                        { name: '检查兼容性', fn: checkCompatibility, progress: 10 },
                        { name: '初始化配置', fn: initializeConfig, progress: 20 },
                        { name: '创建加载界面', fn: createLoadingIndicator, progress: 30 },
                        { name: '预加载资源', fn: preloadResources, progress: 50 },
                        { name: '初始化控制器', fn: initializeAppController, progress: 70 },
                        { name: '启动应用', fn: startApplication, progress: 90 }
                    ];
                    
                    executeStepsSequentially(steps, 0, resolve, reject);
                    
                } catch (error) {
                    reject(error);
                }
            });
        }
        
        function executeStepsSequentially(steps, index, resolve, reject) {
            if (index >= steps.length) {
                updateLoadingProgress('启动完成', 100);
                resolve();
                return;
            }
            
            var step = steps[index];
            updateLoadingProgress(step.name + '...', step.progress);
            
            try {
                var result = step.fn();
                
                // 处理Promise结果
                if (result && typeof result.then === 'function') {
                    result.then(function() {
                        executeStepsSequentially(steps, index + 1, resolve, reject);
                    }).catch(function(error) {
                        reject(new Error('Step failed: ' + step.name + ' - ' + error.message));
                    });
                } else {
                    // 同步结果
                    if (result === false) {
                        reject(new Error('Step failed: ' + step.name));
                        return;
                    }
                    
                    setTimeout(function() {
                        executeStepsSequentially(steps, index + 1, resolve, reject);
                    }, 10);
                }
            } catch (error) {
                reject(new Error('Step error: ' + step.name + ' - ' + error.message));
            }
        }
        
        // 公开API
        this.initialize = function() {
            if (isDestroyed) {
                DEBUG_ERROR('[Main] Cannot initialize destroyed instance');
                return Promise.reject(new Error('Instance destroyed'));
            }
            
            return createReadyPromise().then(function() {
                return executeInitialization();
            }).then(function() {
                if (startupTimer) {
                    clearTimeout(startupTimer);
                    startupTimer = null;
                }
                
                DEBUG_LOG('[Main] Initialization completed successfully');
                return true;
            }).catch(function(error) {
                DEBUG_ERROR('[Main] Initialization failed:', error);
                
                if (startupTimer) {
                    clearTimeout(startupTimer);
                    startupTimer = null;
                }
                
                // 重试逻辑
                if (retryCount < APP_CONFIG.retries.maxAttempts) {
                    retryCount++;
                    DEBUG_LOG('[Main] Retrying initialization, attempt:', retryCount);
                    
                    return new Promise(function(resolve) {
                        setTimeout(function() {
                            resolve(self.initialize());
                        }, APP_CONFIG.retries.delay * retryCount);
                    });
                } else {
                    // 显示降级界面
                    showFallbackInterface();
                    throw error;
                }
            });
        };
        
        this.getAppController = function() {
            return appController;
        };
        
        this.destroy = function() {
            try {
                isDestroyed = true;
                
                if (startupTimer) {
                    clearTimeout(startupTimer);
                    startupTimer = null;
                }
                
                if (appController && typeof appController.destroy === 'function') {
                    appController.destroy();
                }
                
                hideLoadingIndicator();
                
                // 清理全局函数
                if (global.clearAppData) {
                    delete global.clearAppData;
                }
                
                DEBUG_LOG('[Main] AppInitializer destroyed');
                return true;
            } catch (error) {
                DEBUG_ERROR('[Main] Destroy failed:', error);
                return false;
            }
        };
    }
    
    // 🎯 应用启动流程
    var appInitializer = null;
    
    function startApp() {
        try {
            DEBUG_LOG('[Main] Starting LearnerEn v' + APP_CONFIG.version);
            
            appInitializer = new AppInitializer();
            
            appInitializer.initialize().then(function() {
                DEBUG_LOG('[Main] Application ready');
            }).catch(function(error) {
                DEBUG_ERROR('[Main] Application failed to start:', error);
            });
            
        } catch (error) {
            DEBUG_ERROR('[Main] Critical startup error:', error);
            
            // 最后的降级方案
            setTimeout(function() {
                if (typeof document !== 'undefined' && document.body) {
                    document.body.innerHTML = [
                        '<div style="padding: 40px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">',
                        '<h2 style="color: #e74c3c;">启动失败</h2>',
                        '<p>应用启动遇到严重问题，请刷新页面重试。</p>',
                        '<button onclick="location.reload()" style="',
                            'padding: 12px 24px;',
                            'background: #007AFF;',
                            'color: white;',
                            'border: none;',
                            'border-radius: 6px;',
                            'font-size: 16px;',
                            'cursor: pointer;',
                        '">刷新页面</button>',
                        '</div>'
                    ].join('');
                }
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
                if (appInitializer) {
                    appInitializer.destroy();
                }
                location.reload();
            },
            getStats: function() {
                return appInitializer && appInitializer.getAppController() ? 
                       appInitializer.getAppController().getState() : null;
            },
            clearData: function() {
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                    location.reload();
                } catch (error) {
                    DEBUG_ERROR('[Debug] Clear data failed:', error);
                }
            }
        };
    }
    
})(typeof window !== 'undefined' ? window : this);
