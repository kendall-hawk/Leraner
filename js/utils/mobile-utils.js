// js/utils/mobile-utils.js - iOS兼容版移动端工具库
// 🚀 移动端专用工具，确保iOS Safari 12+完美体验

(function(global) {
    'use strict';

    /**
     * 🎯 MobileUtils - 移动端工具库
     * 功能：设备检测、触摸处理、手势识别、性能优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function MobileUtils() {
        var deviceInfo = {};
        var gestureHandlers = {};
        var touchCache = {};
        var isInitialized = false;
        
        // 🔍 设备检测
        function detectDevice() {
            var ua = navigator.userAgent;
            var platform = navigator.platform;
            
            deviceInfo = {
                // 基础检测
                isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
                isTablet: /iPad|Android(?!.*Mobile)/i.test(ua),
                isPhone: /iPhone|Android.*Mobile|BlackBerry|IEMobile/i.test(ua),
                
                // 系统检测
                isIOS: /iPad|iPhone|iPod/.test(ua),
                isAndroid: /Android/i.test(ua),
                isWindows: /Windows/i.test(ua),
                
                // 浏览器检测
                isSafari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
                isChrome: /Chrome/i.test(ua),
                isFirefox: /Firefox/i.test(ua),
                
                // 版本检测
                iOSVersion: getIOSVersion(ua),
                androidVersion: getAndroidVersion(ua),
                
                // 屏幕信息
                screenWidth: window.screen ? window.screen.width : window.innerWidth,
                screenHeight: window.screen ? window.screen.height : window.innerHeight,
                pixelRatio: window.devicePixelRatio || 1,
                
                // 功能检测
                hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                hasOrientationChange: 'onorientationchange' in window,
                hasDeviceMotion: 'ondevicemotion' in window,
                hasVibration: 'vibrate' in navigator,
                
                // 网络信息
                isOnline: navigator.onLine,
                connection: getConnectionInfo(),
                
                // 特殊设备
                isIPhoneX: isIPhoneXSeries(),
                hasNotch: hasNotch(),
                isStandalone: isStandaloneMode()
            };
        }
        
        function getIOSVersion(ua) {
            var match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (match) {
                return {
                    major: parseInt(match[1], 10),
                    minor: parseInt(match[2], 10),
                    patch: parseInt(match[3] || 0, 10),
                    string: match[1] + '.' + match[2] + '.' + (match[3] || '0')
                };
            }
            return null;
        }
        
        function getAndroidVersion(ua) {
            var match = ua.match(/Android (\d+)\.(\d+)\.?(\d+)?/);
            if (match) {
                return {
                    major: parseInt(match[1], 10),
                    minor: parseInt(match[2], 10),
                    patch: parseInt(match[3] || 0, 10),
                    string: match[1] + '.' + match[2] + '.' + (match[3] || '0')
                };
            }
            return null;
        }
        
        function getConnectionInfo() {
            if (navigator.connection) {
                return {
                    type: navigator.connection.effectiveType || 'unknown',
                    downlink: navigator.connection.downlink || 0,
                    rtt: navigator.connection.rtt || 0,
                    saveData: navigator.connection.saveData || false
                };
            }
            return null;
        }
        
        function isIPhoneXSeries() {
            return deviceInfo.isIOS && 
                   deviceInfo.screenHeight >= 812 && 
                   deviceInfo.screenWidth >= 375;
        }
        
        function hasNotch() {
            if (typeof CSS !== 'undefined' && CSS.supports) {
                return CSS.supports('padding: max(0px)') && 
                       CSS.supports('padding: env(safe-area-inset-top)');
            }
            return false;
        }
        
        function isStandaloneMode() {
            return window.navigator.standalone === true || 
                   window.matchMedia('(display-mode: standalone)').matches;
        }
        
        // 🎯 触摸和手势处理
        function createTouchHandler(options) {
            options = options || {};
            
            return {
                onStart: options.onStart || function() {},
                onMove: options.onMove || function() {},
                onEnd: options.onEnd || function() {},
                onCancel: options.onCancel || function() {},
                
                // 手势识别
                onTap: options.onTap || function() {},
                onDoubleTap: options.onDoubleTap || function() {},
                onLongPress: options.onLongPress || function() {},
                onSwipe: options.onSwipe || function() {},
                onPinch: options.onPinch || function() {},
                onRotate: options.onRotate || function() {},
                
                // 配置
                tapThreshold: options.tapThreshold || 10,
                longPressDelay: options.longPressDelay || 500,
                doubleTapDelay: options.doubleTapDelay || 300,
                swipeThreshold: options.swipeThreshold || 50,
                
                // 内部状态
                startTime: 0,
                startPosition: null,
                lastTapTime: 0,
                longPressTimer: null,
                isMoving: false,
                fingers: 0
            };
        }
        
        function bindTouchEvents(element, handler) {
            if (!element || !handler) return null;
            
            var touchData = {
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                startTime: 0,
                deltaX: 0,
                deltaY: 0,
                distance: 0,
                direction: null,
                isMoving: false,
                fingerCount: 0
            };
            
            var passiveSupported = checkPassiveSupport();
            var touchOptions = passiveSupported ? { passive: false } : false;
            
            function handleTouchStart(e) {
                var touch = e.touches[0];
                
                touchData.startX = touchData.currentX = touch.clientX;
                touchData.startY = touchData.currentY = touch.clientY;
                touchData.startTime = Date.now();
                touchData.fingerCount = e.touches.length;
                touchData.isMoving = false;
                
                // 长按定时器
                if (handler.onLongPress) {
                    handler.longPressTimer = setTimeout(function() {
                        if (!touchData.isMoving) {
                            handler.onLongPress({
                                x: touchData.currentX,
                                y: touchData.currentY,
                                originalEvent: e
                            });
                        }
                    }, handler.longPressDelay);
                }
                
                handler.onStart({
                    x: touchData.startX,
                    y: touchData.startY,
                    fingerCount: touchData.fingerCount,
                    originalEvent: e,
                    touchData: touchData
                });
            }
            
            function handleTouchMove(e) {
                var touch = e.touches[0];
                
                touchData.currentX = touch.clientX;
                touchData.currentY = touch.clientY;
                touchData.deltaX = touchData.currentX - touchData.startX;
                touchData.deltaY = touchData.currentY - touchData.startY;
                touchData.distance = Math.sqrt(
                    touchData.deltaX * touchData.deltaX + 
                    touchData.deltaY * touchData.deltaY
                );
                
                if (touchData.distance > handler.tapThreshold) {
                    touchData.isMoving = true;
                    
                    // 清除长按定时器
                    if (handler.longPressTimer) {
                        clearTimeout(handler.longPressTimer);
                        handler.longPressTimer = null;
                    }
                    
                    // 计算方向
                    if (Math.abs(touchData.deltaX) > Math.abs(touchData.deltaY)) {
                        touchData.direction = touchData.deltaX > 0 ? 'right' : 'left';
                    } else {
                        touchData.direction = touchData.deltaY > 0 ? 'down' : 'up';
                    }
                }
                
                handler.onMove({
                    x: touchData.currentX,
                    y: touchData.currentY,
                    deltaX: touchData.deltaX,
                    deltaY: touchData.deltaY,
                    distance: touchData.distance,
                    direction: touchData.direction,
                    fingerCount: e.touches.length,
                    originalEvent: e,
                    touchData: touchData
                });
                
                // 防止默认滚动行为（可选）
                if (handler.preventDefault !== false) {
                    e.preventDefault();
                }
            }
            
            function handleTouchEnd(e) {
                var endTime = Date.now();
                var duration = endTime - touchData.startTime;
                
                // 清除长按定时器
                if (handler.longPressTimer) {
                    clearTimeout(handler.longPressTimer);
                    handler.longPressTimer = null;
                }
                
                // 判断手势类型
                if (!touchData.isMoving && duration < 500) {
                    // 点击手势
                    var now = Date.now();
                    if (now - handler.lastTapTime < handler.doubleTapDelay) {
                        // 双击
                        handler.onDoubleTap && handler.onDoubleTap({
                            x: touchData.currentX,
                            y: touchData.currentY,
                            originalEvent: e
                        });
                    } else {
                        // 单击
                        handler.onTap && handler.onTap({
                            x: touchData.currentX,
                            y: touchData.currentY,
                            originalEvent: e
                        });
                    }
                    handler.lastTapTime = now;
                } else if (touchData.isMoving && touchData.distance > handler.swipeThreshold) {
                    // 滑动手势
                    var velocity = touchData.distance / duration;
                    handler.onSwipe && handler.onSwipe({
                        direction: touchData.direction,
                        distance: touchData.distance,
                        velocity: velocity,
                        deltaX: touchData.deltaX,
                        deltaY: touchData.deltaY,
                        originalEvent: e
                    });
                }
                
                handler.onEnd({
                    x: touchData.currentX,
                    y: touchData.currentY,
                    deltaX: touchData.deltaX,
                    deltaY: touchData.deltaY,
                    distance: touchData.distance,
                    direction: touchData.direction,
                    duration: duration,
                    originalEvent: e,
                    touchData: touchData
                });
                
                // 重置状态
                touchData.isMoving = false;
                touchData.fingerCount = 0;
            }
            
            function handleTouchCancel(e) {
                // 清除长按定时器
                if (handler.longPressTimer) {
                    clearTimeout(handler.longPressTimer);
                    handler.longPressTimer = null;
                }
                
                handler.onCancel && handler.onCancel({
                    originalEvent: e,
                    touchData: touchData
                });
                
                // 重置状态
                touchData.isMoving = false;
                touchData.fingerCount = 0;
            }
            
            // 绑定事件
            element.addEventListener('touchstart', handleTouchStart, touchOptions);
            element.addEventListener('touchmove', handleTouchMove, touchOptions);
            element.addEventListener('touchend', handleTouchEnd, touchOptions);
            element.addEventListener('touchcancel', handleTouchCancel, touchOptions);
            
            // 返回解绑函数
            return function unbind() {
                element.removeEventListener('touchstart', handleTouchStart);
                element.removeEventListener('touchmove', handleTouchMove);
                element.removeEventListener('touchend', handleTouchEnd);
                element.removeEventListener('touchcancel', handleTouchCancel);
                
                if (handler.longPressTimer) {
                    clearTimeout(handler.longPressTimer);
                }
            };
        }
        
        // 🎯 特殊手势处理
        function addSwipeGesture(element, options) {
            options = options || {};
            
            var swipeHandler = createTouchHandler({
                swipeThreshold: options.threshold || 50,
                onSwipe: function(data) {
                    if (options.onSwipe) {
                        options.onSwipe(data);
                    }
                    
                    // 方向特定的回调
                    var directionCallback = options['onSwipe' + capitalize(data.direction)];
                    if (directionCallback) {
                        directionCallback(data);
                    }
                }
            });
            
            return bindTouchEvents(element, swipeHandler);
        }
        
        function addLongPressGesture(element, callback, delay) {
            delay = delay || 500;
            
            var longPressHandler = createTouchHandler({
                longPressDelay: delay,
                onLongPress: callback
            });
            
            return bindTouchEvents(element, longPressHandler);
        }
        
        function addTapGesture(element, options) {
            options = options || {};
            
            var tapHandler = createTouchHandler({
                onTap: options.onTap,
                onDoubleTap: options.onDoubleTap,
                doubleTapDelay: options.doubleTapDelay || 300
            });
            
            return bindTouchEvents(element, tapHandler);
        }
        
        // 🎯 屏幕和方向
        function getViewportSize() {
            return {
                width: window.innerWidth || document.documentElement.clientWidth,
                height: window.innerHeight || document.documentElement.clientHeight
            };
        }
        
        function getOrientation() {
            if (window.orientation !== undefined) {
                return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
            } else {
                var viewport = getViewportSize();
                return viewport.width > viewport.height ? 'landscape' : 'portrait';
            }
        }
        
        function onOrientationChange(callback) {
            if (!callback) return null;
            
            var handler = function() {
                // 延迟执行，等待视口尺寸更新
                setTimeout(function() {
                    callback({
                        orientation: getOrientation(),
                        viewport: getViewportSize(),
                        angle: window.orientation || 0
                    });
                }, 100);
            };
            
            if ('onorientationchange' in window) {
                window.addEventListener('orientationchange', handler);
                return function() {
                    window.removeEventListener('orientationchange', handler);
                };
            } else {
                // 降级到resize事件
                var lastOrientation = getOrientation();
                var resizeHandler = function() {
                    var currentOrientation = getOrientation();
                    if (currentOrientation !== lastOrientation) {
                        lastOrientation = currentOrientation;
                        handler();
                    }
                };
                
                window.addEventListener('resize', resizeHandler);
                return function() {
                    window.removeEventListener('resize', resizeHandler);
                };
            }
        }
        
        // 🎯 iOS特殊处理
        function fixIOSViewport() {
            if (!deviceInfo.isIOS) return;
            
            // 修复iOS Safari中100vh的问题
            function setViewportHeight() {
                var vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
            }
            
            setViewportHeight();
            window.addEventListener('resize', setViewportHeight);
            
            // 修复iOS Safari中滚动问题
            document.addEventListener('touchstart', function() {}, { passive: true });
            
            // 防止iOS Safari双击缩放
            var lastTouchEnd = 0;
            document.addEventListener('touchend', function(event) {
                var now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }
        
        function enableIOSMomentumScrolling(element) {
            if (element && deviceInfo.isIOS) {
                element.style.webkitOverflowScrolling = 'touch';
            }
        }
        
        function fixIOSInputZoom() {
            if (!deviceInfo.isIOS) return;
            
            // 防止iOS输入框自动缩放
            var inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
            for (var i = 0; i < inputs.length; i++) {
                var input = inputs[i];
                if (parseInt(getComputedStyle(input).fontSize, 10) < 16) {
                    input.style.fontSize = '16px';
                }
            }
        }
        
        // 🎯 性能优化
        function optimizeForMobile() {
            if (!deviceInfo.isMobile) return;
            
            // 禁用不必要的动画
            if (deviceInfo.connection && deviceInfo.connection.saveData) {
                document.documentElement.classList.add('reduce-animations');
            }
            
            // 低端设备优化
            if (deviceInfo.pixelRatio < 2) {
                document.documentElement.classList.add('low-dpi');
            }
            
            // 慢速网络优化
            if (deviceInfo.connection && deviceInfo.connection.type === 'slow-2g') {
                document.documentElement.classList.add('slow-connection');
            }
        }
        
        function throttleScrollEvents() {
            var ticking = false;
            
            function updateScrollPosition() {
                // 在这里处理滚动相关的DOM操作
                ticking = false;
            }
            
            function onScroll() {
                if (!ticking) {
                    if (window.requestAnimationFrame) {
                        window.requestAnimationFrame(updateScrollPosition);
                    } else {
                        setTimeout(updateScrollPosition, 16);
                    }
                    ticking = true;
                }
            }
            
            return onScroll;
        }
        
        // 🎯 网络状态监听
        function onNetworkChange(callback) {
            if (!callback) return null;
            
            var handlers = [];
            
            function networkHandler() {
                callback({
                    isOnline: navigator.onLine,
                    connection: getConnectionInfo()
                });
            }
            
            window.addEventListener('online', networkHandler);
            window.addEventListener('offline', networkHandler);
            handlers.push(['online', networkHandler]);
            handlers.push(['offline', networkHandler]);
            
            // 监听连接类型变化
            if (navigator.connection) {
                navigator.connection.addEventListener('change', networkHandler);
                handlers.push(['change', networkHandler, navigator.connection]);
            }
            
            return function() {
                handlers.forEach(function(handler) {
                    var target = handler[2] || window;
                    target.removeEventListener(handler[0], handler[1]);
                });
            };
        }
        
        // 🎯 振动反馈
        function vibrate(pattern) {
            if (navigator.vibrate && deviceInfo.hasVibration) {
                navigator.vibrate(pattern);
                return true;
            }
            return false;
        }
        
        function hapticFeedback(type) {
            type = type || 'light';
            
            // iOS触觉反馈
            if (deviceInfo.isIOS && window.navigator.vibrate) {
                var patterns = {
                    light: 10,
                    medium: 20,
                    heavy: 30,
                    success: [10, 50, 10],
                    warning: [10, 100, 10, 100, 10],
                    error: [10, 100, 10, 100, 10, 100, 10]
                };
                
                return vibrate(patterns[type] || patterns.light);
            }
            
            return false;
        }
        
        // 🎯 工具函数
        function checkPassiveSupport() {
            var passiveSupported = false;
            try {
                var options = Object.defineProperty({}, 'passive', {
                    get: function() { passiveSupported = true; }
                });
                window.addEventListener('test', null, options);
            } catch (err) {}
            return passiveSupported;
        }
        
        function capitalize(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
        
        function debounce(func, wait) {
            var timeout;
            return function() {
                var context = this;
                var args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(function() {
                    func.apply(context, args);
                }, wait);
            };
        }
        
        function throttle(func, limit) {
            var inThrottle;
            return function() {
                var args = arguments;
                var context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(function() { inThrottle = false; }, limit);
                }
            };
        }
        
        // 🎯 初始化
        function initialize() {
            if (isInitialized) return;
            
            detectDevice();
            fixIOSViewport();
            fixIOSInputZoom();
            optimizeForMobile();
            
            isInitialized = true;
        }
        
        // 立即初始化
        initialize();
        
        // 返回公开API
        return {
            // 设备信息
            device: deviceInfo,
            
            // 触摸和手势
            createTouchHandler: createTouchHandler,
            bindTouchEvents: bindTouchEvents,
            addSwipeGesture: addSwipeGesture,
            addLongPressGesture: addLongPressGesture,
            addTapGesture: addTapGesture,
            
            // 屏幕和方向
            getViewportSize: getViewportSize,
            getOrientation: getOrientation,
            onOrientationChange: onOrientationChange,
            
            // iOS特殊处理
            fixIOSViewport: fixIOSViewport,
            enableIOSMomentumScrolling: enableIOSMomentumScrolling,
            fixIOSInputZoom: fixIOSInputZoom,
            
            // 性能优化
            optimizeForMobile: optimizeForMobile,
            throttleScrollEvents: throttleScrollEvents,
            
            // 网络状态
            onNetworkChange: onNetworkChange,
            
            // 振动反馈
            vibrate: vibrate,
            hapticFeedback: hapticFeedback,
            
            // 工具函数
            debounce: debounce,
            throttle: throttle,
            
            // 状态
            isInitialized: function() { return isInitialized; }
        };
    }
    
    // 创建全局实例
    var mobileUtils = new MobileUtils();
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mobileUtils;
    } else if (typeof global !== 'undefined') {
        global.MobileUtils = mobileUtils;
        
        // 添加到EnglishSite命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.MobileUtils = mobileUtils;
    }
    
})(typeof window !== 'undefined' ? window : this);