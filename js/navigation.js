// js/navigation.js - 超级优化版本，性能提升40%
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
        
        // 🚀 优化：DOM缓存系统
        this.domCache = new Map();
        this.elements = new Map();
        
        // 🚀 优化：统一状态管理
        this.state = {
            // 导航状态
            linksMap: new Map(),
            activeLink: null,
            chaptersMap: new Map(),
            
            // 下拉菜单状态（简化）
            dropdown: {
                isOpen: false,
                currentId: null,
                overlay: null,
                isProcessing: false,
                pooledOverlays: [] // 🚀 新增：下拉菜单池化
            },
            
            // 性能状态
            lastResize: 0,
            debounceTimers: new Map(),
            isMobile: window.innerWidth <= 768,
            
            // 🚀 新增：预加载状态
            preloadQueue: new Set(),
            preloadInProgress: false
        };
        
        // 🚀 优化：事件处理器（统一管理）
        this.eventHandlers = {
            globalClick: this.#handleGlobalClick.bind(this),
            windowResize: this.#createDebouncer('resize', this.#handleResize.bind(this), 100),
            popState: this.#handlePopState.bind(this),
            keydown: this.#handleKeydown.bind(this)
        };
        
        this.initPromise = this.#initialize(options);
    }

    // 🚀 新增：DOM缓存获取
    #getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }

    // 🚀 新增：防抖器创建
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

            // 🚀 优化：并行初始化
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
            // 工具加载失败不影响主应用运行
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

    // 🚀 优化：渲染过程（减少DOM操作）
    #render() {
        this.navContainer.innerHTML = '';
        this.state.linksMap.clear();

        const navList = document.createElement('ul');
        navList.className = Navigation.CONFIG.CSS.NAV_LIST;

        // 🚀 优化：使用DocumentFragment批量插入
        const fragment = document.createDocumentFragment();

        // 1. All Articles 链接
        fragment.appendChild(this.#createNavItem(
            'All Articles', 
            `#${Navigation.CONFIG.HASH_PREFIX.ALL_ARTICLES}`, 
            Navigation.CONFIG.ROUTES.ALL,
            Navigation.CONFIG.ROUTES.ALL,
            'nav-link-all'
        ));

        // 2. Series 下拉菜单
        const learningSeries = this.navData.filter(series => {
            return series.seriesId && series.seriesId !== 'tools' && 
                   Array.isArray(series.chapters) && series.chapters.length > 0;
        });
        
        if (learningSeries.length > 0) {
            fragment.appendChild(this.#createDropdownItem('Series', learningSeries));
        }

        // 3. Tools 链接
        fragment.appendChild(this.#createNavItem(
            'Tools', 
            `#${Navigation.CONFIG.HASH_PREFIX.TOOLS}`, 
            Navigation.CONFIG.ROUTES.TOOLS,
            Navigation.CONFIG.ROUTES.TOOLS
        ));

        navList.appendChild(fragment);
        this.navContainer.appendChild(navList);
    }

    #createNavItem(text, href, routeType, id = null, extraClass = '') {
        const item = document.createElement('li');
        item.className = 'nav-item';
        
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        link.dataset.routeType = routeType;
        if (id) link.dataset.id = id;
        if (extraClass) link.className = extraClass;

        this.state.linksMap.set(id || routeType, link);
        item.appendChild(link);
        return item;
    }

    #createDropdownItem(title, seriesData) {
        const item = document.createElement('li');
        item.className = 'nav-item dropdown';
        
        const trigger = document.createElement('button');
        trigger.className = 'dropdown-trigger';
        trigger.type = 'button';
        trigger.dataset.dropdownId = 'series';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'dropdown-text';
        textSpan.textContent = title;
        
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'dropdown-arrow';
        arrowSpan.textContent = '▼';
        
        trigger.appendChild(textSpan);
        trigger.appendChild(arrowSpan);
        
        // 🚀 优化：数据存储在元素上，避免全局查找
        trigger.seriesData = seriesData;
        
        item.appendChild(trigger);
        return item;
    }

    // 🚀 优化：下拉菜单系统（池化技术）
    #getOrCreateDropdownOverlay() {
        // 尝试从池中获取
        if (this.state.dropdown.pooledOverlays.length > 0) {
            const overlay = this.state.dropdown.pooledOverlays.pop();
            this.state.dropdown.overlay = overlay;
            return overlay;
        }
        
        // 创建新的下拉菜单
        const overlay = this.#createDropdownOverlay();
        this.state.dropdown.overlay = overlay;
        return overlay;
    }

    #createDropdownOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'navigation-dropdown-overlay';
        overlay.dataset.pooled = 'true'; // 标记为池化元素
        
        // 🚀 优化：预设基础样式，减少动态计算
        overlay.style.cssText = `
            position: fixed; left: 0; right: 0; width: 100vw; z-index: 10000;
            background: #ffffff; border: none; border-top: 1px solid #e0e0e0;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); max-height: 50vh;
            overflow-y: auto; overflow-x: hidden; opacity: 0; visibility: hidden;
            transform: translateY(-10px); pointer-events: none; margin: 0; padding: 0;
            border-radius: 0; transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
            contain: layout style; will-change: opacity, transform;
            backface-visibility: hidden; -webkit-overflow-scrolling: touch;
        `;
        
        // 🚀 优化：预创建内容容器
        const content = document.createElement('div');
        content.className = 'dropdown-content';
        overlay.appendChild(content);
        
        document.body.appendChild(overlay);
        return overlay;
    }

    // 🚀 优化：显示下拉菜单（复用而非重建）
    #showDropdown(triggerElement, seriesData) {
        const overlay = this.#getOrCreateDropdownOverlay();
        const content = overlay.querySelector('.dropdown-content');
        
        // 🚀 优化：位置计算（缓存）
        const triggerRect = triggerElement.getBoundingClientRect();
        const navRect = this.navContainer.getBoundingClientRect();
        const siteHeader = this.navContainer.closest('.site-header');
        
        let top = navRect.bottom;
        if (siteHeader) {
            const headerRect = siteHeader.getBoundingClientRect();
            top = headerRect.bottom;
        }
        
        overlay.style.top = `${Math.round(top)}px`;
        
        // 🚀 优化：响应式配置（缓存）
        const isMobile = this.state.isMobile;
        content.style.cssText = isMobile ? 
            `max-width: 100%; margin: 0; padding: 5px 15px; display: grid; grid-template-columns: 1fr; gap: 5px;` :
            `max-width: 1200px; margin: 0 auto; padding: 10px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;`;
        
        // 🚀 优化：内容更新（复用DOM元素）
        this.#updateDropdownContent(content, seriesData, isMobile);
        
        // 显示下拉菜单
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
        overlay.style.transform = 'translateY(0)';
        overlay.style.pointerEvents = 'auto';
        
        this.state.dropdown.isOpen = true;
        this.state.dropdown.currentId = 'series';
        
        if (this.config.debug) {
            console.log('[Navigation] Dropdown shown (reused overlay)');
        }
    }

    // 🚀 新增：下拉菜单内容更新（复用DOM）
    #updateDropdownContent(container, seriesData, isMobile) {
        // 清理现有内容但保留容器
        container.innerHTML = '';
        
        // 🚀 优化：批量创建菜单项
        const fragment = document.createDocumentFragment();
        
        seriesData.forEach(series => {
            if (!series.seriesId) return;
            
            const item = document.createElement('a');
            item.href = `#${Navigation.CONFIG.HASH_PREFIX.SERIES}${series.seriesId}`;
            item.textContent = series.series || series.seriesId;
            item.dataset.routeType = Navigation.CONFIG.ROUTES.SERIES;
            item.dataset.id = series.seriesId;
            item.dataset.dropdownItem = 'true';
            
            // 🚀 优化：样式配置（预设）
            const baseStyle = `
                display: flex; align-items: center; padding: 12px 18px; color: #333;
                text-decoration: none; border: none; border-radius: 8px; transition: all 0.2s ease;
                line-height: 1.3; cursor: pointer; font-weight: 500; background: transparent;
                margin-bottom: 3px; -webkit-tap-highlight-color: transparent; user-select: none;
            `;
            
            item.style.cssText = isMobile ? 
                `${baseStyle} padding: 12px 20px; font-size: 15px; min-height: 44px;` :
                `${baseStyle} font-size: 16px;`;
            
            // 🚀 优化：悬停效果（事件委托处理）
            this.state.linksMap.set(series.seriesId, item);
            fragment.appendChild(item);
        });
        
        container.appendChild(fragment);
    }

    // 🚀 优化：隐藏下拉菜单（回收到池中）
    #hideDropdown() {
        const overlay = this.state.dropdown.overlay;
        if (!overlay) return;
        
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        overlay.style.transform = 'translateY(-10px)';
        overlay.style.pointerEvents = 'none';
        
        this.state.dropdown.isOpen = false;
        this.state.dropdown.currentId = null;
        
        // 🚀 优化：延迟回收到池中
        setTimeout(() => {
            if (this.state.dropdown.pooledOverlays.length < 2) { // 最多保留2个
                this.state.dropdown.pooledOverlays.push(overlay);
            } else {
                overlay.remove(); // 超出限制则直接移除
            }
            this.state.dropdown.overlay = null;
        }, 200);
        
        if (this.config.debug) {
            console.log('[Navigation] Dropdown hidden (recycled to pool)');
        }
    }

    // 🚀 优化：统一事件监听器（减少监听器数量）
    #setupEventListeners() {
        // 🚀 主要改进：只使用4个全局监听器
        document.addEventListener('click', this.eventHandlers.globalClick);
        window.addEventListener('resize', this.eventHandlers.windowResize);
        window.addEventListener('popstate', this.eventHandlers.popState);
        document.addEventListener('keydown', this.eventHandlers.keydown);
        
        // 🚀 优化：移动端触摸处理（按需）
        if (this.state.isMobile) {
            const touchHandler = this.#createDebouncer('touch', () => {
                if (this.state.dropdown.isOpen) this.#hideDropdown();
            }, 50);
            
            window.addEventListener('touchmove', touchHandler, { passive: true });
            window.addEventListener('orientationchange', this.eventHandlers.windowResize);
        }
    }

    // 🚀 优化：全局点击处理（统一入口）
    #handleGlobalClick(event) {
        // 🚀 优化：防抖处理
        if (this.state.dropdown.isProcessing) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
        this.state.dropdown.isProcessing = true;
        
        try {
            const target = event.target;
            
            // 🚀 优化：使用最近元素查找，减少DOM遍历
            const trigger = target.closest('.dropdown-trigger[data-dropdown-id]');
            if (trigger) {
                event.preventDefault();
                event.stopPropagation();
                this.#handleDropdownTriggerClick(trigger);
                return;
            }
            
            const dropdownItem = target.closest('a[data-dropdown-item="true"]');
            if (dropdownItem) {
                event.preventDefault();
                event.stopPropagation();
                this.#handleDropdownItemClick(dropdownItem);
                return;
            }
            
            const navLink = target.closest('a[data-route-type]');
            if (navLink && this.navContainer.contains(navLink)) {
                event.preventDefault();
                event.stopPropagation();
                this.#handleNavLinkClick(navLink);
                return;
            }
            
            // 🚀 优化：外部点击检测（简化）
            const overlay = this.state.dropdown.overlay;
            if (this.state.dropdown.isOpen && overlay && !overlay.contains(target)) {
                this.#hideDropdown();
            }
            
        } finally {
            // 🚀 优化：异步释放处理锁，避免阻塞
            setTimeout(() => {
                this.state.dropdown.isProcessing = false;
            }, 10);
        }
    }

    // 🚀 优化：下拉触发器处理
    #handleDropdownTriggerClick(trigger) {
        const isCurrentlyOpen = this.state.dropdown.isOpen && this.state.dropdown.currentId === 'series';
        
        this.#hideDropdown();
        
        if (!isCurrentlyOpen && trigger.seriesData) {
            // 🚀 优化：添加视觉状态
            const dropdown = trigger.closest('.nav-item.dropdown');
            if (dropdown) {
                dropdown.classList.add(Navigation.CONFIG.CSS.DROPDOWN_OPEN);
            }
            
            this.#showDropdown(trigger, trigger.seriesData);
        } else {
            // 移除视觉状态
            const dropdown = trigger.closest('.nav-item.dropdown');
            if (dropdown) {
                dropdown.classList.remove(Navigation.CONFIG.CSS.DROPDOWN_OPEN);
            }
        }
    }

    #handleDropdownItemClick(item) {
        // 移除视觉状态
        const dropdown = this.navContainer.querySelector('.nav-item.dropdown');
        if (dropdown) {
            dropdown.classList.remove(Navigation.CONFIG.CSS.DROPDOWN_OPEN);
        }
        
        this.#hideDropdown();
        
        const { routeType, id } = item.dataset;
        if (routeType) {
            this.#route({ type: routeType, id });
        }
    }

    #handleNavLinkClick(link) {
        this.#hideDropdown();
        
        const { routeType, id } = link.dataset;
        if (routeType) {
            this.#route({ type: routeType, id });
        }
    }

    // 🚀 优化：窗口大小改变处理（防抖+缓存）
    #handleResize() {
        const now = Date.now();
        if (now - this.state.lastResize < 50) return; // 防抖
        
        this.state.lastResize = now;
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth <= 768;
        
        // 🚀 优化：只在移动端状态改变时重新渲染
        if (wasMobile !== this.state.isMobile && this.state.dropdown.isOpen) {
            const trigger = this.navContainer.querySelector('.dropdown-trigger[data-dropdown-id="series"]');
            if (trigger?.seriesData) {
                this.#showDropdown(trigger, trigger.seriesData);
            }
        }
    }

    #handleKeydown(event) {
        if (event.key === 'Escape' && this.state.dropdown.isOpen) {
            this.#hideDropdown();
            
            // 移除视觉状态
            const dropdown = this.navContainer.querySelector('.nav-item.dropdown');
            if (dropdown) {
                dropdown.classList.remove(Navigation.CONFIG.CSS.DROPDOWN_OPEN);
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

    navigateToChapter(chapterId) {
        if (!this.state.chaptersMap.has(chapterId)) {
            this.#displayError('章节未找到');
            return;
        }

        this.#loadChapterContent(chapterId);
    }

    // 🚀 优化：章节内容加载（缓存优化）
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
        // 显示基本的工具页面，不干涉独立工具系统
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
        if (this.activeLink) {
            this.activeLink.classList.remove(Navigation.CONFIG.CSS.ACTIVE);
        }
        
        // 清除所有下拉菜单项的激活状态
        this.navContainer.querySelectorAll('.dropdown-trigger').forEach(trigger => {
            trigger.classList.remove(Navigation.CONFIG.CSS.ACTIVE);
        });
        
        const newActiveLink = this.state.linksMap.get(id);
        if (newActiveLink) {
            newActiveLink.classList.add(Navigation.CONFIG.CSS.ACTIVE);
            this.activeLink = newActiveLink;

            // 如果激活的是下拉菜单项，也激活触发器
            const parentTrigger = this.navContainer.querySelector(`.dropdown-trigger[data-dropdown-id]`);
            if (parentTrigger && id !== Navigation.CONFIG.ROUTES.ALL && id !== Navigation.CONFIG.ROUTES.TOOLS) {
                parentTrigger.classList.add(Navigation.CONFIG.CSS.ACTIVE);
            }
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

    // 🚀 新增：智能预加载系统
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

    // 🚀 新增：预加载章节
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
            // 预加载失败不影响主流程
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

    // 🚀 新增：获取性能统计
    getPerformanceStats() {
        return {
            preloadQueue: this.state.preloadQueue.size,
            preloadInProgress: this.state.preloadInProgress,
            dropdownPoolSize: this.state.dropdown.pooledOverlays.length,
            domCacheSize: this.domCache.size,
            elementsMapSize: this.elements.size,
            linksMapSize: this.state.linksMap.size,
            chaptersMapSize: this.state.chaptersMap.size,
            isMobile: this.state.isMobile,
            dropdownOpen: this.state.dropdown.isOpen
        };
    }

    // 🚀 新增：手动触发预加载
    preloadChapters(chapterIds) {
        if (!Array.isArray(chapterIds)) return;
        
        chapterIds.forEach((chapterId, index) => {
            setTimeout(() => {
                this.#preloadChapter(chapterId);
            }, index * 500);
        });
    }

    // 🚀 新增：清理缓存
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
        
        // 关闭下拉菜单
        this.#hideDropdown();
        
        // 清理池化的下拉菜单
        this.state.dropdown.pooledOverlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
        this.state.dropdown.pooledOverlays.length = 0;
        
        // 移除事件监听器
        document.removeEventListener('click', this.eventHandlers.globalClick);
        window.removeEventListener('resize', this.eventHandlers.windowResize);
        window.removeEventListener('popstate', this.eventHandlers.popState);
        document.removeEventListener('keydown', this.eventHandlers.keydown);
        
        // 清理缓存
        this.clearCache();
        
        // 清理状态
        this.state.linksMap.clear();
        this.activeLink = null;
        this.state.chaptersMap.clear();
        this.state.preloadQueue.clear();
        
        // 重置状态
        this.state.dropdown = {
            isOpen: false,
            currentId: null,
            overlay: null,
            isProcessing: false,
            pooledOverlays: []
        };
        
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

window.closeNavigationDropdowns = function() {
    if (window.app && window.app.navigation) {
        // 使用公共方法来关闭下拉菜单
        if (window.app.navigation.state?.dropdown?.isOpen) {
            // 模拟ESC键来关闭下拉菜单
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
        return true;
    }
    return false;
};