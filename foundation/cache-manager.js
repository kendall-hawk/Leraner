// js/foundation/cache-manager.js - iOS兼容版缓存管理器
// 🚀 两级缓存系统，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    /**
     * 🎯 CacheManager - 缓存管理器
     * 功能：两级缓存、LRU策略、自动清理、版本控制
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function CacheManager(options) {
        options = options || {};
        
        // 配置参数
        var config = {
            maxMemorySize: options.maxMemorySize || 50, // 内存缓存最大项目数
            maxStorageSize: options.maxStorageSize || 200, // 持久缓存最大项目数
            defaultTTL: options.defaultTTL || 3600000, // 默认TTL 1小时
            cleanupInterval: options.cleanupInterval || 300000, // 清理间隔 5分钟
            compressionEnabled: options.compression !== false, // 启用压缩
            namespace: options.namespace || 'learner_cache'
        };
        
        // 私有变量
        var memoryCache = {};
        var memoryLRU = [];
        var storageCache = null;
        var statistics = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            cleanups: 0
        };
        var cleanupTimer = null;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            try {
                initializeStorage();
                startAutoCleanup();
                setupVisibilityHandling();
                console.log('[CacheManager] 初始化成功');
            } catch (error) {
                console.error('[CacheManager] 初始化失败:', error);
                statistics.errors++;
            }
        }
        
        // 🔑 设置缓存
        this.set = function(key, value, options) {
            options = options || {};
            
            try {
                var normalizedKey = normalizeKey(key);
                var ttl = options.ttl || config.defaultTTL;
                var forceStorage = options.persistent || false;
                
                var cacheItem = {
                    key: normalizedKey,
                    value: deepClone(value),
                    timestamp: Date.now(),
                    ttl: ttl,
                    expires: Date.now() + ttl,
                    hits: 0,
                    size: getDataSize(value)
                };
                
                // 内存缓存
                setMemoryCache(normalizedKey, cacheItem);
                
                // 持久缓存
                if (forceStorage || shouldPersist(cacheItem)) {
                    setPersistentCache(normalizedKey, cacheItem);
                }
                
                statistics.sets++;
                
                return true;
                
            } catch (error) {
                console.error('[CacheManager] 设置缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 获取缓存
        this.get = function(key) {
            try {
                var normalizedKey = normalizeKey(key);
                
                // 先从内存缓存查找
                var item = getMemoryCache(normalizedKey);
                
                if (item) {
                    if (isExpired(item)) {
                        this.delete(normalizedKey);
                        statistics.misses++;
                        return undefined;
                    }
                    
                    // 更新访问统计
                    item.hits++;
                    item.lastAccess = Date.now();
                    updateLRU(normalizedKey);
                    
                    statistics.hits++;
                    return deepClone(item.value);
                }
                
                // 再从持久缓存查找
                item = getPersistentCache(normalizedKey);
                
                if (item) {
                    if (isExpired(item)) {
                        this.delete(normalizedKey);
                        statistics.misses++;
                        return undefined;
                    }
                    
                    // 将热点数据提升到内存缓存
                    item.hits++;
                    item.lastAccess = Date.now();
                    setMemoryCache(normalizedKey, item);
                    
                    statistics.hits++;
                    return deepClone(item.value);
                }
                
                statistics.misses++;
                return undefined;
                
            } catch (error) {
                console.error('[CacheManager] 获取缓存失败:', error);
                statistics.errors++;
                return undefined;
            }
        };
        
        // 🔑 检查缓存是否存在
        this.has = function(key) {
            try {
                var normalizedKey = normalizeKey(key);
                
                // 检查内存缓存
                var item = getMemoryCache(normalizedKey);
                if (item && !isExpired(item)) {
                    return true;
                }
                
                // 检查持久缓存
                item = getPersistentCache(normalizedKey);
                if (item && !isExpired(item)) {
                    return true;
                }
                
                return false;
                
            } catch (error) {
                console.error('[CacheManager] 检查缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 删除缓存
        this.delete = function(key) {
            try {
                var normalizedKey = normalizeKey(key);
                var deleted = false;
                
                // 从内存缓存删除
                if (memoryCache[normalizedKey]) {
                    delete memoryCache[normalizedKey];
                    removeFromLRU(normalizedKey);
                    deleted = true;
                }
                
                // 从持久缓存删除
                if (storageCache && storageCache.removeItem) {
                    var storageKey = config.namespace + ':' + normalizedKey;
                    storageCache.removeItem(storageKey);
                    deleted = true;
                }
                
                if (deleted) {
                    statistics.deletes++;
                }
                
                return deleted;
                
            } catch (error) {
                console.error('[CacheManager] 删除缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 批量清理
        this.clear = function(pattern) {
            try {
                var count = 0;
                
                if (!pattern) {
                    // 清理所有
                    memoryCache = {};
                    memoryLRU = [];
                    
                    if (storageCache && storageCache.clear) {
                        // 只清理我们命名空间的数据
                        clearNamespacedStorage();
                    }
                    
                    count = Object.keys(memoryCache).length;
                } else {
                    // 模式匹配清理
                    var regex = new RegExp(pattern);
                    var keysToDelete = [];
                    
                    // 收集需要删除的键
                    for (var key in memoryCache) {
                        if (memoryCache.hasOwnProperty(key) && regex.test(key)) {
                            keysToDelete.push(key);
                        }
                    }
                    
                    // 删除匹配的键
                    for (var i = 0; i < keysToDelete.length; i++) {
                        this.delete(keysToDelete[i]);
                        count++;
                    }
                }
                
                statistics.cleanups++;
                return count;
                
            } catch (error) {
                console.error('[CacheManager] 清理缓存失败:', error);
                statistics.errors++;
                return 0;
            }
        };
        
        // 🔑 获取统计信息
        this.stats = function() {
            var memorySize = Object.keys(memoryCache).length;
            var totalMemoryBytes = 0;
            
            for (var key in memoryCache) {
                if (memoryCache.hasOwnProperty(key)) {
                    totalMemoryBytes += memoryCache[key].size || 0;
                }
            }
            
            return {
                hits: statistics.hits,
                misses: statistics.misses,
                hitRate: statistics.hits / (statistics.hits + statistics.misses) || 0,
                sets: statistics.sets,
                deletes: statistics.deletes,
                errors: statistics.errors,
                cleanups: statistics.cleanups,
                memoryItems: memorySize,
                memoryBytes: totalMemoryBytes,
                storageSupported: !!storageCache
            };
        };
        
        // 🔑 手动清理过期项
        this.cleanup = function() {
            try {
                var cleaned = 0;
                var now = Date.now();
                var keysToDelete = [];
                
                // 清理内存缓存中的过期项
                for (var key in memoryCache) {
                    if (memoryCache.hasOwnProperty(key)) {
                        if (isExpired(memoryCache[key])) {
                            keysToDelete.push(key);
                        }
                    }
                }
                
                for (var i = 0; i < keysToDelete.length; i++) {
                    this.delete(keysToDelete[i]);
                    cleaned++;
                }
                
                // 清理持久缓存需要遍历存储（性能考虑，可选择性执行）
                cleanupPersistentCache();
                
                statistics.cleanups++;
                return cleaned;
                
            } catch (error) {
                console.error('[CacheManager] 清理失败:', error);
                statistics.errors++;
                return 0;
            }
        };
        
        // 🔑 预热缓存
        this.preload = function(data) {
            try {
                var loaded = 0;
                
                if (Array.isArray(data)) {
                    for (var i = 0; i < data.length; i++) {
                        var item = data[i];
                        if (item.key && item.value !== undefined) {
                            this.set(item.key, item.value, item.options);
                            loaded++;
                        }
                    }
                } else if (typeof data === 'object') {
                    for (var key in data) {
                        if (data.hasOwnProperty(key)) {
                            this.set(key, data[key]);
                            loaded++;
                        }
                    }
                }
                
                return loaded;
                
            } catch (error) {
                console.error('[CacheManager] 预热失败:', error);
                statistics.errors++;
                return 0;
            }
        };
        
        // 🔧 内部工具函数
        function normalizeKey(key) {
            return String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        
        function setMemoryCache(key, item) {
            // 检查容量限制
            if (Object.keys(memoryCache).length >= config.maxMemorySize) {
                evictLRU();
            }
            
            memoryCache[key] = item;
            updateLRU(key);
        }
        
        function getMemoryCache(key) {
            return memoryCache[key];
        }
        
        function setPersistentCache(key, item) {
            if (!storageCache) return false;
            
            try {
                var storageKey = config.namespace + ':' + key;
                var data = {
                    item: item,
                    version: '2.0'
                };
                
                if (config.compressionEnabled) {
                    data = compressData(data);
                }
                
                storageCache.setItem(storageKey, JSON.stringify(data));
                return true;
                
            } catch (error) {
                // 可能是容量限制，尝试清理
                if (error.name === 'QuotaExceededError') {
                    cleanupPersistentCache();
                    
                    try {
                        storageCache.setItem(storageKey, JSON.stringify(data));
                        return true;
                    } catch (retryError) {
                        console.warn('[CacheManager] 持久缓存已满');
                    }
                }
                
                statistics.errors++;
                return false;
            }
        }
        
        function getPersistentCache(key) {
            if (!storageCache) return null;
            
            try {
                var storageKey = config.namespace + ':' + key;
                var stored = storageCache.getItem(storageKey);
                
                if (!stored) return null;
                
                var data = JSON.parse(stored);
                
                if (config.compressionEnabled && data.compressed) {
                    data = decompressData(data);
                }
                
                return data.item;
                
            } catch (error) {
                console.warn('[CacheManager] 持久缓存读取失败:', error);
                statistics.errors++;
                return null;
            }
        }
        
        function updateLRU(key) {
            // 移除旧位置
            removeFromLRU(key);
            
            // 添加到最前面
            memoryLRU.unshift(key);
        }
        
        function removeFromLRU(key) {
            var index = memoryLRU.indexOf(key);
            if (index !== -1) {
                memoryLRU.splice(index, 1);
            }
        }
        
        function evictLRU() {
            if (memoryLRU.length === 0) return;
            
            var keyToEvict = memoryLRU.pop();
            
            if (memoryCache[keyToEvict]) {
                // 如果是热点数据，保存到持久缓存
                var item = memoryCache[keyToEvict];
                if (item.hits > 2) {
                    setPersistentCache(keyToEvict, item);
                }
                
                delete memoryCache[keyToEvict];
            }
        }
        
        function isExpired(item) {
            if (!item || !item.expires) return false;
            return Date.now() > item.expires;
        }
        
        function shouldPersist(item) {
            // 基于大小和重要性决定是否持久化
            return item.size > 1000 || item.ttl > config.defaultTTL;
        }
        
        function initializeStorage() {
            // 尝试使用localStorage
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(config.namespace + ':test', 'test');
                    window.localStorage.removeItem(config.namespace + ':test');
                    storageCache = window.localStorage;
                    return;
                }
            } catch (error) {
                console.warn('[CacheManager] localStorage不可用');
            }
            
            // 降级到sessionStorage
            try {
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    window.sessionStorage.setItem(config.namespace + ':test', 'test');
                    window.sessionStorage.removeItem(config.namespace + ':test');
                    storageCache = window.sessionStorage;
                    return;
                }
            } catch (error) {
                console.warn('[CacheManager] sessionStorage不可用');
            }
            
            // 最终降级到内存存储
            storageCache = createMemoryStorage();
        }
        
        function createMemoryStorage() {
            var memoryStorage = {};
            
            return {
                setItem: function(key, value) {
                    memoryStorage[key] = String(value);
                },
                getItem: function(key) {
                    return memoryStorage[key] || null;
                },
                removeItem: function(key) {
                    delete memoryStorage[key];
                },
                clear: function() {
                    memoryStorage = {};
                },
                length: function() {
                    return Object.keys(memoryStorage).length;
                }
            };
        }
        
        function startAutoCleanup() {
            if (cleanupTimer) {
                clearInterval(cleanupTimer);
            }
            
            cleanupTimer = setInterval(function() {
                self.cleanup();
            }, config.cleanupInterval);
        }
        
        function setupVisibilityHandling() {
            if (typeof document !== 'undefined') {
                // 页面隐藏时减少清理频率
                document.addEventListener('visibilitychange', function() {
                    if (document.hidden) {
                        if (cleanupTimer) {
                            clearInterval(cleanupTimer);
                            cleanupTimer = setInterval(function() {
                                self.cleanup();
                            }, config.cleanupInterval * 3); // 降低频率
                        }
                    } else {
                        startAutoCleanup(); // 恢复正常频率
                    }
                });
            }
        }
        
        function cleanupPersistentCache() {
            if (!storageCache) return;
            
            try {
                var keysToDelete = [];
                var prefix = config.namespace + ':';
                
                // 注意：不是所有存储实现都支持keys()方法
                // 这里使用一个简化的方法
                for (var i = 0; storageCache.length && i < storageCache.length; i++) {
                    var key = storageCache.key && storageCache.key(i);
                    if (key && key.indexOf(prefix) === 0) {
                        try {
                            var data = JSON.parse(storageCache.getItem(key));
                            if (data && data.item && isExpired(data.item)) {
                                keysToDelete.push(key);
                            }
                        } catch (parseError) {
                            // 损坏的数据，标记删除
                            keysToDelete.push(key);
                        }
                    }
                }
                
                // 删除过期项
                for (var j = 0; j < keysToDelete.length; j++) {
                    storageCache.removeItem(keysToDelete[j]);
                }
                
            } catch (error) {
                console.warn('[CacheManager] 持久缓存清理失败:', error);
            }
        }
        
        function clearNamespacedStorage() {
            if (!storageCache) return;
            
            try {
                var keysToDelete = [];
                var prefix = config.namespace + ':';
                
                for (var i = 0; storageCache.length && i < storageCache.length; i++) {
                    var key = storageCache.key && storageCache.key(i);
                    if (key && key.indexOf(prefix) === 0) {
                        keysToDelete.push(key);
                    }
                }
                
                for (var j = 0; j < keysToDelete.length; j++) {
                    storageCache.removeItem(keysToDelete[j]);
                }
                
            } catch (error) {
                console.warn('[CacheManager] 命名空间清理失败:', error);
            }
        }
        
        function compressData(data) {
            // 简单的压缩算法（实际项目中可使用更高效的压缩）
            try {
                var str = JSON.stringify(data);
                var compressed = str;
                
                // 简单的重复字符压缩
                compressed = compressed.replace(/(.)\1{3,}/g, function(match, char) {
                    return char + '{' + match.length + '}';
                });
                
                return {
                    compressed: true,
                    data: compressed,
                    originalSize: str.length,
                    compressedSize: compressed.length
                };
            } catch (error) {
                return data; // 压缩失败，返回原数据
            }
        }
        
        function decompressData(compressedData) {
            try {
                if (!compressedData.compressed) {
                    return compressedData;
                }
                
                var decompressed = compressedData.data;
                
                // 解压缩重复字符
                decompressed = decompressed.replace(/(.)\{(\d+)\}/g, function(match, char, count) {
                    return char.repeat(parseInt(count));
                });
                
                return JSON.parse(decompressed);
            } catch (error) {
                console.error('[CacheManager] 解压缩失败:', error);
                return null;
            }
        }
        
        function deepClone(obj) {
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }
            
            if (obj instanceof Date) {
                return new Date(obj.getTime());
            }
            
            if (Array.isArray(obj)) {
                var arrCopy = [];
                for (var i = 0; i < obj.length; i++) {
                    arrCopy[i] = deepClone(obj[i]);
                }
                return arrCopy;
            }
            
            var objCopy = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    objCopy[key] = deepClone(obj[key]);
                }
            }
            
            return objCopy;
        }
        
        function getDataSize(data) {
            try {
                return JSON.stringify(data).length;
            } catch (error) {
                return 0;
            }
        }
        
        // 立即初始化
        initialize();
        
        // 页面卸载时清理
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', function() {
                if (cleanupTimer) {
                    clearInterval(cleanupTimer);
                }
            });
        }
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CacheManager;
    } else if (typeof global !== 'undefined') {
        global.CacheManager = CacheManager;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.CacheManager = CacheManager;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);
