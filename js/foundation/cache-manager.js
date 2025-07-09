// js/foundation/cache-manager.js - iOS兼容版缓存管理器
// 🚀 两级缓存系统，确保iOS Safari 12+兼容性

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
    function safeJSONParse(str, fallback) {
        if (!str || typeof str !== 'string') {
            return fallback || null;
        }
        try {
            var result = JSON.parse(str);
            return result !== null ? result : (fallback || null);
        } catch (error) {
            DEBUG_WARN('[CacheManager] JSON解析失败:', error.message);
            return fallback || null;
        }
    }

    function safeJSONStringify(obj, fallback) {
        if (obj === null || obj === undefined) {
            return fallback || 'null';
        }
        try {
            return JSON.stringify(obj);
        } catch (error) {
            DEBUG_WARN('[CacheManager] JSON序列化失败:', error.message);
            return fallback || 'null';
        }
    }

    // 🔧 存储配额检测
    function checkStorageQuota(storage, namespace) {
        if (!storage) return false;
        
        try {
            var testKey = namespace + ':quota_test_' + Date.now();
            var testData = 'x'.repeat(1024); // 1KB测试数据
            storage.setItem(testKey, testData);
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            DEBUG_WARN('[CacheManager] 存储配额检测失败:', e.message);
            return false;
        }
    }

    /**
     * 🎯 CacheManager - 缓存管理器
     * 功能：两级缓存、LRU策略、自动清理、版本控制
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function CacheManager(options) {
        options = options || {};
        
        // 配置参数
        var config = {
            maxMemorySize: Math.max(10, Math.min(200, options.maxMemorySize || 50)), // 限制范围
            maxStorageSize: Math.max(50, Math.min(1000, options.maxStorageSize || 200)), // 限制范围
            defaultTTL: Math.max(60000, options.defaultTTL || 3600000), // 最少1分钟
            cleanupInterval: Math.max(30000, options.cleanupInterval || 300000), // 最少30秒
            compressionEnabled: options.compression !== false,
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
        
        // 🔧 清理和销毁相关
        var isDestroyed = false;
        var cleanupTimer = null;
        var visibilityHandler = null;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[CacheManager] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                initializeStorage();
                startAutoCleanup();
                setupVisibilityHandling();
                DEBUG_LOG('[CacheManager] 初始化成功');
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 初始化失败:', error);
                statistics.errors++;
            }
        }
        
        // 🔑 设置缓存
        this.set = function(key, value, options) {
            if (isDestroyed) {
                DEBUG_WARN('[CacheManager] 实例已销毁，无法设置缓存');
                return false;
            }
            
            options = options || {};
            
            try {
                if (!key || typeof key !== 'string') {
                    throw new Error('Cache key must be a non-empty string');
                }
                
                var normalizedKey = normalizeKey(key);
                var ttl = Math.max(60000, options.ttl || config.defaultTTL); // 最少1分钟TTL
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
                
                // 检查内存使用情况
                var currentSize = Object.keys(memoryCache).length;
                if (currentSize > config.maxMemorySize * 1.5) {
                    DEBUG_WARN('[CacheManager] 内存缓存超出限制，强制清理');
                    // 强制清理多个项目
                    for (var i = 0; i < Math.min(10, currentSize - config.maxMemorySize); i++) {
                        evictLRU();
                    }
                }
                
                // 内存缓存
                setMemoryCache(normalizedKey, cacheItem);
                
                // 持久缓存
                if (forceStorage || shouldPersist(cacheItem)) {
                    setPersistentCache(normalizedKey, cacheItem);
                }
                
                statistics.sets++;
                return true;
                
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 设置缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 获取缓存
        this.get = function(key) {
            if (isDestroyed) {
                return undefined;
            }
            
            try {
                if (!key || typeof key !== 'string') {
                    statistics.misses++;
                    return undefined;
                }
                
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
                DEBUG_ERROR('[CacheManager] 获取缓存失败:', error);
                statistics.errors++;
                statistics.misses++;
                return undefined;
            }
        };
        
        // 🔑 检查缓存是否存在
        this.has = function(key) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!key || typeof key !== 'string') {
                    return false;
                }
                
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
                DEBUG_ERROR('[CacheManager] 检查缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 删除缓存
        this.delete = function(key) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!key || typeof key !== 'string') {
                    return false;
                }
                
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
                    try {
                        var storageKey = config.namespace + ':' + normalizedKey;
                        storageCache.removeItem(storageKey);
                        deleted = true;
                    } catch (error) {
                        DEBUG_WARN('[CacheManager] 删除持久缓存失败:', error);
                    }
                }
                
                if (deleted) {
                    statistics.deletes++;
                }
                
                return deleted;
                
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 删除缓存失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 批量清理
        this.clear = function(pattern) {
            if (isDestroyed) {
                return 0;
            }
            
            try {
                var count = 0;
                
                if (!pattern) {
                    // 清理所有
                    count = Object.keys(memoryCache).length;
                    memoryCache = {};
                    memoryLRU = [];
                    
                    if (storageCache) {
                        clearNamespacedStorage();
                    }
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
                        if (this.delete(keysToDelete[i])) {
                            count++;
                        }
                    }
                }
                
                statistics.cleanups++;
                return count;
                
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 清理缓存失败:', error);
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
                hitRate: statistics.hits / Math.max(1, statistics.hits + statistics.misses),
                sets: statistics.sets,
                deletes: statistics.deletes,
                errors: statistics.errors,
                cleanups: statistics.cleanups,
                memoryItems: memorySize,
                memoryBytes: totalMemoryBytes,
                storageSupported: !!storageCache,
                isDestroyed: isDestroyed
            };
        };
        
        // 🔑 手动清理过期项
        this.cleanup = function() {
            if (isDestroyed) {
                return 0;
            }
            
            try {
                var cleaned = 0;
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
                    if (this.delete(keysToDelete[i])) {
                        cleaned++;
                    }
                }
                
                // 清理持久缓存（异步，避免阻塞）
                setTimeout(function() {
                    if (!isDestroyed) {
                        cleanupPersistentCache();
                    }
                }, 0);
                
                statistics.cleanups++;
                return cleaned;
                
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 清理失败:', error);
                statistics.errors++;
                return 0;
            }
        };
        
        // 🔑 预热缓存
        this.preload = function(data) {
            if (isDestroyed) {
                return 0;
            }
            
            try {
                var loaded = 0;
                
                if (Array.isArray(data)) {
                    for (var i = 0; i < data.length && loaded < 100; i++) { // 限制预加载数量
                        var item = data[i];
                        if (item && item.key && item.value !== undefined) {
                            if (this.set(item.key, item.value, item.options)) {
                                loaded++;
                            }
                        }
                    }
                } else if (typeof data === 'object' && data !== null) {
                    var keys = Object.keys(data);
                    for (var j = 0; j < keys.length && loaded < 100; j++) {
                        var key = keys[j];
                        if (this.set(key, data[key])) {
                            loaded++;
                        }
                    }
                }
                
                return loaded;
                
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 预热失败:', error);
                statistics.errors++;
                return 0;
            }
        };
        
        // 🔑 别名方法（向后兼容）
        this.cache = function(key, value, ttl) {
            if (arguments.length === 1) {
                return this.get(key);
            } else {
                return this.set(key, value, { ttl: ttl });
            }
        };
        
        // 🔑 销毁实例
        this.destroy = function() {
            if (isDestroyed) {
                return true;
            }
            
            try {
                // 标记为已销毁
                isDestroyed = true;
                
                // 清理定时器
                if (cleanupTimer) {
                    clearInterval(cleanupTimer);
                    cleanupTimer = null;
                }
                
                // 移除事件监听器
                if (visibilityHandler && typeof document !== 'undefined') {
                    document.removeEventListener('visibilitychange', visibilityHandler);
                    visibilityHandler = null;
                }
                
                // 清理内存缓存
                memoryCache = {};
                memoryLRU = [];
                
                // 重置统计
                statistics = {
                    hits: 0,
                    misses: 0,
                    sets: 0,
                    deletes: 0,
                    errors: 0,
                    cleanups: 0
                };
                
                DEBUG_LOG('[CacheManager] 实例已销毁');
                return true;
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 销毁失败:', error);
                return false;
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
            return memoryCache[key] || null;
        }
        
        function setPersistentCache(key, item) {
            if (!storageCache || isDestroyed) return false;
            
            // 检查存储配额
            if (!checkStorageQuota(storageCache, config.namespace)) {
                DEBUG_WARN('[CacheManager] 存储配额不足，执行清理');
                cleanupPersistentCache();
                
                // 再次尝试
                if (!checkStorageQuota(storageCache, config.namespace)) {
                    DEBUG_WARN('[CacheManager] 存储配额仍然不足');
                    return false;
                }
            }
            
            try {
                var storageKey = config.namespace + ':' + key;
                var data = {
                    item: item,
                    version: '2.0'
                };
                
                if (config.compressionEnabled) {
                    data = compressData(data);
                }
                
                var serialized = safeJSONStringify(data);
                if (serialized && serialized !== 'null') {
                    storageCache.setItem(storageKey, serialized);
                    return true;
                }
                
                return false;
                
            } catch (error) {
                // 可能是容量限制，尝试清理
                if (error.name === 'QuotaExceededError' || error.code === 22) {
                    cleanupPersistentCache();
                    
                    try {
                        var serialized = safeJSONStringify(data);
                        if (serialized && serialized !== 'null') {
                            storageCache.setItem(storageKey, serialized);
                            return true;
                        }
                    } catch (retryError) {
                        DEBUG_WARN('[CacheManager] 持久缓存已满');
                    }
                }
                
                statistics.errors++;
                return false;
            }
        }
        
        function getPersistentCache(key) {
            if (!storageCache || isDestroyed) return null;
            
            try {
                var storageKey = config.namespace + ':' + key;
                var stored = storageCache.getItem(storageKey);
                
                if (!stored) return null;
                
                var data = safeJSONParse(stored);
                if (!data) return null;
                
                if (config.compressionEnabled && data.compressed) {
                    data = decompressData(data);
                }
                
                return data && data.item ? data.item : null;
                
            } catch (error) {
                DEBUG_WARN('[CacheManager] 持久缓存读取失败:', error);
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
                if (item.hits > 2 && !isDestroyed) {
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
                    var testKey = config.namespace + ':init_test';
                    window.localStorage.setItem(testKey, 'test');
                    window.localStorage.removeItem(testKey);
                    storageCache = window.localStorage;
                    return;
                }
            } catch (error) {
                DEBUG_WARN('[CacheManager] localStorage不可用');
            }
            
            // 降级到sessionStorage
            try {
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    var testKey = config.namespace + ':init_test';
                    window.sessionStorage.setItem(testKey, 'test');
                    window.sessionStorage.removeItem(testKey);
                    storageCache = window.sessionStorage;
                    return;
                }
            } catch (error) {
                DEBUG_WARN('[CacheManager] sessionStorage不可用');
            }
            
            // 最终降级到内存存储
            storageCache = createMemoryStorage();
        }
        
        function createMemoryStorage() {
            var memoryStorage = {};
            
            return {
                setItem: function(key, value) {
                    if (key && value !== undefined) {
                        memoryStorage[key] = String(value);
                    }
                },
                getItem: function(key) {
                    return memoryStorage[key] || null;
                },
                removeItem: function(key) {
                    if (key) {
                        delete memoryStorage[key];
                    }
                },
                clear: function() {
                    memoryStorage = {};
                },
                get length() {
                    return Object.keys(memoryStorage).length;
                }
            };
        }
        
        function startAutoCleanup() {
            if (isDestroyed) return;
            
            if (cleanupTimer) {
                clearInterval(cleanupTimer);
            }
            
            cleanupTimer = setInterval(function() {
                if (!isDestroyed) {
                    self.cleanup();
                }
            }, config.cleanupInterval);
        }
        
        function setupVisibilityHandling() {
            if (typeof document !== 'undefined' && !isDestroyed) {
                visibilityHandler = function() {
                    if (isDestroyed) return;
                    
                    if (document.hidden) {
                        // 页面隐藏时减少清理频率
                        if (cleanupTimer) {
                            clearInterval(cleanupTimer);
                            cleanupTimer = setInterval(function() {
                                if (!isDestroyed) {
                                    self.cleanup();
                                }
                            }, config.cleanupInterval * 3); // 降低频率
                        }
                    } else {
                        // 页面可见时恢复正常频率
                        startAutoCleanup();
                    }
                };
                
                document.addEventListener('visibilitychange', visibilityHandler);
            }
        }
        
        function cleanupPersistentCache() {
            if (!storageCache || isDestroyed) return;
            
            try {
                var keysToDelete = [];
                var prefix = config.namespace + ':';
                var processed = 0;
                var maxProcess = 50; // 限制处理数量，避免阻塞
                
                // 注意：不是所有存储实现都支持遍历
                if (storageCache.length !== undefined) {
                    for (var i = 0; storageCache.length && i < storageCache.length && processed < maxProcess; i++) {
                        var key = storageCache.key && storageCache.key(i);
                        if (key && key.indexOf(prefix) === 0) {
                            try {
                                var stored = storageCache.getItem(key);
                                var data = safeJSONParse(stored);
                                if (data && data.item && isExpired(data.item)) {
                                    keysToDelete.push(key);
                                }
                                processed++;
                            } catch (parseError) {
                                // 损坏的数据，标记删除
                                keysToDelete.push(key);
                            }
                        }
                    }
                }
                
                // 删除过期项
                for (var j = 0; j < keysToDelete.length; j++) {
                    try {
                        storageCache.removeItem(keysToDelete[j]);
                    } catch (error) {
                        // 忽略删除错误
                    }
                }
                
            } catch (error) {
                DEBUG_WARN('[CacheManager] 持久缓存清理失败:', error);
            }
        }
        
        function clearNamespacedStorage() {
            if (!storageCache || isDestroyed) return;
            
            try {
                var keysToDelete = [];
                var prefix = config.namespace + ':';
                
                if (storageCache.length !== undefined) {
                    for (var i = 0; storageCache.length && i < storageCache.length; i++) {
                        var key = storageCache.key && storageCache.key(i);
                        if (key && key.indexOf(prefix) === 0) {
                            keysToDelete.push(key);
                        }
                    }
                }
                
                for (var j = 0; j < keysToDelete.length; j++) {
                    try {
                        storageCache.removeItem(keysToDelete[j]);
                    } catch (error) {
                        // 忽略删除错误
                    }
                }
                
            } catch (error) {
                DEBUG_WARN('[CacheManager] 命名空间清理失败:', error);
            }
        }
        
        function compressData(data) {
            // 简单的压缩算法（实际项目中可使用更高效的压缩）
            try {
                var str = safeJSONStringify(data);
                if (!str || str === 'null') return data;
                
                var compressed = str;
                
                // 简单的重复字符压缩
                compressed = compressed.replace(/(.)\1{3,}/g, function(match, char) {
                    return char + '{' + match.length + '}';
                });
                
                // 只有在压缩效果明显时才使用压缩版本
                if (compressed.length < str.length * 0.8) {
                    return {
                        compressed: true,
                        data: compressed,
                        originalSize: str.length,
                        compressedSize: compressed.length
                    };
                }
                
                return data;
            } catch (error) {
                return data; // 压缩失败，返回原数据
            }
        }
        
        function decompressData(compressedData) {
            try {
                if (!compressedData || !compressedData.compressed) {
                    return compressedData;
                }
                
                var decompressed = compressedData.data;
                
                // 解压缩重复字符
                decompressed = decompressed.replace(/(.)\{(\d+)\}/g, function(match, char, count) {
                    var num = parseInt(count, 10);
                    if (num > 0 && num < 10000) { // 安全检查
                        return new Array(num + 1).join(char);
                    }
                    return match;
                });
                
                return safeJSONParse(decompressed);
            } catch (error) {
                DEBUG_ERROR('[CacheManager] 解压缩失败:', error);
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
                var str = safeJSONStringify(data);
                return str ? str.length : 0;
            } catch (error) {
                return 0;
            }
        }
  // ✅ 修复初始化逻辑
// 添加初始化状态变量
var isInitialized = false;


    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CacheManager;
    } else if (typeof global !== 'undefined') {
        global.CacheManager = CacheManager;
        
        // 🔧 安全的命名空间添加
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.CacheManager) {
            global.EnglishSite.CacheManager = CacheManager;
        } else {
            DEBUG_WARN('[CacheManager] EnglishSite.CacheManager 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);