// js/core/safe-initializer.js - 安全的模块初始化器
// 🚀 解决循环依赖和初始化卡死问题

(function(global) {
    'use strict';

    // 🔧 防止重复执行
    if (global.SafeInitializer) {
        console.warn('[SafeInitializer] 已存在，跳过重复初始化');
        return;
    }

    /**
     * 🎯 SafeInitializer - 安全的模块初始化器
     * 解决问题：
     * 1. 循环依赖导致的初始化死锁
     * 2. 错误传播导致的系统崩溃  
     * 3. 模块加载顺序混乱
     * 4. 重复初始化问题
     */
    function SafeInitializer() {
        var modules = {};
        var initQueue = [];
        var isInitializing = false;
        var initialized = {};
        var failed = {};
        var maxRetries = 3;
        var initTimeout = 5000; // 5秒超时
        
        // 🔑 安全注册模块
        this.register = function(name, moduleFactory, dependencies) {
            dependencies = dependencies || [];
            
            modules[name] = {
                factory: moduleFactory,
                dependencies: dependencies,
                instance: null,
                retries: 0,
                status: 'pending' // pending, initializing, ready, failed
            };
            
            console.log('[SafeInitializer] 模块已注册:', name);
        };
        
        // 🔑 安全初始化所有模块
        this.initializeAll = function() {
            if (isInitializing) {
                console.warn('[SafeInitializer] 初始化已在进行中');
                return Promise.resolve();
            }
            
            return new Promise(function(resolve) {
                isInitializing = true;
                console.log('[SafeInitializer] 开始初始化所有模块...');
                
                var totalModules = Object.keys(modules).length;
                var completed = 0;
                
                // 设置超时保护
                var timeoutId = setTimeout(function() {
                    console.error('[SafeInitializer] 初始化超时，强制完成');
                    completeInitialization();
                }, initTimeout);
                
                function completeInitialization() {
                    clearTimeout(timeoutId);
                    isInitializing = false;
                    
                    var stats = getInitializationStats();
                    console.log('[SafeInitializer] 初始化完成:', stats);
                    resolve(stats);
                }
                
                function tryInitializeModule(name) {
                    var module = modules[name];
                    if (!module || module.status !== 'pending') {
                        return;
                    }
                    
                    // 检查依赖是否就绪
                    var depsReady = module.dependencies.every(function(dep) {
                        return initialized[dep] === true;
                    });
                    
                    if (!depsReady) {
                        return; // 依赖未就绪，等待下次尝试
                    }
                    
                    module.status = 'initializing';
                    console.log('[SafeInitializer] 正在初始化:', name);
                    
                    try {
                        // 安全执行模块工厂函数
                        var instance = module.factory();
                        
                        if (instance && typeof instance.initialize === 'function') {
                            // 如果模块有初始化方法，调用它
                            instance.initialize();
                        }
                        
                        module.instance = instance;
                        module.status = 'ready';
                        initialized[name] = true;
                        completed++;
                        
                        console.log('[SafeInitializer] 模块初始化成功:', name);
                        
                        // 触发下一轮初始化
                        setTimeout(initializeRound, 0);
                        
                    } catch (error) {
                        console.error('[SafeInitializer] 模块初始化失败:', name, error);
                        
                        module.retries++;
                        if (module.retries < maxRetries) {
                            module.status = 'pending'; // 重试
                            setTimeout(function() {
                                tryInitializeModule(name);
                            }, 1000 * module.retries); // 递增延迟重试
                        } else {
                            module.status = 'failed';
                            failed[name] = error;
                            completed++;
                            
                            // 触发下一轮，跳过失败的模块
                            setTimeout(initializeRound, 0);
                        }
                    }
                }
                
                function initializeRound() {
                    if (completed >= totalModules) {
                        completeInitialization();
                        return;
                    }
                    
                    var progress = false;
                    
                    for (var name in modules) {
                        if (modules[name].status === 'pending') {
                            tryInitializeModule(name);
                            progress = true;
                        }
                    }
                    
                    // 如果没有进展，但还有未完成的模块，强制完成
                    if (!progress && completed < totalModules) {
                        console.warn('[SafeInitializer] 检测到死锁，强制完成初始化');
                        completeInitialization();
                    }
                }
                
                // 开始第一轮初始化
                initializeRound();
            });
        };
        
        // 🔑 获取模块实例
        this.get = function(name) {
            var module = modules[name];
            return module && module.instance ? module.instance : null;
        };
        
        // 🔑 检查模块状态
        this.getStatus = function(name) {
            var module = modules[name];
            return module ? module.status : 'not_found';
        };
        
        // 🔑 获取初始化统计
        function getInitializationStats() {
            var stats = {
                total: Object.keys(modules).length,
                ready: Object.keys(initialized).length,
                failed: Object.keys(failed).length,
                pending: 0
            };
            
            for (var name in modules) {
                if (modules[name].status === 'pending' || modules[name].status === 'initializing') {
                    stats.pending++;
                }
            }
            
            return stats;
        }
        
        this.getStats = getInitializationStats;
        
        // 🔑 清理和重置
        this.reset = function() {
            modules = {};
            initQueue = [];
            isInitializing = false;
            initialized = {};
            failed = {};
        };
    }

    // 🔑 修复现有模块的问题
    function patchExistingModules() {
        // 创建安全的命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        
        // 防止模块自动初始化
        global.EnglishSite._SAFE_MODE = true;
        
        // 为现有模块提供安全的初始化环境
        var safeModules = [
            'CompatibilityUtils',
            'PerformanceUtils', 
            'DOMUtils',
            'MobileUtils',
            'CacheManager',
            'StateManager',
            'EventHub',
            'ErrorBoundary'
        ];
        
        safeModules.forEach(function(moduleName) {
            if (global[moduleName] || (global.EnglishSite && global.EnglishSite[moduleName])) {
                console.log('[SafeInitializer] 检测到模块:', moduleName);
            }
        });
    }

    // 🔑 提供统一的初始化接口
    function createUnifiedInitializer() {
        var initializer = new SafeInitializer();
        
        // 注册所有已知模块（按依赖顺序）
        var moduleDefinitions = [
            {
                name: 'CompatibilityUtils',
                dependencies: [],
                factory: function() {
                    var Constructor = global.CompatibilityUtils || (global.EnglishSite && global.EnglishSite.CompatibilityUtils);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'PerformanceUtils', 
                dependencies: [],
                factory: function() {
                    var Constructor = global.PerformanceUtils || (global.EnglishSite && global.EnglishSite.PerformanceUtils);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'DOMUtils',
                dependencies: ['CompatibilityUtils'],
                factory: function() {
                    var Constructor = global.DOMUtils || (global.EnglishSite && global.EnglishSite.DOMUtils);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'MobileUtils',
                dependencies: ['CompatibilityUtils'],
                factory: function() {
                    var Constructor = global.MobileUtils || (global.EnglishSite && global.EnglishSite.MobileUtils);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'ErrorBoundary',
                dependencies: [],
                factory: function() {
                    var Constructor = global.ErrorBoundary || (global.EnglishSite && global.EnglishSite.ErrorBoundary);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'EventHub',
                dependencies: ['ErrorBoundary'],
                factory: function() {
                    var Constructor = global.EventHub || (global.EnglishSite && global.EnglishSite.EventHub);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'CacheManager',
                dependencies: [],
                factory: function() {
                    var Constructor = global.CacheManager || (global.EnglishSite && global.EnglishSite.CacheManager);
                    return Constructor ? new Constructor() : null;
                }
            },
            {
                name: 'StateManager',
                dependencies: ['EventHub'],
                factory: function() {
                    var Constructor = global.StateManager || (global.EnglishSite && global.EnglishSite.StateManager);
                    return Constructor ? new Constructor() : null;
                }
            }
        ];
        
        // 注册所有模块
        moduleDefinitions.forEach(function(def) {
            initializer.register(def.name, def.factory, def.dependencies);
        });
        
        return initializer;
    }

    // 🚀 主要修复函数
    function fixInitializationIssues() {
        console.log('[SafeInitializer] 开始修复初始化问题...');
        
        try {
            // 1. 修复命名空间
            patchExistingModules();
            
            // 2. 创建统一初始化器
            var initializer = createUnifiedInitializer();
            
            // 3. 等待DOM就绪后初始化
            function startSafeInitialization() {
                console.log('[SafeInitializer] DOM就绪，开始安全初始化');
                
                initializer.initializeAll().then(function(stats) {
                    console.log('[SafeInitializer] 所有模块初始化完成:', stats);
                    
                    // 触发初始化完成事件
                    if (typeof window !== 'undefined') {
                        var event = new Event('EnglishSiteReady');
                        window.dispatchEvent(event);
                    }
                    
                    // 保存初始化器到全局，供其他模块使用
                    global.EnglishSite.initializer = initializer;
                    
                }).catch(function(error) {
                    console.error('[SafeInitializer] 初始化失败:', error);
                });
            }
            
            // 检查DOM状态
            if (typeof document !== 'undefined') {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', startSafeInitialization);
                } else {
                    // DOM已经就绪
                    setTimeout(startSafeInitialization, 0);
                }
            } else {
                // 非浏览器环境，直接初始化
                setTimeout(startSafeInitialization, 0);
            }
            
        } catch (error) {
            console.error('[SafeInitializer] 修复过程中出错:', error);
        }
    }
    
    // 🔗 导出
    global.SafeInitializer = SafeInitializer;
    
    // 🚀 立即开始修复（但不阻塞）
    setTimeout(fixInitializationIssues, 0);
    
    console.log('[SafeInitializer] 安全初始化器已就绪');

})(typeof window !== 'undefined' ? window : this);