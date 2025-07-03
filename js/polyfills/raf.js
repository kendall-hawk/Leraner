// js/polyfills/raf.js - iOS兼容版requestAnimationFrame Polyfill
// 🚀 动画帧API完整实现，确保iOS Safari 6+兼容性

(function(global) {
    'use strict';

    var vendors = ['webkit', 'moz', 'ms', 'o'];
    var lastTime = 0;
    var isPolyfillNeeded = false;

    // 检查原生requestAnimationFrame支持
    if (!global.requestAnimationFrame) {
        isPolyfillNeeded = true;
        
        // 尝试查找带前缀的版本
        for (var x = 0; x < vendors.length && !global.requestAnimationFrame; ++x) {
            global.requestAnimationFrame = global[vendors[x] + 'RequestAnimationFrame'];
            global.cancelAnimationFrame = global[vendors[x] + 'CancelAnimationFrame'] || 
                                          global[vendors[x] + 'CancelRequestAnimationFrame'];
        }
    }

    // 检查cancelAnimationFrame支持
    if (!global.cancelAnimationFrame) {
        for (var x = 0; x < vendors.length && !global.cancelAnimationFrame; ++x) {
            global.cancelAnimationFrame = global[vendors[x] + 'CancelAnimationFrame'] || 
                                          global[vendors[x] + 'CancelRequestAnimationFrame'];
        }
    }

    /**
     * 🎯 RequestAnimationFrame Polyfill
     * 功能：高精度动画帧调度，60fps目标帧率
     * 兼容：iOS Safari 6+, Android 4.0+
     */
    if (!global.requestAnimationFrame || isPolyfillNeeded) {
        global.requestAnimationFrame = function(callback) {
            if (typeof callback !== 'function') {
                throw new TypeError('Callback function required');
            }
            
            var currTime = Date.now();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = global.setTimeout(function() {
                callback(currTime + timeToCall);
            }, timeToCall);
            
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!global.cancelAnimationFrame) {
        global.cancelAnimationFrame = function(id) {
            global.clearTimeout(id);
        };
    }

    /**
     * 🎯 高精度时间戳Polyfill
     * 功能：performance.now()的降级实现
     */
    if (!global.performance) {
        global.performance = {};
    }

    if (!global.performance.now) {
        var performanceNowOffset = Date.now();
        
        if (global.performance.timing && global.performance.timing.navigationStart) {
            performanceNowOffset = global.performance.timing.navigationStart;
        }
        
        global.performance.now = function() {
            return Date.now() - performanceNowOffset;
        };
    }

    /**
     * 🎯 增强版动画帧调度器
     * 功能：智能帧率控制、性能监控、电池优化
     */
    function EnhancedAnimationFrame() {
        var frameCallbacks = [];
        var frameId = 0;
        var isRunning = false;
        var targetFPS = 60;
        var frameInterval = 1000 / targetFPS;
        var lastFrameTime = 0;
        var frameCount = 0;
        var fpsHistory = [];
        var isThrottled = false;
        
        // 性能监控
        var performanceMonitor = {
            frameDrops: 0,
            averageFPS: 60,
            lastFPSUpdate: Date.now()
        };
        
        // 电池状态检测
        var batteryOptimization = {
            isLowPower: false,
            reducedFPS: 30,
            checkInterval: 10000 // 10秒检查一次
        };
        
        function scheduleFrame() {
            if (!isRunning || frameCallbacks.length === 0) {
                isRunning = false;
                return;
            }
            
            global.requestAnimationFrame(function(timestamp) {
                processFrame(timestamp);
                scheduleFrame();
            });
        }
        
        function processFrame(timestamp) {
            var currentTime = timestamp || global.performance.now();
            
            // 帧率控制
            if (currentTime - lastFrameTime < frameInterval && !isThrottled) {
                return;
            }
            
            // 更新FPS统计
            updateFPSStats(currentTime);
            
            // 执行回调
            var callbacks = frameCallbacks.slice();
            frameCallbacks = [];
            
            for (var i = 0; i < callbacks.length; i++) {
                try {
                    callbacks[i].callback(currentTime);
                } catch (error) {
                    console.error('[AnimationFrame] Callback error:', error);
                }
            }
            
            lastFrameTime = currentTime;
            frameCount++;
        }
        
        function updateFPSStats(currentTime) {
            var deltaTime = currentTime - lastFrameTime;
            if (deltaTime > 0) {
                var currentFPS = 1000 / deltaTime;
                fpsHistory.push(currentFPS);
                
                if (fpsHistory.length > 60) {
                    fpsHistory.shift();
                }
                
                // 每秒更新一次平均FPS
                if (currentTime - performanceMonitor.lastFPSUpdate > 1000) {
                    performanceMonitor.averageFPS = fpsHistory.reduce(function(sum, fps) {
                        return sum + fps;
                    }, 0) / fpsHistory.length;
                    
                    performanceMonitor.lastFPSUpdate = currentTime;
                    
                    // 检测帧率下降
                    if (performanceMonitor.averageFPS < 30) {
                        performanceMonitor.frameDrops++;
                        adaptPerformance();
                    }
                }
            }
        }
        
        function adaptPerformance() {
            // 动态调整目标帧率
            if (performanceMonitor.averageFPS < 30 && targetFPS > 30) {
                targetFPS = 30;
                frameInterval = 1000 / targetFPS;
                console.warn('[AnimationFrame] Performance degraded, reducing target FPS to 30');
            } else if (performanceMonitor.averageFPS > 50 && targetFPS < 60) {
                targetFPS = 60;
                frameInterval = 1000 / targetFPS;
                console.log('[AnimationFrame] Performance improved, restoring target FPS to 60');
            }
        }
        
        function checkBatteryStatus() {
            // 检测电池状态（如果支持）
            if (navigator.getBattery) {
                navigator.getBattery().then(function(battery) {
                    if (battery.level < 0.2 || battery.charging === false) {
                        enableLowPowerMode();
                    } else if (battery.level > 0.5 && battery.charging === true) {
                        disableLowPowerMode();
                    }
                }).catch(function() {
                    // 电池API不支持，忽略
                });
            }
            
            // 检测页面可见性
            if (typeof document !== 'undefined') {
                if (document.hidden || document.webkitHidden || document.msHidden) {
                    enableLowPowerMode();
                } else {
                    disableLowPowerMode();
                }
            }
        }
        
        function enableLowPowerMode() {
            if (!batteryOptimization.isLowPower) {
                batteryOptimization.isLowPower = true;
                targetFPS = batteryOptimization.reducedFPS;
                frameInterval = 1000 / targetFPS;
                console.log('[AnimationFrame] Low power mode enabled, FPS reduced to', targetFPS);
            }
        }
        
        function disableLowPowerMode() {
            if (batteryOptimization.isLowPower) {
                batteryOptimization.isLowPower = false;
                targetFPS = 60;
                frameInterval = 1000 / targetFPS;
                console.log('[AnimationFrame] Low power mode disabled, FPS restored to', targetFPS);
            }
        }
        
        // 页面可见性变化监听
        if (typeof document !== 'undefined') {
            var visibilityChange = 'visibilitychange';
            if (typeof document.webkitHidden !== 'undefined') {
                visibilityChange = 'webkitvisibilitychange';
            } else if (typeof document.msHidden !== 'undefined') {
                visibilityChange = 'msvisibilitychange';
            }
            
            document.addEventListener(visibilityChange, function() {
                if (document.hidden || document.webkitHidden || document.msHidden) {
                    isThrottled = true;
                    enableLowPowerMode();
                } else {
                    isThrottled = false;
                    disableLowPowerMode();
                }
            });
        }
        
        // 定期检查电池状态
        setInterval(checkBatteryStatus, batteryOptimization.checkInterval);
        
        return {
            request: function(callback) {
                if (typeof callback !== 'function') {
                    throw new TypeError('Callback function required');
                }
                
                var id = ++frameId;
                frameCallbacks.push({
                    id: id,
                    callback: callback
                });
                
                if (!isRunning) {
                    isRunning = true;
                    scheduleFrame();
                }
                
                return id;
            },
            
            cancel: function(id) {
                for (var i = 0; i < frameCallbacks.length; i++) {
                    if (frameCallbacks[i].id === id) {
                        frameCallbacks.splice(i, 1);
                        break;
                    }
                }
            },
            
            setTargetFPS: function(fps) {
                if (fps > 0 && fps <= 120) {
                    targetFPS = fps;
                    frameInterval = 1000 / targetFPS;
                }
            },
            
            getStats: function() {
                return {
                    targetFPS: targetFPS,
                    averageFPS: performanceMonitor.averageFPS,
                    frameDrops: performanceMonitor.frameDrops,
                    isLowPower: batteryOptimization.isLowPower,
                    isThrottled: isThrottled
                };
            },
            
            throttle: function(enabled) {
                isThrottled = enabled;
            }
        };
    }

    /**
     * 🎯 动画帧管理器
     * 功能：统一管理所有动画帧请求，提供性能优化
     */
    function AnimationFrameManager() {
        var enhancedRAF = new EnhancedAnimationFrame();
        var animationGroups = {};
        var globalCallbacks = [];
        
        return {
            // 标准requestAnimationFrame接口
            request: function(callback, group) {
                if (group) {
                    if (!animationGroups[group]) {
                        animationGroups[group] = [];
                    }
                    var id = enhancedRAF.request(callback);
                    animationGroups[group].push(id);
                    return id;
                } else {
                    return enhancedRAF.request(callback);
                }
            },
            
            cancel: function(id) {
                enhancedRAF.cancel(id);
            },
            
            // 分组动画控制
            pauseGroup: function(group) {
                if (animationGroups[group]) {
                    animationGroups[group].forEach(function(id) {
                        enhancedRAF.cancel(id);
                    });
                    animationGroups[group] = [];
                }
            },
            
            // 全局动画控制
            pauseAll: function() {
                Object.keys(animationGroups).forEach(function(group) {
                    this.pauseGroup(group);
                }, this);
            },
            
            // 性能控制
            setTargetFPS: function(fps) {
                enhancedRAF.setTargetFPS(fps);
            },
            
            throttle: function(enabled) {
                enhancedRAF.throttle(enabled);
            },
            
            getStats: function() {
                return enhancedRAF.getStats();
            }
        };
    }

    // 创建全局动画管理器实例
    var globalAnimationManager = new AnimationFrameManager();

    // 增强原生API
    var originalRequestAnimationFrame = global.requestAnimationFrame;
    var originalCancelAnimationFrame = global.cancelAnimationFrame;

    global.requestAnimationFrame = function(callback) {
        return globalAnimationManager.request(callback);
    };

    global.cancelAnimationFrame = function(id) {
        return globalAnimationManager.cancel(id);
    };

    // 提供额外的API
    global.requestAnimationFrame.setTargetFPS = function(fps) {
        globalAnimationManager.setTargetFPS(fps);
    };

    global.requestAnimationFrame.throttle = function(enabled) {
        globalAnimationManager.throttle(enabled);
    };

    global.requestAnimationFrame.getStats = function() {
        return globalAnimationManager.getStats();
    };

    global.requestAnimationFrame.pauseGroup = function(group) {
        globalAnimationManager.pauseGroup(group);
    };

    global.requestAnimationFrame.pauseAll = function() {
        globalAnimationManager.pauseAll();
    };

    // 兼容旧版本API
    global.webkitRequestAnimationFrame = global.requestAnimationFrame;
    global.mozRequestAnimationFrame = global.requestAnimationFrame;
    global.msRequestAnimationFrame = global.requestAnimationFrame;
    global.oRequestAnimationFrame = global.requestAnimationFrame;

    global.webkitCancelAnimationFrame = global.cancelAnimationFrame;
    global.mozCancelAnimationFrame = global.cancelAnimationFrame;
    global.msCancelAnimationFrame = global.cancelAnimationFrame;
    global.oCancelAnimationFrame = global.cancelAnimationFrame;
    global.webkitCancelRequestAnimationFrame = global.cancelAnimationFrame;
    global.mozCancelRequestAnimationFrame = global.cancelAnimationFrame;
    global.msCancelRequestAnimationFrame = global.cancelAnimationFrame;
    global.oCancelRequestAnimationFrame = global.cancelAnimationFrame;

    /**
     * 🎯 动画工具函数
     * 功能：常用动画模式的封装
     */
    function createAnimationUtils() {
        return {
            // 平滑动画函数
            animate: function(options) {
                var start = options.start || 0;
                var end = options.end || 1;
                var duration = options.duration || 1000;
                var easing = options.easing || function(t) { return t; };
                var onUpdate = options.onUpdate || function() {};
                var onComplete = options.onComplete || function() {};
                
                var startTime = global.performance.now();
                var animationId;
                
                function frame(currentTime) {
                    var elapsed = currentTime - startTime;
                    var progress = Math.min(elapsed / duration, 1);
                    var easedProgress = easing(progress);
                    var value = start + (end - start) * easedProgress;
                    
                    onUpdate(value, progress);
                    
                    if (progress < 1) {
                        animationId = global.requestAnimationFrame(frame);
                    } else {
                        onComplete(end);
                    }
                }
                
                animationId = global.requestAnimationFrame(frame);
                
                return {
                    cancel: function() {
                        global.cancelAnimationFrame(animationId);
                    }
                };
            },
            
            // 缓动函数集合
            easing: {
                linear: function(t) { return t; },
                easeInQuad: function(t) { return t * t; },
                easeOutQuad: function(t) { return t * (2 - t); },
                easeInOutQuad: function(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
                easeInCubic: function(t) { return t * t * t; },
                easeOutCubic: function(t) { return (--t) * t * t + 1; },
                easeInOutCubic: function(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
                easeInSine: function(t) { return 1 - Math.cos(t * Math.PI / 2); },
                easeOutSine: function(t) { return Math.sin(t * Math.PI / 2); },
                easeInOutSine: function(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
            },
            
            // 性能监控动画
            monitorPerformance: function(callback, duration) {
                var frames = 0;
                var startTime = global.performance.now();
                var animationId;
                
                function frame(currentTime) {
                    frames++;
                    var elapsed = currentTime - startTime;
                    
                    if (elapsed >= duration) {
                        var fps = frames / (elapsed / 1000);
                        callback({ fps: fps, frames: frames, duration: elapsed });
                    } else {
                        animationId = global.requestAnimationFrame(frame);
                    }
                }
                
                animationId = global.requestAnimationFrame(frame);
                
                return {
                    cancel: function() {
                        global.cancelAnimationFrame(animationId);
                    }
                };
            }
        };
    }

    // 添加到全局命名空间
    global.AnimationUtils = createAnimationUtils();

    // 添加到EnglishSite命名空间
    if (typeof global.EnglishSite === 'undefined') {
        global.EnglishSite = {};
    }
    
    global.EnglishSite.requestAnimationFrame = global.requestAnimationFrame;
    global.EnglishSite.cancelAnimationFrame = global.cancelAnimationFrame;
    global.EnglishSite.AnimationUtils = global.AnimationUtils;
    global.EnglishSite.AnimationFrameManager = AnimationFrameManager;
    
})(typeof window !== 'undefined' ? window : this);
