// js/utils/compatibility.js - iOS兼容性工具库
// 🚀 全面的兼容性检测和降级方案，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    /**
     * 🎯 CompatibilityUtils - 兼容性工具库
     * 功能：API检测、Polyfill、降级方案、性能优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function CompatibilityUtils() {
        var features = {};
        var polyfills = {};
        var isInitialized = false;
        
        // 🔍 特性检测
        function detectFeatures() {
            // JavaScript核心API
            features.map = typeof Map !== 'undefined';
            features.set = typeof Set !== 'undefined';
            features.weakMap = typeof WeakMap !== 'undefined';
            features.weakSet = typeof WeakSet !== 'undefined';
            features.promise = typeof Promise !== 'undefined';
            features.symbol = typeof Symbol !== 'undefined';
            
            // DOM API
            features.querySelector = typeof document.querySelector !== 'undefined';
            features.classList = typeof document.createElement('div').classList !== 'undefined';
            features.dataset = typeof document.createElement('div').dataset !== 'undefined';
            features.addEventListener = typeof document.addEventListener !== 'undefined';
            
            // 现代API
            features.fetch = typeof fetch !== 'undefined';
            features.requestAnimationFrame = typeof requestAnimationFrame !== 'undefined';
            features.intersectionObserver = typeof IntersectionObserver !== 'undefined';
            features.resizeObserver = typeof ResizeObserver !== 'undefined';
            features.mutationObserver = typeof MutationObserver !== 'undefined';
            
            // 存储API
            features.localStorage = (function() {
                try {
                    var test = 'compatibility_test';
                    localStorage.setItem(test, test);
                    localStorage.removeItem(test);
                    return true;
                } catch(e) {
                    return false;
                }
            })();
            
            features.sessionStorage = (function() {
                try {
                    var test = 'compatibility_test';
                    sessionStorage.setItem(test, test);
                    sessionStorage.removeItem(test);
                    return true;
                } catch(e) {
                    return false;
                }
            })();
            
            features.indexedDB = typeof indexedDB !== 'undefined';
            
            // 性能API
            features.performance = typeof performance !== 'undefined';
            features.performanceNow = typeof performance !== 'undefined' && typeof performance.now !== 'undefined';
            features.performanceMemory = typeof performance !== 'undefined' && typeof performance.memory !== 'undefined';
            
            // 触摸和手势
            features.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            features.pointerEvents = typeof PointerEvent !== 'undefined';
            features.passive = (function() {
                var passive = false;
                try {
                    var opts = Object.defineProperty({}, 'passive', {
                        get: function() { passive = true; }
                    });
                    window.addEventListener('test', null, opts);
                } catch(e) {}
                return passive;
            })();
            
            // CSS特性
            features.flexbox = (function() {
                var element = document.createElement('div');
                element.style.display = 'flex';
                return element.style.display === 'flex';
            })();
            
            features.grid = (function() {
                var element = document.createElement('div');
                element.style.display = 'grid';
                return element.style.display === 'grid';
            })();
            
            features.cssVariables = window.CSS && CSS.supports && CSS.supports('color', 'var(--fake-var)');
            features.cssSupports = window.CSS && typeof CSS.supports !== 'undefined';
            
            // 音频和视频
            features.audio = typeof Audio !== 'undefined';
            features.video = typeof HTMLVideoElement !== 'undefined';
            features.audioContext = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
            
            // WebWorker
            features.webWorker = typeof Worker !== 'undefined';
            features.serviceWorker = 'serviceWorker' in navigator;
            
            // 网络状态
            features.onLine = 'onLine' in navigator;
            features.connection = 'connection' in navigator;
        }
        
        // 🔧 Polyfill实现
        function createPolyfills() {
            // Map Polyfill
            if (!features.map) {
                polyfills.Map = function MapPolyfill() {
                    this._keys = [];
                    this._values = [];
                    this.size = 0;
                };
                
                polyfills.Map.prototype.set = function(key, value) {
                    var index = this._keys.indexOf(key);
                    if (index === -1) {
                        this._keys.push(key);
                        this._values.push(value);
                        this.size++;
                    } else {
                        this._values[index] = value;
                    }
                    return this;
                };
                
                polyfills.Map.prototype.get = function(key) {
                    var index = this._keys.indexOf(key);
                    return index === -1 ? undefined : this._values[index];
                };
                
                polyfills.Map.prototype.has = function(key) {
                    return this._keys.indexOf(key) !== -1;
                };
                
                polyfills.Map.prototype.delete = function(key) {
                    var index = this._keys.indexOf(key);
                    if (index !== -1) {
                        this._keys.splice(index, 1);
                        this._values.splice(index, 1);
                        this.size--;
                        return true;
                    }
                    return false;
                };
                
                polyfills.Map.prototype.clear = function() {
                    this._keys.length = 0;
                    this._values.length = 0;
                    this.size = 0;
                };
                
                polyfills.Map.prototype.forEach = function(callback, thisArg) {
                    for (var i = 0; i < this._keys.length; i++) {
                        callback.call(thisArg, this._values[i], this._keys[i], this);
                    }
                };
            }
            
            // Set Polyfill
            if (!features.set) {
                polyfills.Set = function SetPolyfill() {
                    this._values = [];
                    this.size = 0;
                };
                
                polyfills.Set.prototype.add = function(value) {
                    if (!this.has(value)) {
                        this._values.push(value);
                        this.size++;
                    }
                    return this;
                };
                
                polyfills.Set.prototype.has = function(value) {
                    return this._values.indexOf(value) !== -1;
                };
                
                polyfills.Set.prototype.delete = function(value) {
                    var index = this._values.indexOf(value);
                    if (index !== -1) {
                        this._values.splice(index, 1);
                        this.size--;
                        return true;
                    }
                    return false;
                };
                
                polyfills.Set.prototype.clear = function() {
                    this._values.length = 0;
                    this.size = 0;
                };
                
                polyfills.Set.prototype.forEach = function(callback, thisArg) {
                    for (var i = 0; i < this._values.length; i++) {
                        callback.call(thisArg, this._values[i], this._values[i], this);
                    }
                };
            }
            
            // Promise Polyfill (简化版)
            if (!features.promise) {
                polyfills.Promise = function PromisePolyfill(executor) {
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
                
                polyfills.Promise.prototype.then = function(onFulfilled, onRejected) {
                    var self = this;
                    return new polyfills.Promise(function(resolve, reject) {
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
                
                polyfills.Promise.prototype.catch = function(onRejected) {
                    return this.then(null, onRejected);
                };
            }
            
            // requestAnimationFrame Polyfill
            if (!features.requestAnimationFrame) {
                polyfills.requestAnimationFrame = function(callback) {
                    return setTimeout(callback, 16); // ~60fps
                };
                
                polyfills.cancelAnimationFrame = function(id) {
                    clearTimeout(id);
                };
            }
            
            // classList Polyfill
            if (!features.classList) {
                polyfills.classList = {
                    add: function(element, className) {
                        if (!this.contains(element, className)) {
                            element.className += ' ' + className;
                        }
                    },
                    remove: function(element, className) {
                        element.className = element.className.replace(
                            new RegExp('(^|\\s)' + className + '(\\s|$)', 'g'), ' '
                        ).replace(/^\s+|\s+$/g, '');
                    },
                    contains: function(element, className) {
                        return new RegExp('(^|\\s)' + className + '(\\s|$)').test(element.className);
                    },
                    toggle: function(element, className) {
                        if (this.contains(element, className)) {
                            this.remove(element, className);
                        } else {
                            this.add(element, className);
                        }
                    }
                };
            }
            
            // 存储降级
            if (!features.localStorage) {
                polyfills.localStorage = createMemoryStorage();
            }
            
            if (!features.sessionStorage) {
                polyfills.sessionStorage = createMemoryStorage();
            }
            
            // fetch Polyfill (简化版)
            if (!features.fetch) {
                polyfills.fetch = function(url, options) {
                    options = options || {};
                    
                    return new (getPromise())(function(resolve, reject) {
                        var xhr = new XMLHttpRequest();
                        
                        xhr.open(options.method || 'GET', url, true);
                        
                        // 设置headers
                        if (options.headers) {
                            for (var header in options.headers) {
                                xhr.setRequestHeader(header, options.headers[header]);
                            }
                        }
                        
                        xhr.onreadystatechange = function() {
                            if (xhr.readyState === 4) {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    resolve({
                                        ok: true,
                                        status: xhr.status,
                                        statusText: xhr.statusText,
                                        text: function() {
                                            return new (getPromise())(function(resolve) {
                                                resolve(xhr.responseText);
                                            });
                                        },
                                        json: function() {
                                            return new (getPromise())(function(resolve, reject) {
                                                try {
                                                    resolve(JSON.parse(xhr.responseText));
                                                } catch (error) {
                                                    reject(error);
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    reject(new Error('HTTP ' + xhr.status));
                                }
                            }
                        };
                        
                        xhr.onerror = function() {
                            reject(new Error('Network error'));
                        };
                        
                        xhr.send(options.body || null);
                    });
                };
            }
        }
        
        // 🔧 辅助函数
        function createMemoryStorage() {
            var storage = {};
            
            return {
                setItem: function(key, value) {
                    storage[key] = String(value);
                },
                getItem: function(key) {
                    return storage[key] || null;
                },
                removeItem: function(key) {
                    delete storage[key];
                },
                clear: function() {
                    storage = {};
                },
                key: function(index) {
                    var keys = Object.keys(storage);
                    return keys[index] || null;
                },
                get length() {
                    return Object.keys(storage).length;
                }
            };
        }
        
        // 🎯 公开API
        function getMap() {
            return features.map ? Map : polyfills.Map;
        }
        
        function getSet() {
            return features.set ? Set : polyfills.Set;
        }
        
        function getPromise() {
            return features.promise ? Promise : polyfills.Promise;
        }
        
        function getRequestAnimationFrame() {
            return features.requestAnimationFrame ? 
                   requestAnimationFrame : polyfills.requestAnimationFrame;
        }
        
        function getCancelAnimationFrame() {
            return features.requestAnimationFrame ? 
                   cancelAnimationFrame : polyfills.cancelAnimationFrame;
        }
        
        function getLocalStorage() {
            return features.localStorage ? localStorage : polyfills.localStorage;
        }
        
        function getSessionStorage() {
            return features.sessionStorage ? sessionStorage : polyfills.sessionStorage;
        }
        
        function getFetch() {
            return features.fetch ? fetch : polyfills.fetch;
        }
        
        function getClassList() {
            return features.classList ? null : polyfills.classList;
        }
        
        // classList兼容操作
        function addClass(element, className) {
            if (features.classList) {
                element.classList.add(className);
            } else {
                polyfills.classList.add(element, className);
            }
        }
        
        function removeClass(element, className) {
            if (features.classList) {
                element.classList.remove(className);
            } else {
                polyfills.classList.remove(element, className);
            }
        }
        
        function hasClass(element, className) {
            if (features.classList) {
                return element.classList.contains(className);
            } else {
                return polyfills.classList.contains(element, className);
            }
        }
        
        function toggleClass(element, className) {
            if (features.classList) {
                element.classList.toggle(className);
            } else {
                polyfills.classList.toggle(element, className);
            }
        }
        
        // 触摸事件标准化
        function addTouchListener(element, callback, options) {
            options = options || {};
            
            if (features.touch) {
                var touchOptions = features.passive ? { passive: options.passive !== false } : false;
                
                if (options.longPress) {
                    addLongPressListener(element, callback, touchOptions);
                } else {
                    addTapListener(element, callback, touchOptions);
                }
            } else {
                element.addEventListener('click', callback);
            }
        }
        
        function addTapListener(element, callback, touchOptions) {
            var startY = 0;
            var startTime = 0;
            
            element.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }, touchOptions);
            
            element.addEventListener('touchend', function(e) {
                var endY = e.changedTouches[0].clientY;
                var deltaY = Math.abs(endY - startY);
                var deltaTime = Date.now() - startTime;
                
                if (deltaY < 10 && deltaTime < 500) {
                    e.preventDefault();
                    callback(e);
                }
            }, touchOptions);
        }
        
        function addLongPressListener(element, callback, touchOptions) {
            var longPressTimer = null;
            var startX = 0;
            var startY = 0;
            
            element.addEventListener('touchstart', function(e) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                
                longPressTimer = setTimeout(function() {
                    callback(e);
                }, 500);
            }, touchOptions);
            
            element.addEventListener('touchmove', function(e) {
                var deltaX = Math.abs(e.touches[0].clientX - startX);
                var deltaY = Math.abs(e.touches[0].clientY - startY);
                
                if (deltaX > 10 || deltaY > 10) {
                    clearTimeout(longPressTimer);
                }
            }, touchOptions);
            
            element.addEventListener('touchend', function() {
                clearTimeout(longPressTimer);
            }, touchOptions);
        }
        
        // 性能监控兼容
        function now() {
            if (features.performanceNow) {
                return performance.now();
            } else {
                return Date.now();
            }
        }
        
        function getMemoryUsage() {
            if (features.performanceMemory) {
                return performance.memory.usedJSHeapSize;
            } else {
                return 0;
            }
        }
        
        // 初始化
        function initialize() {
            if (isInitialized) return;
            
            detectFeatures();
            createPolyfills();
            isInitialized = true;
            
            // 应用全局polyfill
            if (!features.map) global.Map = polyfills.Map;
            if (!features.set) global.Set = polyfills.Set;
            if (!features.promise) global.Promise = polyfills.Promise;
            if (!features.requestAnimationFrame) {
                global.requestAnimationFrame = polyfills.requestAnimationFrame;
                global.cancelAnimationFrame = polyfills.cancelAnimationFrame;
            }
            if (!features.fetch) global.fetch = polyfills.fetch;
        }
        
        // 立即初始化
        initialize();
        
        // 返回公开API
        return {
            features: features,
            getMap: getMap,
            getSet: getSet,
            getPromise: getPromise,
            getRequestAnimationFrame: getRequestAnimationFrame,
            getCancelAnimationFrame: getCancelAnimationFrame,
            getLocalStorage: getLocalStorage,
            getSessionStorage: getSessionStorage,
            getFetch: getFetch,
            addClass: addClass,
            removeClass: removeClass,
            hasClass: hasClass,
            toggleClass: toggleClass,
            addTouchListener: addTouchListener,
            now: now,
            getMemoryUsage: getMemoryUsage,
            isInitialized: function() { return isInitialized; }
        };
    }
    
    // 创建全局实例
    var compatibilityUtils = new CompatibilityUtils();
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = compatibilityUtils;
    } else if (typeof global !== 'undefined') {
        global.CompatibilityUtils = compatibilityUtils;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.CompatibilityUtils = compatibilityUtils;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);
