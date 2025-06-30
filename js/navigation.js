// js/navigation.js - 侧边导航系统 v2.1 (问题修复版)
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

    // 🚀 性能优化：对象池化
    static POOLS = {
        navResult: { prevChapterId: null, nextChapterId: null },
        tempElement: null,
        eventData: {}
    };

    // 🚀 性能优化：HTML模板缓存
    static TEMPLATES = {
        hamburgerIcon: `<span class="hamburger-icon"><span></span><span></span><span></span></span>`,
        backArrow: `<span class="back-arrow">‹</span>`,
        expandArrow: `<span class="expand-arrow">></span>`,
        navArrow: `<span class="nav-arrow">></span>`
    };

    constructor(navContainer, contentArea, navData, options = {}) {
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.navData = navData;
        
        // 侧边栏状态管理
        this.sidebarState = {
            isOpen: false,
            expandedSubmenu: null,
            mainPanel: null,
            submenuPanel: null,
            sidebarContainer: null,
            overlay: null
        };
        
        this.sidebarConfig = this.#loadSidebarConfig(options);
        
        // 🚀 性能优化：统一状态管理和缓存
        this.cache = {
            dom: new Map(),
            elements: new Map(),
            fragments: new Map()
        };
        
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
        
        // 🚀 性能优化：事件处理器统一管理
        this.eventHandlers = this.#createEventHandlers();
        this.actionHandlers = this.#createActionHandlers();
        
        this.initPromise = this.#initialize(options);
    }

    #loadSidebarConfig(options) {
        return {
            sidebarWidth: 70,
            mainPanelRatio: 0.6,
            submenuPanelRatio: 0.4,
            minWidth: 320,
            maxWidth: '90vw',
            responsiveWidths: { desktop: 70, tablet: 80, mobile: 90 },
            ...(options.sidebar || {})
        };
    }

    // 🚀 性能优化：DOM缓存策略升级
    #getElement(selector) {
        let element = this.cache.dom.get(selector);
        if (!element) {
            element = document.querySelector(selector);
            if (element) this.cache.dom.set(selector, element);
        }
        return element;
    }

    // 🚀 性能优化：创建高效的事件处理器
    #createEventHandlers() {
        const debounce = (key, func, delay) => (...args) => {
            clearTimeout(this.state.debounceTimers.get(key));
            this.state.debounceTimers.set(key, setTimeout(() => func.apply(this, args), delay));
        };

        return {
            globalClick: this.#handleGlobalClick.bind(this),
            windowResize: debounce('resize', this.#handleResize.bind(this), 100),
            popState: this.#handlePopState.bind(this),
            keydown: this.#handleKeydown.bind(this)
        };
    }

    // 🚀 性能优化：动作处理器映射
    #createActionHandlers() {
        return {
            openTools: () => this.#handleToolsClick(),
            showAllArticles: () => this.#route({ type: Navigation.CONFIG.ROUTES.ALL, id: null }),
            showNews: () => this.#handleNewsClick(),
            toggleSubmenu: (e) => this.#handleExpandableClick(e.target.closest('.nav-item')),
            collapseSubmenu: () => this.#collapseSubmenu(),
            navigateToChapter: (e) => this.#handleSubmenuItemClick(e.target.closest('.nav-item'))
        };
    }

    async #initialize(options = {}) {
        try {
            if (window.EnglishSite.coreToolsReady) {
                await window.EnglishSite.coreToolsReady;
            }
            
            this.config = this.#createConfig(options);
            this.cache.manager = this.#createCacheManager();

            if (!this.navContainer || !this.contentArea || !this.navData) {
                throw new Error('Navigation: Missing required arguments');
            }

            await Promise.all([
                this.#loadAndMergeToolsData(),
                this.#preprocessData()
            ]);
            
            // 🚀 修复：确保正确的初始化顺序
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

    // 🚀 代码精简：配置创建统一
    #createConfig(options) {
        const defaultConfig = {
            siteTitle: '互动学习平台',
            cacheMaxSize: 50,
            cacheTTL: 300000,
            enablePreloading: true,
            debug: false,
            ...options
        };

        return window.EnglishSite.ConfigManager?.createModuleConfig('navigation', defaultConfig) || defaultConfig;
    }

    // 🚀 代码精简：缓存管理器创建统一
    #createCacheManager() {
        return window.EnglishSite.CacheManager?.createCache('navigation', {
            maxSize: this.config.cacheMaxSize,
            ttl: this.config.cacheTTL,
            strategy: 'lru'
        }) || new Map();
    }

    async #loadAndMergeToolsData() {
        try {
            const response = await fetch('./data/tools.json');
            
            if (response.ok) {
                const toolsData = await response.json();
                const validTools = toolsData?.filter?.(tool => tool.id && tool.title) || [];
                
                if (validTools.length > 0) {
                    this.navData.push({
                        series: "学习工具",
                        seriesId: "tools",
                        description: "实用的英语学习工具集合",
                        chapters: validTools.map(tool => ({
                            ...tool,
                            type: tool.type || 'tool',
                            seriesId: 'tools'
                        }))
                    });
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
        for (const series of this.navData) {
            if (!series.seriesId || !Array.isArray(series.chapters)) continue;
            
            for (const chapter of series.chapters) {
                if (!chapter.id) continue;
                
                this.state.chaptersMap.set(chapter.id, { 
                    ...chapter, 
                    seriesId: series.seriesId,
                    seriesTitle: series.series
                });
                totalChapters++;
            }
        }

        if (this.config.debug) {
            console.log(`[Navigation] Preprocessed ${totalChapters} chapters from ${this.navData.length} series`);
        }
    }

    // 🚀 修复：侧边栏系统创建优化
    #createSidebarSystem() {
        // 🚀 修复1：保留原导航系统，只是隐藏
        this.#preserveOriginalNavigation();
        
        // 批量创建所有侧边栏元素
        const fragment = document.createDocumentFragment();
        
        // 创建汉堡菜单按钮
        const hamburgerBtn = this.#createOptimizedHamburgerButton();
        
        // 创建侧边栏容器
        const { sidebarContainer, overlay } = this.#createOptimizedSidebarContainer();
        
        // 批量添加到DOM
        const siteHeader = this.#getElement('.site-header') || this.#createSiteHeader();
        siteHeader.insertBefore(hamburgerBtn, siteHeader.firstChild);
        
        fragment.appendChild(sidebarContainer);
        fragment.appendChild(overlay);
        document.body.appendChild(fragment);
        
        this.#applySidebarConfig();
        
        if (this.config.debug) {
            console.log('[Navigation] Sidebar system created successfully');
        }
    }

    // 🚀 修复：保留原导航系统
    #preserveOriginalNavigation() {
        const originalNav = this.navContainer;
        if (originalNav) {
            // 隐藏但保留原导航
            originalNav.style.display = 'none';
            originalNav.setAttribute('data-sidebar-fallback', 'true');
            
            if (this.config.debug) {
                console.log('[Navigation] Original navigation preserved as fallback');
            }
        }
    }

    // 🚀 性能优化：优化的汉堡菜单按钮创建
    #createOptimizedHamburgerButton() {
        if (!Navigation.POOLS.tempElement) {
            Navigation.POOLS.tempElement = document.createElement('div');
        }
        
        const temp = Navigation.POOLS.tempElement;
        temp.innerHTML = `<button class="nav-toggle" aria-label="打开导航菜单">${Navigation.TEMPLATES.hamburgerIcon}</button>`;
        const button = temp.firstChild;
        
        // 使用事件委托而不是直接绑定
        button.dataset.action = 'toggleSidebar';
        
        if (this.config.debug) {
            console.log('[Navigation] Hamburger button created');
        }
        
        return button;
    }

    // 🚀 修复：优化的侧边栏容器创建
    #createOptimizedSidebarContainer() {
        const container = document.createElement('div');
        container.className = 'sidebar-container';
        container.dataset.state = 'closed';
        
        // 使用innerHTML批量创建子元素
        container.innerHTML = `
            <nav class="sidebar-main"></nav>
            <div class="sidebar-submenu"></div>
        `;
        
        // 🚀 修复2：overlay事件处理改进
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.dataset.action = 'closeSidebar';
        
        // 🚀 修复：添加额外的点击处理确保可靠性
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.#closeSidebar();
            if (this.config.debug) {
                console.log('[Navigation] Overlay clicked - closing sidebar');
            }
        });
        
        // 保存引用
        this.sidebarState.sidebarContainer = container;
        this.sidebarState.mainPanel = container.firstElementChild;
        this.sidebarState.submenuPanel = container.lastElementChild;
        this.sidebarState.overlay = overlay;
        
        this.#renderMainNavigation();
        
        if (this.config.debug) {
            console.log('[Navigation] Sidebar container created');
        }
        
        return { sidebarContainer: container, overlay };
    }

    #createSiteHeader() {
        const header = document.createElement('header');
        header.className = 'site-header';
        header.innerHTML = `<div class="brand-logo">${this.config.siteTitle}</div>`;
        document.body.insertBefore(header, document.body.firstChild);
        
        if (this.config.debug) {
            console.log('[Navigation] Site header created');
        }
        
        return header;
    }

    // 🚀 修复：侧边栏配置应用
    #applySidebarConfig() {
        const container = this.sidebarState.sidebarContainer;
        if (!container) return;
        
        const config = this.sidebarConfig;
        const style = container.style;
        
        // 🚀 修复3：CSS变量设置优化，避免右侧白边
        Object.assign(style, {
            '--sidebar-width': `${config.sidebarWidth}%`,
            '--sidebar-min-width': `${config.minWidth}px`,
            '--sidebar-max-width': config.maxWidth,
            '--main-panel-ratio': `${config.mainPanelRatio * 100}%`,
            '--submenu-panel-ratio': `${config.submenuPanelRatio * 100}%`
        });
        
        // 🚀 修复：确保容器不超出视口
        container.style.maxWidth = '100vw';
        container.style.boxSizing = 'border-box';
        
        this.#handleResponsiveWidth();
        
        if (this.config.debug) {
            console.log('[Navigation] Sidebar config applied');
        }
    }

    #handleResponsiveWidth() {
        const config = this.sidebarConfig;
        const width = window.innerWidth;
        
        const targetWidth = width <= 768 ? config.responsiveWidths.mobile :
                           width <= 1024 ? config.responsiveWidths.tablet :
                           config.responsiveWidths.desktop;
        
        const container = this.sidebarState.sidebarContainer;
        if (container) {
            container.style.setProperty('--sidebar-width', `${targetWidth}%`);
            
            // 🚀 修复：确保不超出视口
            const actualWidth = Math.min(
                (window.innerWidth * targetWidth) / 100,
                window.innerWidth - 20
            );
            container.style.width = `${actualWidth}px`;
        }
    }

    // 🚀 性能优化：主导航渲染优化
    #renderMainNavigation() {
        const mainPanel = this.sidebarState.mainPanel;
        if (!mainPanel) return;
        
        // 使用文档片段提高性能
        const fragment = document.createDocumentFragment();
        const navContent = document.createElement('div');
        navContent.className = 'sidebar-nav-content';
        
        // Tools项
        navContent.appendChild(this.#createToolsItem());
        
        // 分类内容
        this.#renderNavigationCategories(navContent);
        
        fragment.appendChild(navContent);
        mainPanel.appendChild(fragment);
        
        if (this.config.debug) {
            console.log('[Navigation] Main navigation rendered');
        }
    }

    #createToolsItem() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="nav-item tools-item level-1 clickable" data-action="openTools">
                <span class="nav-title">Tools</span>
                ${Navigation.TEMPLATES.navArrow}
            </div>
            <div class="nav-separator"></div>
        `;
        return wrapper;
    }

    // 🚀 代码精简：导航分类渲染优化
    #renderNavigationCategories(container) {
        const categories = [
            {
                title: '📚 文章内容',
                id: 'articles',
                items: [
                    { title: 'All Articles', type: 'direct', action: 'showAllArticles' },
                    ...this.#getSeriesItems(),
                    { title: 'News & Updates', type: 'direct', action: 'showNews' }
                ]
            }
        ];
        
        const resourcesItems = this.#getResourceItems();
        if (resourcesItems.length > 0) {
            categories.push({
                title: '🎓 学习资源',
                id: 'resources',
                items: resourcesItems
            });
        }
        
        categories.forEach(category => {
            container.appendChild(this.#createNavigationCategory(category.title, category.id, category.items));
        });
    }

    // 🚀 性能优化：导航分类创建优化
    #createNavigationCategory(categoryTitle, categoryId, items) {
        const category = document.createElement('div');
        category.className = 'nav-category';
        category.dataset.categoryId = categoryId;
        
        // 批量创建HTML
        const itemsHTML = items.map(item => this.#getNavigationItemHTML(item)).join('');
        category.innerHTML = `
            <div class="nav-category-header">${categoryTitle}</div>
            ${itemsHTML}
        `;
        
        // 批量注册链接映射
        items.forEach(item => {
            if (item.type === 'expandable') {
                const element = category.querySelector(`[data-series-id="${item.seriesId}"]`);
                if (element) this.state.linksMap.set(item.seriesId, element);
            } else if (item.action) {
                const element = category.querySelector(`[data-action="${item.action}"]`);
                if (element) this.state.linksMap.set(item.action, element);
            }
        });
        
        return category;
    }

    // 🚀 性能优化：导航项HTML生成
    #getNavigationItemHTML(itemData) {
        if (itemData.type === 'direct') {
            return `<div class="nav-item level-1 clickable" data-action="${itemData.action}">${itemData.title}</div>`;
        } else if (itemData.type === 'expandable') {
            return `
                <div class="nav-item level-1 expandable" data-series-id="${itemData.seriesId}" data-action="toggleSubmenu">
                    <span class="nav-title">${itemData.title}</span>
                    ${Navigation.TEMPLATES.expandArrow}
                </div>
            `;
        }
        return '';
    }

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

    #getResourceItems() {
        return [];
    }

    // 🚀 修复：侧边栏操作优化
    #toggleSidebar() {
        if (this.config.debug) {
            console.log('[Navigation] Toggle sidebar called, current state:', this.sidebarState.isOpen);
        }
        
        this.sidebarState.isOpen ? this.#closeSidebar() : this.#openSidebar();
    }

    #openSidebar() {
        const { sidebarContainer, overlay } = this.sidebarState;
        if (!sidebarContainer || !overlay) {
            if (this.config.debug) {
                console.warn('[Navigation] Cannot open sidebar: missing elements');
            }
            return;
        }
        
        // 🚀 修复：批量DOM操作 + 强制重绘
        requestAnimationFrame(() => {
            sidebarContainer.dataset.state = 'open';
            sidebarContainer.classList.add('open');
            overlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
            
            this.sidebarState.isOpen = true;
            
            if (this.config.debug) {
                console.log('[Navigation] Sidebar opened successfully');
            }
        });
    }

    #closeSidebar() {
        const { sidebarContainer, overlay } = this.sidebarState;
        if (!sidebarContainer || !overlay) {
            if (this.config.debug) {
                console.warn('[Navigation] Cannot close sidebar: missing elements');
            }
            return;
        }
        
        // 🚀 修复：批量DOM操作 + 状态重置
        requestAnimationFrame(() => {
            sidebarContainer.dataset.state = 'closed';
            sidebarContainer.classList.remove('open');
            overlay.classList.remove('visible');
            document.body.style.overflow = '';
            
            this.#collapseSubmenu();
            this.sidebarState.isOpen = false;
            
            if (this.config.debug) {
                console.log('[Navigation] Sidebar closed successfully');
            }
        });
    }

    // 🚀 性能优化：子菜单操作优化
    #expandSubmenu(seriesData) {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        this.#collapseSubmenu();
        this.#renderSubmenu(seriesData);
        
        requestAnimationFrame(() => {
            submenuPanel.classList.add('expanded');
            this.sidebarState.expandedSubmenu = seriesData.seriesId;
            
            if (this.config.debug) {
                console.log('[Navigation] Submenu expanded:', seriesData.seriesId);
            }
        });
    }

    #collapseSubmenu() {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        submenuPanel.classList.remove('expanded');
        this.sidebarState.expandedSubmenu = null;
        
        setTimeout(() => {
            if (!this.sidebarState.expandedSubmenu) {
                submenuPanel.innerHTML = '';
            }
        }, 250);
    }

    // 🚀 性能优化：子菜单渲染优化
    #renderSubmenu(seriesData) {
        const submenuPanel = this.sidebarState.submenuPanel;
        if (!submenuPanel) return;
        
        const chaptersHTML = seriesData.chapters?.map(chapter => 
            `<div class="nav-item level-2 clickable" data-chapter-id="${chapter.id}" data-action="navigateToChapter">${chapter.title}</div>`
        ).join('') || '';
        
        submenuPanel.innerHTML = `
            <div class="submenu-header">
                <button class="back-btn" data-action="collapseSubmenu">
                    ${Navigation.TEMPLATES.backArrow} ${seriesData.title}
                </button>
            </div>
            <div class="submenu-content">${chaptersHTML}</div>
        `;
    }

    // 🚀 修复：事件监听器设置优化
    #setupEventListeners() {
        // 使用事件委托统一处理所有点击事件
        document.addEventListener('click', this.eventHandlers.globalClick, { passive: false });
        window.addEventListener('resize', this.eventHandlers.windowResize, { passive: true });
        window.addEventListener('popstate', this.eventHandlers.popState, { passive: true });
        document.addEventListener('keydown', this.eventHandlers.keydown, { passive: false });
        
        if (this.config.debug) {
            console.log('[Navigation] Event listeners setup completed');
        }
    }

    // 🚀 修复：全局点击处理优化
    #handleGlobalClick(event) {
        const target = event.target;
        
        if (this.config.debug) {
            console.log('[Navigation] Global click detected:', target);
        }
        
        // 🚀 修复：优先处理overlay点击
        if (target.matches('.sidebar-overlay') || target.closest('.sidebar-overlay')) {
            event.preventDefault();
            event.stopPropagation();
            this.#closeSidebar();
            if (this.config.debug) {
                console.log('[Navigation] Overlay click handled');
            }
            return;
        }
        
        const actionElement = target.closest('[data-action]');
        
        if (actionElement) {
            event.preventDefault();
            const action = actionElement.dataset.action;
            
            if (this.config.debug) {
                console.log('[Navigation] Action element clicked:', action);
            }
            
            // 特殊处理toggleSidebar（需要直接调用）
            if (action === 'toggleSidebar') {
                this.#toggleSidebar();
                return;
            }
            
            // 特殊处理closeSidebar（点击overlay）
            if (action === 'closeSidebar') {
                this.#closeSidebar();
                return;
            }
            
            // 其他动作通过actionHandlers处理
            if (this.actionHandlers[action]) {
                this.actionHandlers[action](event);
                return;
            }
        }
        
        // 处理可展开项点击
        const expandableItem = target.closest('.nav-item.level-1.expandable');
        if (expandableItem) {
            event.preventDefault();
            this.#handleExpandableClick(expandableItem);
            return;
        }
        
        // 处理子菜单项点击
        const submenuItem = target.closest('.nav-item.level-2');
        if (submenuItem) {
            event.preventDefault();
            this.#handleSubmenuItemClick(submenuItem);
            return;
        }
    }

    #handleToolsClick() {
        this.#closeSidebar();
        this.#route({ type: Navigation.CONFIG.ROUTES.TOOLS, id: null });
    }

    #handleNewsClick() {
        // 处理新闻页面导航
        this.#closeSidebar();
    }

    #handleExpandableClick(item) {
        const seriesId = item.dataset.seriesId;
        const seriesData = this.navData.find(s => s.seriesId === seriesId);
        
        if (seriesData) {
            if (this.sidebarState.expandedSubmenu === seriesId) {
                this.#collapseSubmenu();
            } else {
                this.#expandSubmenu({
                    seriesId: seriesData.seriesId,
                    title: seriesData.series,
                    chapters: seriesData.chapters
                });
            }
        }
    }

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
            
            let content = this.cache.manager.get ? this.cache.manager.get(chapterId) : null;
            
            if (!content) {
                const contentUrl = this.#getContentUrl(chapterData);
                const response = await fetch(contentUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                content = await response.text();
                
                if (this.cache.manager.set) {
                    this.cache.manager.set(chapterId, content);
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
            return chapterData.url.startsWith('http') ? chapterData.url : chapterData.url;
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

    // 🚀 性能优化：章节导航获取优化（对象池化）
    #getChapterNav(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) {
            const result = Navigation.POOLS.navResult;
            result.prevChapterId = null;
            result.nextChapterId = null;
            return result;
        }

        const series = this.navData.find(s => s.seriesId === chapterData.seriesId);
        if (!series) {
            const result = Navigation.POOLS.navResult;
            result.prevChapterId = null;
            result.nextChapterId = null;
            return result;
        }
        
        const currentIndex = series.chapters.findIndex(c => c.id === chapterId);
        const prevChapter = series.chapters[currentIndex - 1];
        const nextChapter = series.chapters[currentIndex + 1];

        const result = Navigation.POOLS.navResult;
        result.prevChapterId = prevChapter?.id || null;
        result.nextChapterId = nextChapter?.id || null;
        return result;
    }

    // 🚀 性能优化：智能预加载系统优化
    #startPreloading() {
        if (!this.config.enablePreloading) return;
        
        const preloadCount = 3;
        const chaptersToPreload = [];
        
        for (const [chapterId, chapter] of this.state.chaptersMap) {
            if (chapter.type !== 'tool' && chaptersToPreload.length < preloadCount) {
                chaptersToPreload.push(chapterId);
            }
        }
        
        chaptersToPreload.forEach((chapterId, index) => {
            setTimeout(() => this.#preloadChapter(chapterId), index * 1000);
        });
    }

    async #preloadChapter(chapterId) {
        if (this.cache.manager.has && this.cache.manager.has(chapterId)) return;
        if (this.state.preloadQueue.has(chapterId)) return;
        
        this.state.preloadQueue.add(chapterId);
        
        try {
            const chapterData = this.state.chaptersMap.get(chapterId);
            if (!chapterData || chapterData.type === 'tool') return;
            
            const contentUrl = this.#getContentUrl(chapterData);
            const response = await fetch(contentUrl);
            
            if (response.ok) {
                const content = await response.text();
                if (this.cache.manager.set) {
                    this.cache.manager.set(chapterId, content);
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

    // 🚀 性能优化：事件分发优化（对象池化）
    #dispatchEvent(eventName, detail = {}) {
        // 复用事件数据对象
        const eventData = Navigation.POOLS.eventData;
        Object.keys(eventData).forEach(key => delete eventData[key]);
        Object.assign(eventData, detail);
        
        document.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
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
        const tools = [];
        for (const [, chapter] of this.state.chaptersMap) {
            if (chapter.type === 'tool') {
                tools.push({
                    id: chapter.id,
                    title: chapter.title,
                    description: chapter.description,
                    url: chapter.url,
                    seriesId: chapter.seriesId,
                    category: chapter.category
                });
            }
        }
        return tools;
    }

    async waitForInitialization() {
        return this.initPromise;
    }

    getCacheStats() {
        return this.cache.manager.getStats ? this.cache.manager.getStats() : null;
    }

    getPerformanceStats() {
        return {
            preloadQueue: this.state.preloadQueue.size,
            preloadInProgress: this.state.preloadInProgress,
            domCacheSize: this.cache.dom.size,
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
            setTimeout(() => this.#preloadChapter(chapterId), index * 500);
        });
    }

    clearCache() {
        if (this.cache.manager && this.cache.manager.clear) {
            this.cache.manager.clear();
        }
        this.cache.dom.clear();
        this.cache.elements.clear();
        this.cache.fragments.clear();
        this.state.preloadQueue.clear();
    }

    // 🚀 修复：完整的资源清理
    destroy() {
        // 清理定时器
        for (const timer of this.state.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.state.debounceTimers.clear();
        
        // 关闭侧边栏
        this.#closeSidebar();
        
        // 🚀 修复：恢复原导航
        this.#restoreOriginalNavigation();
        
        // 移除DOM元素
        if (this.sidebarState.sidebarContainer) {
            this.sidebarState.sidebarContainer.remove();
        }
        if (this.sidebarState.overlay) {
            this.sidebarState.overlay.remove();
        }
        
        // 移除汉堡菜单按钮
        const toggleBtn = document.querySelector('.nav-toggle');
        if (toggleBtn) {
            toggleBtn.remove();
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

    // 🚀 修复：恢复原导航系统
    #restoreOriginalNavigation() {
        const originalNav = document.querySelector('[data-sidebar-fallback="true"]');
        if (originalNav) {
            originalNav.style.display = '';
            originalNav.removeAttribute('data-sidebar-fallback');
            
            if (this.config.debug) {
                console.log('[Navigation] Original navigation restored');
            }
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
        // 模拟点击overlay来关闭侧边栏
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.click();
            return true;
        }
    }
    return false;
};