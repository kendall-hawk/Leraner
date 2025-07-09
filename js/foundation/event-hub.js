// js/foundation/event-hub.js - iOS兼容版事件中心
// 🚀 简化版事件系统，确保iOS Safari 12+兼容性

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
    function safeStringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            return '[Object]';
        }
    }

    /**
     * 🎯 EventHub - 事件中心
     * 功能：发布订阅、命名空间、节流防抖、异常隔离
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function EventHub() {
        // 私有变量通过闭包实现
        var listeners = {};
        var namespaces = {};
        var eventQueue = [];
        var isProcessingQueue = false;
        var maxQueueSize = 1000;
        var debugMode = !IS_PRODUCTION; // 生产环境默认关闭调试
        var statistics = {
            totalEvents: 0,
            totalListeners: 0,
            errors: 0
        };
        
        // 🔧 清理相关变量
        var isDestroyed = false;
        var originalErrorHandler = null;
        var globalEventHandlers = [];
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[EventHub] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                setupGlobalErrorHandling();
                DEBUG_LOG('[EventHub] 初始化成功');
            } catch (error) {
                DEBUG_ERROR('[EventHub] 初始化失败:', error);
            }
        }
        
        // 🔑 注册事件监听器
        this.on = function(eventName, callback, options) {
            if (isDestroyed) {
                DEBUG_WARN('[EventHub] 实例已销毁，无法注册监听器');
                return function() {};
            }
            
            options = options || {};
            
            try {
                if (typeof callback !== 'function') {
                    throw new Error('Callback must be a function');
                }
                
                var normalizedName = normalizeEventName(eventName);
                var listenerId = generateListenerId();
                
                var listener = {
                    id: listenerId,
                    callback: callback,
                    once: options.once || false,
                    namespace: options.namespace || 'default',
                    priority: options.priority || 0,
                    throttle: options.throttle || 0,
                    debounce: options.debounce || 0,
                    lastCallTime: 0,
                    debounceTimeout: null
                };
                
                // 应用节流和防抖
                if (listener.throttle > 0 || listener.debounce > 0) {
                    listener.originalCallback = callback;
                    listener.callback = createTimedCallback(listener);
                }
                
                // 存储监听器
                if (!listeners[normalizedName]) {
                    listeners[normalizedName] = [];
                }
                
                listeners[normalizedName].push(listener);
                
                // 按优先级排序
                listeners[normalizedName].sort(function(a, b) {
                    return b.priority - a.priority;
                });
                
                // 记录命名空间
                if (!namespaces[listener.namespace]) {
                    namespaces[listener.namespace] = [];
                }
                namespaces[listener.namespace].push({
                    eventName: normalizedName,
                    listenerId: listenerId
                });
                
                statistics.totalListeners++;
                
                if (debugMode) {
                    DEBUG_LOG('[EventHub] 监听器已注册:', {
                        event: normalizedName,
                        namespace: listener.namespace,
                        priority: listener.priority
                    });
                }
                
                // 返回取消监听函数
                return function unsubscribe() {
                    if (!isDestroyed) {
                        self.off(eventName, callback);
                    }
                };
                
            } catch (error) {
                DEBUG_ERROR('[EventHub] 注册监听器失败:', error);
                statistics.errors++;
                return function() {}; // 空函数避免错误
            }
        };
        
        // 🔑 移除事件监听器
        this.off = function(eventName, callback) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                var normalizedName = normalizeEventName(eventName);
                var eventListeners = listeners[normalizedName];
                
                if (!eventListeners) return false;
                
                var removed = false;
                for (var i = eventListeners.length - 1; i >= 0; i--) {
                    var listener = eventListeners[i];
                    
                    if (!callback || listener.originalCallback === callback || listener.callback === callback) {
                        // 清理防抖定时器
                        if (listener.debounceTimeout) {
                            clearTimeout(listener.debounceTimeout);
                            listener.debounceTimeout = null;
                        }
                        
                        // 从命名空间中移除
                        removeFromNamespace(listener.namespace, normalizedName, listener.id);
                        
                        // 从监听器数组中移除
                        eventListeners.splice(i, 1);
                        statistics.totalListeners--;
                        removed = true;
                        
                        if (debugMode) {
                            DEBUG_LOG('[EventHub] 监听器已移除:', normalizedName);
                        }
                        
                        // 如果指定了callback，只移除第一个匹配的
                        if (callback) break;
                    }
                }
                
                // 如果没有监听器了，删除事件
                if (eventListeners.length === 0) {
                    delete listeners[normalizedName];
                }
                
                return removed;
                
            } catch (error) {
                DEBUG_ERROR('[EventHub] 移除监听器失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 发送事件
        this.emit = function(eventName, data, options) {
            if (isDestroyed) {
                return false;
            }
            
            options = options || {};
            
            try {
                var normalizedName = normalizeEventName(eventName);
                var eventListeners = listeners[normalizedName];
                
                statistics.totalEvents++;
                
                if (debugMode) {
                    DEBUG_LOG('[EventHub] 事件发送:', {
                        event: normalizedName,
                        data: safeStringify(data),
                        listenersCount: eventListeners ? eventListeners.length : 0
                    });
                }
                
                if (!eventListeners || eventListeners.length === 0) {
                    return true;
                }
                
                var event = {
                    name: normalizedName,
                    data: data,
                    timestamp: Date.now(),
                    stopped: false,
                    preventDefault: function() { this.defaultPrevented = true; },
                    stopPropagation: function() { this.stopped = true; },
                    defaultPrevented: false
                };
                
                // 异步执行 vs 同步执行
                if (options.async !== false) {
                    // 默认异步执行
                    queueEvent(event, eventListeners.slice());
                } else {
                    // 同步执行
                    executeEventListeners(event, eventListeners);
                }
                
                return !event.defaultPrevented;
                
            } catch (error) {
                DEBUG_ERROR('[EventHub] 事件发送失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 一次性监听器
        this.once = function(eventName, callback, options) {
            options = options || {};
            options.once = true;
            return this.on(eventName, callback, options);
        };
        
        // 🔑 清理命名空间
        this.clear = function(namespace) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!namespace) {
                    // 清理所有
                    clearAllListeners();
                    listeners = {};
                    namespaces = {};
                    eventQueue = [];
                    statistics.totalListeners = 0;
                } else {
                    // 清理指定命名空间
                    var nsData = namespaces[namespace];
                    if (nsData) {
                        for (var i = 0; i < nsData.length; i++) {
                            var item = nsData[i];
                            var eventListeners = listeners[item.eventName];
                            
                            if (eventListeners) {
                                for (var j = eventListeners.length - 1; j >= 0; j--) {
                                    if (eventListeners[j].id === item.listenerId) {
                                        // 清理防抖定时器
                                        if (eventListeners[j].debounceTimeout) {
                                            clearTimeout(eventListeners[j].debounceTimeout);
                                            eventListeners[j].debounceTimeout = null;
                                        }
                                        eventListeners.splice(j, 1);
                                        statistics.totalListeners--;
                                        break;
                                    }
                                }
                                
                                // 如果事件没有监听器了，删除它
                                if (eventListeners.length === 0) {
                                    delete listeners[item.eventName];
                                }
                            }
                        }
                        delete namespaces[namespace];
                    }
                }
                
                if (debugMode) {
                    DEBUG_LOG('[EventHub] 命名空间已清理:', namespace || 'all');
                }
                
                return true;
                
            } catch (error) {
                DEBUG_ERROR('[EventHub] 清理命名空间失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 开启/关闭调试模式
        this.debug = function(enable) {
            debugMode = !!enable && !IS_PRODUCTION; // 生产环境强制关闭
            DEBUG_LOG('[EventHub] 调试模式:', debugMode ? '开启' : '关闭');
        };
        
        // 🔑 获取统计信息
        this.getStats = function() {
            return {
                totalEvents: statistics.totalEvents,
                totalListeners: statistics.totalListeners,
                errors: statistics.errors,
                activeEvents: Object.keys(listeners).length,
                activeNamespaces: Object.keys(namespaces).length,
                queueSize: eventQueue.length,
                isDestroyed: isDestroyed
            };
        };
        
        // 🔑 等待事件（返回Promise）
        this.waitFor = function(eventName, timeout) {
            if (isDestroyed) {
                return Promise.reject(new Error('EventHub已销毁'));
            }
            
            timeout = timeout || 5000;
            
            return new Promise(function(resolve, reject) {
                var timer = setTimeout(function() {
                    cleanup();
                    reject(new Error('事件等待超时: ' + eventName));
                }, timeout);
                
                var unsubscribe = self.once(eventName, function(data) {
                    cleanup();
                    resolve(data);
                });
                
                function cleanup() {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    if (unsubscribe) {
                        unsubscribe();
                    }
                }
            });
        };
        
        // 🔑 销毁实例
        this.destroy = function() {
            if (isDestroyed) {
                return true;
            }
            
            try {
                // 标记为已销毁
                isDestroyed = true;
                
                // 清理所有监听器
                clearAllListeners();
                
                // 清理数据结构
                listeners = {};
                namespaces = {};
                eventQueue = [];
                
                // 恢复全局错误处理
                restoreGlobalErrorHandling();
                
                // 重置统计
                statistics = {
                    totalEvents: 0,
                    totalListeners: 0,
                    errors: 0
                };
                
                DEBUG_LOG('[EventHub] 实例已销毁');
                return true;
            } catch (error) {
                DEBUG_ERROR('[EventHub] 销毁失败:', error);
                return false;
            }
        };
        
        // 🔧 内部工具函数
        function normalizeEventName(eventName) {
            return String(eventName).toLowerCase();
        }
        
        function generateListenerId() {
            return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        }
        
        function createTimedCallback(listener) {
            return function() {
                if (isDestroyed) return;
                
                var now = Date.now();
                var args = Array.prototype.slice.call(arguments);
                
                // 节流处理
                if (listener.throttle > 0) {
                    if (now - listener.lastCallTime < listener.throttle) {
                        return;
                    }
                    listener.lastCallTime = now;
                }
                
                // 防抖处理
                if (listener.debounce > 0) {
                    if (listener.debounceTimeout) {
                        clearTimeout(listener.debounceTimeout);
                    }
                    
                    listener.debounceTimeout = setTimeout(function() {
                        if (!isDestroyed && listener.originalCallback) {
                            try {
                                listener.originalCallback.apply(null, args);
                            } catch (error) {
                                DEBUG_ERROR('[EventHub] 防抖回调执行失败:', error);
                                statistics.errors++;
                            }
                        }
                    }, listener.debounce);
                    
                    return;
                }
                
                // 直接执行
                if (!isDestroyed && listener.originalCallback) {
                    try {
                        listener.originalCallback.apply(null, args);
                    } catch (error) {
                        DEBUG_ERROR('[EventHub] 节流回调执行失败:', error);
                        statistics.errors++;
                    }
                }
            };
        }
        
        function queueEvent(event, eventListeners) {
            if (isDestroyed) return;
            
            if (eventQueue.length >= maxQueueSize) {
                DEBUG_WARN('[EventHub] 事件队列已满，丢弃最旧事件');
                eventQueue.shift();
            }
            
            eventQueue.push({
                event: event,
                listeners: eventListeners
            });
            
            if (!isProcessingQueue) {
                processEventQueue();
            }
        }
        
        function processEventQueue() {
            if (isProcessingQueue || eventQueue.length === 0 || isDestroyed) return;
            
            isProcessingQueue = true;
            
            // 使用 setTimeout 实现异步处理
            setTimeout(function() {
                try {
                    var processed = 0;
                    var maxProcessPerTick = 5; // 限制每次处理的事件数量
                    
                    while (eventQueue.length > 0 && processed < maxProcessPerTick && !isDestroyed) {
                        var item = eventQueue.shift();
                        executeEventListeners(item.event, item.listeners);
                        processed++;
                    }
                    
                    // 如果还有事件需要处理，继续下一轮
                    if (eventQueue.length > 0 && !isDestroyed) {
                        setTimeout(function() {
                            isProcessingQueue = false;
                            processEventQueue();
                        }, 0);
                    } else {
                        isProcessingQueue = false;
                    }
                } catch (error) {
                    DEBUG_ERROR('[EventHub] 处理事件队列失败:', error);
                    statistics.errors++;
                    isProcessingQueue = false;
                }
            }, 0);
        }
        
        function executeEventListeners(event, eventListeners) {
            if (isDestroyed) return;
            
            var listenersToRemove = [];
            
            for (var i = 0; i < eventListeners.length; i++) {
                if (event.stopped || isDestroyed) break;
                
                var listener = eventListeners[i];
                
                try {
                    listener.callback(event.data, event);
                    
                    // 标记一次性监听器待移除
                    if (listener.once) {
                        listenersToRemove.push({
                            eventName: event.name,
                            listenerId: listener.id
                        });
                    }
                    
                } catch (error) {
                    DEBUG_ERROR('[EventHub] 监听器执行失败:', error);
                    statistics.errors++;
                }
            }
            
            // 移除一次性监听器
            for (var j = 0; j < listenersToRemove.length; j++) {
                var toRemove = listenersToRemove[j];
                removeListenerById(toRemove.eventName, toRemove.listenerId);
            }
        }
        
        function removeListenerById(eventName, listenerId) {
            if (isDestroyed) return;
            
            var eventListeners = listeners[eventName];
            if (!eventListeners) return;
            
            for (var i = 0; i < eventListeners.length; i++) {
                if (eventListeners[i].id === listenerId) {
                    var listener = eventListeners[i];
                    
                    // 清理防抖定时器
                    if (listener.debounceTimeout) {
                        clearTimeout(listener.debounceTimeout);
                        listener.debounceTimeout = null;
                    }
                    
                    // 从命名空间中移除
                    removeFromNamespace(listener.namespace, eventName, listenerId);
                    
                    // 从数组中移除
                    eventListeners.splice(i, 1);
                    statistics.totalListeners--;
                    break;
                }
            }
            
            // 如果没有监听器了，删除事件
            if (eventListeners.length === 0) {
                delete listeners[eventName];
            }
        }
        
        function removeFromNamespace(namespace, eventName, listenerId) {
            if (isDestroyed) return;
            
            var nsData = namespaces[namespace];
            if (!nsData) return;
            
            for (var i = 0; i < nsData.length; i++) {
                if (nsData[i].eventName === eventName && nsData[i].listenerId === listenerId) {
                    nsData.splice(i, 1);
                    break;
                }
            }
            
            // 如果命名空间为空，删除它
            if (nsData.length === 0) {
                delete namespaces[namespace];
            }
        }
        
        function clearAllListeners() {
            // 清理所有防抖定时器
            for (var eventName in listeners) {
                if (listeners.hasOwnProperty(eventName)) {
                    var eventListeners = listeners[eventName];
                    for (var i = 0; i < eventListeners.length; i++) {
                        if (eventListeners[i].debounceTimeout) {
                            clearTimeout(eventListeners[i].debounceTimeout);
                            eventListeners[i].debounceTimeout = null;
                        }
                    }
                }
            }
        }
        
        function setupGlobalErrorHandling() {
            // 如果在浏览器环境中，监听全局错误
            if (typeof window !== 'undefined') {
                originalErrorHandler = window.onerror;
                
                var globalErrorHandler = function(message, source, lineno, colno, error) {
                    if (!isDestroyed) {
                        self.emit('global:error', {
                            message: message,
                            source: source,
                            lineno: lineno,
                            colno: colno,
                            error: error
                        });
                    }
                    
                    // 调用原有错误处理器
                    if (originalErrorHandler) {
                        return originalErrorHandler.apply(this, arguments);
                    }
                };
                
                window.onerror = globalErrorHandler;
                globalEventHandlers.push(['error', globalErrorHandler]);
                
                // 监听未处理的Promise拒绝
                if ('onunhandledrejection' in window) {
                    var rejectionHandler = function(event) {
                        if (!isDestroyed) {
                            self.emit('global:unhandledrejection', {
                                reason: event.reason,
                                promise: event.promise
                            });
                        }
                    };
                    
                    window.addEventListener('unhandledrejection', rejectionHandler);
                    globalEventHandlers.push(['unhandledrejection', rejectionHandler]);
                }
            }
        }
        
        function restoreGlobalErrorHandling() {
            if (typeof window !== 'undefined') {
                // 恢复原始错误处理器
                if (originalErrorHandler) {
                    window.onerror = originalErrorHandler;
                } else {
                    window.onerror = null;
                }
                
                // 移除我们添加的事件监听器
                for (var i = 0; i < globalEventHandlers.length; i++) {
                    var handler = globalEventHandlers[i];
                    if (handler[0] === 'unhandledrejection') {
                        window.removeEventListener('unhandledrejection', handler[1]);
                    }
                }
                
                globalEventHandlers = [];
                originalErrorHandler = null;
            }
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
        module.exports = EventHub;
    } else if (typeof global !== 'undefined') {
        global.EventHub = EventHub;
        
        // 🔧 安全的命名空间添加
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.EventHub) {
            global.EnglishSite.EventHub = EventHub;
        } else {
            DEBUG_WARN('[EventHub] EnglishSite.EventHub 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);