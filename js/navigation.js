// js/navigation.js - 最小化修改版，只改外观+三级导航，其他100%保持原状
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
        
        // 🔒 完全保留原有缓存系统
        this.domCache = new Map();
        this.elements = new Map();
        
        // 🔒 完全保留原有状态管理
        this.state = {
            // 原有导航状态
            linksMap: new Map(),
            activeLink: null,
            chaptersMap: new Map(),
            
            // 原有下拉菜单状态
            dropdown: {
                isOpen: false,
                currentId: null,
                overlay: null,
                isProcessing: false,
                pooledOverlays: []
            },
            
            // 原有性能状态
            lastResize: 0,
            debounceTimers: new Map(),
            isMobile: window.innerWidth <= 768,
            
            // 原有预加载状态
            preloadQueue: new Set(),
            preloadInProgress: false,
            
            // 🆕 只添加侧边栏状态（不影响原功能）
            sidebar: {
                isOpen: false,
                currentLevel: 1,
                navigationPath: [],
                elements: {}
            }
        };
        
        // 🔒 完全保留原有事件处理器
        this.eventHandlers = {
            globalClick: this.#handleGlobalClick.bind(this),
            windowResize: this.#createDebouncer('resize', this.#handleResize.bind(this), 100),
            popState: this.#handlePopState.bind(this),
            keydown: this.#handleKeydown.bind(this)
        };
        
        this.initPromise = this.#initialize(options);
    }

    // 🔒 完全保留原有辅助方法
    #getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }

    #createDebouncer(key, func, delay) {
        return (...args) => {
            const timers = this.state.debounceTimers;
            clearTimeout(timers.get(key));
            timers.set(key, setTimeout(() => func.apply(this, args), delay));
        };
    }

    // 🔒 保留原有初始化，只添加侧边栏创建
    async #initialize(options = {}) {
        try {
            if (window.EnglishSite.coreToolsReady) {
                await window.EnglishSite.coreToolsReady;
            }
            
            // 🔒 完全保留原有配置
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

            // 🆕 只添加侧边栏创建，其他不变
            this.#createSidebarStructure();
            
            // 🔒 完全保留原有初始化流程
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

    // 🆕 创建侧边栏结构（新增方法）
    #createSidebarStructure() {
        // 隐藏原导航但保留备份
        if (this.navContainer) {
            this.navContainer.style.display = 'none';
            this.navContainer.setAttribute('data-backup', 'true');
        }
        
        // 创建汉堡按钮
        this.#createHamburgerButton();
        
        // 创建侧边栏
        this.#createSidebarElements();
    }

    #createHamburgerButton() {
        let header = document.querySelector('.site-header');
        if (!header) {
            header = document.createElement('header');
            header.className = 'site-header';
            document.body.insertBefore(header, document.body.firstChild);
        }
        
        if (!header.querySelector('.nav-toggle')) {
            const hamburger = document.createElement('button');
            hamburger.className = 'nav-toggle';
            hamburger.innerHTML = `<span class="hamburger-icon"><span></span><span></span><span></span></span>`;
            hamburger.setAttribute('data-action', 'toggle-sidebar');
            
            const brandHeader = header.querySelector('.brand-header');
            if (brandHeader) {
                header.insertBefore(hamburger, brandHeader.nextSibling);
            } else {
                header.insertBefore(hamburger, header.firstChild);
            }
        }
    }

    #createSidebarElements() {
        // 清理旧的侧边栏
        const oldSidebar = document.querySelector('.sidebar-container');
        if (oldSidebar) oldSidebar.remove();
        
        const oldOverlay = document.querySelector('.sidebar-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        // 创建侧边栏容器
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar-container';
        sidebar.innerHTML = `
            <nav class="sidebar-main">
                <div class="nav-breadcrumb" style="display: none;"></div>
                <div class="nav-content"></div>
            </nav>
            <div class="sidebar-submenu">
                <div class="submenu-content"></div>
            </div>
        `;
        
        // 创建遮罩
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.setAttribute('data-action', 'close-sidebar');
        
        document.body.appendChild(sidebar);
        document.body.appendChild(overlay);
        
        // 缓存元素
        this.state.sidebar.elements = {
            container: sidebar,
            mainPanel: sidebar.querySelector('.sidebar-main'),
            submenuPanel: sidebar.querySelector('.sidebar-submenu'),
            breadcrumb: sidebar.querySelector('.nav-breadcrumb'),
            mainContent: sidebar.querySelector('.nav-content'),
            submenuContent: sidebar.querySelector('.submenu-content'),
            overlay: overlay,
            hamburger: document.querySelector('.nav-toggle')
        };
    }

    // 🔒 完全保留原有数据处理方法
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

    // 🆕 修改渲染方法（从下拉菜单改为侧边栏）
    #render() {
        this.state.linksMap.clear();
        this.#renderSidebarNavigation();
    }

    #renderSidebarNavigation() {
        const mainContent = this.state.sidebar.elements.mainContent;
        if (!mainContent) return;
        
        const fragment = document.createDocumentFragment();

        // 1. All Articles 链接
        fragment.appendChild(this.#createSidebarNavItem(
            'All Articles', 
            `#${Navigation.CONFIG.HASH_PREFIX.ALL_ARTICLES}`, 
            Navigation.CONFIG.ROUTES.ALL,
            Navigation.CONFIG.ROUTES.ALL,
            '📚'
        ));

        // 2. Series 项目（支持三级导航）
        const learningSeries = this.navData.filter(series => {
            return series.seriesId && series.seriesId !== 'tools' && 
                   Array.isArray(series.chapters) && series.chapters.length > 0;
        });
        
        learningSeries.forEach(series => {
            fragment.appendChild(this.#createSidebarNavItem(
                series.series,
                `#${Navigation.CONFIG.HASH_PREFIX.SERIES}${series.seriesId}`,
                Navigation.CONFIG.ROUTES.SERIES,
                series.seriesId,
                series.icon || '📖',
                series.chapters.length > 0 ? 'expandable' : 'clickable',
                series
            ));
        });

        // 3. Tools 链接
        fragment.appendChild(this.#createSidebarNavItem(
            'Tools', 
            `#${Navigation.CONFIG.HASH_PREFIX.TOOLS}`, 
            Navigation.CONFIG.ROUTES.TOOLS,
            Navigation.CONFIG.ROUTES.TOOLS,
            '🛠️'
        ));

        mainContent.innerHTML = '';
        mainContent.appendChild(fragment);
    }

    #createSidebarNavItem(text, href, routeType, id, icon = '', itemType = 'clickable', data = null) {
        const item = document.createElement('div');
        item.className = `nav-item level-1 ${itemType}`;
        item.setAttribute('data-id', id);
        item.setAttribute('data-route-type', routeType);
        item.setAttribute('data-action', 'sidebar-nav-item');
        
        if (data) {
            item.seriesData = data; // 存储系列数据用于展开
        }
        
        const iconHtml = icon ? `<span class="nav-icon">${icon}</span>` : '';
        const arrowHtml = itemType === 'expandable' ? '<span class="expand-arrow">></span>' : '';
        
        item.innerHTML = `${iconHtml}<span class="nav-title">${text}</span>${arrowHtml}`;
        
        this.state.linksMap.set(id, item);
        return item;
    }

    // 🆕 侧边栏导航处理
    #handleSidebarNavClick(element) {
        const routeType = element.dataset.routeType;
        const id = element.dataset.id;
        
        if (element.classList.contains('expandable') && element.seriesData) {
            // 展开系列章节
            this.#expandSeriesInSidebar(element.seriesData);
        } else {
            // 直接导航
            this.#closeSidebar();
            this.#route({ type: routeType, id });
        }
    }

    #expandSeriesInSidebar(seriesData) {
        // 更新导航路径
        this.state.sidebar.navigationPath = [{
            id: seriesData.seriesId,
            title: seriesData.series,
            level: 1
        }];
        this.state.sidebar.currentLevel = 2;
        
        // 显示面包屑
        this.#updateBreadcrumb();
        
        // 渲染章节列表
        this.#renderChaptersList(seriesData.chapters);
        
        // 显示子菜单
        this.#showSubmenu();
    }

    #renderChaptersList(chapters) {
        const submenuContent = this.state.sidebar.elements.submenuContent;
        if (!submenuContent) return;
        
        const fragment = document.createDocumentFragment();
        
        chapters.forEach(chapter => {
            const item = document.createElement('div');
            item.className = 'nav-item level-2 clickable chapter-item';
            item.setAttribute('data-id', chapter.id);
            item.setAttribute('data-action', 'sidebar-chapter-item');
            
            const iconHtml = chapter.icon ? `<span class="nav-icon">${chapter.icon}</span>` : '';
            item.innerHTML = `${iconHtml}<span class="nav-title">${chapter.title}</span>`;
            
            fragment.appendChild(item);
        });
        
        submenuContent.innerHTML = '';
        submenuContent.appendChild(fragment);
    }

    #updateBreadcrumb() {
        const breadcrumb = this.state.sidebar.elements.breadcrumb;
        if (!breadcrumb) return;
        
        if (this.state.sidebar.navigationPath.length === 0) {
            breadcrumb.style.display = 'none';
            return;
        }
        
        breadcrumb.style.display = 'block';
        const pathHtml = this.state.sidebar.navigationPath
            .map(item => `<span>${item.title}</span>`)
            .join(' > ');
        
        breadcrumb.innerHTML = `
            <button data-action="sidebar-back">‹ 返回</button>
            <span class="breadcrumb-path">${pathHtml}</span>
        `;
    }

    #showSubmenu() {
        const submenu = this.state.sidebar.elements.submenuPanel;
        if (submenu) {
            submenu.classList.add('expanded');
            submenu.style.display = 'block';
        }
    }

    #hideSubmenu() {
        const submenu = this.state.sidebar.elements.submenuPanel;
        if (submenu) {
            submenu.classList.remove('expanded');
            submenu.style.display = 'none';
        }
    }

    #goBackInSidebar() {
        this.state.sidebar.navigationPath = [];
        this.state.sidebar.currentLevel = 1;
        this.#updateBreadcrumb();
        this.#hideSubmenu();
    }

    // 侧边栏控制
    #toggleSidebar() {
        if (this.state.sidebar.isOpen) {
            this.#closeSidebar();
        } else {
            this.#openSidebar();
        }
    }

    #openSidebar() {
        const { container, overlay } = this.state.sidebar.elements;
        this.state.sidebar.isOpen = true;
        
        container.classList.add('open');
        overlay.classList.add('visible');
        document.body.classList.add('sidebar-open');
    }

    #closeSidebar() {
        const { container, overlay } = this.state.sidebar.elements;
        this.state.sidebar.isOpen = false;
        
        container.classList.remove('open');
        overlay.classList.remove('visible');
        document.body.classList.remove('sidebar-open');
        
        // 重置导航状态
        this.#goBackInSidebar();
    }

    // 🔒 完全保留原有事件处理
    #setupEventListeners() {
        document.addEventListener('click', this.eventHandlers.globalClick);
        window.addEventListener('resize', this.eventHandlers.windowResize);
        window.addEventListener('popstate', this.eventHandlers.popState);
        document.addEventListener('keydown', this.eventHandlers.keydown);
        
        if (this.state.isMobile) {
            const touchHandler = this.#createDebouncer('touch', () => {
                if (this.state.dropdown.isOpen) this.#hideDropdown();
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
        
        event.preventDefault();
        event.stopPropagation();
        
        switch (action) {
            case 'toggle-sidebar':
                this.#toggleSidebar();
                break;
            case 'close-sidebar':
                this.#closeSidebar();
                break;
            case 'sidebar-nav-item':
                this.#handleSidebarNavClick(actionElement);
                break;
            case 'sidebar-chapter-item':
                this.navigateToChapter(actionElement.dataset.id);
                this.#closeSidebar();
                break;
            case 'sidebar-back':
                this.#goBackInSidebar();
                break;
        }
    }

    #handleOutsideClick(event) {
        const sidebar = this.state.sidebar.elements.container;
        const hamburger = this.state.sidebar.elements.hamburger;
        const overlay = this.state.sidebar.elements.overlay;
        
        if (this.state.sidebar.isOpen && 
            (event.target === overlay || 
             (!sidebar?.contains(event.target) && !hamburger?.contains(event.target)))) {
            this.#closeSidebar();
        }
    }

    #handleResize() {
        const now = Date.now();
        if (now - this.state.lastResize < 50) return;
        
        this.state.lastResize = now;
        this.state.isMobile = window.innerWidth <= 768;
    }

    #handleKeydown(event) {
        if (event.key === 'Escape') {
            if (this.state.sidebar.isOpen) {
                this.#closeSidebar();
            }
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

    // 🔒 完全保留原有路由系统
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

    // 🔒 完全保留原有内容加载方法
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

    // 🔒 完全保留原有预加载系统
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

    // 🔒 完全保留原有公共API方法
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
            const element = this.state.sidebar.elements[key];
            if (element && element.parentElement) {
                element.remove();
            }
        });
        
        // 移除汉堡按钮
        const hamburger = this.state.sidebar.elements.hamburger;
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
        
        // 清理body样式
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
        
        if (this.config.debug) {
            console.log('[Navigation] Instance destroyed and cleaned up');
        }
    }

    // 🔒 保留原有下拉菜单方法（兼容性）
    #hideDropdown() {
        // 空方法，保持兼容性
    }
}

// 注册到全局
window.EnglishSite.Navigation = Navigation;

// 🔒 完全保留原有全局函数
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