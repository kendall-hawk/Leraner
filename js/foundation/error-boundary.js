// js/foundation/error-boundary.js - iOS兼容版错误边界
// 🚀 全局错误处理，确保iOS Safari 12+兼容性

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
            return fallback || '[Object]';
        }
    }

    function sanitizeErrorInfo(error) {
        if (IS_PRODUCTION) {
            // 生产环境移除敏感信息
            return {
                message: 'Application Error',
                type: 'error',
                timestamp: Date.now()
            };
        }
        
        return {
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace',
            name: error.name || 'Error',
            timestamp: Date.now()
        };
    }

    /**
     * 🎯 ErrorBoundary - 错误边界
     * 功能：全局错误捕获、优雅降级、用户提示、开发友好
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function ErrorBoundary() {
        // 私有变量通过闭包实现
        var errorQueue = [];
        var maxQueueSize = 100;
        var fallbackComponents = {};
        var recoveryStrategies = {};
        var debugMode = !IS_PRODUCTION;
        var statistics = {
            totalErrors: 0,
            scriptErrors: 0,
            networkErrors: 0,
            runtimeErrors: 0,
            recoveredErrors: 0
        };
        var isInitialized = false;
        var reportEndpoint = null;
        
        // 🔧 错误防护机制
        var isHandlingError = false;
        var maxErrorsPerMinute = 10;
        var errorCounts = [];
        var isDestroyed = false;
        
        // 🔧 事件处理器引用
        var originalErrorHandler = null;
        var originalRejectionHandler = null;
        var originalConsoleError = null;
        var boundUnloadHandler = null;
        
        // 🔧 离线错误缓存（手机端优化）
        var offlineErrorCache = [];
        var maxOfflineErrors = 50;
        
        var self = this;
        
        // 🔧 错误防护函数
        function canHandleError() {
            if (isHandlingError || isDestroyed) return false;
            
            var now = Date.now();
            // 清理1分钟前的错误记录
            errorCounts = errorCounts.filter(function(time) {
                return now - time < 60000;
            });
            
            if (errorCounts.length >= maxErrorsPerMinute) {
                DEBUG_WARN('[ErrorBoundary] 错误频率过高，暂停处理');
                return false;
            }
            
            errorCounts.push(now);
            return true;
        }
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[ErrorBoundary] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                setupGlobalErrorHandlers();
                setupUnhandledRejectionHandler();
                setupConsoleErrorCapture();
                setupDefaultRecoveryStrategies();
                setupDefaultFallbacks();
                setupUnloadHandler();
                setupOnlineHandler();
                
                isInitialized = true;
                DEBUG_LOG('[ErrorBoundary] 初始化成功');
            } catch (error) {
                // 避免初始化错误导致递归
                console.error('[ErrorBoundary] 初始化失败:', error);
            }
        }
        
        // 🔑 包装函数
        this.wrap = function(fn, context) {
            context = context || 'unknown';
            
            if (typeof fn !== 'function') {
                DEBUG_WARN('[ErrorBoundary] wrap: 参数不是函数');
                return function() { return undefined; };
            }
            
            return function wrappedFunction() {
                try {
                    return fn.apply(this, arguments);
                } catch (error) {
                    self.handle(error, {
                        context: context,
                        function: fn.name || 'anonymous',
                        arguments: Array.prototype.slice.call(arguments)
                    });
                    
                    // 尝试恢复
                    return attemptRecovery(context, error);
                }
            };
        };
        
        // 🔑 处理错误
        this.handle = function(error, context) {
            if (!canHandleError()) return null;
            
            isHandlingError = true;
            
            try {
                context = context || {};
                var errorInfo = normalizeError(error, context);
                
                // 记录错误
                recordError(errorInfo);
                
                // 分类统计
                categorizeError(errorInfo);
                
                // 用户提示（仅限关键错误）
                if (errorInfo.severity === 'critical') {
                    showUserNotification(errorInfo);
                }
                
                // 开发者调试
                if (debugMode) {
                    logDetailedError(errorInfo);
                }
                
                // 错误上报（智能处理）
                handleErrorReporting(errorInfo);
                
                return errorInfo;
                
            } catch (handlingError) {
                // 防止递归错误
                console.error('[ErrorBoundary] 关键错误处理失败:', handlingError);
                statistics.totalErrors++;
            } finally {
                isHandlingError = false;
            }
        };
        
        // 🔑 错误恢复
        this.recover = function(strategy) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (typeof strategy === 'string') {
                    return executeRecoveryStrategy(strategy);
                }
                
                if (typeof strategy === 'function') {
                    try {
                        return strategy();
                    } catch (error) {
                        DEBUG_ERROR('[ErrorBoundary] 恢复策略执行失败:', error);
                        return false;
                    }
                }
                
                return false;
            } catch (error) {
                DEBUG_ERROR('[ErrorBoundary] 恢复失败:', error);
                return false;
            }
        };
        
        // 🔑 错误报告
        this.report = function(error, details) {
            if (isDestroyed) {
                return null;
            }
            
            try {
                details = details || {};
                
                var errorInfo = {
                    error: sanitizeErrorInfo(error),
                    details: details,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                };
                
                if (reportEndpoint) {
                    sendErrorReport(errorInfo);
                } else {
                    DEBUG_WARN('[ErrorBoundary] 报告端点未设置');
                }
                
                return errorInfo;
            } catch (reportError) {
                DEBUG_ERROR('[ErrorBoundary] 创建错误报告失败:', reportError);
                return null;
            }
        };
        
        // 🔑 设置降级组件
        this.setFallback = function(component, key) {
            if (isDestroyed) {
                return false;
            }
            
            key = key || 'default';
            
            if (typeof component === 'function') {
                fallbackComponents[key] = component;
                return true;
            }
            
            DEBUG_WARN('[ErrorBoundary] 降级组件必须是函数');
            return false;
        };
        
        // 🔑 设置恢复策略
        this.setRecoveryStrategy = function(name, strategy) {
            if (isDestroyed) {
                return false;
            }
            
            if (typeof strategy === 'function') {
                recoveryStrategies[name] = strategy;
                return true;
            }
            
            DEBUG_WARN('[ErrorBoundary] 恢复策略必须是函数');
            return false;
        };
        
        // 🔑 设置报告端点
        this.setReportEndpoint = function(endpoint) {
            if (!isDestroyed) {
                reportEndpoint = endpoint;
            }
        };
        
        // 🔑 开启/关闭调试模式
        this.debug = function(enable) {
            if (!isDestroyed) {
                debugMode = !!enable && !IS_PRODUCTION; // 生产环境强制关闭
                DEBUG_LOG('[ErrorBoundary] 调试模式:', debugMode ? '开启' : '关闭');
            }
        };
        
        // 🔑 获取错误统计
        this.getStats = function() {
            return {
                totalErrors: statistics.totalErrors,
                scriptErrors: statistics.scriptErrors,
                networkErrors: statistics.networkErrors,
                runtimeErrors: statistics.runtimeErrors,
                recoveredErrors: statistics.recoveredErrors,
                queueSize: errorQueue.length,
                offlineCacheSize: offlineErrorCache.length,
                isInitialized: isInitialized,
                isDestroyed: isDestroyed
            };
        };
        
        // 🔑 清理错误队列
        this.clearErrors = function() {
            if (isDestroyed) {
                return 0;
            }
            
            var count = errorQueue.length;
            errorQueue = [];
            offlineErrorCache = [];
            return count;
        };
        
        // 🔑 获取错误历史
        this.getErrorHistory = function(limit) {
            limit = limit || 10;
            return errorQueue.slice(-limit);
        };
        
        // 🔑 销毁实例
        this.destroy = function() {
            if (isDestroyed) {
                return true;
            }
            
            try {
                // 标记为已销毁
                isDestroyed = true;
                
                // 恢复原始处理器
                restoreOriginalHandlers();
                
                // 发送离线缓存的错误
                if (offlineErrorCache.length > 0 && navigator.onLine) {
                    flushOfflineErrors();
                }
                
                // 清理数据
                errorQueue = [];
                fallbackComponents = {};
                recoveryStrategies = {};
                errorCounts = [];
                offlineErrorCache = [];
                
                // 重置统计
                statistics = {
                    totalErrors: 0,
                    scriptErrors: 0,
                    networkErrors: 0,
                    runtimeErrors: 0,
                    recoveredErrors: 0
                };
                
                DEBUG_LOG('[ErrorBoundary] 实例已销毁');
                return true;
            } catch (error) {
                console.error('[ErrorBoundary] 销毁失败:', error);
                return false;
            }
        };
        
        // 🔧 内部工具函数
        function setupGlobalErrorHandlers() {
            // 保存原有错误处理器
            originalErrorHandler = window.onerror;
            
            window.onerror = function(message, source, lineno, colno, error) {
                var errorInfo = {
                    type: 'script',
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    error: error,
                    timestamp: Date.now()
                };
                
                self.handle(error || new Error(message), {
                    type: 'global',
                    details: errorInfo
                });
                
                // 调用原有处理器
                if (originalErrorHandler) {
                    try {
                        return originalErrorHandler.apply(this, arguments);
                    } catch (e) {
                        // 防止原处理器错误
                        return false;
                    }
                }
                
                return false; // 防止默认错误处理
            };
        }
        
        function setupUnhandledRejectionHandler() {
            // 检测Promise rejection支持
            if (typeof window !== 'undefined' && 'onunhandledrejection' in window) {
                originalRejectionHandler = window.onunhandledrejection;
                
                var rejectionHandler = function(event) {
                    var errorInfo = {
                        type: 'promise',
                        reason: event.reason,
                        promise: event.promise,
                        timestamp: Date.now()
                    };
                    
                    self.handle(event.reason, {
                        type: 'unhandledRejection',
                        details: errorInfo
                    });
                };
                
                window.addEventListener('unhandledrejection', rejectionHandler);
            }
        }
        
        function setupConsoleErrorCapture() {
            // 包装console.error以捕获手动错误
            if (typeof console !== 'undefined' && console.error) {
                originalConsoleError = console.error;
                
                console.error = function() {
                    // 记录控制台错误（仅在开发环境）
                    if (!IS_PRODUCTION && arguments.length > 0 && arguments[0] instanceof Error) {
                        self.handle(arguments[0], {
                            type: 'console',
                            details: Array.prototype.slice.call(arguments)
                        });
                    }
                    
                    // 调用原有console.error
                    return originalConsoleError.apply(console, arguments);
                };
            }
        }
        
        function setupUnloadHandler() {
            if (typeof window !== 'undefined') {
                boundUnloadHandler = function() {
                    // 发送最后的错误报告
                    if (offlineErrorCache.length > 0 && reportEndpoint) {
                        var finalReport = {
                            type: 'session_end',
                            errors: offlineErrorCache,
                            stats: self.getStats()
                        };
                        
                        // 使用同步方式确保发送
                        try {
                            if (navigator.sendBeacon) {
                                navigator.sendBeacon(reportEndpoint, safeJSONStringify(finalReport));
                            }
                        } catch (error) {
                            // 静默失败
                        }
                    }
                };
                
                window.addEventListener('beforeunload', boundUnloadHandler);
            }
        }
        
        function setupOnlineHandler() {
            // 网络恢复时发送离线错误
            if (typeof window !== 'undefined') {
                window.addEventListener('online', function() {
                    if (offlineErrorCache.length > 0) {
                        flushOfflineErrors();
                    }
                });
            }
        }
        
        function restoreOriginalHandlers() {
            // 恢复原始错误处理器
            if (typeof window !== 'undefined') {
                if (originalErrorHandler) {
                    window.onerror = originalErrorHandler;
                } else {
                    window.onerror = null;
                }
                
                if (originalRejectionHandler) {
                    window.onunhandledrejection = originalRejectionHandler;
                }
                
                if (boundUnloadHandler) {
                    window.removeEventListener('beforeunload', boundUnloadHandler);
                    boundUnloadHandler = null;
                }
            }
            
            // 恢复console.error
            if (originalConsoleError && typeof console !== 'undefined') {
                console.error = originalConsoleError;
            }
            
            originalErrorHandler = null;
            originalRejectionHandler = null;
            originalConsoleError = null;
        }
        
        function normalizeError(error, context) {
            var normalized = {
                message: 'Unknown error',
                stack: 'No stack trace',
                name: 'Error',
                context: context || {},
                timestamp: Date.now(),
                severity: 'low'
            };
            
            if (error) {
                normalized.message = error.message || String(error);
                normalized.stack = error.stack || 'No stack trace';
                normalized.name = error.name || 'Error';
                
                // 确定严重程度
                normalized.severity = determineSeverity(error, context);
            }
            
            return normalized;
        }
        
        function determineSeverity(error, context) {
            // 关键系统错误
            if (context && context.type === 'global') {
                return 'critical';
            }
            
            // 语法错误或引用错误
            if (error && (error.name === 'SyntaxError' || error.name === 'ReferenceError')) {
                return 'high';
            }
            
            // 网络错误
            if (error && error.message && error.message.indexOf('fetch') !== -1) {
                return 'medium';
            }
            
            return 'low';
        }
        
        function recordError(errorInfo) {
            if (errorQueue.length >= maxQueueSize) {
                errorQueue.shift(); // 移除最旧的错误
            }
            
            errorQueue.push(errorInfo);
            statistics.totalErrors++;
        }
        
        function categorizeError(errorInfo) {
            if (errorInfo.context && errorInfo.context.type) {
                switch (errorInfo.context.type) {
                    case 'script':
                    case 'global':
                        statistics.scriptErrors++;
                        break;
                    case 'network':
                        statistics.networkErrors++;
                        break;
                    default:
                        statistics.runtimeErrors++;
                }
            } else {
                statistics.runtimeErrors++;
            }
        }
        
        function showUserNotification(errorInfo) {
            // 非阻塞式用户提示
            setTimeout(function() {
                if (typeof window !== 'undefined' && !isDestroyed) {
                    // 用户友好的错误消息
                    var userMessage = getUserFriendlyMessage(errorInfo);
                    
                    // 检查是否有自定义通知系统
                    if (window.EnglishSite && window.EnglishSite.showNotification) {
                        window.EnglishSite.showNotification(userMessage, 'error');
                    } else if (!IS_PRODUCTION) {
                        // 仅在开发环境显示技术错误信息
                        DEBUG_ERROR('系统错误:', userMessage);
                    }
                    // 生产环境静默处理
                }
            }, 100);
        }
        
        function getUserFriendlyMessage(errorInfo) {
            var friendlyMessages = {
                'NetworkError': '网络连接问题，请检查您的网络设置',
                'TypeError': '页面功能异常，请刷新页面重试',
                'ReferenceError': '页面加载不完整，请刷新页面',
                'SyntaxError': '页面脚本错误，请联系技术支持'
            };
            
            return friendlyMessages[errorInfo.name] || '系统遇到问题，请稍后重试';
        }
        
        function logDetailedError(errorInfo) {
            DEBUG_LOG('[ErrorBoundary] 详细错误信息:');
            DEBUG_ERROR('错误消息:', errorInfo.message);
            DEBUG_ERROR('错误类型:', errorInfo.name);
            DEBUG_ERROR('严重程度:', errorInfo.severity);
            DEBUG_ERROR('发生时间:', new Date(errorInfo.timestamp).toISOString());
            DEBUG_ERROR('上下文:', errorInfo.context);
            DEBUG_ERROR('堆栈跟踪:', errorInfo.stack);
        }
        
        function handleErrorReporting(errorInfo) {
            if (!reportEndpoint) return;
            
            // 智能错误上报策略
            if (navigator.onLine) {
                // 在线：直接发送
                sendErrorReport(errorInfo);
            } else {
                // 离线：缓存错误
                cacheOfflineError(errorInfo);
            }
        }
        
        function cacheOfflineError(errorInfo) {
            if (offlineErrorCache.length >= maxOfflineErrors) {
                offlineErrorCache.shift(); // 移除最旧的错误
            }
            
            offlineErrorCache.push({
                error: sanitizeErrorInfo(errorInfo),
                timestamp: Date.now(),
                cached: true
            });
        }
        
        function flushOfflineErrors() {
            if (offlineErrorCache.length === 0 || !reportEndpoint) return;
            
            var errors = offlineErrorCache.slice();
            offlineErrorCache = [];
            
            // 批量发送离线错误
            var batchReport = {
                type: 'offline_batch',
                errors: errors,
                count: errors.length,
                timestamp: Date.now()
            };
            
            sendErrorReport(batchReport);
        }
        
        function attemptRecovery(context, error) {
            try {
                var strategy = recoveryStrategies[context] || recoveryStrategies['default'];
                
                if (strategy) {
                    try {
                        var result = strategy(error, context);
                        if (result !== false) {
                            statistics.recoveredErrors++;
                            return result;
                        }
                    } catch (recoveryError) {
                        DEBUG_ERROR('[ErrorBoundary] 恢复策略失败:', recoveryError);
                    }
                }
                
                // 降级到默认组件
                var fallback = fallbackComponents[context] || fallbackComponents['default'];
                if (fallback) {
                    try {
                        return fallback(error, context);
                    } catch (fallbackError) {
                        DEBUG_ERROR('[ErrorBoundary] 降级组件失败:', fallbackError);
                    }
                }
                
                return undefined;
            } catch (error) {
                DEBUG_ERROR('[ErrorBoundary] 恢复尝试失败:', error);
                return undefined;
            }
        }
        
        function executeRecoveryStrategy(strategyName) {
            var strategy = recoveryStrategies[strategyName];
            
            if (strategy) {
                try {
                    return strategy();
                } catch (error) {
                    DEBUG_ERROR('[ErrorBoundary] 恢复策略执行失败:', error);
                    return false;
                }
            }
            
            DEBUG_WARN('[ErrorBoundary] 未找到恢复策略:', strategyName);
            return false;
        }
        
        function sendErrorReport(errorInfo) {
            if (!reportEndpoint) return;
            
            // 异步发送，避免阻塞
            setTimeout(function() {
                if (!isDestroyed) {
                    try {
                        var payload = {
                            error: errorInfo,
                            userAgent: navigator.userAgent,
                            timestamp: Date.now(),
                            url: window.location.href,
                            stats: self.getStats()
                        };
                        
                        // 使用兼容的发送方式
                        if (typeof fetch !== 'undefined') {
                            fetch(reportEndpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: safeJSONStringify(payload)
                            }).catch(function(error) {
                                // 发送失败时缓存错误
                                cacheOfflineError(errorInfo);
                            });
                        } else if (typeof XMLHttpRequest !== 'undefined') {
                            var xhr = new XMLHttpRequest();
                            xhr.open('POST', reportEndpoint, true);
                            xhr.setRequestHeader('Content-Type', 'application/json');
                            xhr.timeout = 5000; // 5秒超时
                            xhr.ontimeout = function() {
                                cacheOfflineError(errorInfo);
                            };
                            xhr.onerror = function() {
                                cacheOfflineError(errorInfo);
                            };
                            xhr.send(safeJSONStringify(payload));
                        }
                    } catch (sendError) {
                        // 发送失败，缓存错误
                        cacheOfflineError(errorInfo);
                    }
                }
            }, 0);
        }
        
        // 设置默认恢复策略
        function setupDefaultRecoveryStrategies() {
            self.setRecoveryStrategy('default', function(error, context) {
                DEBUG_WARN('[ErrorBoundary] 使用默认恢复策略:', context);
                return null;
            });
            
            self.setRecoveryStrategy('navigation', function(error, context) {
                // 导航错误恢复
                if (typeof window !== 'undefined') {
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                }
                return { reloading: true };
            });
            
            self.setRecoveryStrategy('audio', function(error, context) {
                // 音频错误恢复
                DEBUG_WARN('[ErrorBoundary] 音频功能暂时不可用');
                return { disabled: true, reason: 'error' };
            });
            
            self.setRecoveryStrategy('glossary', function(error, context) {
                // 词汇表错误恢复
                DEBUG_WARN('[ErrorBoundary] 词汇表功能暂时不可用');
                return { fallbackToBasic: true };
            });
        }
        
        // 设置默认降级组件
        function setupDefaultFallbacks() {
            self.setFallback(function(error, context) {
                return {
                    error: true,
                    message: '功能暂时不可用',
                    retry: function() {
                        window.location.reload();
                    }
                };
            }, 'default');
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
        module.exports = ErrorBoundary;
    } else if (typeof global !== 'undefined') {
        global.ErrorBoundary = ErrorBoundary;
        
        // 🔧 安全的命名空间添加
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.ErrorBoundary) {
            global.EnglishSite.ErrorBoundary = ErrorBoundary;
        } else {
            DEBUG_WARN('[ErrorBoundary] EnglishSite.ErrorBoundary 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);