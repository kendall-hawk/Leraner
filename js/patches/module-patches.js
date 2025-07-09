// js/core/module-patches.js - 现有模块修复补丁
// 🚀 修复现有模块的初始化问题，防止循环依赖和卡死

(function(global) {
    'use strict';

    // 🔧 防止重复执行
    if (global._MODULE_PATCHES_APPLIED) {
        return;
    }
    global._MODULE_PATCHES_APPLIED = true;

    console.log('[ModulePatches] 开始应用模块修复补丁...');

    // 🔑 1. 修复所有模块的自动初始化问题
    function disableAutoInitialization() {
        // 设置安全模式标志，防止模块自动初始化
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite._SAFE_MODE = true;
        global.EnglishSite._AUTO_INIT_DISABLED = true;
        
        console.log('[ModulePatches] 已禁用自动初始化');
    }

    // 🔑 2. 修复错误边界的全局错误处理
    function patchErrorBoundary() {
        var originalWindowError = global.onerror;
        var errorBoundaryInitialized = false;
        
        // 临时错误收集器
        var pendingErrors = [];
        
        global.onerror = function(message, source, lineno, colno, error) {
            if (errorBoundaryInitialized && global.EnglishSite && global.EnglishSite.ErrorBoundary) {
                // 如果ErrorBoundary已初始化，传递给它
                try {
                    var errorBoundary = global.EnglishSite.ErrorBoundary;
                    if (errorBoundary && typeof errorBoundary.handle === 'function') {
                        errorBoundary.handle(error || new Error(message), {
                            type: 'global',
                            source: source,
                            lineno: lineno,
                            colno: colno
                        });
                    }
                } catch (handlingError) {
                    console.error('[ModulePatches] ErrorBoundary处理失败:', handlingError);
                }
            } else {
                // ErrorBoundary未初始化，暂存错误
                pendingErrors.push({
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    error: error,
                    timestamp: Date.now()
                });
                
                // 限制暂存错误数量
                if (pendingErrors.length > 20) {
                    pendingErrors.shift();
                }
                
                console.error('[ModulePatches] 错误暂存:', message);
            }
            
            // 调用原始错误处理器
            if (originalWindowError) {
                try {
                    return originalWindowError.apply(this, arguments);
                } catch (e) {
                    console.error('[ModulePatches] 原始错误处理器失败:', e);
                }
            }
            
            return false;
        };
        
        // 当ErrorBoundary初始化后，处理暂存的错误
        function flushPendingErrors() {
            if (pendingErrors.length > 0 && global.EnglishSite && global.EnglishSite.ErrorBoundary) {
                console.log('[ModulePatches] 处理', pendingErrors.length, '个暂存错误');
                
                pendingErrors.forEach(function(errorInfo) {
                    try {
                        global.EnglishSite.ErrorBoundary.handle(
                            errorInfo.error || new Error(errorInfo.message),
                            {
                                type: 'delayed',
                                originalTimestamp: errorInfo.timestamp,
                                source: errorInfo.source,
                                lineno: errorInfo.lineno,
                                colno: errorInfo.colno
                            }
                        );
                    } catch (e) {
                        console.error('[ModulePatches] 处理暂存错误失败:', e);
                    }
                });
                
                pendingErrors = [];
            }
        }
        
        // 监听ErrorBoundary初始化
        var checkInterval = setInterval(function() {
            if (global.EnglishSite && global.EnglishSite.ErrorBoundary) {
                errorBoundaryInitialized = true;
                clearInterval(checkInterval);
                setTimeout(flushPendingErrors, 100);
            }
        }, 100);
        
        // 10秒后停止检查，避免内存泄漏
        setTimeout(function() {
            clearInterval(checkInterval);
            if (!errorBoundaryInitialized) {
                console.warn('[ModulePatches] ErrorBoundary未在10秒内初始化，清理暂存错误');
                pendingErrors = [];
            }
        }, 10000);
        
        console.log('[ModulePatches] ErrorBoundary补丁已应用');
    }

    // 🔑 3. 修复存储访问问题
    function patchStorageAccess() {
        var safeStorage = null;
        
        function createSafeStorage() {
            if (safeStorage) return safeStorage;
            
            try {
                // 测试localStorage
                var testKey = '_storage_test_' + Date.now();
                global.localStorage.setItem(testKey, 'test');
                global.localStorage.removeItem(testKey);
                safeStorage = global.localStorage;
                console.log('[ModulePatches] 使用localStorage');
                return safeStorage;
            } catch (error) {
                try {
                    // 降级到sessionStorage
                    var testKey = '_storage_test_' + Date.now();
                    global.sessionStorage.setItem(testKey, 'test');
                    global.sessionStorage.removeItem(testKey);
                    safeStorage = global.sessionStorage;
                    console.log('[ModulePatches] 降级到sessionStorage');
                    return safeStorage;
                } catch (sessionError) {
                    // 最终降级到内存存储
                    safeStorage = createMemoryStorage();
                    console.log('[ModulePatches] 降级到内存存储');
                    return safeStorage;
                }
            }
        }
        
        function createMemoryStorage() {
            var data = {};
            return {
                setItem: function(key, value) {
                    if (key && value !== undefined) {
                        data[key] = String(value);
                    }
                },
                getItem: function(key) {
                    return data[key] || null;
                },
                removeItem: function(key) {
                    if (key && data.hasOwnProperty(key)) {
                        delete data[key];
                    }
                },
                clear: function() {
                    data = {};
                },
                get length() {
                    return Object.keys(data).length;
                },
                key: function(index) {
                    var keys = Object.keys(data);
                    return keys[index] || null;
                }
            };
        }
        
        // 提供全局安全存储访问
        global.EnglishSite.getSafeStorage = createSafeStorage;
        
        console.log('[ModulePatches] 存储访问补丁已应用');
    }

    // 🔑 4. 修复循环依赖问题
    function patchCircularDependencies() {
        var dependencyCache = {};
        
        // 安全的依赖获取函数
        function getSafeDependency(name, fallback) {
            if (dependencyCache[name]) {
                return dependencyCache[name];
            }
            
            var dependency = null;
            
            try {
                // 尝试从全局获取
                dependency = global[name];
                
                // 尝试从EnglishSite命名空间获取
                if (!dependency && global.EnglishSite) {
                    dependency = global.EnglishSite[name];
                }
                
                // 如果找到，缓存它
                if (dependency) {
                    dependencyCache[name] = dependency;
                    return dependency;
                }
                
            } catch (error) {
                console.warn('[ModulePatches] 获取依赖失败:', name, error.message);
            }
            
            // 返回fallback或null
            return fallback || null;
        }
        
        // 提供全局安全依赖获取
        global.EnglishSite.getSafeDependency = getSafeDependency;
        
        console.log('[ModulePatches] 循环依赖补丁已应用');
    }

    // 🔑 5. 修复Promise相关问题
    function patchPromiseIssues() {
        // 确保Promise可用
        if (typeof Promise === 'undefined') {
            console.warn('[ModulePatches] Promise不可用，提供基础Polyfill');
            
            global.Promise = function(executor) {
                var self = this;
                this.state = 'pending';
                this.value = undefined;
                this.handlers = [];
                
                function resolve(result) {
                    if (self.state === 'pending') {
                        self.state = 'fulfilled';
                        self.value = result;
                        self.handlers.forEach(function(handler) {
                            handler.onFulfilled(result);
                        });
                    }
                }
                
                function reject(error) {
                    if (self.state === 'pending') {
                        self.state = 'rejected';
                        self.value = error;
                        self.handlers.forEach(function(handler) {
                            handler.onRejected(error);
                        });
                    }
                }
                
                try {
                    executor(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            };
            
            global.Promise.prototype.then = function(onFulfilled, onRejected) {
                var self = this;
                return new global.Promise(function(resolve, reject) {
                    function handle() {
                        if (self.state === 'fulfilled') {
                            if (typeof onFulfilled === 'function') {
                                try {
                                    resolve(onFulfilled(self.value));
                                } catch (error) {
                                    reject(error);
                                }
                            } else {
                                resolve(self.value);
                            }
                        } else if (self.state === 'rejected') {
                            if (typeof onRejected === 'function') {
                                try {
                                    resolve(onRejected(self.value));
                                } catch (error) {
                                    reject(error);
                                }
                            } else {
                                reject(self.value);
                            }
                        } else {
                            self.handlers.push({
                                onFulfilled: function(result) {
                                    if (typeof onFulfilled === 'function') {
                                        try {
                                            resolve(onFulfilled(result));
                                        } catch (error) {
                                            reject(error);
                                        }
                                    } else {
                                        resolve(result);
                                    }
                                },
                                onRejected: function(error) {
                                    if (typeof onRejected === 'function') {
                                        try {
                                            resolve(onRejected(error));
                                        } catch (e) {
                                            reject(e);
                                        }
                                    } else {
                                        reject(error);
                                    }
                                }
                            });
                        }
                    }
                    
                    handle();
                });
            };
            
            global.Promise.prototype.catch = function(onRejected) {
                return this.then(null, onRejected);
            };
            
            global.Promise.resolve = function(value) {
                return new global.Promise(function(resolve) {
                    resolve(value);
                });
            };
            
            global.Promise.reject = function(error) {
                return new global.Promise(function(resolve, reject) {
                    reject(error);
                });
            };
        }
        
        // 添加未处理的Promise拒绝监听器
        if (typeof global !== 'undefined' && !global.onunhandledrejection) {
            var unhandledRejections = [];
            
            global.addEventListener('unhandledrejection', function(event) {
                unhandledRejections.push(event);
                console.warn('[ModulePatches] 未处理的Promise拒绝:', event.reason);
                
                // 限制数组大小
                if (unhandledRejections.length > 10) {
                    unhandledRejections.shift();
                }
            });
        }
        
        console.log('[ModulePatches] Promise补丁已应用');
    }

    // 🔑 6. 应用所有补丁
    function applyAllPatches() {
        var patches = [
            { name: '禁用自动初始化', fn: disableAutoInitialization },
            { name: '错误边界', fn: patchErrorBoundary },
            { name: '存储访问', fn: patchStorageAccess },
            { name: '循环依赖', fn: patchCircularDependencies },
            { name: 'Promise相关', fn: patchPromiseIssues }
        ];
        
        patches.forEach(function(patch) {
            try {
                patch.fn();
                console.log('[ModulePatches] ✓', patch.name, '补丁应用成功');
            } catch (error) {
                console.error('[ModulePatches] ✗', patch.name, '补丁应用失败:', error);
            }
        });
        
        console.log('[ModulePatches] 所有补丁应用完成');
    }

    // 🚀 立即应用补丁
    try {
        applyAllPatches();
        
        // 设置全局补丁状态
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite._PATCHES_APPLIED = true;
        global.EnglishSite._PATCH_VERSION = '1.0.0';
        
        console.log('[ModulePatches] 模块修复补丁全部应用完成');
        
    } catch (error) {
        console.error('[ModulePatches] 应用补丁时发生错误:', error);
    }

})(typeof window !== 'undefined' ? window : this);