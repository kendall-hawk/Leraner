// js/foundation/event-hub.js - iOS兼容版事件中心
// 🚀 简化版事件系统，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

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
        var debugMode = false;
        var statistics = {
            totalEvents: 0,
            totalListeners: 0,
            errors: 0
        };
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            try {
                setupGlobalErrorHandling();
                console.log('[EventHub] 初始化成功');
            } catch (error) {
                console.error('[EventHub] 初始化失败:', error);
            }
        }
        
        // 🔑 注册事件监听器
        this.on = function(eventName, callback, options) {
            options = options || {};
            
            try {
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
                    console.log('[EventHub] 监听器已注册:', {
                        event: normalizedName,
                        namespace: listener.namespace,
                        priority: listener.priority
                    });
                }
                
                // 返回取消监听函数
                return function unsubscribe() {
                    self.off(eventName, callback);
                };
                
            } catch (error) {
                console.error('[EventHub] 注册监听器失败:', error);
                statistics.errors++;
                return function() {}; // 空函数避免错误
            }
        };
        
        // 🔑 移除事件监听器
        this.off = function(eventName, callback) {
            try {
                var normalizedName = normalizeEventName(eventName);
                var eventListeners = listeners[normalizedName];
                
                if (!eventListeners) return false;
                
                for (var i = eventListeners.length - 1; i >= 0; i--) {
                    var listener = eventListeners[i];
                    
                    if (!callback || listener.originalCallback === callback || listener.callback === callback) {
                        // 清理防抖定时器
                        if (listener.debounceTimeout) {
                            clearTimeout(listener.debounceTimeout);
                        }
                        
                        // 从命名空间中移除
                        removeFromNamespace(listener.namespace, normalizedName, listener.id);
                        
                        // 从监听器数组中移除
                        eventListeners.splice(i, 1);
                        statistics.totalListeners--;
                        
                        if (debugMode) {
                            console.log('[EventHub] 监听器已移除:', normalizedName);
                        }
                        
                        // 如果指定了callback，只移除第一个匹配的
                        if (callback) break;
                    }
                }
                
                // 如果没有监听器了，删除事件
                if (eventListeners.length === 0) {
                    delete listeners[normalizedName];
                }
                
                return true;
                
            } catch (error) {
                console.error('[EventHub] 移除监听器失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 发送事件
        this.emit = function(eventName, data, options) {
            options = options || {};
            
            try {
                var normalizedName = normalizeEventName(eventName);
                var eventListeners = listeners[normalizedName];
                
                statistics.totalEvents++;
                
                if (debugMode) {
                    console.log('[EventHub] 事件发送:', {
                        event: normalizedName,
                        data: data,
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
                console.error('[EventHub] 事件发送失败:', error);
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
            try {
                if (!namespace) {
                    // 清理所有
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
                    console.log('[EventHub] 命名空间已清理:', namespace || 'all');
                }
                
                return true;
                
            } catch (error) {
                console.error('[EventHub] 清理命名空间失败:', error);
                statistics.errors++;
                return false;
            }
        };
        
        // 🔑 开启/关闭调试模式
        this.debug = function(enable) {
            debugMode = !!enable;
            console.log('[EventHub] 调试模式:', debugMode ? '开启' : '关闭');
        };
        
        // 🔑 获取统计信息
        this.getStats = function() {
            return {
                totalEvents: statistics.totalEvents,
                totalListeners: statistics.totalListeners,
                errors: statistics.errors,
                activeEvents: Object.keys(listeners).length,
                activeNamespaces: Object.keys(namespaces).length,
                queueSize: eventQueue.length
            };
        };
        
        // 🔑 等待事件（返回Promise）
        this.waitFor = function(eventName, timeout) {
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
                    clearTimeout(timer);
                    unsubscribe();
                }
            });
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
                        listener.originalCallback.apply(null, args);
                    }, listener.debounce);
                    
                    return;
                }
                
                // 直接执行
                listener.originalCallback.apply(null, args);
            };
        }
        
        function queueEvent(event, eventListeners) {
            if (eventQueue.length >= maxQueueSize) {
                console.warn('[EventHub] 事件队列已满，丢弃最旧事件');
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
            if (isProcessingQueue || eventQueue.length === 0) return;
            
            isProcessingQueue = true;
            
            // 使用 setTimeout 实现异步处理
            setTimeout(function() {
                try {
                    while (eventQueue.length > 0) {
                        var item = eventQueue.shift();
                        executeEventListeners(item.event, item.listeners);
                        
                        // 每次只处理一个事件，避免阻塞
                        if (eventQueue.length > 0) {
                            setTimeout(processEventQueue, 0);
                            break;
                        }
                    }
                } catch (error) {
                    console.error('[EventHub] 处理事件队列失败:', error);
                    statistics.errors++;
                } finally {
                    isProcessingQueue = false;
                }
            }, 0);
        }
        
        function executeEventListeners(event, eventListeners) {
            var listenersToRemove = [];
            
            for (var i = 0; i < eventListeners.length; i++) {
                if (event.stopped) break;
                
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
                    console.error('[EventHub] 监听器执行失败:', error);
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
            var eventListeners = listeners[eventName];
            if (!eventListeners) return;
            
            for (var i = 0; i < eventListeners.length; i++) {
                if (eventListeners[i].id === listenerId) {
                    var listener = eventListeners[i];
                    
                    // 清理防抖定时器
                    if (listener.debounceTimeout) {
                        clearTimeout(listener.debounceTimeout);
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
        
        function setupGlobalErrorHandling() {
            // 如果在浏览器环境中，监听全局错误
            if (typeof window !== 'undefined') {
                var originalErrorHandler = window.onerror;
                
                window.onerror = function(message, source, lineno, colno, error) {
                    self.emit('global:error', {
                        message: message,
                        source: source,
                        lineno: lineno,
                        colno: colno,
                        error: error
                    });
                    
                    // 调用原有错误处理器
                    if (originalErrorHandler) {
                        return originalErrorHandler.apply(this, arguments);
                    }
                };
                
                // 监听未处理的Promise拒绝
                if ('onunhandledrejection' in window) {
                    window.addEventListener('unhandledrejection', function(event) {
                        self.emit('global:unhandledrejection', {
                            reason: event.reason,
                            promise: event.promise
                        });
                    });
                }
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventHub;
    } else if (typeof global !== 'undefined') {
        global.EventHub = EventHub;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.EventHub = EventHub;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);