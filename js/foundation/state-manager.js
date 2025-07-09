// js/foundation/state-manager.js - iOS兼容版状态管理器
// 🚀 简化版状态管理，确保iOS Safari 12+兼容性

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
            return fallback || {};
        }
        try {
            var result = JSON.parse(str);
            return result !== null ? result : (fallback || {});
        } catch (error) {
            DEBUG_WARN('[StateManager] JSON解析失败:', error.message);
            return fallback || {};
        }
    }

    function safeJSONStringify(obj, fallback) {
        if (obj === null || obj === undefined) {
            return fallback || '{}';
        }
        try {
            return JSON.stringify(obj);
        } catch (error) {
            DEBUG_WARN('[StateManager] JSON序列化失败:', error.message);
            return fallback || '{}';
        }
    }

    // 🔧 性能优化的克隆函数
    function fastClone(obj) {
        // 对于 null 或基本类型，直接返回
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // 对于简单对象，优先使用 JSON 方法（更快）
        try {
            var str = safeJSONStringify(obj);
            if (str && str !== '{}' && str !== 'null') {
                var cloned = safeJSONParse(str);
                if (cloned && typeof cloned === 'object') {
                    return cloned;
                }
            }
        } catch (error) {
            // 降级到深拷贝
        }
        
        // 降级到深拷贝
        return deepClone(obj);
    }

    /**
     * 🎯 StateManager - 统一状态管理器
     * 功能：单一状态树、订阅通知、持久化、回滚支持
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function StateManager() {
        // 私有变量通过闭包实现
        var state = {};
        var subscribers = {};
        var history = [];
        var maxHistorySize = 50;
        var updateQueue = [];
        var isUpdating = false;
        
        // 🔧 清理和销毁相关
        var isDestroyed = false;
        var autoSaveTimer = null;
        var beforeUnloadHandler = null;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[StateManager] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                restoreFromStorage();
                setupAutoSave();
                DEBUG_LOG('[StateManager] 初始化成功');
            } catch (error) {
                DEBUG_ERROR('[StateManager] 初始化失败:', error);
                state = {};
            }
        }
        
        // 🔑 设置状态
        this.setState = function(path, value, options) {
            if (isDestroyed) {
                DEBUG_WARN('[StateManager] 实例已销毁，无法设置状态');
                return false;
            }
            
            options = options || {};
            
            try {
                var normalizedPath = normalizePath(path);
                if (!normalizedPath || normalizedPath.length === 0) {
                    throw new Error('Invalid path provided');
                }
                
                var oldValue = getStateByPath(normalizedPath);
                
                // 保存历史记录
                if (!options.skipHistory) {
                    saveToHistory(normalizedPath, oldValue, value);
                }
                
                // 设置新值
                setStateByPath(normalizedPath, value);
                
                // 通知订阅者
                if (!options.silent) {
                    notifySubscribers(normalizedPath, value, oldValue);
                }
                
                // 批量更新处理
                if (options.batch) {
                    updateQueue.push({
                        path: normalizedPath,
                        value: value,
                        oldValue: oldValue
                    });
                    
                    if (!isUpdating) {
                        processBatchUpdates();
                    }
                }
                
                return true;
            } catch (error) {
                DEBUG_ERROR('[StateManager] setState失败:', error);
                return false;
            }
        };
        
        // 🔑 获取状态
        this.getState = function(path) {
            if (isDestroyed) {
                return undefined;
            }
            
            try {
                if (!path) return fastClone(state);
                
                var normalizedPath = normalizePath(path);
                return getStateByPath(normalizedPath);
            } catch (error) {
                DEBUG_ERROR('[StateManager] getState失败:', error);
                return undefined;
            }
        };
        
        // 🔑 订阅状态变化
        this.subscribe = function(path, callback, options) {
            if (isDestroyed) {
                DEBUG_WARN('[StateManager] 实例已销毁，无法订阅');
                return function() {};
            }
            
            options = options || {};
            
            try {
                if (typeof callback !== 'function') {
                    throw new Error('Callback must be a function');
                }
                
                var normalizedPath = normalizePath(path).join('.');
                
                if (!subscribers[normalizedPath]) {
                    subscribers[normalizedPath] = [];
                }
                
                var subscription = {
                    id: generateId(),
                    callback: callback,
                    immediate: options.immediate || false,
                    deep: options.deep || false
                };
                
                subscribers[normalizedPath].push(subscription);
                
                // 立即执行
                if (subscription.immediate) {
                    var currentValue = self.getState(path);
                    try {
                        callback(currentValue, undefined, path);
                    } catch (callbackError) {
                        DEBUG_ERROR('[StateManager] 订阅回调执行失败:', callbackError);
                    }
                }
                
                // 返回取消订阅函数
                return function unsubscribe() {
                    if (isDestroyed) return;
                    
                    var subs = subscribers[normalizedPath];
                    if (subs) {
                        for (var i = 0; i < subs.length; i++) {
                            if (subs[i].id === subscription.id) {
                                subs.splice(i, 1);
                                break;
                            }
                        }
                        
                        // 如果没有订阅者了，清理数组
                        if (subs.length === 0) {
                            delete subscribers[normalizedPath];
                        }
                    }
                };
            } catch (error) {
                DEBUG_ERROR('[StateManager] subscribe失败:', error);
                return function() {}; // 空函数避免错误
            }
        };
        
        // 🔑 批量更新状态
        this.batchUpdate = function(updates) {
            if (isDestroyed || !updates || !updates.length) {
                return false;
            }
            
            isUpdating = true;
            
            try {
                for (var i = 0; i < updates.length; i++) {
                    var update = updates[i];
                    if (update && update.path !== undefined && update.value !== undefined) {
                        self.setState(update.path, update.value, {
                            batch: true,
                            silent: true
                        });
                    }
                }
                
                processBatchUpdates();
                return true;
            } catch (error) {
                DEBUG_ERROR('[StateManager] batchUpdate失败:', error);
                return false;
            } finally {
                isUpdating = false;
            }
        };
        
        // 🔑 清理状态
        this.clearState = function(path) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!path) {
                    state = {};
                    history = [];
                    notifyAllSubscribers();
                } else {
                    self.setState(path, undefined);
                }
                
                return true;
            } catch (error) {
                DEBUG_ERROR('[StateManager] clearState失败:', error);
                return false;
            }
        };
        
        // 🔑 持久化状态
        this.persist = function() {
            if (isDestroyed) {
                return false;
            }
            
            try {
                var storage = getStorage();
                if (storage) {
                    var dataToStore = {
                        state: state,
                        timestamp: Date.now(),
                        version: '2.0'
                    };
                    
                    var serialized = safeJSONStringify(dataToStore);
                    if (serialized && serialized !== '{}') {
                        storage.setItem('learner_state', serialized);
                        return true;
                    }
                }
                return false;
            } catch (error) {
                DEBUG_ERROR('[StateManager] persist失败:', error);
                return false;
            }
        };
        
        // 🔑 恢复状态
        this.restore = function() {
            if (isDestroyed) {
                return false;
            }
            
            try {
                restoreFromStorage();
                return true;
            } catch (error) {
                DEBUG_ERROR('[StateManager] restore失败:', error);
                return false;
            }
        };
        
        // 🔑 时间旅行 - 回到历史状态
        this.timeTravel = function(index) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (typeof index === 'number' && index >= 0 && index < history.length) {
                    var historyItem = history[index];
                    if (historyItem && historyItem.path && historyItem.oldValue !== undefined) {
                        self.setState(historyItem.path, historyItem.oldValue, {
                            skipHistory: true
                        });
                        return true;
                    }
                }
                return false;
            } catch (error) {
                DEBUG_ERROR('[StateManager] timeTravel失败:', error);
                return false;
            }
        };
        
        // 🔑 监听路径变化
        this.watch = function(path, callback, options) {
            return this.subscribe(path, callback, options);
        };
        
        // 🔑 获取统计信息
        this.getStats = function() {
            return {
                stateSize: getObjectSize(state),
                subscriberCount: getTotalSubscribers(),
                historySize: history.length,
                maxHistorySize: maxHistorySize,
                isDestroyed: isDestroyed
            };
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
                if (autoSaveTimer) {
                    clearInterval(autoSaveTimer);
                    autoSaveTimer = null;
                }
                
                // 移除事件监听器
                if (beforeUnloadHandler && typeof window !== 'undefined') {
                    window.removeEventListener('beforeunload', beforeUnloadHandler);
                    beforeUnloadHandler = null;
                }
                
                // 清理订阅者
                subscribers = {};
                
                // 清理更新队列
                updateQueue = [];
                isUpdating = false;
                
                // 清理历史记录
                history = [];
                
                // 最后一次持久化
                this.persist();
                
                // 清理状态
                state = {};
                
                DEBUG_LOG('[StateManager] 实例已销毁');
                return true;
            } catch (error) {
                DEBUG_ERROR('[StateManager] 销毁失败:', error);
                return false;
            }
        };
        
        // 🔧 内部工具函数
        function normalizePath(path) {
            if (typeof path === 'string') {
                return path.split('.').filter(function(part) {
                    return part.length > 0;
                });
            }
            if (Array.isArray(path)) {
                return path.slice().filter(function(part) {
                    return part !== null && part !== undefined && String(part).length > 0;
                });
            }
            if (path !== null && path !== undefined) {
                return [String(path)];
            }
            return [];
        }
        
        function getStateByPath(pathArray) {
            if (!pathArray || pathArray.length === 0) {
                return undefined;
            }
            
            var current = state;
            
            for (var i = 0; i < pathArray.length; i++) {
                if (current === null || current === undefined) {
                    return undefined;
                }
                current = current[pathArray[i]];
            }
            
            return fastClone(current);
        }
        
        function setStateByPath(pathArray, value) {
            if (!pathArray || pathArray.length === 0) {
                return;
            }
            
            var current = state;
            
            // 确保路径存在
            for (var i = 0; i < pathArray.length - 1; i++) {
                var key = pathArray[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            
            // 设置最终值
            var finalKey = pathArray[pathArray.length - 1];
            if (value === undefined) {
                delete current[finalKey];
            } else {
                current[finalKey] = fastClone(value);
            }
        }
        
        function notifySubscribers(pathArray, newValue, oldValue) {
            if (isDestroyed) return;
            
            var pathString = pathArray.join('.');
            var subs = subscribers[pathString];
            
            if (subs && subs.length > 0) {
                // 创建副本，防止在回调中修改订阅者列表
                var subsToNotify = subs.slice();
                
                for (var i = 0; i < subsToNotify.length; i++) {
                    try {
                        subsToNotify[i].callback(newValue, oldValue, pathString);
                    } catch (error) {
                        DEBUG_ERROR('[StateManager] 订阅者回调执行失败:', error);
                    }
                }
            }
            
            // 通知父路径订阅者（深度订阅）
            notifyParentSubscribers(pathArray, newValue, oldValue);
        }
        
        function notifyParentSubscribers(pathArray, newValue, oldValue) {
            if (isDestroyed) return;
            
            for (var i = pathArray.length - 1; i > 0; i--) {
                var parentPath = pathArray.slice(0, i).join('.');
                var parentSubs = subscribers[parentPath];
                
                if (parentSubs) {
                    var subsToNotify = parentSubs.slice();
                    
                    for (var j = 0; j < subsToNotify.length; j++) {
                        if (subsToNotify[j].deep) {
                            try {
                                var parentValue = getStateByPath(pathArray.slice(0, i));
                                subsToNotify[j].callback(parentValue, undefined, parentPath);
                            } catch (error) {
                                DEBUG_ERROR('[StateManager] 父级订阅者通知失败:', error);
                            }
                        }
                    }
                }
            }
        }
        
        function notifyAllSubscribers() {
            if (isDestroyed) return;
            
            for (var path in subscribers) {
                if (subscribers.hasOwnProperty(path)) {
                    var currentValue = self.getState(path);
                    var subs = subscribers[path];
                    var subsToNotify = subs.slice();
                    
                    for (var i = 0; i < subsToNotify.length; i++) {
                        try {
                            subsToNotify[i].callback(currentValue, undefined, path);
                        } catch (error) {
                            DEBUG_ERROR('[StateManager] 全局通知失败:', error);
                        }
                    }
                }
            }
        }
        
        function processBatchUpdates() {
            if (updateQueue.length === 0 || isDestroyed) return;
            
            // 使用异步处理避免阻塞
            setTimeout(function() {
                if (isDestroyed) return;
                
                var updates = updateQueue.slice();
                updateQueue = [];
                
                for (var i = 0; i < updates.length; i++) {
                    var update = updates[i];
                    notifySubscribers(update.path, update.value, update.oldValue);
                }
            }, 0);
        }
        
        function saveToHistory(pathArray, oldValue, newValue) {
            if (isDestroyed) return;
            
            // 限制历史记录大小
            if (history.length >= maxHistorySize) {
                history.shift(); // 移除最旧的记录
            }
            
            history.push({
                path: pathArray,
                oldValue: fastClone(oldValue),
                newValue: fastClone(newValue),
                timestamp: Date.now()
            });
        }
        
        function restoreFromStorage() {
            var storage = getStorage();
            if (!storage) return;
            
            try {
                var stored = storage.getItem('learner_state');
                if (stored) {
                    var data = safeJSONParse(stored, null);
                    
                    // 版本检查
                    if (data && data.version === '2.0' && data.state && typeof data.state === 'object') {
                        state = data.state;
                        DEBUG_LOG('[StateManager] 状态恢复成功');
                    } else {
                        DEBUG_WARN('[StateManager] 状态版本不匹配或格式错误');
                    }
                }
            } catch (error) {
                DEBUG_WARN('[StateManager] 恢复存储状态失败:', error);
            }
        }
        
        function setupAutoSave() {
            if (isDestroyed) return;
            
            // 每30秒自动保存
            autoSaveTimer = setInterval(function() {
                if (!isDestroyed) {
                    self.persist();
                }
            }, 30000);
            
            // 页面卸载时保存
            if (typeof window !== 'undefined') {
                beforeUnloadHandler = function() {
                    if (!isDestroyed) {
                        self.persist();
                    }
                };
                window.addEventListener('beforeunload', beforeUnloadHandler);
            }
        }
        
        function getStorage() {
            if (typeof window === 'undefined') return null;
            
            try {
                // 测试localStorage是否可用
                var testKey = '__state_test__';
                window.localStorage.setItem(testKey, 'test');
                window.localStorage.removeItem(testKey);
                return window.localStorage;
            } catch (error) {
                // 降级到sessionStorage
                try {
                    var testKey = '__state_test__';
                    window.sessionStorage.setItem(testKey, 'test');
                    window.sessionStorage.removeItem(testKey);
                    return window.sessionStorage;
                } catch (sessionError) {
                    // 最终降级到内存存储
                    return createMemoryStorage();
                }
            }
        }
        
        function createMemoryStorage() {
            var memoryData = {};
            
            return {
                setItem: function(key, value) {
                    if (key && value !== undefined) {
                        memoryData[key] = String(value);
                    }
                },
                getItem: function(key) {
                    return memoryData[key] || null;
                },
                removeItem: function(key) {
                    if (key) {
                        delete memoryData[key];
                    }
                },
                clear: function() {
                    memoryData = {};
                },
                get length() {
                    return Object.keys(memoryData).length;
                }
            };
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
        
        function generateId() {
            return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        }
        
        function getObjectSize(obj) {
            try {
                return safeJSONStringify(obj, '{}').length;
            } catch (error) {
                return 0;
            }
        }
        
        function getTotalSubscribers() {
            var total = 0;
            for (var path in subscribers) {
                if (subscribers.hasOwnProperty(path)) {
                    total += subscribers[path].length;
                }
            }
            return total;
        }
        
// ❌ 删除立即初始化
// initialize();

// ✅ 改为条件初始化
// 只有在被直接使用时才初始化，否则等待容器调用
if (typeof module === 'undefined' && typeof global !== 'undefined') {
    // 浏览器环境且非模块系统，延迟初始化
    setTimeout(function() {
        if (!isInitialized) {
            initialize();
        }
    }, 0);
}
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StateManager;
    } else if (typeof global !== 'undefined') {
        global.StateManager = StateManager;
        
        // 🔧 安全的命名空间添加
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.StateManager) {
            global.EnglishSite.StateManager = StateManager;
        } else {
            DEBUG_WARN('[StateManager] EnglishSite.StateManager 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);