// js/modules/navigation-core.js - iOS兼容版导航核心
// 🚀 响应式导航系统，确保iOS Safari 12+兼容性

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
    function safeJSONParse(str, fallback) {
        if (!str || typeof str !== 'string') {
            return fallback || {};
        }
        try {
            var result = JSON.parse(str);
            return result !== null ? result : (fallback || {});
        } catch (error) {
            DEBUG_WARN('[NavigationCore] JSON解析失败:', error.message);
            return fallback || {};
        }
    }

    function safeJSONStringify(obj, fallback) {
        if (obj === null || obj === undefined) {
            return fallback || '{}';
        }
        try {
            return JSON.stringify(obj);
        } catch (error) {
            DEBUG_WARN('[NavigationCore] JSON序列化失败:', error.message);
            return fallback || '{}';
        }
    }

    function createSafeTimeout(callback, delay, context) {
        var timeoutId;
        var executed = false;
        
        var safeCallback = function() {
            if (executed) return;
            executed = true;
            
            try {
                if (typeof callback === 'function') {
                    callback.call(context);
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 定时器回调错误:', error);
            }
        };
        
        timeoutId = setTimeout(safeCallback, delay);
        
        return {
            clear: function() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    executed = true;
                }
            },
            execute: safeCallback
        };
    }

    /**
     * 🎯 NavigationCore - 导航核心
     * 功能：响应式侧边栏、多层级导航、位置对齐子菜单、触摸优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function NavigationCore(container, options) {
        options = options || {};
        
        // 配置参数
        var config = {
            breakpoint: Math.max(480, Math.min(1200, options.breakpoint || 768)),
            animationDuration: Math.max(100, Math.min(1000, options.animationDuration || 300)),
            touchThreshold: Math.max(20, Math.min(100, options.touchThreshold || 50)),
            autoCollapse: options.autoCollapse !== false,
            enableBreadcrumb: options.enableBreadcrumb !== false,
            enableSearch: options.enableSearch !== false,
            maxDepth: Math.max(2, Math.min(10, options.maxDepth || 5)),
            cacheKey: 'navigation_data'
        };
        
        // 私有变量
        var navigationData = [];
        var navigationMap = {};
        var currentPath = [];
        var isOpen = false;
        var isMobile = false;
        var isAnimating = false;
        var touchStartX = 0;
        var touchStartY = 0;
        var searchResults = [];
        var searchTimeout = null;
        var isDestroyed = false;
        
        // DOM元素引用
        var elements = {
            container: null,
            sidebar: null,
            overlay: null,
            toggle: null,
            content: null,
            breadcrumb: null,
            search: null
        };
        
        // 🔧 事件监听器管理
        var boundEventHandlers = {};
        var resizeHandler = null;
        
        // 依赖注入
        var stateManager = null;
        var eventHub = null;
        var cacheManager = null;
        var errorBoundary = null;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[NavigationCore] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                // 注入依赖
                injectDependencies();
                
                // 验证容器
                if (!container) {
                    throw new Error('Navigation container is required');
                }
                
                elements.container = typeof container === 'string' ? 
                    document.getElementById(container) : container;
                
                if (!elements.container) {
                    throw new Error('Navigation container not found');
                }
                
                // 检测移动端
                detectMobile();
                
                // 构建DOM结构
                buildNavigationStructure();
                
                // 绑定事件
                bindEvents();
                
                // 加载导航数据
                loadNavigationData();
                
                // 恢复状态
                restoreNavigationState();
                
                DEBUG_LOG('[NavigationCore] 初始化成功');
                
                // 触发初始化完成事件
                if (eventHub) {
                    eventHub.emit('navigation:initialized', {
                        isMobile: isMobile,
                        config: config
                    });
                }
                
            } catch (error) {
                handleError('initialize', error);
            }
        }
        
        // 🔑 公开API
        
        /**
         * 加载导航数据
         * @param {Array|string} data - 导航数据或URL
         */
        this.load = function(data) {
            if (isDestroyed) {
                DEBUG_WARN('[NavigationCore] 实例已销毁，无法加载数据');
                return false;
            }
            
            try {
                if (typeof data === 'string') {
                    // 从URL加载
                    loadFromUrl(data);
                } else if (Array.isArray(data)) {
                    // 直接设置数据
                    setNavigationData(data);
                } else {
                    throw new Error('Invalid navigation data format');
                }
                return true;
            } catch (error) {
                handleError('load', error);
                return false;
            }
        };
        
        /**
         * 打开导航
         */
        this.open = function() {
            if (isDestroyed || isAnimating || isOpen) {
                return false;
            }
            
            try {
                isAnimating = true;
                isOpen = true;
                
                // 更新状态
                updateNavigationState();
                
                // 显示覆盖层
                if (isMobile && elements.overlay) {
                    elements.overlay.style.display = 'block';
                    setTimeout(function() {
                        if (!isDestroyed) {
                            elements.overlay.style.opacity = '1';
                        }
                    }, 10);
                }
                
                // 显示侧边栏
                if (elements.sidebar) {
                    elements.sidebar.style.transform = 'translateX(0)';
                    elements.sidebar.setAttribute('aria-hidden', 'false');
                }
                
                // 更新切换按钮状态
                updateToggleButton();
                
                // 动画完成后重置状态
                createSafeTimeout(function() {
                    if (!isDestroyed) {
                        isAnimating = false;
                        
                        // 触发事件
                        if (eventHub) {
                            eventHub.emit('navigation:opened', { isMobile: isMobile });
                        }
                    }
                }, config.animationDuration);
                
                return true;
            } catch (error) {
                handleError('open', error);
                isAnimating = false;
                return false;
            }
        };
        
        /**
         * 关闭导航
         */
        this.close = function() {
            if (isDestroyed || isAnimating || !isOpen) {
                return false;
            }
            
            try {
                isAnimating = true;
                isOpen = false;
                
                // 更新状态
                updateNavigationState();
                
                // 隐藏侧边栏
                if (elements.sidebar) {
                    elements.sidebar.style.transform = isMobile ? 
                        'translateX(-100%)' : 'translateX(-' + elements.sidebar.offsetWidth + 'px)';
                    elements.sidebar.setAttribute('aria-hidden', 'true');
                }
                
                // 隐藏覆盖层
                if (isMobile && elements.overlay) {
                    elements.overlay.style.opacity = '0';
                    createSafeTimeout(function() {
                        if (!isDestroyed && elements.overlay) {
                            elements.overlay.style.display = 'none';
                        }
                    }, config.animationDuration);
                }
                
                // 更新切换按钮状态
                updateToggleButton();
                
                // 动画完成后重置状态
                createSafeTimeout(function() {
                    if (!isDestroyed) {
                        isAnimating = false;
                        
                        // 触发事件
                        if (eventHub) {
                            eventHub.emit('navigation:closed', { isMobile: isMobile });
                        }
                    }
                }, config.animationDuration);
                
                return true;
            } catch (error) {
                handleError('close', error);
                isAnimating = false;
                return false;
            }
        };
        
        /**
         * 切换导航状态
         */
        this.toggle = function() {
            return isOpen ? this.close() : this.open();
        };
        
        /**
         * 导航到指定路径
         * @param {string} path - 导航路径
         */
        this.navigateTo = function(path) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                var item = findNavigationItem(path);
                if (!item) {
                    DEBUG_WARN('[NavigationCore] Navigation item not found:', path);
                    return false;
                }
                
                // 更新当前路径
                currentPath = getItemPath(item);
                
                // 更新激活状态
                updateActiveStates();
                
                // 展开父级菜单
                expandParentMenus(item);
                
                // 更新面包屑
                updateBreadcrumb();
                
                // 保存状态
                saveNavigationState();
                
                // 触发导航事件
                if (eventHub) {
                    eventHub.emit('navigation:changed', {
                        path: path,
                        item: item,
                        currentPath: currentPath
                    });
                }
                
                // 移动端自动关闭
                if (isMobile && config.autoCollapse) {
                    this.close();
                }
                
                return true;
            } catch (error) {
                handleError('navigateTo', error);
                return false;
            }
        };
        
        /**
         * 搜索导航项
         * @param {string} query - 搜索关键词
         */
        this.search = function(query) {
            if (isDestroyed) {
                return [];
            }
            
            try {
                if (!query || query.length < 2) {
                    searchResults = [];
                    updateSearchResults();
                    return [];
                }
                
                var results = [];
                searchNavigationItems(navigationData, query.toLowerCase(), results);
                
                searchResults = results.slice(0, 10); // 限制结果数量
                updateSearchResults();
                
                // 触发搜索事件
                if (eventHub) {
                    eventHub.emit('navigation:searched', {
                        query: query,
                        results: searchResults
                    });
                }
                
                return searchResults;
            } catch (error) {
                handleError('search', error);
                return [];
            }
        };
        
        /**
         * 获取当前导航状态
         */
        this.getState = function() {
            return {
                isOpen: isOpen,
                isMobile: isMobile,
                currentPath: currentPath.slice(),
                navigationData: navigationData,
                searchResults: searchResults,
                isDestroyed: isDestroyed
            };
        };
        
        /**
         * 销毁导航实例
         */
        this.destroy = function() {
            if (isDestroyed) {
                return true;
            }
            
            try {
                // 标记为已销毁
                isDestroyed = true;
                
                // 移除事件监听器
                unbindEvents();
                
                // 清理搜索定时器
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                    searchTimeout = null;
                }
                
                // 清理DOM
                cleanupDOM();
                
                // 清理状态
                if (stateManager) {
                    stateManager.clearState('navigation');
                }
                
                // 触发销毁事件
                if (eventHub) {
                    eventHub.emit('navigation:destroyed');
                }
                
                DEBUG_LOG('[NavigationCore] 实例已销毁');
                return true;
            } catch (error) {
                handleError('destroy', error);
                return false;
            }
        };
        
        // 🔧 内部方法
        
        function injectDependencies() {
            // 尝试获取全局依赖
            if (typeof global.EnglishSite !== 'undefined') {
                stateManager = global.EnglishSite.StateManager ? 
                    new global.EnglishSite.StateManager() : null;
                eventHub = global.EnglishSite.EventHub ? 
                    new global.EnglishSite.EventHub() : null;
                cacheManager = global.EnglishSite.CacheManager ? 
                    new global.EnglishSite.CacheManager() : null;
                errorBoundary = global.EnglishSite.ErrorBoundary ? 
                    new global.EnglishSite.ErrorBoundary() : null;
            }
            
            // 如果用户传入了依赖，则使用用户提供的
            if (options.stateManager) stateManager = options.stateManager;
            if (options.eventHub) eventHub = options.eventHub;
            if (options.cacheManager) cacheManager = options.cacheManager;
            if (options.errorBoundary) errorBoundary = options.errorBoundary;
        }
        
        function createBoundHandler(handler, context) {
            return function boundHandler() {
                if (isDestroyed) return;
                try {
                    return handler.apply(context || self, arguments);
                } catch (error) {
                    handleError('eventHandler', error);
                }
            };
        }
        
        function detectMobile() {
            if (typeof window !== 'undefined') {
                isMobile = window.innerWidth < config.breakpoint;
                
                // 监听窗口大小变化
                resizeHandler = createBoundHandler(function() {
                    var wasMobile = isMobile;
                    isMobile = window.innerWidth < config.breakpoint;
                    
                    if (wasMobile !== isMobile) {
                        handleBreakpointChange();
                    }
                });
                
                window.addEventListener('resize', resizeHandler);
            }
        }
        
        function buildNavigationStructure() {
            if (!elements.container || isDestroyed) return;
            
            try {
                // 创建导航HTML结构
                var html = [
                    '<div class="nav-sidebar" role="navigation" aria-label="主导航">',
                        config.enableSearch ? '<div class="nav-search-container"></div>' : '',
                        '<div class="nav-menu-container"></div>',
                    '</div>',
                    isMobile ? '<div class="nav-overlay"></div>' : '',
                    '<button class="nav-toggle" aria-label="切换导航菜单">',
                        '<span class="nav-toggle-icon"></span>',
                    '</button>',
                    config.enableBreadcrumb ? '<div class="nav-breadcrumb"></div>' : ''
                ].join('');
                
                elements.container.innerHTML = html;
                
                // 获取DOM元素引用
                elements.sidebar = elements.container.querySelector('.nav-sidebar');
                elements.overlay = elements.container.querySelector('.nav-overlay');
                elements.toggle = elements.container.querySelector('.nav-toggle');
                elements.content = elements.container.querySelector('.nav-menu-container');
                elements.breadcrumb = elements.container.querySelector('.nav-breadcrumb');
                elements.search = elements.container.querySelector('.nav-search-container');
                
                // 初始化搜索框
                if (config.enableSearch && elements.search) {
                    buildSearchBox();
                }
                
                // 设置初始样式
                applyInitialStyles();
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] DOM结构构建失败:', error);
            }
        }
        
        function buildSearchBox() {
            if (!elements.search || isDestroyed) return;
            
            try {
                elements.search.innerHTML = [
                    '<div class="nav-search-box">',
                        '<input type="text" class="nav-search-input" placeholder="搜索..." aria-label="搜索导航">',
                        '<div class="nav-search-results"></div>',
                    '</div>'
                ].join('');
                
                var searchInput = elements.search.querySelector('.nav-search-input');
                if (searchInput) {
                    // 防抖搜索
                    boundEventHandlers.searchInput = createBoundHandler(function(e) {
                        if (searchTimeout) {
                            clearTimeout(searchTimeout);
                        }
                        searchTimeout = setTimeout(function() {
                            if (!isDestroyed) {
                                self.search(e.target.value);
                            }
                        }, 300);
                    });
                    
                    // 清空搜索
                    boundEventHandlers.searchBlur = createBoundHandler(function() {
                        setTimeout(function() {
                            if (!isDestroyed) {
                                searchResults = [];
                                updateSearchResults();
                            }
                        }, 200);
                    });
                    
                    searchInput.addEventListener('input', boundEventHandlers.searchInput);
                    searchInput.addEventListener('blur', boundEventHandlers.searchBlur);
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 搜索框构建失败:', error);
            }
        }
        
        function applyInitialStyles() {
            if (!elements.sidebar || isDestroyed) return;
            
            try {
                // 设置初始位置
                elements.sidebar.style.transform = isMobile ? 'translateX(-100%)' : 'translateX(0)';
                elements.sidebar.style.transition = 'transform ' + config.animationDuration + 'ms ease-in-out';
                elements.sidebar.setAttribute('aria-hidden', isMobile ? 'true' : 'false');
                
                // 覆盖层样式
                if (elements.overlay) {
                    elements.overlay.style.opacity = '0';
                    elements.overlay.style.display = 'none';
                    elements.overlay.style.transition = 'opacity ' + config.animationDuration + 'ms ease-in-out';
                }
                
                // 切换按钮样式
                if (elements.toggle) {
                    elements.toggle.style.display = isMobile ? 'block' : 'none';
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 初始样式应用失败:', error);
            }
        }
        
        function bindEvents() {
            if (isDestroyed) return;
            
            try {
                // 切换按钮事件
                if (elements.toggle) {
                    boundEventHandlers.toggleClick = createBoundHandler(function(e) {
                        e.preventDefault();
                        self.toggle();
                    });
                    elements.toggle.addEventListener('click', boundEventHandlers.toggleClick);
                }
                
                // 覆盖层点击关闭
                if (elements.overlay) {
                    boundEventHandlers.overlayClick = createBoundHandler(function() {
                        self.close();
                    });
                    elements.overlay.addEventListener('click', boundEventHandlers.overlayClick);
                }
                
                // 触摸手势支持
                if (isMobile) {
                    bindTouchEvents();
                }
                
                // 键盘导航支持
                bindKeyboardEvents();
                
                // 窗口焦点事件
                if (typeof window !== 'undefined') {
                    boundEventHandlers.windowFocus = createBoundHandler(function() {
                        // 窗口获得焦点时恢复状态
                        restoreNavigationState();
                    });
                    window.addEventListener('focus', boundEventHandlers.windowFocus);
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 事件绑定失败:', error);
            }
        }
        
        function bindTouchEvents() {
            if (!elements.container || isDestroyed) return;
            
            try {
                var isPassiveSupported = checkPassiveSupport();
                var touchOptions = isPassiveSupported ? { passive: true } : false;
                
                boundEventHandlers.touchStart = createBoundHandler(function(e) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                });
                
                boundEventHandlers.touchMove = createBoundHandler(function(e) {
                    if (!isOpen) return;
                    
                    var touchX = e.touches[0].clientX;
                    var touchY = e.touches[0].clientY;
                    var deltaX = touchX - touchStartX;
                    var deltaY = touchY - touchStartY;
                    
                    // 水平滑动且距离足够
                    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > config.touchThreshold) {
                        if (deltaX < 0) {
                            // 向左滑动关闭
                            self.close();
                        }
                    }
                });
                
                elements.container.addEventListener('touchstart', boundEventHandlers.touchStart, touchOptions);
                elements.container.addEventListener('touchmove', boundEventHandlers.touchMove, touchOptions);
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 触摸事件绑定失败:', error);
            }
        }
        
        function bindKeyboardEvents() {
            if (typeof document !== 'undefined') {
                boundEventHandlers.keyDown = createBoundHandler(function(e) {
                    // ESC键关闭导航
                    if (e.keyCode === 27 && isOpen) {
                        self.close();
                    }
                    
                    // Alt + M 切换导航
                    if (e.altKey && e.keyCode === 77) {
                        e.preventDefault();
                        self.toggle();
                    }
                });
                
                document.addEventListener('keydown', boundEventHandlers.keyDown);
            }
        }
        
        function unbindEvents() {
            try {
                // 移除容器相关事件
                if (elements.toggle && boundEventHandlers.toggleClick) {
                    elements.toggle.removeEventListener('click', boundEventHandlers.toggleClick);
                }
                
                if (elements.overlay && boundEventHandlers.overlayClick) {
                    elements.overlay.removeEventListener('click', boundEventHandlers.overlayClick);
                }
                
                if (elements.container) {
                    if (boundEventHandlers.touchStart) {
                        elements.container.removeEventListener('touchstart', boundEventHandlers.touchStart);
                    }
                    if (boundEventHandlers.touchMove) {
                        elements.container.removeEventListener('touchmove', boundEventHandlers.touchMove);
                    }
                }
                
                // 移除搜索事件
                var searchInput = elements.search ? elements.search.querySelector('.nav-search-input') : null;
                if (searchInput) {
                    if (boundEventHandlers.searchInput) {
                        searchInput.removeEventListener('input', boundEventHandlers.searchInput);
                    }
                    if (boundEventHandlers.searchBlur) {
                        searchInput.removeEventListener('blur', boundEventHandlers.searchBlur);
                    }
                }
                
                // 移除文档和窗口事件
                if (typeof document !== 'undefined' && boundEventHandlers.keyDown) {
                    document.removeEventListener('keydown', boundEventHandlers.keyDown);
                }
                
                if (typeof window !== 'undefined') {
                    if (resizeHandler) {
                        window.removeEventListener('resize', resizeHandler);
                        resizeHandler = null;
                    }
                    if (boundEventHandlers.windowFocus) {
                        window.removeEventListener('focus', boundEventHandlers.windowFocus);
                    }
                }
                
                // 清空所有绑定的处理器
                boundEventHandlers = {};
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 事件解绑失败:', error);
            }
        }
        
        function loadNavigationData() {
            if (isDestroyed) return;
            
            try {
                // 尝试从缓存加载
                if (cacheManager) {
                    var cachedData = cacheManager.cache(config.cacheKey);
                    if (cachedData) {
                        setNavigationData(cachedData);
                        return;
                    }
                }
                
                // 尝试从选项加载
                if (options.data) {
                    setNavigationData(options.data);
                    return;
                }
                
                // 尝试从URL加载
                if (options.dataUrl) {
                    loadFromUrl(options.dataUrl);
                    return;
                }
                
                // 使用默认数据
                setNavigationData([]);
                
            } catch (error) {
                handleError('loadNavigationData', error);
                setNavigationData([]);
            }
        }
        
        function loadFromUrl(url) {
            if (isDestroyed) return;
            
            try {
                // 兼容性fetch处理
                var loadFunction = typeof fetch !== 'undefined' ? 
                    loadWithFetch : loadWithXHR;
                
                loadFunction(url, function(data) {
                    if (!isDestroyed) {
                        setNavigationData(data);
                        
                        // 缓存数据
                        if (cacheManager) {
                            cacheManager.cache(config.cacheKey, data, 24 * 60 * 60 * 1000); // 24小时
                        }
                    }
                }, function(error) {
                    if (!isDestroyed) {
                        handleError('loadFromUrl', error);
                        setNavigationData([]);
                    }
                });
                
            } catch (error) {
                handleError('loadFromUrl', error);
                setNavigationData([]);
            }
        }
        
        function loadWithFetch(url, onSuccess, onError) {
            try {
                var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                var signal = controller ? controller.signal : undefined;
                
                var timeoutId = setTimeout(function() {
                    if (controller) controller.abort();
                    onError(new Error('请求超时'));
                }, 10000);
                
                fetch(url, { signal: signal })
                    .then(function(response) {
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status);
                        }
                        return response.json();
                    })
                    .then(onSuccess)
                    .catch(onError);
            } catch (error) {
                onError(error);
            }
        }
        
        function loadWithXHR(url, onSuccess, onError) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = 10000; // 10秒超时
                
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                var data = safeJSONParse(xhr.responseText);
                                if (data) {
                                    onSuccess(data);
                                } else {
                                    onError(new Error('数据解析失败'));
                                }
                            } catch (parseError) {
                                onError(parseError);
                            }
                        } else {
                            onError(new Error('HTTP ' + xhr.status));
                        }
                    }
                };
                
                xhr.ontimeout = function() {
                    onError(new Error('请求超时'));
                };
                
                xhr.onerror = function() {
                    onError(new Error('网络错误'));
                };
                
                xhr.send();
            } catch (error) {
                onError(error);
            }
        }
        
        function setNavigationData(data) {
            if (isDestroyed) return;
            
            try {
                navigationData = processNavigationData(data);
                buildNavigationMap();
                renderNavigation();
                
                // 触发数据加载事件
                if (eventHub) {
                    eventHub.emit('navigation:loaded', {
                        data: navigationData,
                        itemCount: countNavigationItems(navigationData)
                    });
                }
                
            } catch (error) {
                handleError('setNavigationData', error);
            }
        }
        
        function processNavigationData(data) {
            if (!Array.isArray(data)) {
                DEBUG_WARN('[NavigationCore] Navigation data must be an array');
                return [];
            }
            
            // 处理每个导航项
            return data.slice(0, 100).map(function(item, index) { // 限制数量
                return processNavigationItem(item, null, 0, index);
            });
        }
        
        function processNavigationItem(item, parent, depth, index) {
            if (!item || typeof item !== 'object') {
                return null;
            }
            
            // 验证和标准化导航项
            var processed = {
                id: item.id || generateItemId(item, index),
                title: item.title || item.name || 'Untitled',
                url: item.url || item.href || '#',
                type: item.type || 'link',
                icon: item.icon || null,
                target: item.target || '_self',
                visible: item.visible !== false,
                disabled: item.disabled === true,
                depth: Math.min(depth, config.maxDepth),
                parent: parent,
                children: [],
                metadata: item.metadata || {}
            };
            
            // 处理子项
            if (item.children && Array.isArray(item.children) && depth < config.maxDepth) {
                processed.children = item.children.slice(0, 20).map(function(child, childIndex) { // 限制子项数量
                    return processNavigationItem(child, processed, depth + 1, childIndex);
                }).filter(function(child) {
                    return child !== null;
                });
            }
            
            return processed;
        }
        
        function generateItemId(item, index) {
            var base = item.title || item.name || 'item';
            return base.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + index;
        }
        
        function buildNavigationMap() {
            navigationMap = {};
            
            function mapItems(items) {
                if (!items) return;
                
                items.forEach(function(item) {
                    if (item) {
                        navigationMap[item.id] = item;
                        if (item.url && item.url !== '#') {
                            navigationMap[item.url] = item;
                        }
                        
                        if (item.children && item.children.length > 0) {
                            mapItems(item.children);
                        }
                    }
                });
            }
            
            mapItems(navigationData);
        }
        
        function renderNavigation() {
            if (!elements.content || isDestroyed) return;
            
            try {
                var html = renderNavigationItems(navigationData, 0);
                elements.content.innerHTML = html;
                
                // 绑定导航项事件
                bindNavigationEvents();
                
                // 更新激活状态
                updateActiveStates();
                
            } catch (error) {
                handleError('renderNavigation', error);
                elements.content.innerHTML = '<div class="nav-error">导航加载失败</div>';
            }
        }
        
        function renderNavigationItems(items, depth) {
            if (!items || items.length === 0) {
                return '';
            }
            
            var html = ['<ul class="nav-menu nav-menu-level-' + depth + '">'];
            
            items.forEach(function(item) {
                if (!item || !item.visible) return;
                
                var itemClass = ['nav-item'];
                if (item.children && item.children.length > 0) {
                    itemClass.push('nav-item-parent');
                }
                if (item.disabled) {
                    itemClass.push('nav-item-disabled');
                }
                
                html.push('<li class="' + itemClass.join(' ') + '" data-nav-id="' + item.id + '">');
                
                // 渲染项目链接
                html.push(renderNavigationLink(item));
                
                // 渲染子菜单
                if (item.children && item.children.length > 0) {
                    html.push('<div class="nav-submenu">');
                    html.push(renderNavigationItems(item.children, depth + 1));
                    html.push('</div>');
                }
                
                html.push('</li>');
            });
            
            html.push('</ul>');
            return html.join('');
        }
        
        function renderNavigationLink(item) {
            var linkClass = ['nav-link'];
            var attributes = [];
            
            if (item.disabled) {
                linkClass.push('nav-link-disabled');
                attributes.push('aria-disabled="true"');
            }
            
            if (item.target !== '_self') {
                attributes.push('target="' + item.target + '"');
            }
            
            var iconHtml = item.icon ? 
                '<span class="nav-icon ' + item.icon + '"></span>' : '';
            
            var expandHtml = (item.children && item.children.length > 0) ? 
                '<span class="nav-expand"></span>' : '';
            
            return [
                '<a href="' + item.url + '" class="' + linkClass.join(' ') + '"',
                attributes.length > 0 ? ' ' + attributes.join(' ') : '',
                ' data-nav-url="' + item.url + '">',
                iconHtml,
                '<span class="nav-text">' + item.title + '</span>',
                expandHtml,
                '</a>'
            ].join('');
        }
        
        function bindNavigationEvents() {
            if (!elements.content || isDestroyed) return;
            
            // 使用事件委托
            boundEventHandlers.contentClick = createBoundHandler(function(e) {
                var link = e.target.closest('.nav-link');
                if (!link) return;
                
                e.preventDefault();
                
                var url = link.getAttribute('data-nav-url');
                var disabled = link.classList.contains('nav-link-disabled');
                
                if (disabled) return;
                
                // 处理子菜单展开/收起
                var item = link.closest('.nav-item');
                if (item && item.classList.contains('nav-item-parent')) {
                    toggleSubmenu(item);
                }
                
                // 导航处理
                if (url && url !== '#') {
                    self.navigateTo(url);
                }
            });
            
            elements.content.addEventListener('click', boundEventHandlers.contentClick);
        }
        
        function toggleSubmenu(itemElement) {
            if (!itemElement || isDestroyed) return;
            
            try {
                var submenu = itemElement.querySelector('.nav-submenu');
                if (!submenu) return;
                
                var isExpanded = itemElement.classList.contains('nav-item-expanded');
                
                if (isExpanded) {
                    itemElement.classList.remove('nav-item-expanded');
                    submenu.style.maxHeight = '0';
                } else {
                    itemElement.classList.add('nav-item-expanded');
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 子菜单切换失败:', error);
            }
        }
        
        function findNavigationItem(identifier) {
            return navigationMap[identifier] || null;
        }
        
        function getItemPath(item) {
            var path = [];
            var current = item;
            
            while (current) {
                path.unshift(current);
                current = current.parent;
            }
            
            return path;
        }
        
        function updateActiveStates() {
            if (!elements.content || isDestroyed) return;
            
            try {
                // 移除所有活跃状态
                var activeElements = elements.content.querySelectorAll('.nav-item-active, .nav-link-active');
                for (var i = 0; i < activeElements.length; i++) {
                    activeElements[i].classList.remove('nav-item-active', 'nav-link-active');
                }
                
                // 设置当前路径的活跃状态
                currentPath.forEach(function(item) {
                    var itemElement = elements.content.querySelector('[data-nav-id="' + item.id + '"]');
                    if (itemElement) {
                        itemElement.classList.add('nav-item-active');
                        var link = itemElement.querySelector('.nav-link');
                        if (link) {
                            link.classList.add('nav-link-active');
                        }
                    }
                });
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 激活状态更新失败:', error);
            }
        }
        
        function expandParentMenus(item) {
            if (!item || isDestroyed) return;
            
            try {
                var current = item.parent;
                
                while (current) {
                    var itemElement = elements.content.querySelector('[data-nav-id="' + current.id + '"]');
                    if (itemElement) {
                        itemElement.classList.add('nav-item-expanded');
                        var submenu = itemElement.querySelector('.nav-submenu');
                        if (submenu) {
                            submenu.style.maxHeight = submenu.scrollHeight + 'px';
                        }
                    }
                    current = current.parent;
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 父菜单展开失败:', error);
            }
        }
        
        function updateBreadcrumb() {
            if (!config.enableBreadcrumb || !elements.breadcrumb || isDestroyed) return;
            
            try {
                if (currentPath.length === 0) {
                    elements.breadcrumb.innerHTML = '';
                    return;
                }
                
                var breadcrumbHtml = ['<nav class="breadcrumb" aria-label="面包屑导航">'];
                
                currentPath.forEach(function(item, index) {
                    var isLast = index === currentPath.length - 1;
                    
                    breadcrumbHtml.push('<span class="breadcrumb-item">');
                    
                    if (isLast) {
                        breadcrumbHtml.push('<span class="breadcrumb-current">' + item.title + '</span>');
                    } else {
                        breadcrumbHtml.push('<a href="' + item.url + '" class="breadcrumb-link">' + item.title + '</a>');
                        breadcrumbHtml.push('<span class="breadcrumb-separator">›</span>');
                    }
                    
                    breadcrumbHtml.push('</span>');
                });
                
                breadcrumbHtml.push('</nav>');
                elements.breadcrumb.innerHTML = breadcrumbHtml.join('');
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 面包屑更新失败:', error);
            }
        }
        
        function searchNavigationItems(items, query, results) {
            if (!items || !query || isDestroyed) return;
            
            items.forEach(function(item) {
                if (item && item.title && item.title.toLowerCase().indexOf(query) !== -1) {
                    results.push({
                        item: item,
                        path: getItemPath(item),
                        score: calculateSearchScore(item.title, query)
                    });
                }
                
                if (item && item.children && item.children.length > 0) {
                    searchNavigationItems(item.children, query, results);
                }
            });
            
            // 按分数排序
            results.sort(function(a, b) {
                return b.score - a.score;
            });
        }
        
        function calculateSearchScore(title, query) {
            var lowerTitle = title.toLowerCase();
            var lowerQuery = query.toLowerCase();
            
            // 完全匹配得分最高
            if (lowerTitle === lowerQuery) return 100;
            
            // 开头匹配
            if (lowerTitle.indexOf(lowerQuery) === 0) return 80;
            
            // 包含匹配
            if (lowerTitle.indexOf(lowerQuery) !== -1) return 60;
            
            return 0;
        }
        
        function updateSearchResults() {
            if (!elements.search || isDestroyed) return;
            
            try {
                var resultsContainer = elements.search.querySelector('.nav-search-results');
                if (!resultsContainer) return;
                
                if (searchResults.length === 0) {
                    resultsContainer.innerHTML = '';
                    resultsContainer.style.display = 'none';
                    return;
                }
                
                var html = ['<ul class="nav-search-list">'];
                
                searchResults.forEach(function(result) {
                    var pathText = result.path.map(function(item) { return item.title; }).join(' › ');
                    
                    html.push('<li class="nav-search-item">');
                    html.push('<a href="' + result.item.url + '" class="nav-search-link" data-nav-url="' + result.item.url + '">');
                    html.push('<span class="nav-search-title">' + result.item.title + '</span>');
                    html.push('<span class="nav-search-path">' + pathText + '</span>');
                    html.push('</a>');
                    html.push('</li>');
                });
                
                html.push('</ul>');
                resultsContainer.innerHTML = html.join('');
                resultsContainer.style.display = 'block';
                
                // 绑定搜索结果点击事件
                boundEventHandlers.searchResultClick = createBoundHandler(function(e) {
                    var link = e.target.closest('.nav-search-link');
                    if (link) {
                        e.preventDefault();
                        var url = link.getAttribute('data-nav-url');
                        self.navigateTo(url);
                    }
                });
                
                resultsContainer.addEventListener('click', boundEventHandlers.searchResultClick);
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 搜索结果更新失败:', error);
            }
        }
        
        function handleBreakpointChange() {
            if (isDestroyed) return;
            
            try {
                // 响应断点变化
                if (isMobile) {
                    // 切换到移动模式
                    if (elements.toggle) {
                        elements.toggle.style.display = 'block';
                    }
                    if (elements.sidebar) {
                        elements.sidebar.style.transform = isOpen ? 'translateX(0)' : 'translateX(-100%)';
                        elements.sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
                    }
                    bindTouchEvents();
                } else {
                    // 切换到桌面模式
                    if (elements.toggle) {
                        elements.toggle.style.display = 'none';
                    }
                    if (elements.overlay) {
                        elements.overlay.style.display = 'none';
                    }
                    if (elements.sidebar) {
                        elements.sidebar.style.transform = 'translateX(0)';
                        elements.sidebar.setAttribute('aria-hidden', 'false');
                    }
                    isOpen = true; // 桌面模式默认打开
                }
                
                updateNavigationState();
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 断点变化处理失败:', error);
            }
        }
        
        function updateToggleButton() {
            if (!elements.toggle || isDestroyed) return;
            
            try {
                elements.toggle.setAttribute('aria-expanded', isOpen.toString());
                elements.toggle.classList.toggle('nav-toggle-active', isOpen);
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] 切换按钮更新失败:', error);
            }
        }
        
        function updateNavigationState() {
            if (stateManager && !isDestroyed) {
                stateManager.setState('navigation.isOpen', isOpen);
                stateManager.setState('navigation.isMobile', isMobile);
                stateManager.setState('navigation.currentPath', currentPath);
            }
        }
        
        function saveNavigationState() {
            if (stateManager && !isDestroyed) {
                stateManager.setState('navigation.currentPath', currentPath, true);
                stateManager.setState('navigation.lastVisited', Date.now(), true);
            }
        }
        
        function restoreNavigationState() {
            if (!stateManager || isDestroyed) return;
            
            try {
                var savedPath = stateManager.getState('navigation.currentPath');
                if (savedPath && savedPath.length > 0) {
                    // 恢复最后的导航位置
                    var lastItem = savedPath[savedPath.length - 1];
                    if (lastItem && lastItem.url) {
                        self.navigateTo(lastItem.url);
                    }
                }
            } catch (error) {
                handleError('restoreNavigationState', error);
            }
        }
        
        function countNavigationItems(items) {
            var count = 0;
            if (!items) return count;
            
            items.forEach(function(item) {
                if (item) {
                    count++;
                    if (item.children && item.children.length > 0) {
                        count += countNavigationItems(item.children);
                    }
                }
            });
            return count;
        }
        
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
        
        function cleanupDOM() {
            try {
                if (elements.container) {
                    elements.container.innerHTML = '';
                }
                
                // 清空元素引用
                for (var key in elements) {
                    elements[key] = null;
                }
            } catch (error) {
                DEBUG_ERROR('[NavigationCore] DOM清理失败:', error);
            }
        }
        
        function handleError(context, error) {
            var errorInfo = {
                context: 'NavigationCore:' + context,
                message: error.message || String(error),
                timestamp: Date.now()
            };
            
            DEBUG_ERROR('[NavigationCore:' + context + ']', error);
            
            // 使用错误边界处理
            if (errorBoundary) {
                errorBoundary.handle(error, errorInfo);
            }
            
            // 触发错误事件
            if (eventHub) {
                eventHub.emit('navigation:error', errorInfo);
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NavigationCore;
    } else if (typeof global !== 'undefined') {
        global.NavigationCore = NavigationCore;
        
        // 添加到EnglishSite命名空间
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.NavigationCore) {
            global.EnglishSite.NavigationCore = NavigationCore;
        } else {
            DEBUG_WARN('[NavigationCore] EnglishSite.NavigationCore 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);