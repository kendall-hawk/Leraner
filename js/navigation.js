// js/navigation.js - 完整自定义多级导航系统
window.EnglishSite = window.EnglishSite || {};

class Navigation {
    static CONFIG = {
        CSS: {
            NAV_LIST: 'main-nav-list',
            ACTIVE: 'active',
            DROPDOWN_OPEN: 'dropdown-open',
        },
        ROUTES: {
            SERIES: 'series',
            CHAPTER: 'chapter',
            ALL: 'all',
            TOOLS: 'tools',
            CUSTOM: 'custom',
        },
        HASH_PREFIX: {
            SERIES: 'series=',
            ALL_ARTICLES: 'all-articles',
            TOOLS: 'tools',
        },
        EVENTS: {
            SERIES_SELECTED: 'seriesSelected',
            CHAPTER_LOADED: 'chapterLoaded',
            NAVIGATION_UPDATED: 'navigationUpdated',
            ALL_ARTICLES_REQUESTED: 'allArticlesRequested',
            TOOLS_REQUESTED: 'toolsRequested',
            CUSTOM_NAVIGATION: 'customNavigation',
        }
    };

    constructor(navContainer, contentArea, navData, options = {}) {
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.navData = navData;
        
        // 🚀 DOM缓存系统
        this.domCache = new Map();
        this.elements = new Map();
        
        // 🚀 统一状态管理
        this.state = {
            // 原有导航状态
            linksMap: new Map(),
            activeLink: null,
            chaptersMap: new Map(),
            
            // 🆕 侧边栏状态
            sidebar: {
                isOpen: false,
                isMobile: window.innerWidth <= 768,
                currentLevel: 1,
                navigationPath: [],
                expandedMenus: new Map()
            },
            
            // 🆕 自定义导航状态
            customNavigation: {
                flatItemsMap: new Map(), // 所有导航项的扁平映射
                levelStructure: new Map(), // 按层级组织的结构
                maxDepth: 1 // 最大深度
            },
            
            // 性能状态
            lastResize: 0,
            debounceTimers: new Map(),
            isMobile: window.innerWidth <= 768,
            
            // 预加载状态
            preloadQueue: new Set(),
            preloadInProgress: false
        };
        
        // 🚀 事件处理器
        this.eventHandlers = {
            globalClick: this.#handleGlobalClick.bind(this),
            windowResize: this.#createDebouncer('resize', this.#handleResize.bind(this), 100),
            popState: this.#handlePopState.bind(this),
            keydown: this.#handleKeydown.bind(this)
        };
        
        this.initPromise = this.#initialize(options);
    }

    // 🚀 DOM缓存获取
    #getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }

    // 🚀 防抖器创建
    #createDebouncer(key, func, delay) {
        return (...args) => {
            const timers = this.state.debounceTimers;
            clearTimeout(timers.get(key));
            timers.set(key, setTimeout(() => func.apply(this, args), delay));
        };
    }

    // 🚀 初始化方法
    async #initialize(options = {}) {
        try {
            if (window.EnglishSite.coreToolsReady) {
                await window.EnglishSite.coreToolsReady;
            }
            
            this.config = window.EnglishSite.ConfigManager?.createModuleConfig('navigation', {
                siteTitle: '互动学习平台',
                cacheMaxSize: 50,
                cacheTTL: 300000,
                enablePreloading: true,
                debug: false,
                ...options
            }) || {
                siteTitle: '互动学习平台',
                cacheMaxSize: 50,
                cacheTTL: 300000,
                enablePreloading: true,
                debug: false,
                ...options
            };

            this.cache = window.EnglishSite.CacheManager?.createCache('navigation', {
                maxSize: this.config.cacheMaxSize,
                ttl: this.config.cacheTTL,
                strategy: 'lru'
            }) || new Map();

            if (!this.navContainer || !this.contentArea || !this.navData) {
                throw new Error('Navigation: Missing required arguments');
            }

            // 🆕 创建侧边栏结构
            this.#createSidebarStructure();
            
            // 🆕 解析自定义导航结构
            this.#parseCustomNavigationStructure();
            
            // 🚀 并行初始化
            await Promise.all([
                this.#loadAndMergeToolsData(),
                this.#preprocessData()
            ]);
            
            this.#render();
            this.#setupEventListeners();
            this.#handleInitialLoad();
            
            if (this.config.enablePreloading) {
                this.#startPreloading();
            }
                
        } catch (error) {
            this.#handleInitializationFailure(error);
            throw error;
        }
    }

    // 🆕 解析自定义导航结构
    #parseCustomNavigationStructure() {
        const { flatItemsMap, levelStructure } = this.state.customNavigation;
        let maxDepth = 1;
        
        // 清空现有数据
        flatItemsMap.clear();
        levelStructure.clear();
        
        // 递归解析导航项
        const parseItem = (item, level = 1, parentPath = []) => {
            const itemId = item.id || item.seriesId || this.#generateId();
            const currentPath = [...parentPath, itemId];
            
            // 标准化导航项
            const normalizedItem = {
                id: itemId,
                title: item.title || item.series || 'Untitled',
                level: level,
                type: item.type || 'category',
                
                // 🎯 导航行为配置
                behavior: item.behavior || 'auto', // 'direct', 'expand', 'auto', 'custom'
                action: item.action, // 自定义动作
                url: item.url,
                externalUrl: item.externalUrl,
                openInNewTab: item.openInNewTab,
                
                // 内容相关
                chapters: item.chapters || [],
                children: [],
                
                // 元数据
                description: item.description,
                thumbnail: item.thumbnail,
                icon: item.icon,
                
                // 路径信息
                path: currentPath,
                parentPath: parentPath,
                
                // 原始数据
                originalData: item
            };
            
            // 存储到扁平映射
            flatItemsMap.set(itemId, normalizedItem);
            
            // 按层级存储
            if (!levelStructure.has(level)) {
                levelStructure.set(level, []);
            }
            levelStructure.get(level).push(normalizedItem);
            
            // 更新最大深度
            maxDepth = Math.max(maxDepth, level);
            
            // 🎯 处理子项
            if (item.children && Array.isArray(item.children)) {
                item.children.forEach(child => {
                    const childItem = parseItem(child, level + 1, currentPath);
                    normalizedItem.children.push(childItem);
                });
            }
            
            // 🎯 自动判断导航行为
            if (normalizedItem.behavior === 'auto') {
                if (normalizedItem.children.length > 0 || normalizedItem.chapters.length > 0) {
                    normalizedItem.behavior = 'expand'; // 有子项则展开
                } else {
                    normalizedItem.behavior = 'direct'; // 无子项则直接导航
                }
            }
            
            return normalizedItem;
        };
        
        // 解析所有顶级项目
        this.navData.forEach(item => parseItem(item, 1));
        
        this.state.customNavigation.maxDepth = maxDepth;
        
        if (this.config.debug) {
            console.log('[Navigation] 🎯 自定义导航结构解析完成');
            console.log('[Navigation] 📊 总项目数:', flatItemsMap.size);
            console.log('[Navigation] 📏 最大深度:', maxDepth);
            console.log('[Navigation] 🗂️ 层级结构:', levelStructure);
        }
    }

    // 🆕 创建侧边栏结构
    #createSidebarStructure() {
        // 隐藏原导航
        const originalNav = this.navContainer;
        if (originalNav) {
            originalNav.style.display = 'none';
            originalNav.setAttribute('data-backup', 'true');
        }
        
        // 创建汉堡按钮
        this.#createHamburgerButton();
        
        // 创建侧边栏容器
        this.#createSidebarContainer();
        
        // 创建遮罩
        this.#createOverlay();
        
        // 缓存关键DOM元素
        this.#cacheElements();
    }

    #createHamburgerButton() {
        // 确保头部存在
        let header = document.querySelector('.site-header');
        if (!header) {
            header = document.createElement('header');
            header.className = 'site-header';
            document.body.insertBefore(header, document.body.firstChild);
        }
        
        // 创建汉堡按钮（如果不存在）
        if (!header.querySelector('.nav-toggle')) {
            const hamburger = document.createElement('button');
            hamburger.className = 'nav-toggle';
            hamburger.setAttribute('aria-label', '打开导航菜单');
            hamburger.setAttribute('data-action', 'toggle-sidebar');
            hamburger.innerHTML = `
                <span class="hamburger-icon">
                    <span></span><span></span><span></span>
                </span>
            `;
            
            // 插入到品牌头部之后
            const brandHeader = header.querySelector('.brand-header');
            if (brandHeader) {
                header.insertBefore(hamburger, brandHeader.nextSibling);
            } else {
                header.insertBefore(hamburger, header.firstChild);
            }
        } else {
            // 更新现有按钮的action
            const existingHamburger = header.querySelector('.nav-toggle');
            existingHamburger.setAttribute('data-action', 'toggle-sidebar');
        }
    }

    #createSidebarContainer() {
        // 移除旧的侧边栏
        const oldSidebar = document.querySelector('.sidebar-container');
        if (oldSidebar) oldSidebar.remove();
        
        const sidebarContainer = document.createElement('div');
        sidebarContainer.className = 'sidebar-container';
        sidebarContainer.setAttribute('data-state', 'closed');
        sidebarContainer.innerHTML = `
            <nav class="sidebar-main">
                <div class="nav-breadcrumb"></div>
                <div class="nav-content"></div>
            </nav>
            <div class="sidebar-submenu">
                <div class="submenu-content"></div>
            </div>
        `;
        
        document.body.appendChild(sidebarContainer);
    }

    #createOverlay() {
        const oldOverlay = document.querySelector('.sidebar-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.setAttribute('aria-label', '点击关闭导航');
        overlay.setAttribute('data-action', 'close-sidebar');
        document.body.appendChild(overlay);
    }

    #cacheElements() {
        this.state.elements = {
            hamburger: document.querySelector('.nav-toggle'),
            container: document.querySelector('.sidebar-container'),
            mainPanel: document.querySelector('.sidebar-main'),
            submenuPanel: document.querySelector('.sidebar-submenu'),
            overlay: document.querySelector('.sidebar-overlay'),
            breadcrumb: document.querySelector('.nav-breadcrumb'),
            mainContent: document.querySelector('.nav-content'),
            submenuContent: document.querySelector('.submenu-content')
        };
        
        // 验证关键元素
        const required = ['hamburger', 'container', 'mainPanel', 'submenuPanel', 'overlay'];
        for (const key of required) {
            if (!this.state.elements[key]) {
                throw new Error(`Navigation: 缺少关键元素 ${key}`);
            }
        }
    }

    // 🚀 数据处理
    async #loadAndMergeToolsData() {
        try {
            const response = await fetch('./data/tools.json');
            
            if (response.ok) {
                const toolsData = await response.json();
                
                if (Array.isArray(toolsData) && toolsData.length > 0) {
                    const validTools = toolsData.filter(tool => tool.id && tool.title);
                    
                    if (validTools.length > 0) {
                        const toolsSeries = {
                            id: "tools",
                            title: "学习工具",
                            type: "tools-category",
                            behavior: "expand", // 工具分类需要展开
                            description: "实用的英语学习工具集合",
                            icon: "🛠️",
                            children: validTools.map(tool => ({
                                ...tool,
                                type: tool.type || 'tool',
                                behavior: 'direct' // 工具项直接导航
                            }))
                        };
                        
                        this.navData.push(toolsSeries);
                    }
                }
            }
        } catch (error) {
            if (this.config.debug) {
                console.warn('[Navigation] Tools loading failed:', error);
            }
        }
    }

    #preprocessData() {
        if (!Array.isArray(this.navData)) {
            throw new Error('Navigation data must be an array');
        }

        let totalChapters = 0;
        
        // 🎯 递归处理所有章节，支持多级结构
        const processItem = (item) => {
            if (item.chapters && Array.isArray(item.chapters)) {
                item.chapters.forEach(chapter => {
                    if (!chapter.id) return;
                    
                    const chapterWithSeriesInfo = { 
                        ...chapter, 
                        seriesId: item.id || item.seriesId,
                        seriesTitle: item.title || item.series
                    };
                    this.state.chaptersMap.set(chapter.id, chapterWithSeriesInfo);
                    totalChapters++;
                });
            }
            
            if (item.children && Array.isArray(item.children)) {
                item.children.forEach(child => processItem(child));
            }
        };
        
        this.navData.forEach(item => processItem(item));

        if (this.config.debug) {
            console.log(`[Navigation] Preprocessed ${totalChapters} chapters from ${this.navData.length} series`);
        }
    }

    // 🆕 自定义导航渲染系统
    #render() {
        this.#renderMainNavigation();
    }

    #renderMainNavigation() {
        this.state.sidebar.currentLevel = 1;
        this.state.sidebar.navigationPath = [];
        this.#renderBreadcrumb();
        
        // 🎯 获取第一级导航项
        const level1Items = this.state.customNavigation.levelStructure.get(1) || [];
        
        // 🆕 添加特殊导航项
        const navigationItems = [
            // All Articles 特殊项
            {
                id: 'all-articles',
                title: 'All Articles',
                type: 'all-articles',
                behavior: 'direct',
                level: 1,
                icon: '📚'
            },
            ...level1Items
        ];
        
        this.#renderNavigationLevel(navigationItems, this.state.elements.mainContent);
        this.#hideSubmenu();
    }

    #renderBreadcrumb() {
        const breadcrumbEl = this.state.elements.breadcrumb;
        if (!breadcrumbEl) return;
        
        if (this.state.sidebar.navigationPath.length === 0) {
            breadcrumbEl.style.display = 'none';
            return;
        }
        
        breadcrumbEl.style.display = 'block';
        const pathHtml = this.state.sidebar.navigationPath
            .map((item, index) => {
                const isLast = index === this.state.sidebar.navigationPath.length - 1;
                if (isLast) {
                    return `<span class="breadcrumb-current">${item.title}</span>`;
                } else {
                    return `<a href="#" class="breadcrumb-link" data-action="breadcrumb-link" data-level="${item.level}" data-id="${item.id}">${item.title}</a>`;
                }
            })
            .join('<span class="breadcrumb-separator"> > </span>');
        
        breadcrumbEl.innerHTML = `
            <div class="breadcrumb-container">
                <button class="breadcrumb-back" data-action="breadcrumb-back" aria-label="返回上级">‹</button>
                <div class="breadcrumb-path">${pathHtml}</div>
            </div>
        `;
    }

    #renderNavigationLevel(items, container) {
        if (!container || !items) return;
        
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
            const element = this.#createNavigationItem(item);
            fragment.appendChild(element);
            
            // 缓存链接映射
            this.state.linksMap.set(item.id, element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    #createNavigationItem(item) {
        const hasChildren = (item.children && item.children.length > 0) || 
                           (item.chapters && item.chapters.length > 0);
        
        const element = document.createElement('div');
        element.className = this.#getItemClasses(item, hasChildren);
        element.setAttribute('data-id', item.id);
        element.setAttribute('data-level', item.level);
        element.setAttribute('data-type', item.type || 'category');
        element.setAttribute('data-behavior', item.behavior || 'auto');
        element.setAttribute('data-action', 'nav-item');
        
        // 🎯 添加图标支持
        const iconHtml = item.icon ? `<span class="nav-icon">${item.icon}</span>` : '';
        
        element.innerHTML = `
            ${iconHtml}
            <span class="nav-title">${item.title}</span>
            ${hasChildren && item.behavior === 'expand' ? '<span class="expand-arrow">></span>' : ''}
        `;
        
        return element;
    }

    #getItemClasses(item, hasChildren) {
        const classes = ['nav-item', `level-${item.level}`];
        
        if (hasChildren && item.behavior === 'expand') {
            classes.push('expandable');
        } else {
            classes.push('clickable');
        }
        
        if (item.type === 'tool' || item.type === 'tools-category') {
            classes.push('tools-item');
        }
        
        return classes.join(' ');
    }

    #renderChaptersList(chapters, container) {
        if (!container || !chapters) return;
        
        const fragment = document.createDocumentFragment();
        
        chapters.forEach(chapter => {
            const element = document.createElement('div');
            element.className = `nav-item level-${this.state.sidebar.currentLevel} clickable chapter-item`;
            element.setAttribute('data-id', chapter.id);
            element.setAttribute('data-action', 'navigate-chapter');
            
            const iconHtml = chapter.icon ? `<span class="nav-icon">${chapter.icon}</span>` : '';
            element.innerHTML = `${iconHtml}<span class="nav-title">${chapter.title}</span>`;
            
            fragment.appendChild(element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    #renderChildrenList(children, container) {
        if (!container || !children) return;
        
        const fragment = document.createDocumentFragment();
        
        children.forEach(child => {
            const element = this.#createNavigationItem({
                ...child,
                level: this.state.sidebar.currentLevel
            });
            
            // 缓存链接映射
            this.state.linksMap.set(child.id, element);
            fragment.appendChild(element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // 🆕 智能导航处理系统
    #handleNavItemClick(itemId) {
        // 🎯 查找项目（优先从自定义导航结构中查找）
        let item = this.state.customNavigation.flatItemsMap.get(itemId);
        
        if (!item) {
            // 回退到章节查找
            const chapterData = this.state.chaptersMap.get(itemId);
            if (chapterData) {
                item = {
                    id: itemId,
                    title: chapterData.title,
                    type: 'chapter',
                    behavior: 'direct',
                    level: 1,
                    originalData: chapterData
                };
            }
        }
        
        if (!item) {
            console.error('[Navigation] 找不到项目:', itemId);
            return;
        }
        
        if (this.config.debug) {
            console.log('[Navigation] 🎯 点击项目:', item.title);
            console.log('[Navigation] 🎭 行为模式:', item.behavior);
            console.log('[Navigation] 📊 项目数据:', item);
        }
        
        // 🎯 根据配置的行为模式处理
        switch (item.behavior) {
            case 'expand':
                this.#expandSubmenu(item);
                break;
            case 'direct':
                this.#handleDirectNavigation(item);
                break;
            case 'custom':
                this.#handleCustomAction(item);
                break;
            default:
                // auto 模式：智能判断
                if ((item.children && item.children.length > 0) || 
                    (item.chapters && item.chapters.length > 0)) {
                    this.#expandSubmenu(item);
                } else {
                    this.#handleDirectNavigation(item);
                }
                break;
        }
    }

    #expandSubmenu(item) {
        // 更新导航路径
        this.#updateNavigationPath(item);
        
        // 渲染面包屑
        this.#renderBreadcrumb();
        
        // 🎯 根据内容类型渲染
        if (item.children && item.children.length > 0) {
            // 渲染子分类
            this.#renderChildrenList(item.children, this.state.elements.submenuContent);
        } else if (item.chapters && item.chapters.length > 0) {
            // 渲染章节列表
            this.#renderChaptersList(item.chapters, this.state.elements.submenuContent);
        }
        
        // 显示子菜单
        this.#showSubmenu();
        
        // 更新主面板选中状态
        this.#updateActiveState(item.id);
    }

    #handleDirectNavigation(item) {
        // 关闭侧边栏
        this.#closeSidebar();
        
        // 🎯 根据项目类型进行导航
        switch (item.type) {
            case 'all-articles':
                this.#route({ type: Navigation.CONFIG.ROUTES.ALL, id: null });
                break;
            case 'tools':
            case 'tools-category':
                this.#route({ type: Navigation.CONFIG.ROUTES.TOOLS, id: null });
                break;
            case 'tool':
                this.#route({ type: Navigation.CONFIG.ROUTES.CHAPTER, id: item.id });
                break;
            case 'chapter':
                this.#route({ type: Navigation.CONFIG.ROUTES.CHAPTER, id: item.id });
                break;
            case 'external':
                this.#handleExternalNavigation(item);
                break;
            case 'custom':
                this.#handleCustomNavigation(item);
                break;
            default:
                if (item.url || item.externalUrl) {
                    this.#handleExternalNavigation(item);
                } else if (item.chapters && item.chapters.length > 0) {
                    this.#route({ type: Navigation.CONFIG.ROUTES.SERIES, id: item.id });
                } else {
                    this.#route({ type: Navigation.CONFIG.ROUTES.CUSTOM, id: item.id, item: item });
                }
                break;
        }
    }

    #handleCustomAction(item) {
        // 关闭侧边栏
        this.#closeSidebar();
        
        // 🎯 触发自定义事件
        this.#dispatchEvent(Navigation.CONFIG.EVENTS.CUSTOM_NAVIGATION, {
            item: item,
            action: item.action,
            customData: item.originalData
        });
        
        if (this.config.debug) {
            console.log('[Navigation] 🎭 触发自定义导航事件:', item.action);
        }
    }

    #handleExternalNavigation(item) {
        const url = item.externalUrl || item.url;
        const openInNewTab = item.openInNewTab !== false; // 默认新窗口
        
        if (openInNewTab) {
            window.open(url, '_blank', 'noopener,noreferrer');
            this.#displayExternalLinkMessage(item);
        } else {
            window.location.href = url;
        }
    }

    #handleCustomNavigation(item) {
        // 更新标题和激活状态
        this.#updateTitle(item.title);
        this.#setActiveLink(item.id);
        
        // 触发自定义导航事件
        this.#dispatchEvent(Navigation.CONFIG.EVENTS.CUSTOM_NAVIGATION, {
            item: item,
            customData: item.originalData
        });
    }

    #updateNavigationPath(item) {
        this.state.sidebar.navigationPath.push({
            id: item.id,
            title: item.title,
            level: item.level
        });
        
        this.state.sidebar.currentLevel = item.level + 1;
    }

    #navigateToLevel(level, itemId) {
        // 面包屑导航：返回到指定层级
        const targetLevel = parseInt(level);
        
        // 移除当前层级之后的路径
        this.state.sidebar.navigationPath = this.state.sidebar.navigationPath.filter(p => p.level <= targetLevel);
        this.state.sidebar.currentLevel = targetLevel + 1;
        
        if (this.state.sidebar.navigationPath.length === 0) {
            // 返回主菜单
            this.#renderMainNavigation();
        } else {
            // 重新渲染指定层级
            const targetItem = this.state.customNavigation.flatItemsMap.get(itemId);
            if (targetItem) {
                this.#expandSubmenu(targetItem);
            }
        }
    }

    #navigateBack() {
        if (this.state.sidebar.navigationPath.length === 0) {
            this.#closeSidebar();
            return;
        }
        
        // 移除最后一级
        this.state.sidebar.navigationPath.pop();
        this.state.sidebar.currentLevel--;
        
        if (this.state.sidebar.navigationPath.length === 0) {
            // 回到主菜单
            this.#renderMainNavigation();
        } else {
            // 回到上一级
            const parentItem = this.state.sidebar.navigationPath[this.state.sidebar.navigationPath.length - 1];
            const parent = this.state.customNavigation.flatItemsMap.get(parentItem.id);
            
            if (parent) {
                this.#renderBreadcrumb();
                
                if (parent.children && parent.children.length > 0) {
                    this.#renderChildrenList(parent.children, this.state.elements.submenuContent);
                } else if (parent.chapters && parent.chapters.length > 0) {
                    this.#renderChaptersList(parent.chapters, this.state.elements.submenuContent);
                }
                
                this.#showSubmenu();
            } else {
                this.#renderMainNavigation();
            }
        }
    }

    // 🎭 子菜单显示/隐藏
    #showSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        if (this.config.debug) {
            console.log('[Navigation] 🎭 显示子菜单');
        }
        
        submenu.classList.remove('hidden');
        submenu.classList.add('expanded');
        submenu.style.display = 'block';
        
        submenu.style.transform = 'translateX(100%)';
        submenu.style.opacity = '0';
        submenu.style.visibility = 'visible';
        submenu.style.pointerEvents = 'auto';
        
        requestAnimationFrame(() => {
            submenu.style.transform = 'translateX(0)';
            submenu.style.opacity = '1';
        });
    }

    #hideSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        if (this.config.debug) {
            console.log('[Navigation] 🎭 隐藏子菜单');
        }
        
        submenu.style.transform = 'translateX(100%)';
        submenu.style.opacity = '0';
        
        setTimeout(() => {
            submenu.style.display = 'none';
            submenu.style.visibility = 'hidden';
            submenu.style.pointerEvents = 'none';
            submenu.classList.remove('expanded');
            submenu.classList.add('hidden');
            submenu.innerHTML = '';
        }, 250);
    }

    // 🎮 侧边栏控制
    #toggleSidebar() {
        this.state.sidebar.isOpen ? this.#closeSidebar() : this.#openSidebar();
    }

    #openSidebar() {
        this.state.sidebar.isOpen = true;
        
        const { container, overlay } = this.state.elements;
        
        container.setAttribute('data-state', 'open');
        container.classList.add('open');
        overlay.classList.add('visible');
        
        document.body.style.overflow = 'hidden';
        document.body.classList.add('sidebar-open');
        
        // 确保汉堡按钮更新action
        this.#updateHamburgerAction();
    }

    #closeSidebar() {
        this.state.sidebar.isOpen = false;
        
        const { container, overlay } = this.state.elements;
        
        container.setAttribute('data-state', 'closed');
        container.classList.remove('open');
        overlay.classList.remove('visible');
        
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
        
        // 重置导航状态
        this.#resetNavigationState();
        
        // 确保汉堡按钮更新action
        this.#updateHamburgerAction();
    }

    #resetNavigationState() {
        this.state.sidebar.navigationPath = [];
        this.state.sidebar.currentLevel = 1;
        this.#hideSubmenu();
        this.#renderMainNavigation();
    }

    #updateHamburgerAction() {
        const hamburger = this.state.elements.hamburger;
        if (hamburger) {
            hamburger.setAttribute('data-action', this.state.sidebar.isOpen ? 'close-sidebar' : 'toggle-sidebar');
        }
    }

    #updateActiveState(itemId) {
        this.#setActiveLink(itemId);
    }

    // 🎮 事件处理
    #setupEventListeners() {
        document.addEventListener('click', this.eventHandlers.globalClick);
        window.addEventListener('resize', this.eventHandlers.windowResize);
        window.addEventListener('popstate', this.eventHandlers.popState);
        document.addEventListener('keydown', this.eventHandlers.keydown);
        
        if (this.state.isMobile) {
            const touchHandler = this.#createDebouncer('touch', () => {
                if (this.state.sidebar.isOpen) this.#closeSidebar();
            }, 50);
            
            window.addEventListener('touchmove', touchHandler, { passive: true });
            window.addEventListener('orientationchange', this.eventHandlers.windowResize);
        }
    }

    #handleGlobalClick(event) {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        
        if (!actionElement) {
            this.#handleOutsideClick(event);
            return;
        }
        
        const action = actionElement.dataset.action;
        const id = actionElement.dataset.id;
        
        event.preventDefault();
        event.stopPropagation();
        
        switch (action) {
            case 'toggle-sidebar':
                this.#toggleSidebar();
                break;
            case 'close-sidebar':
                this.#closeSidebar();
                break;
            case 'nav-item':
                this.#handleNavItemClick(id);
                break;
            case 'navigate-chapter':
                this.navigateToChapter(id);
                this.#closeSidebar();
                break;
            case 'breadcrumb-back':
                this.#navigateBack();
                break;
            case 'breadcrumb-link':
                this.#navigateToLevel(actionElement.dataset.level, id);
                break;
        }
    }

    #handleOutsideClick(event) {
        if (!this.state.sidebar.isOpen) return;
        
        const sidebar = this.state.elements.container;
        const hamburger = this.state.elements.hamburger;
        const overlay = this.state.elements.overlay;
        
        if (event.target === overlay || 
            (!sidebar.contains(event.target) && !hamburger.contains(event.target))) {
            this.#closeSidebar();
        }
    }

    #handleResize() {
        const now = Date.now();
        if (now - this.state.lastResize < 50) return;
        
        this.state.lastResize = now;
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth <= 768;
        this.state.sidebar.isMobile = this.state.isMobile;
    }

    #handleKeydown(event) {
        if (event.key === 'Escape' && this.state.sidebar.isOpen) {
            event.preventDefault();
            this.#closeSidebar();
        }
    }

    #handlePopState(event) {
        const route = event.state || this.#parseHash();
        this.#route(route, false, true);
    }

    #handleInitialLoad() {
        const route = this.#parseHash();
        this.#route(route, true);
    }

    // 🧭 路由系统
    #parseHash() {
        const hash = window.location.hash.substring(1);
        const { ROUTES, HASH_PREFIX } = Navigation.CONFIG;
        
        if (hash.startsWith(HASH_PREFIX.SERIES)) {
            return { type: ROUTES.SERIES, id: hash.substring(HASH_PREFIX.SERIES.length) };
        }
        if (hash === HASH_PREFIX.ALL_ARTICLES) {
            return { type: ROUTES.ALL, id: null };
        }
        if (hash === HASH_PREFIX.TOOLS) {
            return { type: ROUTES.TOOLS, id: null };
        }
        if (hash && this.state.chaptersMap.has(hash)) {
            return { type: ROUTES.CHAPTER, id: hash };
        }

        const defaultSeriesId = this.navData[0]?.seriesId || this.navData[0]?.id;
        return defaultSeriesId ? { type: ROUTES.SERIES, id: defaultSeriesId } : { type: ROUTES.ALL, id: null };
    }

    #route(route, replace = false, fromPopState = false) {
        if (!fromPopState) {
            const historyMethod = replace ? 'replaceState' : 'pushState';
            const newHash = this.#getHashFromRoute(route);
            history[historyMethod](route, '', newHash);
        }

        switch (route.type) {
            case Navigation.CONFIG.ROUTES.SERIES:
                this.#setActiveSeries(route.id);
                break;
            case Navigation.CONFIG.ROUTES.CHAPTER:
                this.navigateToChapter(route.id);
                break;
            case Navigation.CONFIG.ROUTES.ALL:
                this.#showAllArticles();
                break;
            case Navigation.CONFIG.ROUTES.TOOLS:
                this.#showToolsPage();
                break;
            case Navigation.CONFIG.ROUTES.CUSTOM:
                this.#handleCustomNavigation(route.item);
                break;
            default:
                this.#loadDefaultRoute();
                break;
        }
    }

    #getHashFromRoute(route) {
        const { type, id } = route;
        switch(type) {
            case Navigation.CONFIG.ROUTES.SERIES: 
                return `#${Navigation.CONFIG.HASH_PREFIX.SERIES}${id}`;
            case Navigation.CONFIG.ROUTES.CHAPTER: 
                return `#${id}`;
            case Navigation.CONFIG.ROUTES.ALL: 
                return `#${Navigation.CONFIG.HASH_PREFIX.ALL_ARTICLES}`;
            case Navigation.CONFIG.ROUTES.TOOLS:
                return `#${Navigation.CONFIG.HASH_PREFIX.TOOLS}`;
            default: 
                return '';
        }
    }

    #loadDefaultRoute() {
        const defaultSeriesId = this.navData[0]?.seriesId || this.navData[0]?.id;
        if (defaultSeriesId) {
            this.#setActiveSeries(defaultSeriesId);
        } else {
            this.#showAllArticles();
        }
    }

    // 📄 内容加载系统
    navigateToChapter(chapterId) {
        if (!this.state.chaptersMap.has(chapterId)) {
            this.#displayError('章节未找到');
            return;
        }
        this.#loadChapterContent(chapterId);
    }

    async #loadChapterContent(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) {
            this.#displayError('章节数据未找到');
            return;
        }

        try {
            if (chapterData.type === 'tool' && chapterData.url) {
                this.#handleToolPageNavigation(chapterData);
                return;
            }
            
            let content = this.cache.get ? this.cache.get(chapterId) : null;
            
            if (!content) {
                const contentUrl = this.#getContentUrl(chapterData);
                const response = await fetch(contentUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                content = await response.text();
                
                if (this.cache.set) {
                    this.cache.set(chapterId, content);
                }
            }
            
            this.#displayChapterContent(chapterId, content, chapterData);
            
        } catch (error) {
            this.#displayError('章节加载失败，请检查网络连接');
            this.#dispatchEvent('chapterLoadError', { chapterId, error });
        }
    }

    #getContentUrl(chapterData) {
        if (chapterData.url) {
            if (chapterData.url.startsWith('http')) {
                return chapterData.url;
            }
            return chapterData.url;
        }
        return `chapters/${chapterData.id}.html`;
    }

    #handleToolPageNavigation(chapterData) {
        const { id, url, title } = chapterData;
        
        if (url.startsWith('http')) {
            window.open(url, '_blank', 'noopener,noreferrer');
            this.#displayExternalLinkMessage(chapterData);
        } else {
            window.location.href = url;
        }
        
        this.#updateTitle(title);
        this.#setActiveLink(id);
        
        this.#dispatchEvent('toolPageLoaded', { 
            toolId: id, 
            toolUrl: url, 
            chapterData 
        });
    }
    
    #displayChapterContent(chapterId, content, chapterData) {
        this.contentArea.innerHTML = content;
        this.#updateTitle(chapterData.title);
        this.#setActiveLink(chapterData.seriesId);

        this.#dispatchEvent(Navigation.CONFIG.EVENTS.CHAPTER_LOADED, { 
            chapterId, 
            hasAudio: chapterData.audio, 
            chapterData 
        });

        const { prevChapterId, nextChapterId } = this.#getChapterNav(chapterId);
        this.#dispatchEvent(Navigation.CONFIG.EVENTS.NAVIGATION_UPDATED, { prevChapterId, nextChapterId });
    }

    #setActiveSeries(seriesId) {
        const seriesData = this.navData.find(s => s.seriesId === seriesId || s.id === seriesId);
        if (seriesData) {
            this.#updateTitle(`Series: ${seriesData.series || seriesData.title || seriesId}`);
            this.#setActiveLink(seriesId);
            this.#dispatchEvent(Navigation.CONFIG.EVENTS.SERIES_SELECTED, { 
                seriesId, 
                chapters: seriesData.chapters 
            });
        }
    }
    
    #showAllArticles() {
        this.#updateTitle('All Articles');
        this.#setActiveLink(Navigation.CONFIG.ROUTES.ALL);
        this.#dispatchEvent(Navigation.CONFIG.EVENTS.ALL_ARTICLES_REQUESTED);
    }

    #showToolsPage() {
        this.#updateTitle('Tools');
        this.#setActiveLink(Navigation.CONFIG.ROUTES.TOOLS);
        this.#displayToolsPageContent();
        this.#dispatchEvent(Navigation.CONFIG.EVENTS.TOOLS_REQUESTED);
    }

    #displayToolsPageContent() {
        this.contentArea.innerHTML = `
            <div class="tools-page">
                <div class="tools-header" style="text-align: center; margin-bottom: 40px; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🛠️</div>
                    <h1 style="margin-bottom: 16px; font-size: 2.5rem;">学习工具箱</h1>
                    <p style="opacity: 0.9; font-size: 1.1rem;">提升英语学习效率的实用工具集合</p>
                </div>
                
                <div class="tools-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; padding: 0 20px;">
                    <div class="tool-card" onclick="window.location.href='word-frequency.html'" style="
                        background: white; 
                        border-radius: 12px; 
                        padding: 24px; 
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
                        cursor: pointer; 
                        transition: all 0.3s ease;
                        border: 2px solid transparent;
                    "
                    onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#667eea';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.1)'; this.style.borderColor='transparent';">
                        
                        <div class="tool-icon" style="font-size: 2.5rem; text-align: center; margin-bottom: 16px;">
                            📊
                        </div>
                        
                        <h3 style="margin-bottom: 12px; color: #333; font-size: 1.3rem; text-align: center;">
                            词频统计分析
                        </h3>
                        
                        <p style="color: #666; margin-bottom: 20px; line-height: 1.5; text-align: center; min-height: 48px;">
                            全站英文词汇频次统计，帮助发现重点学习词汇，支持词云展示和智能搜索
                        </p>
                        
                        <div class="tool-footer" style="text-align: center;">
                            <button style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                color: white; 
                                border: none; 
                                padding: 10px 24px; 
                                border-radius: 6px; 
                                cursor: pointer; 
                                font-weight: 500;
                                transition: all 0.2s ease;
                                pointer-events: none;
                            ">
                                使用工具 →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    #setActiveLink(id) {
        if (this.state.activeLink) {
            this.state.activeLink.classList.remove(Navigation.CONFIG.CSS.ACTIVE);
        }
        
        const newActiveLink = this.state.linksMap.get(id);
        if (newActiveLink) {
            newActiveLink.classList.add(Navigation.CONFIG.CSS.ACTIVE);
            this.state.activeLink = newActiveLink;
        }
    }

    #getChapterNav(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) return { prevChapterId: null, nextChapterId: null };

        const series = this.navData.find(s => (s.seriesId || s.id) === chapterData.seriesId);
        if (!series) return { prevChapterId: null, nextChapterId: null };
        
        const currentIndex = series.chapters.findIndex(c => c.id === chapterId);
        const prevChapter = series.chapters[currentIndex - 1];
        const nextChapter = series.chapters[currentIndex + 1];

        return {
            prevChapterId: prevChapter?.id || null,
            nextChapterId: nextChapter?.id || null,
        };
    }

    // 🚀 预加载系统
    #startPreloading() {
        if (!this.config.enablePreloading) return;
        
        const preloadCount = 3;
        const chaptersToPreload = Array.from(this.state.chaptersMap.values())
            .filter(chapter => chapter.type !== 'tool')
            .slice(0, preloadCount)
            .map(chapter => chapter.id);
        
        chaptersToPreload.forEach((chapterId, index) => {
            setTimeout(() => {
                this.#preloadChapter(chapterId);
            }, index * 1000);
        });
    }

    async #preloadChapter(chapterId) {
        if (this.cache.has && this.cache.has(chapterId)) return;
        if (this.state.preloadQueue.has(chapterId)) return;
        
        this.state.preloadQueue.add(chapterId);
        
        try {
            const chapterData = this.state.chaptersMap.get(chapterId);
            if (!chapterData || chapterData.type === 'tool') return;
            
            const contentUrl = this.#getContentUrl(chapterData);
            const response = await fetch(contentUrl);
            
            if (response.ok) {
                const content = await response.text();
                if (this.cache.set) {
                    this.cache.set(chapterId, content);
                }
                
                if (this.config.debug) {
                    console.log(`[Navigation] Preloaded: ${chapterId}`);
                }
            }
        } catch (error) {
            if (this.config.debug) {
                console.warn(`[Navigation] Preload failed: ${chapterId}`, error);
            }
        } finally {
            this.state.preloadQueue.delete(chapterId);
        }
    }

    // 🛠️ 工具方法
    #generateId() {
        return 'nav_' + Math.random().toString(36).substr(2, 9);
    }

    #displayExternalLinkMessage(item) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">${item.icon || '🌐'}</div>
                <h2 style="margin-bottom: 16px;">${item.title}</h2>
                <p style="margin-bottom: 24px; opacity: 0.9;">${item.description || '外部链接已在新窗口打开'}</p>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                    <small style="opacity: 0.8;">如果页面没有自动打开，请点击下方链接：</small><br>
                    <a href="${item.externalUrl || item.url}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 500;">
                        ${item.externalUrl || item.url}
                    </a>
                </div>
            </div>
        `;
    }

    #updateTitle(text) {
        document.title = text ? `${text} | ${this.config.siteTitle}` : this.config.siteTitle;
    }

    #displayError(message) {
        this.contentArea.innerHTML = `<p class="error-message" style="text-align: center; padding: 40px; color: #dc3545;">${message}</p>`;
    }

    #dispatchEvent(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    #handleInitializationFailure(error) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #dc3545; margin-bottom: 16px;">导航系统初始化失败</h2>
                <p>遇到了一些问题：${error.message}</p>
                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                    重新加载
                </button>
            </div>
        `;
    }

    // === 公共API方法 ===
    navigateToTool(toolId) {
        const toolData = this.state.chaptersMap.get(toolId);
        if (!toolData || toolData.type !== 'tool') {
            return false;
        }
        
        this.navigateToChapter(toolId);
        return true;
    }

    getToolsList() {
        return Array.from(this.state.chaptersMap.values())
            .filter(chapter => chapter.type === 'tool')
            .map(tool => ({
                id: tool.id,
                title: tool.title,
                description: tool.description,
                url: tool.url,
                seriesId: tool.seriesId,
                category: tool.category
            }));
    }

    async waitForInitialization() {
        return this.initPromise;
    }

    getCacheStats() {
        return this.cache.getStats ? this.cache.getStats() : null;
    }

    getPerformanceStats() {
        return {
            preloadQueue: this.state.preloadQueue.size,
            preloadInProgress: this.state.preloadInProgress,
            domCacheSize: this.domCache.size,
            elementsMapSize: this.elements.size,
            linksMapSize: this.state.linksMap.size,
            chaptersMapSize: this.state.chaptersMap.size,
            customNavigationItems: this.state.customNavigation.flatItemsMap.size,
            maxNavigationDepth: this.state.customNavigation.maxDepth,
            isMobile: this.state.isMobile,
            sidebarOpen: this.state.sidebar.isOpen
        };
    }

    preloadChapters(chapterIds) {
        if (!Array.isArray(chapterIds)) return;
        
        chapterIds.forEach((chapterId, index) => {
            setTimeout(() => {
                this.#preloadChapter(chapterId);
            }, index * 500);
        });
    }

    clearCache() {
        if (this.cache && this.cache.clear) {
            this.cache.clear();
        }
        this.domCache.clear();
        this.state.preloadQueue.clear();
    }

    // 🆕 自定义导航API
    getNavigationStructure() {
        return {
            flatItems: this.state.customNavigation.flatItemsMap,
            levelStructure: this.state.customNavigation.levelStructure,
            maxDepth: this.state.customNavigation.maxDepth
        };
    }

    findNavigationItem(id) {
        return this.state.customNavigation.flatItemsMap.get(id);
    }

    getCurrentNavigationPath() {
        return this.state.sidebar.navigationPath;
    }

    programmaticallyNavigate(itemId) {
        this.#handleNavItemClick(itemId);
    }

    addNavigationItem(item, parentId = null) {
        // 动态添加导航项的功能
        if (parentId) {
            const parent = this.state.customNavigation.flatItemsMap.get(parentId);
            if (parent) {
                parent.children.push(item);
            }
        } else {
            this.navData.push(item);
        }
        
        // 重新解析结构
        this.#parseCustomNavigationStructure();
        
        // 如果当前在主菜单，重新渲染
        if (this.state.sidebar.currentLevel === 1) {
            this.#renderMainNavigation();
        }
    }

    removeNavigationItem(itemId) {
        // 动态移除导航项的功能
        const item = this.state.customNavigation.flatItemsMap.get(itemId);
        if (item) {
            // 从父级移除
            if (item.parentPath.length > 0) {
                const parentId = item.parentPath[item.parentPath.length - 1];
                const parent = this.state.customNavigation.flatItemsMap.get(parentId);
                if (parent) {
                    parent.children = parent.children.filter(child => child.id !== itemId);
                }
            } else {
                // 从根级移除
                this.navData = this.navData.filter(navItem => (navItem.id || navItem.seriesId) !== itemId);
            }
            
            // 重新解析结构
            this.#parseCustomNavigationStructure();
            
            // 重新渲染当前视图
            if (this.state.sidebar.currentLevel === 1) {
                this.#renderMainNavigation();
            }
        }
    }

    updateNavigationItem(itemId, updates) {
        // 动态更新导航项的功能
        const item = this.state.customNavigation.flatItemsMap.get(itemId);
        if (item) {
            Object.assign(item, updates);
            
            // 重新解析结构
            this.#parseCustomNavigationStructure();
            
            // 重新渲染当前视图
            this.#renderMainNavigation();
        }
    }

    destroy() {
        // 清理定时器
        for (const timer of this.state.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.state.debounceTimers.clear();
        
        // 关闭侧边栏
        this.#closeSidebar();
        
        // 恢复原导航
        const originalNav = document.querySelector('[data-backup="true"]');
        if (originalNav) {
            originalNav.style.display = '';
            originalNav.removeAttribute('data-backup');
        }
        
        // 移除侧边栏DOM
        const elementsToRemove = ['container', 'overlay'];
        elementsToRemove.forEach(key => {
            const element = this.state.elements[key];
            if (element && element.parentElement) {
                element.remove();
            }
        });
        
        // 移除汉堡按钮
        const hamburger = this.state.elements.hamburger;
        if (hamburger && hamburger.parentElement) {
            hamburger.remove();
        }
        
        // 移除事件监听器
        document.removeEventListener('click', this.eventHandlers.globalClick);
        window.removeEventListener('resize', this.eventHandlers.windowResize);
        window.removeEventListener('popstate', this.eventHandlers.popState);
        document.removeEventListener('keydown', this.eventHandlers.keydown);
        
        // 清理缓存
        this.clearCache();
        
        // 清理状态
        this.state.linksMap.clear();
        this.state.activeLink = null;
        this.state.chaptersMap.clear();
        this.state.preloadQueue.clear();
        this.state.customNavigation.flatItemsMap.clear();
        this.state.customNavigation.levelStructure.clear();
        
        // 清理body样式
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
        
        if (this.config.debug) {
            console.log('[Navigation] Instance destroyed and cleaned up');
        }
    }
}

// 注册到全局
window.EnglishSite.Navigation = Navigation;

// 🚀 全局便捷函数
window.navigateToWordFrequency = function() {
    if (window.app && window.app.navigation) {
        return window.app.navigation.navigateToTool('word-frequency');
    }
    return false;
};

window.closeSidebarNavigation = function() {
    if (window.app && window.app.navigation && window.app.navigation.state?.sidebar?.isOpen) {
        window.app.navigation.state.sidebar.isOpen = false;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return true;
    }
    return false;
};

// 保留原有函数名为兼容性
window.closeNavigationDropdowns = window.closeSidebarNavigation;

// 🆕 调试和测试函数
window.debugNavigationData = function() {
    if (window.app && window.app.navigation) {
        const nav = window.app.navigation;
        console.log('=== 🔍 自定义导航系统调试信息 ===');
        console.log('📊 导航结构:', nav.getNavigationStructure());
        console.log('📏 性能统计:', nav.getPerformanceStats());
        console.log('🗺️ 当前路径:', nav.getCurrentNavigationPath());
        
        return nav.getNavigationStructure();
    }
    return null;
};

window.testCustomNavigation = function(itemId) {
    if (window.app && window.app.navigation) {
        console.log('🧪 测试导航到:', itemId);
        window.app.navigation.programmaticallyNavigate(itemId);
        return true;
    }
    return false;
};

window.addTestNavigationItem = function() {
    if (window.app && window.app.navigation) {
        const testItem = {
            id: 'test-' + Date.now(),
            title: '🧪 测试项目',
            type: 'custom',
            behavior: 'direct',
            action: 'test-action',
            icon: '🧪',
            description: '这是一个动态添加的测试项目'
        };
        
        window.app.navigation.addNavigationItem(testItem);
        console.log('✅ 测试项目已添加:', testItem);
        return testItem;
    }
    return null;
};