// js/foundation/state-manager.js - iOS兼容版状态管理器
// 🚀 简化版状态管理，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

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
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            try {
                restoreFromStorage();
                setupAutoSave();
                console.log('[StateManager] 初始化成功');
            } catch (error) {
                console.error('[StateManager] 初始化失败:', error);
                state = {};
            }
        }
        
        // 🔑 设置状态
        this.setState = function(path, value, options) {
            options = options || {};
            
            try {
                var normalizedPath = normalizePath(path);
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
                console.error('[StateManager] setState失败:', error);
                return false;
            }
        };
        
        // 🔑 获取状态
        this.getState = function(path) {
            try {
                if (!path) return deepClone(state);
                
                var normalizedPath = normalizePath(path);
                return getStateByPath(normalizedPath);
            } catch (error) {
                console.error('[StateManager] getState失败:', error);
                return undefined;
            }
        };
        
        // 🔑 订阅状态变化
        this.subscribe = function(path, callback, options) {
            options = options || {};
            
            try {
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
                        console.error('[StateManager] 订阅回调执行失败:', callbackError);
                    }
                }
                
                // 返回取消订阅函数
                return function unsubscribe() {
                    var subs = subscribers[normalizedPath];
                    if (subs) {
                        for (var i = 0; i < subs.length; i++) {
                            if (subs[i].id === subscription.id) {
                                subs.splice(i, 1);
                                break;
                            }
                        }
                    }
                };
            } catch (error) {
                console.error('[StateManager] subscribe失败:', error);
                return function() {}; // 空函数避免错误
            }
        };
        
        // 🔑 批量更新状态
        this.batchUpdate = function(updates) {
            if (!updates || !updates.length) return;
            
            isUpdating = true;
            
            try {
                for (var i = 0; i < updates.length; i++) {
                    var update = updates[i];
                    self.setState(update.path, update.value, {
                        batch: true,
                        silent: true
                    });
                }
                
                processBatchUpdates();
            } catch (error) {
                console.error('[StateManager] batchUpdate失败:', error);
            } finally {
                isUpdating = false;
            }
        };
        
        // 🔑 清理状态
        this.clearState = function(path) {
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
                console.error('[StateManager] clearState失败:', error);
                return false;
            }
        };
        
        // 🔑 持久化状态
        this.persist = function() {
            try {
                var storage = getStorage();
                if (storage) {
                    var dataToStore = {
                        state: state,
                        timestamp: Date.now(),
                        version: '2.0'
                    };
                    
                    storage.setItem('learner_state', JSON.stringify(dataToStore));
                    return true;
                }
                return false;
            } catch (error) {
                console.error('[StateManager] persist失败:', error);
                return false;
            }
        };
        
        // 🔑 恢复状态
        this.restore = function() {
            try {
                restoreFromStorage();
                return true;
            } catch (error) {
                console.error('[StateManager] restore失败:', error);
                return false;
            }
        };
        
        // 🔑 时间旅行 - 回到历史状态
        this.timeTravel = function(index) {
            try {
                if (index >= 0 && index < history.length) {
                    var historyItem = history[index];
                    self.setState(historyItem.path, historyItem.oldValue, {
                        skipHistory: true
                    });
                    return true;
                }
                return false;
            } catch (error) {
                console.error('[StateManager] timeTravel失败:', error);
                return false;
            }
        };
        
        // 🔑 获取统计信息
        this.getStats = function() {
            return {
                stateSize: getObjectSize(state),
                subscriberCount: getTotalSubscribers(),
                historySize: history.length,
                maxHistorySize: maxHistorySize
            };
        };
        
        // 🔧 内部工具函数
        function normalizePath(path) {
            if (typeof path === 'string') {
                return path.split('.').filter(function(part) {
                    return part.length > 0;
                });
            }
            if (Array.isArray(path)) {
                return path.slice(); // 创建副本
            }
            return [String(path)];
        }
        
        function getStateByPath(pathArray) {
            var current = state;
            
            for (var i = 0; i < pathArray.length; i++) {
                if (current === null || current === undefined) {
                    return undefined;
                }
                current = current[pathArray[i]];
            }
            
            return deepClone(current);
        }
        
        function setStateByPath(pathArray, value) {
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
            current[finalKey] = deepClone(value);
        }
        
        function notifySubscribers(pathArray, newValue, oldValue) {
            var pathString = pathArray.join('.');
            var subs = subscribers[pathString];
            
            if (subs && subs.length > 0) {
                for (var i = 0; i < subs.length; i++) {
                    try {
                        subs[i].callback(newValue, oldValue, pathString);
                    } catch (error) {
                        console.error('[StateManager] 订阅者回调执行失败:', error);
                    }
                }
            }
            
            // 通知父路径订阅者（深度订阅）
            notifyParentSubscribers(pathArray, newValue, oldValue);
        }
        
        function notifyParentSubscribers(pathArray, newValue, oldValue) {
            for (var i = pathArray.length - 1; i > 0; i--) {
                var parentPath = pathArray.slice(0, i).join('.');
                var parentSubs = subscribers[parentPath];
                
                if (parentSubs) {
                    for (var j = 0; j < parentSubs.length; j++) {
                        if (parentSubs[j].deep) {
                            try {
                                var parentValue = getStateByPath(pathArray.slice(0, i));
                                parentSubs[j].callback(parentValue, undefined, parentPath);
                            } catch (error) {
                                console.error('[StateManager] 父级订阅者通知失败:', error);
                            }
                        }
                    }
                }
            }
        }
        
        function notifyAllSubscribers() {
            for (var path in subscribers) {
                if (subscribers.hasOwnProperty(path)) {
                    var currentValue = self.getState(path);
                    var subs = subscribers[path];
                    
                    for (var i = 0; i < subs.length; i++) {
                        try {
                            subs[i].callback(currentValue, undefined, path);
                        } catch (error) {
                            console.error('[StateManager] 全局通知失败:', error);
                        }
                    }
                }
            }
        }
        
        function processBatchUpdates() {
            if (updateQueue.length === 0) return;
            
            // 使用异步处理避免阻塞
            setTimeout(function() {
                var updates = updateQueue.slice();
                updateQueue = [];
                
                for (var i = 0; i < updates.length; i++) {
                    var update = updates[i];
                    notifySubscribers(update.path, update.value, update.oldValue);
                }
            }, 0);
        }
        
        function saveToHistory(pathArray, oldValue, newValue) {
            if (history.length >= maxHistorySize) {
                history.shift(); // 移除最旧的记录
            }
            
            history.push({
                path: pathArray,
                oldValue: deepClone(oldValue),
                newValue: deepClone(newValue),
                timestamp: Date.now()
            });
        }
        
        function restoreFromStorage() {
            var storage = getStorage();
            if (!storage) return;
            
            try {
                var stored = storage.getItem('learner_state');
                if (stored) {
                    var data = JSON.parse(stored);
                    
                    // 版本检查
                    if (data.version === '2.0' && data.state) {
                        state = data.state;
                    }
                }
            } catch (error) {
                console.warn('[StateManager] 恢复存储状态失败:', error);
            }
        }
        
        function setupAutoSave() {
            // 每30秒自动保存
            setInterval(function() {
                self.persist();
            }, 30000);
            
            // 页面卸载时保存
            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', function() {
                    self.persist();
                });
            }
        }
        
        function getStorage() {
            if (typeof window === 'undefined') return null;
            
            try {
                // 测试localStorage是否可用
                window.localStorage.setItem('test', 'test');
                window.localStorage.removeItem('test');
                return window.localStorage;
            } catch (error) {
                // 降级到sessionStorage
                try {
                    window.sessionStorage.setItem('test', 'test');
                    window.sessionStorage.removeItem('test');
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
                    memoryData[key] = String(value);
                },
                getItem: function(key) {
                    return memoryData[key] || null;
                },
                removeItem: function(key) {
                    delete memoryData[key];
                },
                clear: function() {
                    memoryData = {};
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
                return JSON.stringify(obj).length;
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
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StateManager;
    } else if (typeof global !== 'undefined') {
        global.StateManager = StateManager;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.StateManager = StateManager;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);
