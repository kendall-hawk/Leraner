// js/utils/performance.js - iOS兼容版性能工具库
// 🚀 性能监控和优化工具，确保iOS Safari 12+最佳性能

(function(global) {
    'use strict';

    /**
     * 🎯 PerformanceUtils - 性能工具库
     * 功能：性能监控、资源优化、内存管理、帧率监控
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function PerformanceUtils() {
        var isInitialized = false;
        var metrics = {};
        var observers = {};
        var timers = {};
        var frameData = {
            lastTime: 0,
            frames: [],
            fps: 0
        };
        
        // 🔍 性能指标收集
        function collectMetrics() {
            var now = getNow();
            
            metrics = {
                // 时间戳
                timestamp: now,
                
                // 页面加载性能
                navigation: getNavigationTiming(),
                
                // 内存使用
                memory: getMemoryInfo(),
                
                // 网络信息
                connection: getConnectionInfo(),
                
                // 渲染性能
                rendering: getRenderingMetrics(),
                
                // 用户体验指标
                vitals: getWebVitals(),
                
                // 设备信息
                device: getDeviceInfo()
            };
            
            return metrics;
        }
        
        function getNavigationTiming() {
            if (!performance || !performance.timing) {
                return null;
            }
            
            var timing = performance.timing;
            var navigationStart = timing.navigationStart;
            
            return {
                // 关键时间点
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                tcp: timing.connectEnd - timing.connectStart,
                ssl: timing.secureConnectionStart > 0 ? 
                     timing.connectEnd - timing.secureConnectionStart : 0,
                ttfb: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                
                // 页面加载阶段
                domLoading: timing.domLoading - navigationStart,
                domInteractive: timing.domInteractive - navigationStart,
                domComplete: timing.domComplete - navigationStart,
                loadComplete: timing.loadEventEnd - navigationStart,
                
                // 总体性能
                pageLoadTime: timing.loadEventEnd - navigationStart,
                domReadyTime: timing.domContentLoadedEventEnd - navigationStart,
                firstPaint: getFirstPaint(),
                firstContentfulPaint: getFirstContentfulPaint()
            };
        }
        
        function getFirstPaint() {
            if (performance.getEntriesByType) {
                var paints = performance.getEntriesByType('paint');
                var fp = paints.find(function(entry) {
                    return entry.name === 'first-paint';
                });
                return fp ? fp.startTime : null;
            }
            return null;
        }
        
        function getFirstContentfulPaint() {
            if (performance.getEntriesByType) {
                var paints = performance.getEntriesByType('paint');
                var fcp = paints.find(function(entry) {
                    return entry.name === 'first-contentful-paint';
                });
                return fcp ? fcp.startTime : null;
            }
            return null;
        }
        
        function getMemoryInfo() {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                    usageRatio: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        }
        
        function getConnectionInfo() {
            if (navigator.connection) {
                return {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt,
                    saveData: navigator.connection.saveData
                };
            }
            return null;
        }
        
        function getRenderingMetrics() {
            return {
                fps: frameData.fps,
                averageFrameTime: calculateAverageFrameTime(),
                longestFrame: getLongestFrame(),
                droppedFrames: getDroppedFrames()
            };
        }
        
        function getWebVitals() {
            return {
                cls: getCLS(),
                fid: getFID(),
                lcp: getLCP(),
                inp: getINP()
            };
        }
        
        function getDeviceInfo() {
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                deviceMemory: navigator.deviceMemory || 'unknown',
                pixelRatio: window.devicePixelRatio || 1,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };
        }
        
        // 🎯 帧率监控
        function startFrameRateMonitoring() {
            var frameCount = 0;
            var lastTime = getNow();
            
            function measureFrame() {
                var currentTime = getNow();
                var deltaTime = currentTime - frameData.lastTime;
                
                if (deltaTime > 0) {
                    frameData.frames.push(deltaTime);
                    
                    // 保持最近100帧的数据
                    if (frameData.frames.length > 100) {
                        frameData.frames.shift();
                    }
                    
                    // 计算FPS（每秒更新一次）
                    frameCount++;
                    if (currentTime - lastTime >= 1000) {
                        frameData.fps = frameCount;
                        frameCount = 0;
                        lastTime = currentTime;
                    }
                }
                
                frameData.lastTime = currentTime;
                
                if (window.requestAnimationFrame) {
                    requestAnimationFrame(measureFrame);
                } else {
                    setTimeout(measureFrame, 16);
                }
            }
            
            measureFrame();
        }
        
        function calculateAverageFrameTime() {
            if (frameData.frames.length === 0) return 0;
            
            var total = frameData.frames.reduce(function(sum, time) {
                return sum + time;
            }, 0);
            
            return total / frameData.frames.length;
        }
        
        function getLongestFrame() {
            if (frameData.frames.length === 0) return 0;
            
            return Math.max.apply(Math, frameData.frames);
        }
        
        function getDroppedFrames() {
            if (frameData.frames.length === 0) return 0;
            
            var droppedCount = 0;
            var targetFrameTime = 16.67; // 60fps
            
            frameData.frames.forEach(function(frameTime) {
                if (frameTime > targetFrameTime * 2) {
                    droppedCount++;
                }
            });
            
            return droppedCount;
        }
        
        // 🎯 Core Web Vitals
        function getCLS() {
            if (typeof PerformanceObserver !== 'undefined') {
                var clsValue = 0;
                
                try {
                    var observer = new PerformanceObserver(function(list) {
                        list.getEntries().forEach(function(entry) {
                            if (!entry.hadRecentInput) {
                                clsValue += entry.value;
                            }
                        });
                    });
                    
                    observer.observe({ entryTypes: ['layout-shift'] });
                } catch (e) {
                    // 不支持layout-shift
                }
                
                return clsValue;
            }
            return null;
        }
        
        function getFID() {
            if (typeof PerformanceObserver !== 'undefined') {
                var fidValue = null;
                
                try {
                    var observer = new PerformanceObserver(function(list) {
                        list.getEntries().forEach(function(entry) {
                            if (entry.name === 'first-input' && !fidValue) {
                                fidValue = entry.processingStart - entry.startTime;
                            }
                        });
                    });
                    
                    observer.observe({ entryTypes: ['first-input'] });
                } catch (e) {
                    // 不支持first-input
                }
                
                return fidValue;
            }
            return null;
        }
        
        function getLCP() {
            if (typeof PerformanceObserver !== 'undefined') {
                var lcpValue = null;
                
                try {
                    var observer = new PerformanceObserver(function(list) {
                        list.getEntries().forEach(function(entry) {
                            lcpValue = entry.startTime;
                        });
                    });
                    
                    observer.observe({ entryTypes: ['largest-contentful-paint'] });
                } catch (e) {
                    // 不支持largest-contentful-paint
                }
                
                return lcpValue;
            }
            return null;
        }
        
        function getINP() {
            // Interaction to Next Paint (实验性指标)
            if (typeof PerformanceObserver !== 'undefined') {
                var interactions = [];
                
                try {
                    var observer = new PerformanceObserver(function(list) {
                        list.getEntries().forEach(function(entry) {
                            interactions.push(entry.processingStart - entry.startTime);
                        });
                    });
                    
                    observer.observe({ entryTypes: ['event'] });
                } catch (e) {
                    // 不支持event timing
                }
                
                if (interactions.length > 0) {
                    // 返回95百分位数
                    interactions.sort(function(a, b) { return a - b; });
                    var index = Math.floor(interactions.length * 0.95);
                    return interactions[index];
                }
            }
            return null;
        }
        
        // 🎯 资源监控
        function monitorResources() {
            if (!performance.getEntriesByType) return null;
            
            var resources = performance.getEntriesByType('resource');
            var analysis = {
                total: resources.length,
                types: {},
                sizes: {
                    total: 0,
                    compressed: 0,
                    uncompressed: 0
                },
                timing: {
                    slowest: 0,
                    fastest: Infinity,
                    average: 0
                },
                domains: {},
                failed: []
            };
            
            var totalDuration = 0;
            
            resources.forEach(function(resource) {
                var type = getResourceType(resource.name);
                var duration = resource.responseEnd - resource.startTime;
                
                // 类型统计
                analysis.types[type] = (analysis.types[type] || 0) + 1;
                
                // 大小统计
                if (resource.transferSize) {
                    analysis.sizes.total += resource.transferSize;
                    analysis.sizes.compressed += resource.transferSize;
                }
                if (resource.decodedBodySize) {
                    analysis.sizes.uncompressed += resource.decodedBodySize;
                }
                
                // 时间统计
                if (duration > analysis.timing.slowest) {
                    analysis.timing.slowest = duration;
                }
                if (duration < analysis.timing.fastest) {
                    analysis.timing.fastest = duration;
                }
                totalDuration += duration;
                
                // 域名统计
                var domain = extractDomain(resource.name);
                analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
                
                // 失败资源
                if (resource.transferSize === 0 && duration > 0) {
                    analysis.failed.push(resource.name);
                }
            });
            
            analysis.timing.average = totalDuration / resources.length;
            
            return analysis;
        }
        
        function getResourceType(url) {
            var extension = url.split('.').pop().split('?')[0].toLowerCase();
            
            var types = {
                js: ['js'],
                css: ['css'],
                image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
                font: ['woff', 'woff2', 'ttf', 'otf', 'eot'],
                video: ['mp4', 'webm', 'ogg'],
                audio: ['mp3', 'wav', 'ogg']
            };
            
            for (var type in types) {
                if (types[type].indexOf(extension) !== -1) {
                    return type;
                }
            }
            
            return 'other';
        }
        
        function extractDomain(url) {
            try {
                return new URL(url).hostname;
            } catch (e) {
                return 'unknown';
            }
        }
        
        // 🎯 内存监控
        function startMemoryMonitoring(interval) {
            interval = interval || 5000;
            
            var memoryData = [];
            
            function checkMemory() {
                var memInfo = getMemoryInfo();
                if (memInfo) {
                    memoryData.push({
                        timestamp: getNow(),
                        used: memInfo.used,
                        total: memInfo.total,
                        ratio: memInfo.usageRatio
                    });
                    
                    // 保持最近100个数据点
                    if (memoryData.length > 100) {
                        memoryData.shift();
                    }
                    
                    // 检查内存泄漏
                    var trend = analyzeMemoryTrend(memoryData);
                    if (trend.isIncreasing && trend.rate > 0.1) {
                        console.warn('[Performance] Possible memory leak detected');
                        triggerEvent('memoryLeak', trend);
                    }
                    
                    // 检查内存压力
                    if (memInfo.usageRatio > 0.9) {
                        console.warn('[Performance] High memory usage detected');
                        triggerEvent('highMemoryUsage', memInfo);
                    }
                }
            }
            
            var timer = setInterval(checkMemory, interval);
            
            return {
                stop: function() {
                    clearInterval(timer);
                },
                getData: function() {
                    return memoryData.slice();
                }
            };
        }
        
        function analyzeMemoryTrend(data) {
            if (data.length < 10) {
                return { isIncreasing: false, rate: 0 };
            }
            
            var recent = data.slice(-10);
            var older = data.slice(-20, -10);
            
            var recentAvg = recent.reduce(function(sum, item) {
                return sum + item.ratio;
            }, 0) / recent.length;
            
            var olderAvg = older.reduce(function(sum, item) {
                return sum + item.ratio;
            }, 0) / older.length;
            
            var rate = (recentAvg - olderAvg) / olderAvg;
            
            return {
                isIncreasing: rate > 0,
                rate: Math.abs(rate)
            };
        }
        
        // 🎯 性能优化建议
        function analyzePerformance() {
            var suggestions = [];
            var metrics = collectMetrics();
            
            // 页面加载性能建议
            if (metrics.navigation) {
                if (metrics.navigation.pageLoadTime > 3000) {
                    suggestions.push({
                        type: 'loading',
                        severity: 'high',
                        message: '页面加载时间过长 (' + metrics.navigation.pageLoadTime + 'ms)',
                        recommendations: [
                            '优化关键资源加载',
                            '启用资源压缩',
                            '使用CDN加速',
                            '减少HTTP请求数量'
                        ]
                    });
                }
                
                if (metrics.navigation.ttfb > 800) {
                    suggestions.push({
                        type: 'network',
                        severity: 'medium',
                        message: 'Time to First Byte过长 (' + metrics.navigation.ttfb + 'ms)',
                        recommendations: [
                            '优化服务器响应时间',
                            '使用服务器端缓存',
                            '优化数据库查询'
                        ]
                    });
                }
            }
            
            // 内存使用建议
            if (metrics.memory && metrics.memory.usageRatio > 0.8) {
                suggestions.push({
                    type: 'memory',
                    severity: 'high',
                    message: '内存使用率过高 (' + (metrics.memory.usageRatio * 100).toFixed(1) + '%)',
                    recommendations: [
                        '检查内存泄漏',
                        '及时清理不用的对象',
                        '优化DOM节点数量',
                        '使用懒加载减少内存占用'
                    ]
                });
            }
            
            // 渲染性能建议
            if (metrics.rendering.fps < 30) {
                suggestions.push({
                    type: 'rendering',
                    severity: 'medium',
                    message: '帧率过低 (' + metrics.rendering.fps + 'fps)',
                    recommendations: [
                        '减少DOM操作频率',
                        '使用CSS动画代替JavaScript动画',
                        '避免强制同步布局',
                        '优化重绘和重排'
                    ]
                });
            }
            
            // 网络连接建议
            if (metrics.connection && metrics.connection.effectiveType === 'slow-2g') {
                suggestions.push({
                    type: 'network',
                    severity: 'high',
                    message: '网络连接较慢',
                    recommendations: [
                        '启用数据节省模式',
                        '优化图片大小和格式',
                        '减少非关键资源加载',
                        '使用离线缓存'
                    ]
                });
            }
            
            return suggestions;
        }
        
        // 🎯 性能预算
        function createPerformanceBudget(budget) {
            var warnings = [];
            var metrics = collectMetrics();
            
            // 检查各项指标是否超出预算
            for (var metric in budget) {
                if (metrics[metric] && metrics[metric] > budget[metric]) {
                    warnings.push({
                        metric: metric,
                        actual: metrics[metric],
                        budget: budget[metric],
                        overage: metrics[metric] - budget[metric]
                    });
                }
            }
            
            return {
                passed: warnings.length === 0,
                warnings: warnings,
                score: calculateBudgetScore(metrics, budget)
            };
        }
        
        function calculateBudgetScore(metrics, budget) {
            var scores = [];
            
            for (var metric in budget) {
                if (metrics[metric]) {
                    var score = Math.max(0, 100 - (metrics[metric] / budget[metric] * 100));
                    scores.push(score);
                }
            }
            
            return scores.length > 0 ? 
                   scores.reduce(function(a, b) { return a + b; }) / scores.length : 0;
        }
        
        // 🎯 工具函数
        function getNow() {
            if (performance && performance.now) {
                return performance.now();
            } else {
                return Date.now();
            }
        }
        
        function createTimer(name) {
            var startTime = getNow();
            
            return {
                end: function() {
                    var duration = getNow() - startTime;
                    console.log('[Performance] ' + name + ': ' + duration.toFixed(2) + 'ms');
                    return duration;
                },
                lap: function(label) {
                    var duration = getNow() - startTime;
                    console.log('[Performance] ' + name + ' (' + label + '): ' + duration.toFixed(2) + 'ms');
                    return duration;
                }
            };
        }
        
        function measureFunction(fn, name) {
            return function() {
                var timer = createTimer(name || fn.name || 'anonymous');
                var result = fn.apply(this, arguments);
                timer.end();
                return result;
            };
        }
        
        function measureAsyncFunction(fn, name) {
            return function() {
                var timer = createTimer(name || fn.name || 'async');
                var result = fn.apply(this, arguments);
                
                if (result && typeof result.then === 'function') {
                    return result.then(function(value) {
                        timer.end();
                        return value;
                    });
                } else {
                    timer.end();
                    return result;
                }
            };
        }
        
        function triggerEvent(type, data) {
            if (observers[type]) {
                observers[type].forEach(function(callback) {
                    try {
                        callback(data);
                    } catch (e) {
                        console.error('[Performance] Event handler error:', e);
                    }
                });
            }
        }
        
        function addEventListener(type, callback) {
            if (!observers[type]) {
                observers[type] = [];
            }
            observers[type].push(callback);
            
            return function removeEventListener() {
                var index = observers[type].indexOf(callback);
                if (index > -1) {
                    observers[type].splice(index, 1);
                }
            };
        }
        
        // 🎯 初始化
        function initialize() {
            if (isInitialized) return;
            
            // 开始帧率监控
            startFrameRateMonitoring();
            
            // 开始内存监控
            if (typeof window !== 'undefined') {
                startMemoryMonitoring();
            }
            
            isInitialized = true;
        }
        
        // 返回公开API
        return {
            // 指标收集
            collectMetrics: collectMetrics,
            getNavigationTiming: getNavigationTiming,
            getMemoryInfo: getMemoryInfo,
            
            // 监控
            startFrameRateMonitoring: startFrameRateMonitoring,
            startMemoryMonitoring: startMemoryMonitoring,
            monitorResources: monitorResources,
            
            // 分析
            analyzePerformance: analyzePerformance,
            createPerformanceBudget: createPerformanceBudget,
            
            // 工具
            createTimer: createTimer,
            measureFunction: measureFunction,
            measureAsyncFunction: measureAsyncFunction,
            getNow: getNow,
            
            // 事件
            addEventListener: addEventListener,
            
            // 初始化
            initialize: initialize,
            isInitialized: function() { return isInitialized; }
        };
    }
    
    // 创建全局实例
    var performanceUtils = new PerformanceUtils();
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = performanceUtils;
    } else if (typeof global !== 'undefined') {
        global.PerformanceUtils = performanceUtils;
        
        // 添加到EnglishSite命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.PerformanceUtils = performanceUtils;
    }
    
})(typeof window !== 'undefined' ? window : this);