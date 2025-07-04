// js/foundation/dependency-container.js - 依赖注入容器
// 🚀 统一的单例依赖管理，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    /**
     * 🎯 DependencyContainer - 依赖注入容器
     * 功能：单例管理、依赖解析、生命周期控制
     * 解决：重复实例创建、状态不同步问题
     */
    function DependencyContainer() {
        var instances = {};
        var constructors = {};
        var isInitialized = false;
        
        // 🔑 注册依赖构造函数
        this.register = function(name, constructor, config) {
            if (typeof constructor !== 'function') {
                throw new Error('Constructor must be a function for: ' + name);
            }
            
            constructors[name] = {
                constructor: constructor,
                config: config || {},
                singleton: true // 默认单例
            };
        };
        
        // 🔑 获取依赖实例（单例）
        this.get = function(name) {
            // 如果已存在实例，直接返回
            if (instances[name]) {
                return instances[name];
            }
            
            // 检查是否已注册
            var dependency = constructors[name];
            if (!dependency) {
                console.warn('[DependencyContainer] Dependency not found:', name);
                return null;
            }
            
            try {
                // 创建实例
                var instance = new dependency.constructor(dependency.config);
                
                // 缓存实例
                if (dependency.singleton) {
                    instances[name] = instance;
                }
                
                return instance;
            } catch (error) {
                console.error('[DependencyContainer] Failed to create instance:', name, error);
                return null;
            }
        };
        
        // 🔑 检查依赖是否存在
        this.has = function(name) {
            return !!constructors[name];
        };
        
        // 🔑 获取所有可用依赖名称
        this.getAvailable = function() {
            return Object.keys(constructors);
        };
        
        // 🔑 清理实例（用于重启）
        this.clear = function(name) {
            if (name) {
                // 清理特定实例
                if (instances[name] && typeof instances[name].destroy === 'function') {
                    instances[name].destroy();
                }
                delete instances[name];
            } else {
                // 清理所有实例
                for (var instanceName in instances) {
                    if (instances[instanceName] && typeof instances[instanceName].destroy === 'function') {
                        instances[instanceName].destroy();
                    }
                }
                instances = {};
            }
        };
        
        // 🔑 初始化容器
        this.initialize = function() {
            if (isInitialized) return true;
            
            try {
                // 自动注册全局可用的依赖
                this.autoRegisterGlobalDependencies();
                isInitialized = true;
                return true;
            } catch (error) {
                console.error('[DependencyContainer] Initialization failed:', error);
                return false;
            }
        };
        
        // 🔧 自动注册全局依赖
        this.autoRegisterGlobalDependencies = function() {
            if (typeof global.EnglishSite !== 'undefined') {
                var availableDeps = [
                    'StateManager',
                    'EventHub', 
                    'CacheManager',
                    'ErrorBoundary',
                    'NavigationCore',
                    'AudioSyncCore',
                    'GlossaryCore',
                    'WordFrequencyCore'
                ];
                
                availableDeps.forEach(function(depName) {
                    if (global.EnglishSite[depName]) {
                        // 为每个依赖设置默认配置
                        var defaultConfig = getDefaultConfig(depName);
                        this.register(depName, global.EnglishSite[depName], defaultConfig);
                    }
                }.bind(this));
            }
        };
        
        // 🔧 获取默认配置
        function getDefaultConfig(depName) {
            var configs = {
                StateManager: {},
                EventHub: {},
                CacheManager: {
                    maxMemorySize: 50,
                    maxStorageSize: 200,
                    defaultTTL: 3600000,
                    namespace: 'learner_cache'
                },
                ErrorBoundary: {},
                NavigationCore: {
                    breakpoint: 768,
                    animationDuration: 300,
                    enableTouch: true
                },
                AudioSyncCore: {
                    animationDuration: 200,
                    enableTouch: true,
                    enableKeyboard: true
                },
                GlossaryCore: {
                    triggerEvent: 'click',
                    enableTouch: true,
                    enableAudio: true
                },
                WordFrequencyCore: {
                    enablePersonalization: true,
                    enableRealTimeAnalysis: true
                }
            };
            
            return configs[depName] || {};
        }
        
        // 🔑 批量获取依赖（用于注入）
        this.inject = function(dependencies) {
            var injected = {};
            
            if (Array.isArray(dependencies)) {
                dependencies.forEach(function(depName) {
                    injected[depName] = this.get(depName);
                }.bind(this));
            } else if (typeof dependencies === 'object') {
                for (var key in dependencies) {
                    injected[key] = this.get(dependencies[key]);
                }
            }
            
            return injected;
        };
        
        // 🔑 获取状态信息
        this.getStatus = function() {
            var status = {
                initialized: isInitialized,
                registered: Object.keys(constructors).length,
                instantiated: Object.keys(instances).length,
                dependencies: {}
            };
            
            // 详细依赖状态
            for (var name in constructors) {
                status.dependencies[name] = {
                    registered: true,
                    instantiated: !!instances[name],
                    hasDestroy: instances[name] && typeof instances[name].destroy === 'function'
                };
            }
            
            return status;
        };
    }
    
    // 创建全局单例容器
    var globalContainer = new DependencyContainer();
    
    /**
     * 🎯 改进的依赖注入辅助函数
     * 供各模块使用，替换原有的injectDependencies
     */
    function createDependencyInjector(container) {
        return function injectDependencies(options) {
            options = options || {};
            
            var dependencies = {
                stateManager: null,
                eventHub: null,
                cacheManager: null,
                errorBoundary: null
            };
            
            try {
                // 优先使用用户传入的依赖
                if (options.stateManager) {
                    dependencies.stateManager = options.stateManager;
                } else {
                    dependencies.stateManager = container.get('StateManager');
                }
                
                if (options.eventHub) {
                    dependencies.eventHub = options.eventHub;
                } else {
                    dependencies.eventHub = container.get('EventHub');
                }
                
                if (options.cacheManager) {
                    dependencies.cacheManager = options.cacheManager;
                } else {
                    dependencies.cacheManager = container.get('CacheManager');
                }
                
                if (options.errorBoundary) {
                    dependencies.errorBoundary = options.errorBoundary;
                } else {
                    dependencies.errorBoundary = container.get('ErrorBoundary');
                }
                
                return dependencies;
            } catch (error) {
                console.error('[DependencyInjector] Injection failed:', error);
                return dependencies; // 返回部分依赖
            }
        };
    }
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            DependencyContainer: DependencyContainer,
            createDependencyInjector: createDependencyInjector,
            globalContainer: globalContainer
        };
    } else if (typeof global !== 'undefined') {
        // 添加到全局
        global.DependencyContainer = DependencyContainer;
        global.createDependencyInjector = createDependencyInjector;
        
        // 添加到EnglishSite命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.DependencyContainer = DependencyContainer;
        global.EnglishSite.globalContainer = globalContainer;
        global.EnglishSite.createDependencyInjector = createDependencyInjector;
        
        // 立即初始化全局容器
        globalContainer.initialize();
    }
    
})(typeof window !== 'undefined' ? window : this);