// js/foundation/error-boundary.js - iOS兼容版错误边界
// 🚀 全局错误处理，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

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
        var debugMode = false;
        var statistics = {
            totalErrors: 0,
            scriptErrors: 0,
            networkErrors: 0,
            runtimeErrors: 0,
            recoveredErrors: 0
        };
        var isInitialized = false;
        var reportEndpoint = null;

        var self = this;

        // 🎯 初始化
        function initialize() {
            try {
                setupGlobalErrorHandlers();
                setupUnhandledRejectionHandler();
                setupConsoleErrorCapture();
                isInitialized = true;
                console.log('[ErrorBoundary] 初始化成功');
            } catch (error) {
                console.error('[ErrorBoundary] 初始化失败:', error);
            }
        }

        // 🔑 包装函数
        this.wrap = function(fn, context) {
            context = context || 'unknown';

            if (typeof fn !== 'function') {
                console.warn('[ErrorBoundary] wrap: 参数不是函数');
                return function() {
                    return undefined;
                };
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
            context = context || {};

            try {
                var errorInfo = normalizeError(error, context);

                // 记录错误
                recordError(errorInfo);

                // 分类统计
                categorizeError(errorInfo);

                // 用户提示
                if (errorInfo.severity === 'critical') {
                    showUserNotification(errorInfo);
                }

                // 开发者调试
                if (debugMode) {
                    logDetailedError(errorInfo);
                }

                // 远程报告
                if (reportEndpoint && shouldReport(errorInfo)) {
                    reportError(errorInfo);
                }

                return errorInfo;

            } catch (handlingError) {
                console.error('[ErrorBoundary] 错误处理失败:', handlingError);
                statistics.totalErrors++;
            }
        };

        // 🔑 错误恢复
        this.recover = function(strategy) {
            if (typeof strategy === 'string') {
                return executeRecoveryStrategy(strategy);
            }

            if (typeof strategy === 'function') {
                try {
                    return strategy();
                } catch (error) {
                    console.error('[ErrorBoundary] 恢复策略执行失败:', error);
                    return false;
                }
            }

            return false;
        };

        // 🔑 错误报告
        this.report = function(error, details) {
            details = details || {};

            var errorInfo = {
                error: normalizeError(error),
                details: details,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                stack: error && error.stack || 'No stack trace'
            };

            if (reportEndpoint) {
                sendErrorReport(errorInfo);
            } else {
                console.warn('[ErrorBoundary] 报告端点未设置');
            }

            return errorInfo;
        };

        // 🔑 设置降级组件
        this.setFallback = function(component, key) {
            key = key || 'default';

            if (typeof component === 'function') {
                fallbackComponents[key] = component;
                return true;
            }

            console.warn('[ErrorBoundary] 降级组件必须是函数');
            return false;
        };

        // 🔑 设置恢复策略
        this.setRecoveryStrategy = function(name, strategy) {
            if (typeof strategy === 'function') {
                recoveryStrategies[name] = strategy;
                return true;
            }

            console.warn('[ErrorBoundary] 恢复策略必须是函数');
            return false;
        };

        // 🔑 设置报告端点
        this.setReportEndpoint = function(endpoint) {
            reportEndpoint = endpoint;
        };

        // 🔑 开启/关闭调试模式
        this.debug = function(enable) {
            debugMode = !!enable;
            console.log('[ErrorBoundary] 调试模式:', debugMode ? '开启' : '关闭');
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
                isInitialized: isInitialized
            };
        };

        // 🔑 清理错误队列
        this.clearErrors = function() {
            var count = errorQueue.length;
            errorQueue = [];
            return count;
        };

        // 🔑 获取错误历史
        this.getErrorHistory = function(limit) {
            limit = limit || 10;
            return errorQueue.slice(-limit);
        };

        // 🔧 内部工具函数
        function setupGlobalErrorHandlers() {
            // 保存原有错误处理器
            var originalErrorHandler = window.onerror;

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
                    return originalErrorHandler.apply(this, arguments);
                }

                return false; // 防止默认错误处理
            };
        }

        function setupUnhandledRejectionHandler() {
            // 检测Promise rejection支持
            if (typeof window !== 'undefined' && 'onunhandledrejection' in window) {
                window.addEventListener('unhandledrejection', function(event) {
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
                });
            }
        }

        function setupConsoleErrorCapture() {
            // 包装console.error以捕获手动错误
            if (typeof console !== 'undefined' && console.error) {
                var originalConsoleError = console.error;

                console.error = function() {
                    // 记录控制台错误
                    if (arguments.length > 0 && arguments[0] instanceof Error) {
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
                if (typeof window !== 'undefined' && window.alert) {
                    // 用户友好的错误消息
                    var userMessage = getUserFriendlyMessage(errorInfo);

                    // 检查是否有自定义通知系统
                    if (window.EnglishSite && window.EnglishSite.showNotification) {
                        window.EnglishSite.showNotification(userMessage, 'error');
                    } else {
                        // 降级到基础提示
                        console.error('系统错误:', userMessage);
                    }
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
            console.group('[ErrorBoundary] 详细错误信息');
            console.error('错误消息:', errorInfo.message);
            console.error('错误类型:', errorInfo.name);
            console.error('严重程度:', errorInfo.severity);
            console.error('发生时间:', new Date(errorInfo.timestamp).toISOString());
            console.error('上下文:', errorInfo.context);
            console.error('堆栈跟踪:', errorInfo.stack);
            console.groupEnd();
        }

        function attemptRecovery(context, error) {
            var strategy = recoveryStrategies[context] || recoveryStrategies['default'];

            if (strategy) {
                try {
                    var result = strategy(error, context);
                    if (result !== false) {
                        statistics.recoveredErrors++;
                        return result;
                    }
                } catch (recoveryError) {
                    console.error('[ErrorBoundary] 恢复策略失败:', recoveryError);
                }
            }

            // 降级到默认组件
            var fallback = fallbackComponents[context] || fallbackComponents['default'];
            if (fallback) {
                try {
                    return fallback(error, context);
                } catch (fallbackError) {
                    console.error('[ErrorBoundary] 降级组件失败:', fallbackError);
                }
            }

            return undefined;
        }

        function executeRecoveryStrategy(strategyName) {
            var strategy = recoveryStrategies[strategyName];

            if (strategy) {
                try {
                    return strategy();
                } catch (error) {
                    console.error('[ErrorBoundary] 恢复策略执行失败:', error);
                    return false;
                }
            }

            console.warn('[ErrorBoundary] 未找到恢复策略:', strategyName);
            return false;
        }

        function shouldReport(errorInfo) {
            // 避免重复报告相同错误
            var recentErrors = errorQueue.slice(-5);
            for (var i = 0; i < recentErrors.length; i++) {
                if (recentErrors[i].message === errorInfo.message) {
                    return false;
                }
            }

            // 只报告中等以上严重程度的错误
            return errorInfo.severity === 'medium' ||
                errorInfo.severity === 'high' ||
                errorInfo.severity === 'critical';
        }

        function reportError(errorInfo) {
            if (!reportEndpoint) return;

            // 异步发送，避免阻塞
            setTimeout(function() {
                sendErrorReport(errorInfo);
            }, 0);
        }

        function sendErrorReport(errorInfo) {
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
                        body: JSON.stringify(payload)
                    }).catch(function(error) {
                        console.warn('[ErrorBoundary] 错误报告发送失败:', error);
                    });
                } else if (typeof XMLHttpRequest !== 'undefined') {
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', reportEndpoint, true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(JSON.stringify(payload));
                }
            } catch (reportError) {
                console.warn('[ErrorBoundary] 错误报告创建失败:', reportError);
            }
        }

        // 设置默认恢复策略
        function setupDefaultRecoveryStrategies() {
            self.setRecoveryStrategy('default', function(error, context) {
                console.warn('[ErrorBoundary] 使用默认恢复策略:', context);
                return null;
            });

            self.setRecoveryStrategy('navigation', function(error, context) {
                // 导航错误恢复
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
                return false;
            });

            self.setRecoveryStrategy('audio', function(error, context) {
                // 音频错误恢复
                console.warn('[ErrorBoundary] 音频功能暂时不可用');
                return {
                    disabled: true,
                    reason: 'error'
                };
            });

            self.setRecoveryStrategy('glossary', function(error, context) {
                // 词汇表错误恢复
                console.warn('[ErrorBoundary] 词汇表功能暂时不可用');
                return {
                    fallbackToBasic: true
                };
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

        // 立即初始化
        initialize();
        setupDefaultRecoveryStrategies();
        setupDefaultFallbacks();

        // 页面卸载时清理
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', function() {
                // 发送最后的错误报告
                if (errorQueue.length > 0 && reportEndpoint) {
                    var finalReport = {
                        type: 'session_end',
                        errors: errorQueue,
                        stats: self.getStats()
                    };

                    // 使用同步方式确保发送
                    try {
                        if (global.CompatibilityFixes && global.CompatibilityFixes.sendBeacon) {
                            global.CompatibilityFixes.sendBeacon(reportEndpoint, JSON.stringify(finalReport));
                        } else if (navigator.sendBeacon) {
                            navigator.sendBeacon(reportEndpoint, JSON.stringify(finalReport));
                        }
                    } catch (error) {
                        console.warn('[ErrorBoundary] 最终报告发送失败:', error);
                    }
                }
            });
        }
    }

    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ErrorBoundary;
    } else if (typeof global !== 'undefined') {
        global.ErrorBoundary = ErrorBoundary;

        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.ErrorBoundary = ErrorBoundary;
        }
    }

})(typeof window !== 'undefined' ? window : this);