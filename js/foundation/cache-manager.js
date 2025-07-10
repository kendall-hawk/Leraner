// 🚀 重构后的缓存管理器 - 使用统一基础设施
// js/foundation/cache-manager.js

(function(global) {
    'use strict';

    // 使用统一的模块定义接口
    global.EnglishSite.ModuleDefinition.define(
        'EnglishSite.CacheManager',
        [], // 无外部依赖，只依赖基础设施
        function(moduleContext) {
            var logger = moduleContext.logger;
            var resourceManager = moduleContext.resourceManager;
            var Security = moduleContext.security;
            var LRUCache = global.EnglishSite.LRUCache;
            
            /**
             * 🎯 CacheManager V2 - 重构版缓存管理器
             * 改进：
             * 1. 使用高效的LRU实现
             * 2. 统一的错误处理
             * 3. 完善的资源管理
             * 4. 安全的数据处理
             * 5. 性能监控集成
             */
            function CacheManager(options) {
                options = options || {};
                
                // 配置验证和默认值
                var config = this.validateConfig(options);
                
                // 使用高效的LRU缓存
                var memoryCache = new LRUCache(config.maxMemorySize);
                var storageCache = null;
                var statistics = {
                    hits: 0,
                    misses: 0,
                    sets: 0,
                    deletes: 0,
                    errors: 0,
                    cleanups: 0,
                    lastCleanup: Date.now()
                };
                
                var isDestroyed = false;
                var cleanupTimer = null;
                var self = this;
                
                // 初始化
                this.initialize(config);
                
                // 🔑 公开API
                this.set = moduleContext.errorHandler.wrap(function(key, value, options) {
                    if (isDestroyed) {
                        logger.warn('实例已销毁，无法设置缓存');
                        return false;
                    }
                    
                    options = options || {};
                    
                    // 输入验证
                    if (!Security.validate.isValidPath(key)) {
                        throw new Error('Invalid cache key: ' + key);
                    }
                    
                    var normalizedKey = this.normalizeKey(key);
                    var ttl = Math.max(60000, options.ttl || config.defaultTTL);
                    var forceStorage = options.persistent || false;
                    
                    var cacheItem = {
                        key: normalizedKey,
                        value: this.cloneValue(value),
                        timestamp: Date.now(),
                        ttl: ttl,
                        expires: Date.now() + ttl,
                        hits: 0,
                        size: this.calculateSize(value)
                    };
                    
                    // 内存缓存
                    memoryCache.put(normalizedKey, cacheItem);
                    
                    // 持久缓存
                    if (forceStorage || this.shouldPersist(cacheItem)) {
                        this.setPersistentCache(normalizedKey, cacheItem);
                    }
                    
                    statistics.sets++;
                    return true;
                    
                }.bind(this), 'CacheManager.set', { fallback: false });
                
                this.get = moduleContext.errorHandler.wrap(function(key) {
                    if (isDestroyed) {
                        return undefined;
                    }
                    
                    if (!Security.validate.isValidPath(key)) {
                        statistics.misses++;
                        return undefined;
                    }
                    
                    var normalizedKey = this.normalizeKey(key);
                    
                    // 先从内存缓存查找
                    var item = memoryCache.get(normalizedKey);
                    
                    if (item) {
                        if (this.isExpired(item)) {
                            this.delete(normalizedKey);
                            statistics.misses++;
                            return undefined;
                        }
                        
                        item.hits++;
                        item.lastAccess = Date.now();
                        statistics.hits++;
                        return this.cloneValue(item.value);
                    }
                    
                    // 再从持久缓存查找
                    item = this.getPersistentCache(normalizedKey);
                    
                    if (item) {
                        if (this.isExpired(item)) {
                            this.delete(normalizedKey);
                            statistics.misses++;
                            return undefined;
                        }
                        
                        // 热点数据提升到内存缓存
                        item.hits++;
                        item.lastAccess = Date.now();
                        memoryCache.put(normalizedKey, item);
                        
                        statistics.hits++;
                        return this.cloneValue(item.value);
                    }
                    
                    statistics.misses++;
                    return undefined;
                    
                }.bind(this), 'CacheManager.get', { fallback: undefined });
                
                this.has = moduleContext.errorHandler.wrap(function(key) {
                    return this.get(key) !== undefined;
                }.bind(this), 'CacheManager.has', { fallback: false });
                
                this.delete = moduleContext.errorHandler.wrap(function(key) {
                    if (isDestroyed || !Security.validate.isValidPath(key)) {
                        return false;
                    }
                    
                    var normalizedKey = this.normalizeKey(key);
                    var deleted = false;
                    
                    // 从内存缓存删除
                    if (memoryCache.has(normalizedKey)) {
                        memoryCache.delete(normalizedKey);
                        deleted = true;
                    }
                    
                    // 从持久缓存删除
                    if (storageCache) {
                        try {
                            var storageKey = config.namespace + ':' + normalizedKey;
                            storageCache.removeItem(storageKey);
                            deleted = true;
                        } catch (error) {
                            logger.warn('删除持久缓存失败:', error);
                        }
                    }
                    
                    if (deleted) {
                        statistics.deletes++;
                    }
                    
                    return deleted;
                    
                }.bind(this), 'CacheManager.delete', { fallback: false });
                
                this.clear = moduleContext.errorHandler.wrap(function(pattern) {
                    if (isDestroyed) {
                        return 0;
                    }
                    
                    var count = 0;
                    
                    if (!pattern) {
                        // 清理所有
                        count = memoryCache.size;
                        memoryCache.clear();
                        
                        if (storageCache) {
                            this.clearNamespacedStorage();
                        }
                    } else {
                        // 模式匹配清理 - 需要重新实现，因为LRU没有遍历接口
                        logger.warn('Pattern-based clearing not implemented in LRU version');
                    }
                    
                    statistics.cleanups++;
                    return count;
                    
                }.bind(this), 'CacheManager.clear', { fallback: 0 });
                
                this.stats = function() {
                    var memoryUsage = 0;
                    // LRU缓存的大小估算
                    // 注意：这里需要LRU缓存提供统计接口
                    
                    return {
                        hits: statistics.hits,
                        misses: statistics.misses,
                        hitRate: statistics.hits / Math.max(1, statistics.hits + statistics.misses),
                        sets: statistics.sets,
                        deletes: statistics.deletes,
                        errors: statistics.errors,
                        cleanups: statistics.cleanups,
                        memoryItems: memoryCache.size,
                        memoryBytes: memoryUsage,
                        storageSupported: !!storageCache,
                        isDestroyed: isDestroyed,
                        lastCleanup: statistics.lastCleanup
                    };
                };
                
                this.cleanup = moduleContext.errorHandler.wrap(function() {
                    if (isDestroyed) {
                        return 0;
                    }
                    
                    logger.time('cleanup');
                    
                    var cleaned = 0;
                    
                    // 由于使用LRU，过期项会自动被淘汰
                    // 这里主要清理持久缓存
                    if (storageCache) {
                        cleaned = this.cleanupPersistentCache();
                    }
                    
                    statistics.cleanups++;
                    statistics.lastCleanup = Date.now();
                    
                    logger.timeEnd('cleanup');
                    return cleaned;
                    
                }.bind(this), 'CacheManager.cleanup', { fallback: 0 });
                
                this.destroy = function() {
                    if (isDestroyed) {
                        return true;
                    }
                    
                    try {
                        isDestroyed = true;
                        
                        // 使用资源管理器清理所有资源
                        resourceManager.cleanup();
                        
                        // 清理缓存
                        memoryCache.clear();
                        
                        // 最后一次持久化（如果需要）
                        // this.persist();
                        
                        logger.log('CacheManager 已销毁');
                        return true;
                    } catch (error) {
                        logger.error('销毁失败:', error);
                        return false;
                    }
                };
                
                // 🔧 私有方法
                this.validateConfig = function(options) {
                    var defaultConfig = {
                        maxMemorySize: 50,
                        maxStorageSize: 200,
                        defaultTTL: 3600000, // 1小时
                        cleanupInterval: 300000, // 5分钟
                        compressionEnabled: true,
                        namespace: 'learner_cache'
                    };
                    
                    var config = Object.assign({}, defaultConfig, options);
                    
                    // 验证配置值
                    config.maxMemorySize = Math.max(10, Math.min(200, config.maxMemorySize));
                    config.maxStorageSize = Math.max(50, Math.min(1000, config.maxStorageSize));
                    config.defaultTTL = Math.max(60000, config.defaultTTL);
                    config.cleanupInterval = Math.max(30000, config.cleanupInterval);
                    
                    return config;
                };
                
                this.initialize = function(config) {
                    logger.log('初始化缓存管理器');
                    
                    try {
                        this.initializeStorage();
                        this.startAutoCleanup(config.cleanupInterval);
                        logger.log('缓存管理器初始化成功');
                    } catch (error) {
                        logger.error('初始化失败:', error);
                        statistics.errors++;
                    }
                };
                
                this.initializeStorage = function() {
                    // 优先使用localStorage
                    try {
                        if (typeof window !== 'undefined' && window.localStorage) {
                            var testKey = config.namespace + ':init_test';
                            window.localStorage.setItem(testKey, 'test');
                            window.localStorage.removeItem(testKey);
                            storageCache = window.localStorage;
                            logger.log('使用 localStorage');
                            return;
                        }
                    } catch (error) {
                        logger.warn('localStorage不可用:', error);
                    }
                    
                    // 降级到sessionStorage
                    try {
                        if (typeof window !== 'undefined' && window.sessionStorage) {
                            var testKey = config.namespace + ':init_test';
                            window.sessionStorage.setItem(testKey, 'test');
                            window.sessionStorage.removeItem(testKey);
                            storageCache = window.sessionStorage;
                            logger.log('使用 sessionStorage');
                            return;
                        }
                    } catch (error) {
                        logger.warn('sessionStorage不可用:', error);
                    }
                    
                    logger.warn('浏览器存储不可用，仅使用内存缓存');
                };
                
                this.startAutoCleanup = function(interval) {
                    if (cleanupTimer) {
                        clearInterval(cleanupTimer);
                    }
                    
                    cleanupTimer = setInterval(function() {
                        if (!isDestroyed) {
                            self.cleanup();
                        }
                    }, interval);
                    
                    // 使用资源管理器管理定时器
                    resourceManager.addTimer(cleanupTimer, 'interval');
                };
                
                this.normalizeKey = function(key) {
                    return String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
                };
                
                this.cloneValue = function(value) {
                    if (value === null || typeof value !== 'object') {
                        return value;
                    }
                    
                    try {
                        return Security.safeJSON.parse(Security.safeJSON.stringify(value));
                    } catch (error) {
                        logger.warn('值克隆失败，返回原值:', error);
                        return value;
                    }
                };
                
                this.calculateSize = function(value) {
                    try {
                        var str = Security.safeJSON.stringify(value);
                        return str ? str.length : 0;
                    } catch (error) {
                        return 0;
                    }
                };
                
                this.isExpired = function(item) {
                    if (!item || !item.expires) return false;
                    return Date.now() > item.expires;
                };
                
                this.shouldPersist = function(item) {
                    return item.size > 1000 || item.ttl > config.defaultTTL;
                };
                
                this.setPersistentCache = function(key, item) {
                    if (!storageCache) return false;
                    
                    try {
                        var storageKey = config.namespace + ':' + key;
                        var data = {
                            item: item,
                            version: '2.0',
                            timestamp: Date.now()
                        };
                        
                        var serialized = Security.safeJSON.stringify(data);
                        if (serialized && serialized !== '{}') {
                            storageCache.setItem(storageKey, serialized);
                            return true;
                        }
                        
                        return false;
                    } catch (error) {
                        if (error.name === 'QuotaExceededError' || error.code === 22) {
                            logger.warn('存储配额已满，尝试清理');
                            this.cleanupPersistentCache();
                        } else {
                            logger.warn('持久缓存设置失败:', error);
                        }
                        statistics.errors++;
                        return false;
                    }
                };
                
                this.getPersistentCache = function(key) {
                    if (!storageCache) return null;
                    
                    try {
                        var storageKey = config.namespace + ':' + key;
                        var stored = storageCache.getItem(storageKey);
                        
                        if (!stored) return null;
                        
                        var data = Security.safeJSON.parse(stored);
                        if (!data || !data.item) return null;
                        
                        return data.item;
                    } catch (error) {
                        logger.warn('持久缓存读取失败:', error);
                        statistics.errors++;
                        return null;
                    }
                };
                
                this.cleanupPersistentCache = function() {
                    if (!storageCache) return 0;
                    
                    try {
                        var cleaned = 0;
                        var prefix = config.namespace + ':';
                        var keysToDelete = [];
                        
                        // 收集过期的键
                        for (var i = 0; i < storageCache.length; i++) {
                            var key = storageCache.key(i);
                            if (key && key.indexOf(prefix) === 0) {
                                try {
                                    var stored = storageCache.getItem(key);
                                    var data = Security.safeJSON.parse(stored);
                                    if (data && data.item && this.isExpired(data.item)) {
                                        keysToDelete.push(key);
                                    }
                                } catch (parseError) {
                                    // 损坏的数据，标记删除
                                    keysToDelete.push(key);
                                }
                            }
                        }
                        
                        // 删除过期项
                        keysToDelete.forEach(function(key) {
                            try {
                                storageCache.removeItem(key);
                                cleaned++;
                            } catch (error) {
                                // 忽略删除错误
                            }
                        });
                        
                        return cleaned;
                    } catch (error) {
                        logger.warn('持久缓存清理失败:', error);
                        return 0;
                    }
                };
                
                this.clearNamespacedStorage = function() {
                    if (!storageCache) return;
                    
                    try {
                        var prefix = config.namespace + ':';
                        var keysToDelete = [];
                        
                        for (var i = 0; i < storageCache.length; i++) {
                            var key = storageCache.key(i);
                            if (key && key.indexOf(prefix) === 0) {
                                keysToDelete.push(key);
                            }
                        }
                        
                        keysToDelete.forEach(function(key) {
                            try {
                                storageCache.removeItem(key);
                            } catch (error) {
                                // 忽略删除错误
                            }
                        });
                    } catch (error) {
                        logger.warn('命名空间清理失败:', error);
                    }
                };
            }
            
            return CacheManager;
        }
    );
    
})(typeof window !== 'undefined' ? window : this);