// js/polyfills/promise.js - iOS兼容版Promise Polyfill
// 🚀 Promise完整实现，确保iOS Safari 9+兼容性

(function(global) {
    'use strict';

    // 检查是否需要polyfill
    if (typeof Promise !== 'undefined' && Promise.toString().indexOf('[native code]') !== -1) {
        return; // 原生Promise存在且为native实现
    }

    /**
     * 🎯 Promise Polyfill - 完整实现
     * 功能：Promise/A+规范完整实现
     * 兼容：iOS Safari 9+, Android 4.4+
     */
    function PromisePolyfill(executor) {
        var self = this;
        
        // Promise状态
        self.state = 'pending'; // pending, fulfilled, rejected
        self.value = undefined;
        self.reason = undefined;
        
        // 回调队列
        self.onFulfilledCallbacks = [];
        self.onRejectedCallbacks = [];
        
        // resolve函数
        function resolve(value) {
            if (self.state === 'pending') {
                // 处理thenable对象
                if (value && (typeof value === 'object' || typeof value === 'function')) {
                    var then = value.then;
                    if (typeof then === 'function') {
                        executeAsync(function() {
                            try {
                                then.call(value, resolve, reject);
                            } catch (error) {
                                reject(error);
                            }
                        });
                        return;
                    }
                }
                
                self.state = 'fulfilled';
                self.value = value;
                
                // 执行所有fulfilled回调
                executeAsync(function() {
                    self.onFulfilledCallbacks.forEach(function(callback) {
                        callback(value);
                    });
                });
            }
        }
        
        // reject函数
        function reject(reason) {
            if (self.state === 'pending') {
                self.state = 'rejected';
                self.reason = reason;
                
                // 执行所有rejected回调
                executeAsync(function() {
                    self.onRejectedCallbacks.forEach(function(callback) {
                        callback(reason);
                    });
                });
            }
        }
        
        // 执行executor
        try {
            executor(resolve, reject);
        } catch (error) {
            reject(error);
        }
    }
    
    // then方法 - Promise/A+核心
    PromisePolyfill.prototype.then = function(onFulfilled, onRejected) {
        var self = this;
        
        // 返回新的Promise
        return new PromisePolyfill(function(resolve, reject) {
            // 处理fulfilled状态
            function handleFulfilled(value) {
                try {
                    if (typeof onFulfilled === 'function') {
                        var result = onFulfilled(value);
                        resolvePromise(result, resolve, reject);
                    } else {
                        resolve(value);
                    }
                } catch (error) {
                    reject(error);
                }
            }
            
            // 处理rejected状态
            function handleRejected(reason) {
                try {
                    if (typeof onRejected === 'function') {
                        var result = onRejected(reason);
                        resolvePromise(result, resolve, reject);
                    } else {
                        reject(reason);
                    }
                } catch (error) {
                    reject(error);
                }
            }
            
            // 根据当前状态处理
            if (self.state === 'fulfilled') {
                executeAsync(function() {
                    handleFulfilled(self.value);
                });
            } else if (self.state === 'rejected') {
                executeAsync(function() {
                    handleRejected(self.reason);
                });
            } else {
                // pending状态，添加到回调队列
                self.onFulfilledCallbacks.push(handleFulfilled);
                self.onRejectedCallbacks.push(handleRejected);
            }
        });
    };
    
    // catch方法
    PromisePolyfill.prototype.catch = function(onRejected) {
        return this.then(null, onRejected);
    };
    
    // finally方法 (ES2018)
    PromisePolyfill.prototype.finally = function(onFinally) {
        var self = this;
        return self.then(
            function(value) {
                return PromisePolyfill.resolve(onFinally()).then(function() {
                    return value;
                });
            },
            function(reason) {
                return PromisePolyfill.resolve(onFinally()).then(function() {
                    throw reason;
                });
            }
        );
    };
    
    // 静态方法：Promise.resolve
    PromisePolyfill.resolve = function(value) {
        if (value instanceof PromisePolyfill) {
            return value;
        }
        
        return new PromisePolyfill(function(resolve) {
            resolve(value);
        });
    };
    
    // 静态方法：Promise.reject
    PromisePolyfill.reject = function(reason) {
        return new PromisePolyfill(function(resolve, reject) {
            reject(reason);
        });
    };
    
    // 静态方法：Promise.all
    PromisePolyfill.all = function(promises) {
        return new PromisePolyfill(function(resolve, reject) {
            if (!Array.isArray(promises)) {
                reject(new TypeError('Promise.all requires an array'));
                return;
            }
            
            var results = [];
            var remaining = promises.length;
            
            if (remaining === 0) {
                resolve(results);
                return;
            }
            
            promises.forEach(function(promise, index) {
                PromisePolyfill.resolve(promise).then(
                    function(value) {
                        results[index] = value;
                        remaining--;
                        if (remaining === 0) {
                            resolve(results);
                        }
                    },
                    function(reason) {
                        reject(reason);
                    }
                );
            });
        });
    };
    
    // 静态方法：Promise.allSettled
    PromisePolyfill.allSettled = function(promises) {
        return new PromisePolyfill(function(resolve) {
            if (!Array.isArray(promises)) {
                resolve([]);
                return;
            }
            
            var results = [];
            var remaining = promises.length;
            
            if (remaining === 0) {
                resolve(results);
                return;
            }
            
            promises.forEach(function(promise, index) {
                PromisePolyfill.resolve(promise).then(
                    function(value) {
                        results[index] = { status: 'fulfilled', value: value };
                        remaining--;
                        if (remaining === 0) {
                            resolve(results);
                        }
                    },
                    function(reason) {
                        results[index] = { status: 'rejected', reason: reason };
                        remaining--;
                        if (remaining === 0) {
                            resolve(results);
                        }
                    }
                );
            });
        });
    };
    
    // 静态方法：Promise.race
    PromisePolyfill.race = function(promises) {
        return new PromisePolyfill(function(resolve, reject) {
            if (!Array.isArray(promises)) {
                reject(new TypeError('Promise.race requires an array'));
                return;
            }
            
            promises.forEach(function(promise) {
                PromisePolyfill.resolve(promise).then(resolve, reject);
            });
        });
    };
    
    // 静态方法：Promise.any (ES2021)
    PromisePolyfill.any = function(promises) {
        return new PromisePolyfill(function(resolve, reject) {
            if (!Array.isArray(promises)) {
                reject(new TypeError('Promise.any requires an array'));
                return;
            }
            
            var errors = [];
            var remaining = promises.length;
            
            if (remaining === 0) {
                reject(new AggregateError([], 'All promises were rejected'));
                return;
            }
            
            promises.forEach(function(promise, index) {
                PromisePolyfill.resolve(promise).then(
                    function(value) {
                        resolve(value);
                    },
                    function(reason) {
                        errors[index] = reason;
                        remaining--;
                        if (remaining === 0) {
                            reject(new AggregateError(errors, 'All promises were rejected'));
                        }
                    }
                );
            });
        });
    };
    
    // 工具函数：异步执行
    function executeAsync(callback) {
        if (typeof setImmediate !== 'undefined') {
            setImmediate(callback);
        } else if (typeof MessageChannel !== 'undefined') {
            var channel = new MessageChannel();
            channel.port1.onmessage = function() {
                callback();
            };
            channel.port2.postMessage(null);
        } else {
            setTimeout(callback, 0);
        }
    }
    
    // 工具函数：解析Promise结果
    function resolvePromise(x, resolve, reject) {
        if (x instanceof PromisePolyfill) {
            x.then(resolve, reject);
        } else if (x && (typeof x === 'object' || typeof x === 'function')) {
            var then;
            try {
                then = x.then;
            } catch (error) {
                reject(error);
                return;
            }
            
            if (typeof then === 'function') {
                var called = false;
                try {
                    then.call(x, function(y) {
                        if (!called) {
                            called = true;
                            resolvePromise(y, resolve, reject);
                        }
                    }, function(r) {
                        if (!called) {
                            called = true;
                            reject(r);
                        }
                    });
                } catch (error) {
                    if (!called) {
                        reject(error);
                    }
                }
            } else {
                resolve(x);
            }
        } else {
            resolve(x);
        }
    }
    
    // AggregateError polyfill (for Promise.any)
    if (typeof AggregateError === 'undefined') {
        global.AggregateError = function AggregateError(errors, message) {
            var error = new Error(message || 'Multiple errors occurred');
            error.name = 'AggregateError';
            error.errors = errors || [];
            return error;
        };
    }
    
    // 导出Promise
    global.Promise = PromisePolyfill;
    
    // 添加到EnglishSite命名空间
    if (typeof global.EnglishSite === 'undefined') {
        global.EnglishSite = {};
    }
    global.EnglishSite.Promise = PromisePolyfill;
    
})(typeof window !== 'undefined' ? window : this);
