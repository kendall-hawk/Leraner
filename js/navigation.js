// js/navigation.js - 侧边导航系统 v1.0 (Coolors风格)
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
        }
    };

    constructor(navContainer, contentArea, navData, options = {}) {
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.navData = navData;
        
        // 🚀 新增：侧边栏状态管理
        this.sidebarState = {
            isOpen: false,
            expandedSubmenu: null,
            mainPanel: null,
            submenuPanel: null,
            sidebarContainer: null,
            overlay: null
        };
        
        // 🚀 新增：配置加载
        this.sidebarConfig = this.#loadSidebarConfig(options);
        
        // DOM缓存系统
        this.domCache = new Map();
        this.elements = new Map();
        
        // 统一状态管理
        this.state = {
            linksMap: new Map(),
            activeLink: null,
            chaptersMap: new Map(),
            lastResize: 0,
            debounceTimers: new Map(),
            isMobile: window.innerWidth <= 768,
            preloadQueue: new Set(),
            preloadInProgress: false
        };
        
        // 事件处理器
        this.eventHandlers = {
            globalClick: this.#handleGlobalClick.bind(this),
            windowResize: this.#createDebouncer('resize', this.#handleResize.bind(this), 100),
            popState: this.#handlePopState.bind(this),
            keydown: this.#handleKeydown.bind(this)
        };
        
        this.initPromise = this.#initialize(options);
    }

    // 🚀 新增：配置加载
    #loadSidebarConfig(options) {
        const defaultConfig = {
            sidebarWidth: 70,        // 默认70%宽度
            mainPanelRatio: 0.6,     // 主导航60%
            submenuPanelRatio: 0.4,  // 子菜单40%
            minWidth: 320,           // 最小320px
            maxWidth: '90vw',        // 最大90%
            responsiveWidths: {
                desktop: 70,         // 桌面端70%
                tablet: 80,          // 平板端80%
                mobile: 90           // 移动端90%
            }
        };
        
        return { ...defaultConfig, ...(options.sidebar || {}) };
    }

    // DOM缓存获取
    #getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }

    // 防抖器创建
    #createDebouncer(key, func, delay) {
        return (...args) => {
            const timers = this.state.debounceTimers;
            clearTimeout(timers.get(key));
            timers.set(key, setTimeout(() => func.apply(this, args), delay));
        };
    }

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

            // 并行初始化
            await Promise.all([
                this.#loadAndMergeToolsData(),
                this.#preprocessData()
            ]);
            
            // 🚀 新增：创建侧边导航系统
            this.#createSidebarSystem();
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

    async #loadAndMergeToolsData() {
        try {
            const response = await fetch('./data/tools.json');
            
            if (response.ok) {
                const toolsData = await response.json();
                
                if (Array.isArray(toolsData) && toolsData.length > 0) {
                    const validTools = toolsData.filter(tool => tool.id && tool.title);
                    
                    if (validTools.length > 0) {
                        const toolsSeries = {
                            series: "学习工具",
                            seriesId: "tools",
                            description: "实用的英语学习工具集合",
                            chapters: validTools.map(tool => ({
                                ...tool,
                                type: tool.type || 'tool',
                                seriesId: 'tools'
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
        this.navData.forEach(series => {
            if (!series.seriesId || !Array.isArray(series.chapters)) return;
            
            series.chapters.forEach(chapter => {
                if (!chapter.id) return;
                
                const chapterWithSeriesInfo = { 
                    ...chapter, 
                    seriesId: series.seriesId,
                    seriesTitle: series.series
                };
                this.state.chaptersMap.set(chapter.id, chapterWithSeriesInfo);
                totalChapters++;
            });
        });

        if (this.config.debug) {
            console.log(`[Navigation] Preprocessed ${totalChapters} chapters from ${this.navData.length} series`);
        }
    }

    // 🚀 新增：创建侧边导航系统
    #createSidebarSystem() {
        // 清空原导航容器
        this.navContainer.innerHTML = '';
        
        // 创建汉堡菜单按钮
        this.#createHamburgerButton();
        
        // 创建侧边栏容器
        this.#createSidebarContainer();
        
        // 创建背景遮罩
        this.#createOverlay();
        
        // 应用配置
        this.#applySidebarConfig();
    }

    // 🚀 新增：创建汉堡菜单按钮
    #createHamburgerButton() {
        const button = document.createElement('button');
        button.className = 'nav-toggle';
        button.setAttribute('aria-label', '打开导航菜单');
        button.innerHTML = `
            <span class="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
            </span>
        `;
        
        // 插入到页面顶部
        const siteHeader = this.#getElement('.site-header') || this.#createSiteHeader();
        siteHeader.insertBefore(button, siteHeader.firstChild);
        
        // 绑定点击事件
        button.addEventListener('click', () => this.#toggleSidebar());
    }

    // 🚀 新增：创建顶部栏（如果不存在）
    #createSiteHeader() {
        const header = document.createElement('header');
        header.className = 'site-header';
        
        // 创建Logo
        const logo = document.createElement('div');
        logo.className = 'brand-logo';
        logo.textContent = this.config.siteTitle;
        
        header.appendChild(logo);
        document.body.insertBefore(header, document.body.firstChild);
        
        return header;
    }

    // 🚀 新增：创建侧边栏容器
    #createSidebarContainer() {
        const container = document.createElement('div');
        container.className = 'sidebar-container';
        container.dataset.state = 'closed';
        
        // 主导航面板
        const mainPanel = document.createElement('nav');
        mainPanel.className = 'sidebar-main';
        
        // 子菜单面板
        const submenuPanel = document.createElement('div');
        submenuPanel.className = 'sidebar-submenu';
        
        container.appendChild(mainPanel);
        container.appendChild(submenuPanel);
        document.body.appendChild(container);
        
        // 保存引用
        this.sidebarState.sidebarContainer = container;
        this.sidebarState.mainPanel = mainPanel;
        this.sidebarState.submenuPanel = submenuPanel;
        
        // 渲染主导航内容
        this.#renderMainNavigation();
    }

    // 🚀 新增：创建背景遮罩
    #createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        
        this.sidebarState.overlay = overlay;
        
        // 点击遮罩关闭侧边栏
        overlay.addEventListener('click', () => this.#closeSidebar());
    }

    // 🚀 新增：应用侧边栏配置
    #applySidebarConfig() {
        const container = this.sidebarState.sidebarContainer;
        if (!container) return;
        
        const config = this.sidebarConfig;
        
        // 设置CSS变量
        container.style.setProperty('--sidebar-width', `${config.sidebarWidth}%`);
        container.style.setProperty('--sidebar-min-width', `${config.minWidth}px`);
        container.style.setProperty('--sidebar-max-width', config.maxWidth);
        container.style.setProperty('--main-panel-ratio', `${config.mainPanelRatio * 100}%`);
        container.style.setProperty('--submenu-panel-ratio', `${config.submenuPanelRatio * 100}%`);
        
        // 响应式处理
        this.#handleResponsiveWidth();
    }

    // 🚀 新增：响应式宽度处理
    #handleResponsiveWidth() {
        const config = this.sidebarConfig;
        const width = window.innerWidth;
        
        let targetWidth;
        if (width <= 768) {
            targetWidth = config.responsiveWidths.mobile;
        } else if (width <= 1024) {
            targetWidth = config.responsiveWidths.tablet;
        } else {
            targetWidth = config.responsiveWidths.desktop;
        }
        
        const container = this.sidebarState.sidebarContainer;
        if (container) {
            container.style.setProperty('--sidebar-width', `${targetWidth}%`);
        }
    }

    // 🚀 新增：渲染主导航
    #renderMainNavigation() {
        const mainPanel = this.sidebarState.mainPanel;
        if (!mainPanel) return;
        
        // 创建导航内容
        const navContent = document.createElement('div');
        navContent.className = 'sidebar-nav-content';
        
        // 添加Tools项
        navContent.appendChild(this.#createToolsItem());
        
        // 添加分类内容
        this.#renderNavigationCategories(navContent);
        
        mainPanel.appendChild(navContent);
    }

    // 🚀 新增：创建Tools项
    #createToolsItem() {
        const item = document.createElement('div');
        item.className = 'nav-item tools-item level-1 clickable';
        item.dataset.action = 'openTools';
        
        const title = document.createElement('span');
        title.className = 'nav-title';
        title.textContent = 'Tools';
        
        const arrow = document.createElement('span');
        arrow.className = 'nav-arrow';
        arrow.textContent = '>';
        
        item.appendChild(title);
        item.appendChild(arrow);
        
        // 添加分割线
        const separator = document.createElement('div');
        separator.className = 'nav-separator';
        
        const wrapper = document.createElement('div');
        wrapper.appendChild(item);
        wrapper.appendChild(separator);
        
        return wrapper;
    }

    // 🚀 新增：渲染导航分类
    #renderNavigationCategories(container) {
        // 创建文章内容分类
        const articlesCategory = this.#createNavigationCategory('📚 文章内容', 'articles', [
            { title: 'All Articles', type: 'direct', action: 'showAllArticles' },
            ...this.#getSeriesItems(),
            { title: 'News & Updates', type: 'direct', action: 'showNews' }
        ]);
        
        container.appendChild(articlesCategory);
        
        // 创建学习资源分类（如果有的话）
        const resourcesItems = this.#getResourceItems();
        if (resourcesItems.length > 0) {
            const resourcesCategory = this.#createNavigationCategory('🎓 学习资源', 'resources', resourcesItems);
            container.appendChild(resourcesCategory);
        }
    }

    // 🚀 新增：创建导航分类
    #createNavigationCategory(categoryTitle, categoryId, items) {
        const category = document.createElement('div');
        category.className = 'nav-category';
        category.dataset.categoryId = categoryId;
        
        // 分类标题
        const header = document.createElement('div');
        header.className = 'nav-category-header';
        header.textContent = categoryTitle;
        
        category.appendChild(header);
        
        // 分类项目
        items.forEach(item => {
            const navItem = this.#createNavigationItem(item);
            category.appendChild(navItem);
        });
        
        return category;
    }

    // 🚀 新增：创建导航项
    #createNavigationItem(itemData) {
        const item = document.createElement('div');
        
        if (itemData.type === 'direct') {
            // 直接跳转项
            item.className = 'nav-item level-1 clickable';
            item.dataset.action = itemData.action;
            item.textContent = itemData.title;
            
            this.state.linksMap.set(itemData.action, item);
        } else if (itemData.type === 'expandable') {
            // 可展开项
            item.className = 'nav-item level-1 expandable';
            item.dataset.seriesId = itemData.seriesId;
            
            const title = document.createElement('span');
            title.className = 'nav-title';
            title.textContent = itemData.title;
            
            const arrow = document.createElement('span');
            arrow.className = 'expand-arrow';
            arrow.textContent = '>';
            
            item.appendChild(title);
            item.appendChild(arrow);
            
            this.state.linksMap.set(itemData.seriesId, item);
        }
        
        return item;
    }

    // 🚀 新增：获取系列项目
    #getSeriesItems() {
        return this.navData
            .filter(series => series.seriesId && series.seriesId !== 'tools' && 
                    Array.isArray(series.chapters) && series.chapters.length > 0)
            .map(series => ({
                title: series.series,
                type: 'expandable',
                seriesId: series.seriesId,
                chapters: series.chapters
            }));
    }

    // 🚀 新增：获取资源项目
    #getResourceItems() {
        // 这里可以根据实际需求添加学习资源项目
        return [];
    }

    // 🚀 新增：侧边栏开关
    #toggleSidebar() {
        if (this.sidebarState.isOpen) {
            this.#closeSidebar();
        } else {
            this.#openSidebar();
        }
    }

    // 🚀 新增：打开侧边栏
    #openSidebar() {
        const container = this.sidebarState.sidebarContainer;
        const overlay = this.sidebarState.overlay;
        
        if (!container || !overlay) return;
        
        container.dataset.state = 'open';
        container.classList.add('open');
        overlay.classList.add('visible');
        
        this.sidebarState.isOpen = true;
        
        // 添加body锁定（防止背景滚动）
        document.body.style.overflow = 'hidden';
        
        if (this.config.debug) {
            console.log('[Navigation] Sidebar opened');
        }
    }

    // 🚀 新增：关闭侧边栏
    #closeSidebar() {
        const container = this.sidebarState.sidebarContainer;
        const overlay = this.sidebarState.overlay;
        
        if (!container || !overlay) return;
        
        container.dataset.state = 'closed';
        container.classList.remove('open');
        overlay.classList.remove('visible');
        
        // 收起子菜单
        this.#collapseSubmenu();
        
        this.sidebarState.isOpen = false;
        
        // 解除body锁定
        document.body.style.overflow = '';
        
        if (this.config.debug) {
            console.log('[Navigation] Sidebar closed');
        }
    }

    // 🚀 新增：展开子菜单
    #expandSubmenu(seriesData) {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        // 收起当前展开的子菜单
        this.#collapseSubmenu();
        
        // 创建子菜单内容
        this.#renderSubmenu(seriesData);
        
        // 显示子菜单面板
        submenuPanel.classList.add('expanded');
        this.sidebarState.expandedSubmenu = seriesData.seriesId;
        
        if (this.config.debug) {
            console.log('[Navigation] Submenu expanded:', seriesData.seriesId);
        }
    }

    // 🚀 新增：收起子菜单
    #collapseSubmenu() {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        submenuPanel.classList.remove('expanded');
        this.sidebarState.expandedSubmenu = null;
        
        // 清空子菜单内容
        setTimeout(() => {
            if (!this.sidebarState.expandedSubmenu) {
                submenuPanel.innerHTML = '';
            }
        }, 250);
    }

    // 🚀 新增：渲染子菜单
    #renderSubmenu(seriesData) {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        submenuPanel.innerHTML = '';
        
        // 子菜单头部
        const header = document.createElement('div');
        header.className = 'submenu-header';
        
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerHTML = `<span class="back-arrow">‹</span> ${seriesData.title}`;
        backBtn.addEventListener('click', () => this.#collapseSubmenu());
        
        header.appendChild(backBtn);
        
        // 子菜单内容
        const content = document.createElement('div');
        content.className = 'submenu-content';
        
        if (seriesData.chapters && seriesData.chapters.length > 0) {
            seriesData.chapters.forEach(chapter => {
                const item = document.createElement('div');
                item.className = 'nav-item level-2 clickable';
                item.dataset.chapterId = chapter.id;
                item.textContent = chapter.title;
                
                content.appendChild(item);
            });
        }
        
        submenuPanel.appendChild(header);
        submenuPanel.appendChild(content);
    }

    // 🚀 优化：统一事件监听器
    #setupEventListeners() {
        document.addEventListener('click', this.eventHandlers.globalClick);
        window.addEventListener('resize', this.eventHandlers.windowResize);
        window.addEventListener('popstate', this.eventHandlers.popState);
        document.addEventListener('keydown', this.eventHandlers.keydown);
    }

    // 🚀 优化：全局点击处理
    #handleGlobalClick(event) {
        const target = event.target;
        
        // Tools项点击
        const toolsItem = target.closest('.nav-item.tools-item');
        if (toolsItem) {
            event.preventDefault();
            this.#handleToolsClick();
            return;
        }
        
        // 可展开项点击
        const expandableItem = target.closest('.nav-item.level-1.expandable');
        if (expandableItem) {
            event.preventDefault();
            this.#handleExpandableClick(expandableItem);
            return;
        }
        
        // 直接跳转项点击
        const clickableItem = target.closest('.nav-item.clickable');
        if (clickableItem) {
            event.preventDefault();
            this.#handleDirectNavigation(clickableItem);
            return;
        }
        
        // 子菜单项点击
        const submenuItem = target.closest('.nav-item.level-2');
        if (submenuItem) {
            event.preventDefault();
            this.#handleSubmenuItemClick(submenuItem);
            return;
        }
    }

    // 🚀 新增：Tools点击处理
    #handleToolsClick() {
        this.#closeSidebar();
        this.#route({ type: Navigation.CONFIG.ROUTES.TOOLS, id: null });
    }

    // 🚀 新增：可展开项点击处理
    #handleExpandableClick(item) {
        const seriesId = item.dataset.seriesId;
        const seriesData = this.navData.find(s => s.seriesId === seriesId);
        
        if (seriesData) {
            if (this.sidebarState.expandedSubmenu === seriesId) {
                // 如果已展开，则收起
                this.#collapseSubmenu();
            } else {
                // 展开子菜单
                this.#expandSubmenu({
                    seriesId: seriesData.seriesId,
                    title: seriesData.series,
                    chapters: seriesData.chapters
                });
            }
        }
    }

    // 🚀 新增：直接导航处理
    #handleDirectNavigation(item) {
        const action = item.dataset.action;
        this.#closeSidebar();
        
        switch (action) {
            case 'showAllArticles':
                this.#route({ type: Navigation.CONFIG.ROUTES.ALL, id: null });
                break;
            case 'showNews':
                // 处理新闻页面导航
                break;
            default:
                console.warn('[Navigation] Unknown action:', action);
        }
    }

    // 🚀 新增：子菜单项点击处理
    #handleSubmenuItemClick(item) {
        const chapterId = item.dataset.chapterId;
        this.#closeSidebar();
        
        if (chapterId) {
            this.navigateToChapter(chapterId);
        }
    }

    #handleResize() {
        const now = Date.now();
        if (now - this.state.lastResize < 50) return;
        
        this.state.lastResize = now;
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth <= 768;
        
        // 响应式宽度调整
        this.#handleResponsiveWidth();
        
        if (wasMobile !== this.state.isMobile && this.config.debug) {
            console.log('[Navigation] Device type changed:', this.state.isMobile ? 'mobile' : 'desktop');
        }
    }

    #handleKeydown(event) {
        if (event.key === 'Escape' && this.sidebarState.isOpen) {
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

        const defaultSeriesId = this.navData[0]?.seriesId;
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
        const defaultSeriesId = this.navData[0]?.seriesId;
        if (defaultSeriesId) {
            this.#setActiveSeries(defaultSeriesId);
        } else {
            this.#showAllArticles();
        }
    }

    // === 保持原有的公共API方法 ===
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
            
            this.contentArea.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 20px 0;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
                    <h2 style="margin-bottom: 16px;">${title}</h2>
                    <p style="margin-bottom: 24px; opacity: 0.9;">工具页面已在新窗口打开</p>
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                        <small style="opacity: 0.8;">如果页面没有自动打开，请点击下方链接：</small><br>
                        <a href="${url}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 500;">
                            ${url}
                        </a>
                    </div>
                </div>
            `;
        } else {
            window.location.href = url;
        }
        
        this.#updateTitle(title);
        this.#setActiveLink(chapterData.seriesId);
        
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
        const seriesData = this.navData.find(s => s.seriesId === seriesId);
        if (seriesData) {
            this.#updateTitle(`Series: ${seriesData.series || seriesId}`);
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
        // 清除所有激活状态
        this.state.linksMap.forEach(link => {
            link.classList.remove(Navigation.CONFIG.CSS.ACTIVE);
        });
        
        // 设置新的激活状态
        const newActiveLink = this.state.linksMap.get(id);
        if (newActiveLink) {
            newActiveLink.classList.add(Navigation.CONFIG.CSS.ACTIVE);
            this.state.activeLink = newActiveLink;
        }
    }

    #getChapterNav(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) return { prevChapterId: null, nextChapterId: null };

        const series = this.navData.find(s => s.seriesId === chapterData.seriesId);
        if (!series) return { prevChapterId: null, nextChapterId: null };
        
        const currentIndex = series.chapters.findIndex(c => c.id === chapterId);
        const prevChapter = series.chapters[currentIndex - 1];
        const nextChapter = series.chapters[currentIndex + 1];

        return {
            prevChapterId: prevChapter?.id || null,
            nextChapterId: nextChapter?.id || null,
        };
    }

    // 智能预加载系统
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

    // === 保持原有的公共API方法 ===
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
            linksMapSize: this.state.linksMap.size,
            chaptersMapSize: this.state.chaptersMap.size,
            isMobile: this.state.isMobile,
            sidebarOpen: this.sidebarState.isOpen,
            expandedSubmenu: this.sidebarState.expandedSubmenu
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

    destroy() {
        // 清理定时器
        for (const timer of this.state.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.state.debounceTimers.clear();
        
        // 关闭侧边栏
        this.#closeSidebar();
        
        // 移除侧边栏DOM
        if (this.sidebarState.sidebarContainer) {
            this.sidebarState.sidebarContainer.remove();
        }
        if (this.sidebarState.overlay) {
            this.sidebarState.overlay.remove();
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
        
        // 重置侧边栏状态
        this.sidebarState = {
            isOpen: false,
            expandedSubmenu: null,
            mainPanel: null,
            submenuPanel: null,
            sidebarContainer: null,
            overlay: null
        };
        
        // 解除body锁定
        document.body.style.overflow = '';
        
        if (this.config.debug) {
            console.log('[Navigation] Instance destroyed and cleaned up');
        }
    }
}

// 注册到全局
window.EnglishSite.Navigation = Navigation;

// 便捷的全局函数
window.navigateToWordFrequency = function() {
    if (window.app && window.app.navigation) {
        return window.app.navigation.navigateToTool('word-frequency');
    }
    return false;
};

window.closeSidebarNavigation = function() {
    if (window.app && window.app.navigation && window.app.navigation.sidebarState?.isOpen) {
        window.app.navigation.sidebarState.isOpen && window.app.navigation.destroy();
        return true;
    }
    return false;
};