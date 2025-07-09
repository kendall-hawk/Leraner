// js/modules/app-controller.js - iOS兼容版应用控制器
// 🚀 统一应用管理，确保iOS Safari 12+兼容性

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

    // 🔧 安全工具函数
    function safeJSONStringify(obj, fallback) {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            return fallback || '{}';
        }
    }

    function createSafeTimeout(callback, delay, context) {
        var timeoutId;
        var executed = false;
        
        var safeCallback = function() {
            if (executed) return;
            executed = true;
            
            try {
                if (typeof callback === 'function') {
                    callback.call(context);
                }
            } catch (error) {
                DEBUG_ERROR('[AppController] Timeout callback error:', error);
            }
        };
        
        timeoutId = setTimeout(safeCallback, delay);
        
        return {
            clear: function() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    executed = true;
                }
            },
            execute: safeCallback
        };
    }

    /**
     * 🎯 AppController - 应用控制器
     * 功能：生命周期管理、模块协调、错误恢复、资源管理、用户体验
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function AppController(config) {
        config = config || {};
        
        // 应用配置
        var appConfig = {
            name: config.name || 'EnglishSite',
            version: config.version || '2.0.0',
            debug: config.debug && !IS_PRODUCTION, // 生产环境强制关闭
            autoStart: config.autoStart !== false,
            enablePWA: config.enablePWA || false,
            enableOffline: config.enableOffline || false,
            enableAnalytics: config.enableAnalytics && !IS_PRODUCTION, // 生产环境默认关闭
            startupTimeout: Math.max(5000, config.startupTimeout || 10000),
            maxRetries: Math.max(1, Math.min(5, config.maxRetries || 3)),
            retryDelay: Math.max(500, config.retryDelay || 1000),
            healthCheckInterval: Math.max(10000, config.healthCheckInterval || 30000),
            performanceThreshold: Math.max(1000, config.performanceThreshold || 3000)
        };
        
        // 应用状态
        var appState = {
            phase: 'initializing', // initializing, starting, running, pausing, stopped, error
            startTime: 0,
            loadTime: 0,
            modules: {},
            dependencies: {},
            errors: [],
            retryCount: 0,
            lastHealthCheck: 0,
            isDestroyed: false,
            performance: {
                startupTime: 0,
                memoryUsage: 0,
                moduleLoadTime: {},
                errorCount: 0,
                lastUpdate: 0
            }
        };
        
        // 模块注册表
        var moduleRegistry = {};
        var moduleInstances = {};
        var initializationQueue = [];
        var destructionQueue = [];
        
        // Foundation Layer模块
        var foundation = {
            StateManager: null,
            EventHub: null,
            CacheManager: null,
            ErrorBoundary: null
        };
        
        // Core Modules Layer模块
        var coreModules = {
            NavigationCore: null,
            AudioSyncCore: null,
            GlossaryCore: null
        };
        
        // 定时器和监控
        var healthCheckTimer = null;
        var startupTimer = null;
        var performanceMonitor = null;
        var visibilityHandler = null;
        
        // 用户界面元素
        var uiElements = {
            loadingIndicator: null,
            errorDialog: null,
            progressBar: null
        };
        
        // 错误处理
        var errorHandlingActive = false;
        var criticalErrorCount = 0;
        var maxCriticalErrors = 5;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            try {
                if (appState.isDestroyed) {
                    DEBUG_ERROR('[AppController] 尝试初始化已销毁的实例');
                    return;
                }
                
                appState.startTime = Date.now();
                appState.phase = 'initializing';
                
                // 设置全局命名空间
                setupGlobalNamespace();
                
                // 创建UI元素
                createUIElements();
                
                // 检测运行环境
                detectEnvironment();
                
                // 注册默认模块
                registerDefaultModules();
                
                // 设置全局错误处理
                setupGlobalErrorHandling();
                
                // 设置性能监控
                setupPerformanceMonitoring();
                
                // 设置页面可见性处理
                setupVisibilityHandling();
                
                // 自动启动
                if (appConfig.autoStart) {
                    setTimeout(function() {
                        if (!appState.isDestroyed) {
                            self.start();
                        }
                    }, 10);
                }
                
                DEBUG_LOG('[AppController] 应用控制器初始化完成');
                
            } catch (error) {
                handleCriticalError('initialize', error);
            }
        }
        
        // 🔑 公开API - 生命周期管理
        
        /**
         * 启动应用
         */
        this.start = function(options) {
            try {
                if (appState.isDestroyed) {
                    DEBUG_ERROR('[AppController] 实例已销毁，无法启动');
                    return false;
                }
                
                if (appState.phase === 'running') {
                    DEBUG_WARN('[AppController] 应用已在运行');
                    return true;
                }
                
                options = options || {};
                appState.phase = 'starting';
                appState.retryCount = 0;
                
                showLoadingIndicator('正在启动应用...');
                
                // 设置启动超时
                startupTimer = createSafeTimeout(function() {
                    handleStartupTimeout();
                }, appConfig.startupTimeout);
                
                // 异步启动流程
                setTimeout(function() {
                    if (!appState.isDestroyed) {
                        executeStartupSequence(options);
                    }
                }, 10);
                
                return true;
            } catch (error) {
                handleCriticalError('start', error);
                return false;
            }
        };
        
        /**
         * 停止应用
         */
        this.stop = function() {
            try {
                if (appState.isDestroyed) {
                    return true;
                }
                
                appState.phase = 'stopping';
                
                showLoadingIndicator('正在停止应用...');
                
                // 停止健康检查
                stopHealthCheck();
                
                // 停止性能监控
                stopPerformanceMonitoring();
                
                // 销毁模块
                destroyAllModules();
                
                // 清理资源
                cleanupResources();
                
                appState.phase = 'stopped';
                hideLoadingIndicator();
                
                // 触发停止事件
                emitEvent('app:stopped');
                
                return true;
            } catch (error) {
                handleCriticalError('stop', error);
                return false;
            }
        };
        
        /**
         * 重启应用
         */
        this.restart = function() {
            try {
                if (appState.isDestroyed) {
                    return false;
                }
                
                DEBUG_LOG('[AppController] 重启应用');
                
                this.stop();
                
                // 延迟重启，确保清理完成
                setTimeout(function() {
                    if (!appState.isDestroyed) {
                        self.start();
                    }
                }, 1000);
                
                return true;
            } catch (error) {
                handleCriticalError('restart', error);
                return false;
            }
        };
        
        /**
         * 暂停应用
         */
        this.pause = function() {
            try {
                if (appState.phase !== 'running' || appState.isDestroyed) {
                    return false;
                }
                
                appState.phase = 'pausing';
                
                // 暂停模块
                pauseAllModules();
                
                // 停止性能监控
                stopPerformanceMonitoring();
                
                appState.phase = 'paused';
                
                // 触发暂停事件
                emitEvent('app:paused');
                
                return true;
            } catch (error) {
                handleCriticalError('pause', error);
                return false;
            }
        };
        
        /**
         * 恢复应用
         */
        this.resume = function() {
            try {
                if (appState.phase !== 'paused' || appState.isDestroyed) {
                    return false;
                }
                
                appState.phase = 'resuming';
                
                // 恢复模块
                resumeAllModules();
                
                // 重启性能监控
                setupPerformanceMonitoring();
                
                appState.phase = 'running';
                
                // 触发恢复事件
                emitEvent('app:resumed');
                
                return true;
            } catch (error) {
                handleCriticalError('resume', error);
                return false;
            }
        };
        
        // 🔑 公开API - 模块管理
        
        /**
         * 注册模块
         */
        this.registerModule = function(name, moduleClass, dependencies, config) {
            try {
                if (!name || !moduleClass) {
                    throw new Error('Module name and class are required');
                }
                
                moduleRegistry[name] = {
                    name: name,
                    moduleClass: moduleClass,
                    dependencies: dependencies || [],
                    config: config || {},
                    instance: null,
                    initialized: false,
                    startTime: 0,
                    loadTime: 0,
                    status: 'registered'
                };
                
                if (appConfig.debug) {
                    DEBUG_LOG('[AppController] 模块已注册:', name);
                }
                
                return true;
            } catch (error) {
                handleError('registerModule', error);
                return false;
            }
        };
        
        /**
         * 获取模块实例
         */
        this.getModule = function(name) {
            try {
                var moduleInfo = moduleRegistry[name];
                if (moduleInfo && moduleInfo.instance) {
                    return moduleInfo.instance;
                }
                
                // 尝试从foundation或coreModules获取
                if (foundation[name]) {
                    return foundation[name];
                }
                
                if (coreModules[name]) {
                    return coreModules[name];
                }
                
                return null;
            } catch (error) {
                handleError('getModule', error);
                return null;
            }
        };
        
        /**
         * 初始化模块
         */
        this.initializeModule = function(name, options) {
            try {
                return initializeModule(name, options);
            } catch (error) {
                handleError('initializeModule', error);
                return false;
            }
        };
        
        /**
         * 销毁模块
         */
        this.destroyModule = function(name) {
            try {
                return destroyModule(name);
            } catch (error) {
                handleError('destroyModule', error);
                return false;
            }
        };
        
        // 🔑 公开API - 状态和监控
        
        /**
         * 获取应用状态
         */
        this.getState = function() {
            return {
                phase: appState.phase,
                startTime: appState.startTime,
                loadTime: appState.loadTime,
                uptime: appState.startTime > 0 ? Date.now() - appState.startTime : 0,
                modules: Object.keys(moduleRegistry),
                initializedModules: Object.keys(moduleInstances),
                errors: appState.errors.slice(-10), // 最近10个错误
                performance: Object.assign({}, appState.performance),
                config: Object.assign({}, appConfig),
                isDestroyed: appState.isDestroyed
            };
        };
        
        /**
         * 健康检查
         */
        this.healthCheck = function() {
            try {
                if (appState.isDestroyed) {
                    return { status: 'destroyed', timestamp: Date.now() };
                }
                
                var health = {
                    status: 'healthy',
                    timestamp: Date.now(),
                    phase: appState.phase,
                    modules: {},
                    performance: {
                        memory: getMemoryUsage(),
                        uptime: Date.now() - appState.startTime,
                        errorRate: calculateErrorRate(),
                        lastUpdate: appState.performance.lastUpdate
                    },
                    issues: []
                };
                
                // 检查模块健康状态
                for (var name in moduleInstances) {
                    if (moduleInstances.hasOwnProperty(name)) {
                        var moduleHealth = checkModuleHealth(name);
                        health.modules[name] = moduleHealth;
                        
                        if (moduleHealth.status !== 'healthy') {
                            health.status = 'degraded';
                            health.issues.push('Module ' + name + ' is ' + moduleHealth.status);
                        }
                    }
                }
                
                // 检查性能指标
                if (health.performance.memory > 150 * 1024 * 1024) { // 150MB
                    health.status = 'warning';
                    health.issues.push('High memory usage detected');
                }
                
                if (health.performance.errorRate > 0.1) { // 10%错误率
                    health.status = 'warning';
                    health.issues.push('High error rate detected');
                }
                
                // 检查关键错误计数
                if (criticalErrorCount > maxCriticalErrors / 2) {
                    health.status = 'warning';
                    health.issues.push('Multiple critical errors detected');
                }
                
                appState.lastHealthCheck = Date.now();
                
                // 触发健康检查事件
                emitEvent('app:healthCheck', health);
                
                return health;
            } catch (error) {
                handleError('healthCheck', error);
                return {
                    status: 'error',
                    timestamp: Date.now(),
                    error: error.message
                };
            }
        };
        
        /**
         * 错误恢复
         */
        this.recover = function() {
            try {
                if (appState.isDestroyed) {
                    return false;
                }
                
                if (appState.phase === 'error') {
                    appState.retryCount++;
                    
                    if (appState.retryCount <= appConfig.maxRetries && criticalErrorCount < maxCriticalErrors) {
                        DEBUG_LOG('[AppController] 尝试恢复, 重试次数:', appState.retryCount);
                        
                        setTimeout(function() {
                            if (!appState.isDestroyed) {
                                self.restart();
                            }
                        }, appConfig.retryDelay * appState.retryCount);
                        
                        return true;
                    } else {
                        showCriticalErrorDialog();
                        return false;
                    }
                }
                
                return false;
            } catch (error) {
                handleCriticalError('recover', error);
                return false;
            }
        };
        
        /**
         * 销毁实例
         */
        this.destroy = function() {
            try {
                if (appState.isDestroyed) {
                    return true;
                }
                
                DEBUG_LOG('[AppController] 销毁应用控制器');
                
                // 标记为已销毁
                appState.isDestroyed = true;
                appState.phase = 'destroyed';
                
                // 清理启动定时器
                if (startupTimer) {
                    startupTimer.clear();
                    startupTimer = null;
                }
                
                // 停止所有监控
                stopHealthCheck();
                stopPerformanceMonitoring();
                
                // 销毁所有模块
                destroyAllModules();
                
                // 清理UI元素
                cleanupUIElements();
                
                // 移除事件监听器
                if (visibilityHandler && typeof document !== 'undefined') {
                    document.removeEventListener('visibilitychange', visibilityHandler);
                    visibilityHandler = null;
                }
                
                // 清理全局引用
                if (global.EnglishSite && global.EnglishSite.App === self) {
                    delete global.EnglishSite.App;
                }
                
                // 重置状态
                appState.errors = [];
                moduleRegistry = {};
                moduleInstances = {};
                foundation = {};
                coreModules = {};
                
                DEBUG_LOG('[AppController] 应用控制器已销毁');
                return true;
            } catch (error) {
                DEBUG_ERROR('[AppController] 销毁失败:', error);
                return false;
            }
        };
        
        // 🔧 内部方法 - 启动流程
        
        function executeStartupSequence(options) {
            try {
                var startupSteps = [
                    { name: 'initializeFoundation', fn: initializeFoundationLayer, progress: 20 },
                    { name: 'initializeCoreModules', fn: initializeCoreModules, progress: 50 },
                    { name: 'setupModuleIntegration', fn: setupModuleIntegration, progress: 70 },
                    { name: 'restoreApplicationState', fn: restoreApplicationState, progress: 85 },
                    { name: 'finalizeStartup', fn: finalizeStartup, progress: 95 }
                ];
                
                var currentStep = 0;
                
                function executeNextStep() {
                    if (appState.isDestroyed) return;
                    
                    if (currentStep >= startupSteps.length) {
                        completeStartup();
                        return;
                    }
                    
                    var step = startupSteps[currentStep];
                    updateLoadingProgress(step.name, step.progress);
                    
                    try {
                        var result = step.fn(options);
                        
                        // 支持异步步骤
                        if (result && typeof result.then === 'function') {
                            result.then(function() {
                                if (!appState.isDestroyed) {
                                    currentStep++;
                                    setTimeout(executeNextStep, 10);
                                }
                            }).catch(function(error) {
                                handleStartupError(step.name, error);
                            });
                        } else {
                            currentStep++;
                            setTimeout(executeNextStep, 10);
                        }
                    } catch (error) {
                        handleStartupError(step.name, error);
                    }
                }
                
                executeNextStep();
                
            } catch (error) {
                handleStartupError('executeStartupSequence', error);
            }
        }
        
        function initializeFoundationLayer(options) {
            try {
                updateLoadingProgress('初始化基础设施层...', 20);
                
                // 初始化ErrorBoundary
                if (global.EnglishSite && global.EnglishSite.ErrorBoundary) {
                    foundation.ErrorBoundary = new global.EnglishSite.ErrorBoundary();
                    moduleInstances.ErrorBoundary = foundation.ErrorBoundary;
                    
                    // 设置应用级错误恢复策略
                    foundation.ErrorBoundary.setRecoveryStrategy('app', function(error) {
                        DEBUG_WARN('[AppController] 应用级错误恢复');
                        return self.recover();
                    });
                }
                
                // 初始化EventHub
                if (global.EnglishSite && global.EnglishSite.EventHub) {
                    foundation.EventHub = new global.EnglishSite.EventHub();
                    moduleInstances.EventHub = foundation.EventHub;
                    
                    // 订阅系统事件
                    setupSystemEventHandlers();
                }
                
                // 初始化CacheManager
                if (global.EnglishSite && global.EnglishSite.CacheManager) {
                    foundation.CacheManager = new global.EnglishSite.CacheManager({
                        maxMemorySize: 50,
                        maxStorageSize: 200,
                        namespace: appConfig.name
                    });
                    moduleInstances.CacheManager = foundation.CacheManager;
                }
                
                // 初始化StateManager
                if (global.EnglishSite && global.EnglishSite.StateManager) {
                    foundation.StateManager = new global.EnglishSite.StateManager();
                    moduleInstances.StateManager = foundation.StateManager;
                }
                
                return true;
            } catch (error) {
                throw new Error('Foundation layer initialization failed: ' + error.message);
            }
        }
        
        function initializeCoreModules(options) {
            try {
                updateLoadingProgress('初始化核心模块...', 50);
                
                var moduleConfigs = options.modules || {};
                
                // 初始化NavigationCore
                if (global.EnglishSite && global.EnglishSite.NavigationCore && moduleConfigs.navigation) {
                    coreModules.NavigationCore = new global.EnglishSite.NavigationCore(
                        moduleConfigs.navigation.container,
                        Object.assign({}, moduleConfigs.navigation, {
                            stateManager: foundation.StateManager,
                            eventHub: foundation.EventHub,
                            cacheManager: foundation.CacheManager,
                            errorBoundary: foundation.ErrorBoundary
                        })
                    );
                    moduleInstances.NavigationCore = coreModules.NavigationCore;
                    appState.performance.moduleLoadTime.NavigationCore = Date.now();
                }
                
                // 初始化AudioSyncCore
                if (global.EnglishSite && global.EnglishSite.AudioSyncCore && moduleConfigs.audioSync) {
                    coreModules.AudioSyncCore = new global.EnglishSite.AudioSyncCore(
                        moduleConfigs.audioSync.contentArea,
                        moduleConfigs.audioSync.srtText,
                        moduleConfigs.audioSync.audioPlayer,
                        Object.assign({}, moduleConfigs.audioSync, {
                            stateManager: foundation.StateManager,
                            eventHub: foundation.EventHub,
                            cacheManager: foundation.CacheManager,
                            errorBoundary: foundation.ErrorBoundary
                        })
                    );
                    moduleInstances.AudioSyncCore = coreModules.AudioSyncCore;
                    appState.performance.moduleLoadTime.AudioSyncCore = Date.now();
                }
                
                // 初始化GlossaryCore
                if (global.EnglishSite && global.EnglishSite.GlossaryCore && moduleConfigs.glossary) {
                    coreModules.GlossaryCore = new global.EnglishSite.GlossaryCore(
                        moduleConfigs.glossary.container,
                        Object.assign({}, moduleConfigs.glossary, {
                            stateManager: foundation.StateManager,
                            eventHub: foundation.EventHub,
                            cacheManager: foundation.CacheManager,
                            errorBoundary: foundation.ErrorBoundary
                        })
                    );
                    moduleInstances.GlossaryCore = coreModules.GlossaryCore;
                    appState.performance.moduleLoadTime.GlossaryCore = Date.now();
                }
                
                return true;
            } catch (error) {
                throw new Error('Core modules initialization failed: ' + error.message);
            }
        }
        
        function setupModuleIntegration(options) {
            try {
                updateLoadingProgress('设置模块集成...', 70);
                
                // 设置模块间通信
                setupModuleCommunication();
                
                // 设置数据同步
                setupDataSynchronization();
                
                // 设置错误处理集成
                setupErrorHandlingIntegration();
                
                return true;
            } catch (error) {
                throw new Error('Module integration setup failed: ' + error.message);
            }
        }
        
        function restoreApplicationState(options) {
            try {
                updateLoadingProgress('恢复应用状态...', 85);
                
                // 恢复用户偏好
                restoreUserPreferences();
                
                // 恢复应用数据
                restoreApplicationData();
                
                // 恢复模块状态
                restoreModuleStates();
                
                return true;
            } catch (error) {
                DEBUG_WARN('[AppController] 状态恢复失败:', error);
                // 状态恢复失败不阻止启动
                return true;
            }
        }
        
        function finalizeStartup(options) {
            try {
                updateLoadingProgress('完成启动...', 95);
                
                // 启动健康检查
                startHealthCheck();
                
                // 启动性能监控
                startPerformanceMonitoring();
                
                // 设置PWA功能
                if (appConfig.enablePWA) {
                    setupPWAFeatures();
                }
                
                // 设置离线功能
                if (appConfig.enableOffline) {
                    setupOfflineFeatures();
                }
                
                return true;
            } catch (error) {
                DEBUG_WARN('[AppController] 启动完成化失败:', error);
                return true;
            }
        }
        
        function completeStartup() {
            try {
                // 清理启动定时器
                if (startupTimer) {
                    startupTimer.clear();
                    startupTimer = null;
                }
                
                // 计算启动时间
                appState.loadTime = Date.now() - appState.startTime;
                appState.performance.startupTime = appState.loadTime;
                appState.performance.lastUpdate = Date.now();
                
                // 更新状态
                appState.phase = 'running';
                appState.retryCount = 0;
                criticalErrorCount = 0; // 重置关键错误计数
                
                // 隐藏加载指示器
                hideLoadingIndicator();
                
                // 触发启动完成事件
                emitEvent('app:started', {
                    loadTime: appState.loadTime,
                    modules: Object.keys(moduleInstances)
                });
                
                if (appConfig.debug) {
                    DEBUG_LOG('[AppController] 应用启动完成，耗时:', appState.loadTime + 'ms');
                }
                
            } catch (error) {
                handleCriticalError('completeStartup', error);
            }
        }
        
        // 🔧 内部方法 - 模块管理
        
        function initializeModule(name, options) {
            try {
                var moduleInfo = moduleRegistry[name];
                if (!moduleInfo) {
                    throw new Error('Module not registered: ' + name);
                }
                
                if (moduleInfo.initialized) {
                    return moduleInfo.instance;
                }
                
                // 检查依赖
                if (!checkModuleDependencies(name)) {
                    throw new Error('Module dependencies not satisfied: ' + name);
                }
                
                // 创建实例
                var startTime = Date.now();
                
                var config = Object.assign({}, moduleInfo.config, options);
                
                // 注入Foundation Layer依赖
                config.stateManager = foundation.StateManager;
                config.eventHub = foundation.EventHub;
                config.cacheManager = foundation.CacheManager;
                config.errorBoundary = foundation.ErrorBoundary;
                
                moduleInfo.instance = new moduleInfo.moduleClass(config);
                moduleInfo.initialized = true;
                moduleInfo.startTime = startTime;
                moduleInfo.loadTime = Date.now() - startTime;
                moduleInfo.status = 'initialized';
                
                moduleInstances[name] = moduleInfo.instance;
                appState.performance.moduleLoadTime[name] = moduleInfo.loadTime;
                
                if (appConfig.debug) {
                    DEBUG_LOG('[AppController] 模块初始化完成:', name, moduleInfo.loadTime + 'ms');
                }
                
                return moduleInfo.instance;
            } catch (error) {
                throw new Error('Module initialization failed [' + name + ']: ' + error.message);
            }
        }
        
        function destroyModule(name) {
            try {
                var moduleInfo = moduleRegistry[name];
                if (!moduleInfo || !moduleInfo.initialized) {
                    return false;
                }
                
                // 销毁实例
                if (moduleInfo.instance && typeof moduleInfo.instance.destroy === 'function') {
                    moduleInfo.instance.destroy();
                }
                
                // 清理引用
                moduleInfo.instance = null;
                moduleInfo.initialized = false;
                moduleInfo.status = 'destroyed';
                delete moduleInstances[name];
                
                // 从foundation和coreModules中移除
                if (foundation[name]) {
                    foundation[name] = null;
                }
                if (coreModules[name]) {
                    coreModules[name] = null;
                }
                
                if (appConfig.debug) {
                    DEBUG_LOG('[AppController] 模块已销毁:', name);
                }
                
                return true;
            } catch (error) {
                handleError('destroyModule', error);
                return false;
            }
        }
        
        function checkModuleDependencies(name) {
            var moduleInfo = moduleRegistry[name];
            if (!moduleInfo.dependencies || moduleInfo.dependencies.length === 0) {
                return true;
            }
            
            for (var i = 0; i < moduleInfo.dependencies.length; i++) {
                var dependency = moduleInfo.dependencies[i];
                var depModule = moduleRegistry[dependency];
                
                if (!depModule || !depModule.initialized) {
                    return false;
                }
            }
            
            return true;
        }
        
        function pauseAllModules() {
            for (var name in moduleInstances) {
                if (moduleInstances.hasOwnProperty(name)) {
                    var instance = moduleInstances[name];
                    if (instance && typeof instance.pause === 'function') {
                        try {
                            instance.pause();
                        } catch (error) {
                            handleError('pauseModule:' + name, error);
                        }
                    }
                }
            }
        }
        
        function resumeAllModules() {
            for (var name in moduleInstances) {
                if (moduleInstances.hasOwnProperty(name)) {
                    var instance = moduleInstances[name];
                    if (instance && typeof instance.resume === 'function') {
                        try {
                            instance.resume();
                        } catch (error) {
                            handleError('resumeModule:' + name, error);
                        }
                    }
                }
            }
        }
        
        function destroyAllModules() {
            var moduleNames = Object.keys(moduleInstances);
            
            // 按依赖关系倒序销毁
            for (var i = moduleNames.length - 1; i >= 0; i--) {
                destroyModule(moduleNames[i]);
            }
        }
        
        // 🔧 内部方法 - 系统集成
        
        function setupGlobalNamespace() {
            if (typeof global.EnglishSite === 'undefined') {
                global.EnglishSite = {};
            }
            
            global.EnglishSite.App = self;
            global.EnglishSite.version = appConfig.version;
        }
        
        function setupSystemEventHandlers() {
            if (!foundation.EventHub) return;
            
            // 模块事件处理
            foundation.EventHub.on('*:error', function(data) {
                handleModuleError(data.context, data);
            });
            
            foundation.EventHub.on('*:initialized', function(data) {
                if (appConfig.debug) {
                    DEBUG_LOG('[AppController] 模块初始化事件:', data);
                }
            });
            
            // 导航事件处理
            foundation.EventHub.on('navigation:changed', function(data) {
                updateApplicationURL(data.path);
            });
            
            // 音频事件处理
            foundation.EventHub.on('audioSync:play', function() {
                updateApplicationState('playing');
            });
            
            foundation.EventHub.on('audioSync:pause', function() {
                updateApplicationState('paused');
            });
            
            // 词汇表事件处理
            foundation.EventHub.on('glossary:shown', function(data) {
                trackUserInteraction('glossary_lookup', data.word);
            });
        }
        
        function setupModuleCommunication() {
            if (!foundation.EventHub) return;
            
            // 设置模块间通信桥梁
            foundation.EventHub.on('navigation:opened', function() {
                // 暂停音频播放
                if (coreModules.AudioSyncCore && typeof coreModules.AudioSyncCore.pause === 'function') {
                    try {
                        coreModules.AudioSyncCore.pause();
                    } catch (error) {
                        DEBUG_WARN('[AppController] 音频暂停失败:', error);
                    }
                }
            });
            
            foundation.EventHub.on('audioSync:timeUpdate', function(data) {
                // 同步字幕高亮到导航
                if (foundation.StateManager) {
                    foundation.StateManager.setState('app.currentTime', data.currentTime);
                }
            });
            
            foundation.EventHub.on('glossary:bookmarkChanged', function(data) {
                // 同步书签到缓存
                if (foundation.CacheManager) {
                    foundation.CacheManager.cache('bookmarks:' + data.word, data.bookmarked);
                }
            });
        }
        
        function setupDataSynchronization() {
            if (!foundation.StateManager) return;
            
            // 设置跨模块数据同步
            foundation.StateManager.watch('user', function(userData) {
                // 用户数据变化时通知所有模块
                if (foundation.EventHub) {
                    foundation.EventHub.emit('app:userChanged', userData);
                }
            });
            
            foundation.StateManager.watch('app.theme', function(theme) {
                // 主题变化时更新UI
                updateApplicationTheme(theme);
            });
        }
        
        function setupErrorHandlingIntegration() {
            if (!foundation.ErrorBoundary) return;
            
            // 设置模块错误恢复策略
            foundation.ErrorBoundary.setRecoveryStrategy('navigation', function(error) {
                // 导航模块错误：重新初始化
                try {
                    if (coreModules.NavigationCore) {
                        destroyModule('NavigationCore');
                        initializeModule('NavigationCore');
                    }
                    return true;
                } catch (recoveryError) {
                    return false;
                }
            });
            
            foundation.ErrorBoundary.setRecoveryStrategy('audioSync', function(error) {
                // 音频同步错误：停止播放
                try {
                    if (coreModules.AudioSyncCore && typeof coreModules.AudioSyncCore.stop === 'function') {
                        coreModules.AudioSyncCore.stop();
                    }
                    return { fallbackMode: true };
                } catch (recoveryError) {
                    return false;
                }
            });
            
            foundation.ErrorBoundary.setRecoveryStrategy('glossary', function(error) {
                // 词汇表错误：禁用功能
                return { disabled: true, reason: 'error' };
            });
        }
        
        // 🔧 内部方法 - UI和用户体验
        
        function createUIElements() {
            if (typeof document === 'undefined') return;
            
            try {
                // 创建加载指示器
                uiElements.loadingIndicator = document.createElement('div');
                uiElements.loadingIndicator.className = 'app-loading-indicator';
                uiElements.loadingIndicator.style.cssText = [
                    'position: fixed',
                    'top: 0',
                    'left: 0',
                    'right: 0',
                    'bottom: 0',
                    'background: rgba(255,255,255,0.95)',
                    'display: none',
                    'align-items: center',
                    'justify-content: center',
                    'z-index: 10000',
                    'font-family: -apple-system, BlinkMacSystemFont, sans-serif'
                ].join(';');
                
                uiElements.loadingIndicator.innerHTML = [
                    '<div style="text-align: center; max-width: 300px; padding: 20px;">',
                        '<div class="app-spinner" style="',
                            'width: 40px;',
                            'height: 40px;',
                            'border: 4px solid #f3f3f3;',
                            'border-top: 4px solid #3498db;',
                            'border-radius: 50%;',
                            'animation: app-spin 1s linear infinite;',
                            'margin: 0 auto 20px;',
                        '"></div>',
                        '<div class="app-loading-text" style="color: #333; font-size: 16px; margin-bottom: 10px;">',
                            '正在加载...',
                        '</div>',
                        '<div class="app-progress-bar" style="',
                            'width: 200px;',
                            'height: 4px;',
                            'background: #f0f0f0;',
                            'border-radius: 2px;',
                            'margin: 10px auto;',
                            'overflow: hidden;',
                        '">',
                            '<div class="app-progress-fill" style="',
                                'width: 0%;',
                                'height: 100%;',
                                'background: #3498db;',
                                'transition: width 0.3s ease;',
                            '"></div>',
                        '</div>',
                    '</div>'
                ].join('');
                
                // 添加CSS动画
                addAppStyles();
                
                document.body.appendChild(uiElements.loadingIndicator);
            } catch (error) {
                DEBUG_ERROR('[AppController] UI创建失败:', error);
            }
        }
        
        function addAppStyles() {
            if (document.getElementById('app-controller-styles')) return;
            
            var style = document.createElement('style');
            style.id = 'app-controller-styles';
            style.textContent = [
                '@keyframes app-spin {',
                '  0% { transform: rotate(0deg); }',
                '  100% { transform: rotate(360deg); }',
                '}',
                '.app-spinner {',
                '  animation: app-spin 1s linear infinite;',
                '}'
            ].join('');
            document.head.appendChild(style);
        }
        
        function showLoadingIndicator(text) {
            if (uiElements.loadingIndicator) {
                var textElement = uiElements.loadingIndicator.querySelector('.app-loading-text');
                if (textElement) {
                    textElement.textContent = text || '正在加载...';
                }
                
                uiElements.loadingIndicator.style.display = 'flex';
            }
        }
        
        function hideLoadingIndicator() {
            if (uiElements.loadingIndicator) {
                uiElements.loadingIndicator.style.display = 'none';
            }
        }
        
        function updateLoadingProgress(text, percentage) {
            if (uiElements.loadingIndicator) {
                var textElement = uiElements.loadingIndicator.querySelector('.app-loading-text');
                var progressElement = uiElements.loadingIndicator.querySelector('.app-progress-fill');
                
                if (textElement && text) {
                    textElement.textContent = text;
                }
                
                if (progressElement && typeof percentage === 'number') {
                    progressElement.style.width = Math.min(100, Math.max(0, percentage)) + '%';
                }
            }
        }
        
        function showCriticalErrorDialog() {
            var message = '应用遇到严重错误，已超过最大重试次数。请刷新页面重试。';
            
            if (typeof window !== 'undefined') {
                if (window.confirm && window.confirm(message + '\n\n是否立即刷新页面？')) {
                    window.location.reload();
                } else if (window.alert) {
                    window.alert(message);
                }
            }
        }
        
        function cleanupUIElements() {
            try {
                if (uiElements.loadingIndicator && uiElements.loadingIndicator.parentNode) {
                    uiElements.loadingIndicator.parentNode.removeChild(uiElements.loadingIndicator);
                }
                
                var styles = document.getElementById('app-controller-styles');
                if (styles && styles.parentNode) {
                    styles.parentNode.removeChild(styles);
                }
                
                uiElements = {};
            } catch (error) {
                DEBUG_ERROR('[AppController] UI清理失败:', error);
            }
        }
        
        // 🔧 内部方法 - 监控和性能
        
        function startHealthCheck() {
            stopHealthCheck();
            
            healthCheckTimer = setInterval(function() {
                if (!appState.isDestroyed) {
                    self.healthCheck();
                }
            }, appConfig.healthCheckInterval);
        }
        
        function stopHealthCheck() {
            if (healthCheckTimer) {
                clearInterval(healthCheckTimer);
                healthCheckTimer = null;
            }
        }
        
        function startPerformanceMonitoring() {
            stopPerformanceMonitoring();
            
            // 降低监控频率，减少性能影响
            performanceMonitor = setInterval(function() {
                if (!appState.isDestroyed) {
                    updatePerformanceMetrics();
                }
            }, 10000); // 每10秒更新一次
        }
        
        function stopPerformanceMonitoring() {
            if (performanceMonitor) {
                clearInterval(performanceMonitor);
                performanceMonitor = null;
            }
        }
        
        function updatePerformanceMetrics() {
            try {
                appState.performance.memoryUsage = getMemoryUsage();
                appState.performance.lastUpdate = Date.now();
                
                // 性能警告检查
                if (appState.performance.memoryUsage > 200 * 1024 * 1024) { // 200MB
                    emitEvent('app:performanceWarning', {
                        type: 'memory',
                        usage: appState.performance.memoryUsage
                    });
                }
                
                // 触发性能更新事件
                emitEvent('app:performanceUpdate', appState.performance);
                
            } catch (error) {
                handleError('updatePerformanceMetrics', error);
            }
        }
        
        function getMemoryUsage() {
            try {
                if (typeof performance !== 'undefined' && performance.memory) {
                    return performance.memory.usedJSHeapSize;
                }
                return 0;
            } catch (error) {
                return 0;
            }
        }
        
        function calculateErrorRate() {
            var recentErrors = appState.errors.filter(function(error) {
                return Date.now() - error.timestamp < 300000; // 最近5分钟
            });
            
            var totalOperations = Math.max(1, appState.performance.startupTime > 0 ? 1000 : 100);
            return recentErrors.length / totalOperations;
        }
        
        function checkModuleHealth(name) {
            try {
                var instance = moduleInstances[name];
                if (!instance) {
                    return { status: 'not_initialized' };
                }
                
                // 检查模块是否有健康检查方法
                if (typeof instance.getStats === 'function') {
                    var stats = instance.getStats();
                    
                    if (stats.errors && stats.errors > 10) {
                        return { status: 'unhealthy', reason: 'high_error_count' };
                    }
                    
                    if (stats.isDestroyed) {
                        return { status: 'destroyed' };
                    }
                    
                    return { status: 'healthy', stats: stats };
                }
                
                return { status: 'healthy' };
            } catch (error) {
                return { status: 'error', error: error.message };
            }
        }
        
        function setupVisibilityHandling() {
            if (typeof document !== 'undefined') {
                visibilityHandler = function() {
                    if (appState.isDestroyed) return;
                    
                    if (document.hidden) {
                        // 页面隐藏时暂停应用
                        self.pause();
                    } else {
                        // 页面可见时恢复应用
                        if (appState.phase === 'paused') {
                            self.resume();
                        }
                    }
                };
                
                document.addEventListener('visibilitychange', visibilityHandler);
            }
        }
        
        // 🔧 内部方法 - 错误处理
        
        function setupGlobalErrorHandling() {
            // 全局错误捕获
            if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                    handleCriticalError('global', e.error || new Error(e.message));
                });
                
                window.addEventListener('unhandledrejection', function(e) {
                    handleCriticalError('promise', e.reason);
                });
            }
        }
        
        function handleError(context, error) {
            if (errorHandlingActive) return; // 防止递归
            
            try {
                errorHandlingActive = true;
                
                var errorInfo = {
                    context: context,
                    message: error.message || String(error),
                    timestamp: Date.now(),
                    phase: appState.phase
                };
                
                appState.errors.push(errorInfo);
                appState.performance.errorCount++;
                
                // 限制错误历史大小
                if (appState.errors.length > 100) {
                    appState.errors.splice(0, 50);
                }
                
                if (appConfig.debug) {
                    DEBUG_ERROR('[AppController:' + context + ']', error);
                }
                
                // 使用错误边界处理
                if (foundation.ErrorBoundary) {
                    foundation.ErrorBoundary.handle(error, errorInfo);
                }
                
                // 触发错误事件
                emitEvent('app:error', errorInfo);
                
            } catch (criticalError) {
                DEBUG_ERROR('[AppController] Critical error in error handler:', criticalError);
            } finally {
                errorHandlingActive = false;
            }
        }
        
        function handleCriticalError(context, error) {
            try {
                criticalErrorCount++;
                appState.phase = 'error';
                
                var criticalErrorInfo = {
                    context: 'CRITICAL:' + context,
                    message: error.message || String(error),
                    timestamp: Date.now(),
                    phase: appState.phase,
                    stack: error.stack,
                    count: criticalErrorCount
                };
                
                appState.errors.push(criticalErrorInfo);
                
                DEBUG_ERROR('[AppController] CRITICAL ERROR [' + context + ']:', error);
                
                // 如果关键错误过多，停止自动恢复
                if (criticalErrorCount < maxCriticalErrors) {
                    // 尝试自动恢复
                    setTimeout(function() {
                        if (!appState.isDestroyed) {
                            self.recover();
                        }
                    }, 1000);
                } else {
                    // 显示关键错误对话框
                    showCriticalErrorDialog();
                }
                
                // 触发关键错误事件
                emitEvent('app:criticalError', criticalErrorInfo);
                
            } catch (e) {
                // 最后的错误处理
                DEBUG_ERROR('[AppController] Fatal error in critical error handler:', e);
                if (typeof window !== 'undefined' && window.alert) {
                    window.alert('应用遇到致命错误，请刷新页面');
                }
            }
        }
        
        function handleModuleError(context, errorData) {
            handleError('module:' + context, new Error(errorData.message || 'Module error'));
        }
        
        function handleStartupError(step, error) {
            handleCriticalError('startup:' + step, error);
            
            // 显示启动错误
            updateLoadingProgress('启动失败: ' + step, 0);
            
            setTimeout(function() {
                hideLoadingIndicator();
                if (typeof window !== 'undefined' && window.alert) {
                    window.alert('应用启动失败，请刷新页面重试');
                }
            }, 2000);
        }
        
        function handleStartupTimeout() {
            handleCriticalError('startup', new Error('Startup timeout exceeded'));
            
            updateLoadingProgress('启动超时，请重试', 0);
            
            setTimeout(function() {
                hideLoadingIndicator();
                if (typeof window !== 'undefined' && window.alert) {
                    window.alert('应用启动超时，请检查网络连接后重试');
                }
            }, 2000);
        }
        
        // 🔧 内部方法 - 辅助功能
        
        function registerDefaultModules() {
            // 注册Foundation Layer模块
            if (global.EnglishSite) {
                if (global.EnglishSite.StateManager) {
                    this.registerModule('StateManager', global.EnglishSite.StateManager, []);
                }
                if (global.EnglishSite.EventHub) {
                    this.registerModule('EventHub', global.EnglishSite.EventHub, []);
                }
                if (global.EnglishSite.CacheManager) {
                    this.registerModule('CacheManager', global.EnglishSite.CacheManager, []);
                }
                if (global.EnglishSite.ErrorBoundary) {
                    this.registerModule('ErrorBoundary', global.EnglishSite.ErrorBoundary, []);
                }
                /*
                // 注册Core Modules
                if (global.EnglishSite.NavigationCore) {
                    this.registerModule('NavigationCore', global.EnglishSite.NavigationCore, 
                        ['StateManager', 'EventHub', 'CacheManager', 'ErrorBoundary']);
                }
                if (global.EnglishSite.AudioSyncCore) {
                    this.registerModule('AudioSyncCore', global.EnglishSite.AudioSyncCore, 
                        ['StateManager', 'EventHub', 'CacheManager', 'ErrorBoundary']);
                }
                if (global.EnglishSite.GlossaryCore) {
                    this.registerModule('GlossaryCore', global.EnglishSite.GlossaryCore, 
                        ['StateManager', 'EventHub', 'CacheManager', 'ErrorBoundary']);
                }
                */
            }
        }
        
        function detectEnvironment() {
            var env = {
                isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
                isIOS: typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent),
                isStandalone: typeof window !== 'undefined' && window.navigator.standalone,
                isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
            };
            
            appState.environment = env;
            
            if (foundation.StateManager) {
                foundation.StateManager.setState('app.environment', env);
            }
        }
        
        function emitEvent(eventName, data) {
            try {
                if (foundation.EventHub && !appState.isDestroyed) {
                    foundation.EventHub.emit(eventName, data);
                }
            } catch (error) {
                DEBUG_ERROR('[AppController] Event emission failed:', error);
            }
        }
        
        function restoreUserPreferences() {
            // 恢复用户偏好设置
            if (foundation.StateManager) {
                var preferences = foundation.StateManager.getState('user.preferences');
                if (preferences) {
                    applyUserPreferences(preferences);
                }
            }
        }
        
        function restoreApplicationData() {
            // 恢复应用数据
            if (foundation.CacheManager) {
                var appData = foundation.CacheManager.cache('app_data');
                if (appData) {
                    if (foundation.StateManager) {
                        foundation.StateManager.setState('app.data', appData);
                    }
                }
            }
        }
        
        function restoreModuleStates() {
            // 让各模块恢复自己的状态
            // 模块初始化时会自动恢复状态
        }
        
        function applyUserPreferences(preferences) {
            // 应用用户偏好
            if (preferences.theme) {
                updateApplicationTheme(preferences.theme);
            }
            
            if (preferences.language) {
                updateApplicationLanguage(preferences.language);
            }
        }
        
        function updateApplicationTheme(theme) {
            if (typeof document !== 'undefined') {
                document.body.className = (document.body.className || '').replace(/theme-\w+/g, '') + ' theme-' + theme;
            }
        }
        
        function updateApplicationLanguage(language) {
            if (typeof document !== 'undefined') {
                document.documentElement.lang = language;
            }
        }
        
        function updateApplicationURL(path) {
            if (typeof window !== 'undefined' && window.history && window.history.pushState) {
                try {
                    window.history.pushState(null, '', path);
                } catch (error) {
                    // 忽略URL更新错误
                }
            }
        }
        
        function updateApplicationState(state) {
            if (foundation.StateManager) {
                foundation.StateManager.setState('app.playbackState', state);
            }
        }
        
        function trackUserInteraction(action, data) {
            if (appConfig.enableAnalytics) {
                // 用户行为分析
                if (foundation.StateManager) {
                    var interactions = foundation.StateManager.getState('app.interactions') || [];
                    interactions.push({
                        action: action,
                        data: data,
                        timestamp: Date.now()
                    });
                    
                    // 限制交互历史大小
                    if (interactions.length > 1000) {
                        interactions = interactions.slice(-500);
                    }
                    
                    foundation.StateManager.setState('app.interactions', interactions);
                }
            }
        }
        
        function setupPWAFeatures() {
            // PWA功能设置
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function(error) {
                    DEBUG_WARN('[AppController] Service Worker registration failed:', error);
                });
            }
        }
        
        function setupOfflineFeatures() {
            // 离线功能设置
            if (typeof window !== 'undefined') {
                window.addEventListener('online', function() {
                    emitEvent('app:online');
                });
                
                window.addEventListener('offline', function() {
                    emitEvent('app:offline');
                });
            }
        }
        
        function cleanupResources() {
            // 清理定时器
            stopHealthCheck();
            stopPerformanceMonitoring();
            
            if (startupTimer) {
                startupTimer.clear();
                startupTimer = null;
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AppController;
    } else if (typeof global !== 'undefined') {
        global.AppController = AppController;
        
        // 添加到EnglishSite命名空间
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        if (!global.EnglishSite.AppController) {
            global.EnglishSite.AppController = AppController;
        } else {
            DEBUG_WARN('[AppController] EnglishSite.AppController 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);