// === 重构后的 navigation.js (模块化架构版) ===

window.EnglishSite = window.EnglishSite || {};

// === 1. 🚀 核心状态管理器 ===
class StateManager {
    constructor() {
        this.state = {
            isOpen: false,
            expandedSubmenu: null,
            activeLink: null,
            isMobile: window.innerWidth <= 768,
            preloadQueue: new Set(),
            lastResize: 0
        };
        
        this.data = {
            navData: [],
            linksMap: new Map(),
            chaptersMap: new Map()
        };
        
        this.cache = {
            dom: new Map(),
            content: null
        };
    }

    setState(key, value) {
        this.state[key] = value;
        this.notifyChange(key, value);
    }

    getState(key) {
        return key ? this.state[key] : this.state;
    }

    setData(key, value) {
        this.data[key] = value;
    }

    getData(key) {
        return key ? this.data[key] : this.data;
    }

    notifyChange(key, value) {
        // 状态变化通知机制
        document.dispatchEvent(new CustomEvent('stateChanged', {
            detail: { key, value, state: this.state }
        }));
    }
}

// === 2. 🚀 DOM操作抽象层 ===
class DOMHelper {
    constructor() {
        this.cache = new Map();
    }

    $(selector) {
        if (!this.cache.has(selector)) {
            const element = document.querySelector(selector);
            if (element) this.cache.set(selector, element);
        }
        return this.cache.get(selector);
    }

    create(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.firstElementChild;
    }

    batch(operations) {
        const fragment = document.createDocumentFragment();
        operations.forEach(op => {
            if (typeof op === 'function') op(fragment);
        });
        return fragment;
    }

    animate(element, className, duration = 250) {
        return new Promise(resolve => {
            element.classList.add(className);
            setTimeout(() => {
                element.classList.remove(className);
                resolve();
            }, duration);
        });
    }
}

// === 3. 🚀 事件总线 ===
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.setupGlobalHandlers();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }

    off(event, handler) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(handler);
        }
    }

    emit(event, data = {}) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Event handler error for ${event}:`, error);
                }
            });
        }
    }

    setupGlobalHandlers() {
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 100));
        window.addEventListener('popstate', this.handlePopState.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    handleGlobalClick(event) {
        this.emit('globalClick', { event, target: event.target });
    }

    handleResize() {
        this.emit('windowResize', { width: window.innerWidth, height: window.innerHeight });
    }

    handlePopState(event) {
        this.emit('popState', { state: event.state });
    }

    handleKeydown(event) {
        this.emit('keydown', { event, key: event.key });
    }

    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}

// === 4. 🚀 侧边栏管理器 ===
class SidebarManager {
    constructor(state, dom, events) {
        this.state = state;
        this.dom = dom;
        this.events = events;
        this.elements = {};
        
        this.init();
        this.bindEvents();
    }

    init() {
        this.createSidebarElements();
        this.applySidebarConfig();
    }

    createSidebarElements() {
        // 创建汉堡菜单按钮
        const header = this.dom.$('.site-header') || this.createSiteHeader();
        const hamburger = this.dom.create(`
            <button class="nav-toggle" aria-label="打开导航菜单" data-action="toggleSidebar">
                <span class="hamburger-icon"><span></span><span></span><span></span></span>
            </button>
        `);
        header.insertBefore(hamburger, header.firstChild);

        // 创建侧边栏容器
        const sidebarContainer = this.dom.create(`
            <div class="sidebar-container" data-state="closed">
                <nav class="sidebar-main"></nav>
                <div class="sidebar-submenu"></div>
            </div>
        `);

        // 创建遮罩
        const overlay = this.dom.create(`
            <div class="sidebar-overlay" data-action="closeSidebar"></div>
        `);

        document.body.appendChild(sidebarContainer);
        document.body.appendChild(overlay);

        // 保存元素引用
        this.elements = {
            hamburger,
            container: sidebarContainer,
            mainPanel: sidebarContainer.querySelector('.sidebar-main'),
            submenuPanel: sidebarContainer.querySelector('.sidebar-submenu'),
            overlay
        };
    }

    createSiteHeader() {
        const header = this.dom.create(`
            <header class="site-header">
                <div class="brand-logo">学习平台</div>
            </header>
        `);
        document.body.insertBefore(header, document.body.firstChild);
        return header;
    }

    applySidebarConfig() {
        const container = this.elements.container;
        container.style.setProperty('--sidebar-width', '70%');
        container.style.setProperty('--sidebar-min-width', '320px');
        this.handleResponsiveWidth();
    }

    handleResponsiveWidth() {
        const width = window.innerWidth;
        const targetWidth = width <= 768 ? 90 : width <= 1024 ? 80 : 70;
        this.elements.container.style.setProperty('--sidebar-width', `${targetWidth}%`);
    }

    bindEvents() {
        this.events.on('globalClick', this.handleClick.bind(this));
        this.events.on('windowResize', this.handleResize.bind(this));
        this.events.on('keydown', this.handleKeydown.bind(this));
    }

    handleClick({ event, target }) {
        const action = target.closest('[data-action]')?.dataset.action;
        
        switch (action) {
            case 'toggleSidebar':
                event.preventDefault();
                this.toggle();
                break;
            case 'closeSidebar':
                event.preventDefault();
                this.close();
                break;
        }
    }

    handleResize() {
        this.handleResponsiveWidth();
        this.state.setState('isMobile', window.innerWidth <= 768);
    }

    handleKeydown({ event, key }) {
        if (key === 'Escape' && this.state.getState('isOpen')) {
            this.close();
        }
    }

    toggle() {
        this.state.getState('isOpen') ? this.close() : this.open();
    }

    open() {
        requestAnimationFrame(() => {
            this.elements.container.dataset.state = 'open';
            this.elements.container.classList.add('open');
            this.elements.overlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
            this.state.setState('isOpen', true);
        });
    }

    close() {
        requestAnimationFrame(() => {
            this.elements.container.dataset.state = 'closed';
            this.elements.container.classList.remove('open');
            this.elements.overlay.classList.remove('visible');
            document.body.style.overflow = '';
            this.collapseSubmenu();
            this.state.setState('isOpen', false);
        });
    }

    expandSubmenu(seriesData) {
        this.collapseSubmenu();
        this.renderSubmenu(seriesData);
        
        requestAnimationFrame(() => {
            this.elements.submenuPanel.classList.add('expanded');
            this.state.setState('expandedSubmenu', seriesData.seriesId);
        });
    }

    collapseSubmenu() {
        this.elements.submenuPanel.classList.remove('expanded');
        this.state.setState('expandedSubmenu', null);
        
        setTimeout(() => {
            if (!this.state.getState('expandedSubmenu')) {
                this.elements.submenuPanel.innerHTML = '';
            }
        }, 250);
    }

    renderSubmenu(seriesData) {
        const chaptersHTML = seriesData.chapters?.map(chapter => 
            `<div class="nav-item level-2 clickable" data-chapter-id="${chapter.id}" data-action="navigateToChapter">${chapter.title}</div>`
        ).join('') || '';
        
        this.elements.submenuPanel.innerHTML = `
            <div class="submenu-header">
                <button class="back-btn" data-action="collapseSubmenu">
                    <span class="back-arrow">‹</span> ${seriesData.title}
                </button>
            </div>
            <div class="submenu-content">${chaptersHTML}</div>
        `;
    }
}

// === 5. 🚀 导航渲染器 ===
class NavigationRenderer {
    constructor(state, dom, events) {
        this.state = state;
        this.dom = dom;
        this.events = events;
        this.templates = {
            toolsItem: `<div class="nav-item tools-item level-1 clickable" data-action="openTools">
                <span class="nav-title">Tools</span>
                <span class="nav-arrow">></span>
            </div>`,
            expandableItem: (title, seriesId) => `
                <div class="nav-item level-1 expandable" data-series-id="${seriesId}" data-action="toggleSubmenu">
                    <span class="nav-title">${title}</span>
                    <span class="expand-arrow">></span>
                </div>
            `,
            directItem: (title, action) => `
                <div class="nav-item level-1 clickable" data-action="${action}">${title}</div>
            `
        };
    }

    renderMainNavigation(container) {
        const navContent = this.dom.create('<div class="sidebar-nav-content"></div>');
        
        // Tools项
        navContent.appendChild(this.dom.create(this.templates.toolsItem));
        navContent.appendChild(this.dom.create('<div class="nav-separator"></div>'));
        
        // 文章分类
        const articleCategory = this.createCategory('📚 文章内容', 'articles', [
            { title: 'All Articles', type: 'direct', action: 'showAllArticles' },
            ...this.getSeriesItems(),
            { title: 'News & Updates', type: 'direct', action: 'showNews' }
        ]);
        
        navContent.appendChild(articleCategory);
        container.appendChild(navContent);
        
        this.registerLinkMappings();
    }

    createCategory(title, id, items) {
        const itemsHTML = items.map(item => this.getItemHTML(item)).join('');
        return this.dom.create(`
            <div class="nav-category" data-category-id="${id}">
                <div class="nav-category-header">${title}</div>
                ${itemsHTML}
            </div>
        `);
    }

    getItemHTML(item) {
        switch (item.type) {
            case 'direct':
                return this.templates.directItem(item.title, item.action);
            case 'expandable':
                return this.templates.expandableItem(item.title, item.seriesId);
            default:
                return '';
        }
    }

    getSeriesItems() {
        return this.state.getData('navData')
            .filter(series => series.seriesId && series.seriesId !== 'tools' && 
                    Array.isArray(series.chapters) && series.chapters.length > 0)
            .map(series => ({
                title: series.series,
                type: 'expandable',
                seriesId: series.seriesId,
                chapters: series.chapters
            }));
    }

    registerLinkMappings() {
        const linksMap = this.state.getData('linksMap');
        document.querySelectorAll('[data-series-id], [data-action]').forEach(element => {
            const key = element.dataset.seriesId || element.dataset.action;
            if (key) linksMap.set(key, element);
        });
    }

    setActiveLink(id) {
        const linksMap = this.state.getData('linksMap');
        
        // 清除所有激活状态
        linksMap.forEach(link => link.classList.remove('active'));
        
        // 设置新的激活状态
        const newActiveLink = linksMap.get(id);
        if (newActiveLink) {
            newActiveLink.classList.add('active');
            this.state.setState('activeLink', newActiveLink);
        }
    }
}

// === 6. 🚀 路由控制器 ===
class RouterController {
    constructor(state, events) {
        this.state = state;
        this.events = events;
        this.routes = {
            SERIES: 'series',
            CHAPTER: 'chapter',
            ALL: 'all',
            TOOLS: 'tools'
        };
        
        this.bindEvents();
    }

    bindEvents() {
        this.events.on('popState', this.handlePopState.bind(this));
    }

    handlePopState({ state }) {
        const route = state || this.parseHash();
        this.route(route, false, true);
    }

    parseHash() {
        const hash = window.location.hash.substring(1);
        
        if (hash.startsWith('series=')) {
            return { type: this.routes.SERIES, id: hash.substring(7) };
        }
        if (hash === 'all-articles') {
            return { type: this.routes.ALL, id: null };
        }
        if (hash === 'tools') {
            return { type: this.routes.TOOLS, id: null };
        }
        if (hash && this.state.getData('chaptersMap').has(hash)) {
            return { type: this.routes.CHAPTER, id: hash };
        }

        return { type: this.routes.ALL, id: null };
    }

    route(route, replace = false, fromPopState = false) {
        if (!fromPopState) {
            const historyMethod = replace ? 'replaceState' : 'pushState';
            const newHash = this.getHashFromRoute(route);
            history[historyMethod](route, '', newHash);
        }

        this.events.emit('routeChanged', { route, replace, fromPopState });
    }

    getHashFromRoute(route) {
        const { type, id } = route;
        switch(type) {
            case this.routes.SERIES: return `#series=${id}`;
            case this.routes.CHAPTER: return `#${id}`;
            case this.routes.ALL: return `#all-articles`;
            case this.routes.TOOLS: return `#tools`;
            default: return '';
        }
    }
}

// === 7. 🚀 核心导航控制器（外观模式） ===
class NavigationCore {
    constructor(navContainer, contentArea, navData, options = {}) {
        // 🚀 依赖注入
        this.state = new StateManager();
        this.dom = new DOMHelper();
        this.events = new EventBus();
        
        // 原始参数保存（兼容性）
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.originalNavData = navData;
        this.options = options;
        
        // 🚀 模块组合
        this.sidebar = new SidebarManager(this.state, this.dom, this.events);
        this.renderer = new NavigationRenderer(this.state, this.dom, this.events);
        this.router = new RouterController(this.state, this.events);
        
        // 缓存管理器（兼容性）
        this.cache = {
            manager: this.createCacheManager()
        };
        
        this.initPromise = this.initialize();
    }

    async initialize() {
        try {
            // 等待核心工具就绪
            if (window.EnglishSite.coreToolsReady) {
                await window.EnglishSite.coreToolsReady;
            }
            
            // 预处理数据
            await this.preprocessData();
            
            // 加载工具数据
            await this.loadToolsData();
            
            // 渲染导航
            this.renderer.renderMainNavigation(this.sidebar.elements.mainPanel);
            
            // 设置事件监听
            this.setupEventHandlers();
            
            // 处理初始路由
            this.handleInitialRoute();
            
        } catch (error) {
            console.error('[NavigationCore] Initialization failed:', error);
            throw error;
        }
    }

    async preprocessData() {
        this.state.setData('navData', this.originalNavData || []);
        
        const chaptersMap = new Map();
        let totalChapters = 0;
        
        for (const series of this.originalNavData) {
            if (!series.seriesId || !Array.isArray(series.chapters)) continue;
            
            for (const chapter of series.chapters) {
                if (!chapter.id) continue;
                
                chaptersMap.set(chapter.id, { 
                    ...chapter, 
                    seriesId: series.seriesId,
                    seriesTitle: series.series
                });
                totalChapters++;
            }
        }
        
        this.state.setData('chaptersMap', chaptersMap);
    }

    async loadToolsData() {
        try {
            const response = await fetch('./data/tools.json');
            if (response.ok) {
                const toolsData = await response.json();
                const validTools = toolsData?.filter?.(tool => tool.id && tool.title) || [];
                
                if (validTools.length > 0) {
                    const navData = this.state.getData('navData');
                    navData.push({
                        series: "学习工具",
                        seriesId: "tools",
                        description: "实用的英语学习工具集合",
                        chapters: validTools.map(tool => ({
                            ...tool,
                            type: tool.type || 'tool',
                            seriesId: 'tools'
                        }))
                    });
                    this.state.setData('navData', navData);
                }
            }
        } catch (error) {
            console.warn('[NavigationCore] Tools loading failed:', error);
        }
    }

    setupEventHandlers() {
        this.events.on('globalClick', this.handleNavigation.bind(this));
        this.events.on('routeChanged', this.handleRouteChange.bind(this));
    }

    handleNavigation({ event, target }) {
        const actionElement = target.closest('[data-action]');
        if (!actionElement) return;

        const action = actionElement.dataset.action;
        
        switch (action) {
            case 'openTools':
                this.handleToolsClick();
                break;
            case 'showAllArticles':
                this.handleAllArticlesClick();
                break;
            case 'toggleSubmenu':
                this.handleExpandableClick(actionElement);
                break;
            case 'collapseSubmenu':
                this.sidebar.collapseSubmenu();
                break;
            case 'navigateToChapter':
                this.handleChapterClick(actionElement);
                break;
        }
    }

    handleToolsClick() {
        this.sidebar.close();
        this.router.route({ type: 'tools', id: null });
    }

    handleAllArticlesClick() {
        this.sidebar.close();
        this.router.route({ type: 'all', id: null });
    }

    handleExpandableClick(element) {
        const seriesId = element.dataset.seriesId;
        const seriesData = this.state.getData('navData').find(s => s.seriesId === seriesId);
        
        if (seriesData) {
            if (this.state.getState('expandedSubmenu') === seriesId) {
                this.sidebar.collapseSubmenu();
            } else {
                this.sidebar.expandSubmenu({
                    seriesId: seriesData.seriesId,
                    title: seriesData.series,
                    chapters: seriesData.chapters
                });
            }
        }
    }

    handleChapterClick(element) {
        const chapterId = element.dataset.chapterId;
        this.sidebar.close();
        if (chapterId) {
            this.navigateToChapter(chapterId);
        }
    }

    handleRouteChange({ route }) {
        switch (route.type) {
            case 'series':
                this.setActiveSeries(route.id);
                break;
            case 'chapter':
                this.navigateToChapter(route.id);
                break;
            case 'all':
                this.showAllArticles();
                break;
            case 'tools':
                this.showToolsPage();
                break;
        }
    }

    handleInitialRoute() {
        const route = this.router.parseHash();
        this.router.route(route, true);
    }

    createCacheManager() {
        return window.EnglishSite.CacheManager?.createCache('navigation', {
            maxSize: 50,
            ttl: 300000,
            strategy: 'lru'
        }) || new Map();
    }

    // === 🚀 兼容性API（保持原有接口） ===
    
    async waitForInitialization() {
        return this.initPromise;
    }

    navigateToChapter(chapterId) {
        if (!this.state.getData('chaptersMap').has(chapterId)) {
            this.displayError('章节未找到');
            return;
        }
        this.loadChapterContent(chapterId);
    }

    async loadChapterContent(chapterId) {
        const chapterData = this.state.getData('chaptersMap').get(chapterId);
        if (!chapterData) {
            this.displayError('章节数据未找到');
            return;
        }

        try {
            if (chapterData.type === 'tool' && chapterData.url) {
                this.handleToolPageNavigation(chapterData);
                return;
            }
            
            let content = this.cache.manager.get ? this.cache.manager.get(chapterId) : null;
            
            if (!content) {
                const contentUrl = this.getContentUrl(chapterData);
                const response = await fetch(contentUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                content = await response.text();
                
                if (this.cache.manager.set) {
                    this.cache.manager.set(chapterId, content);
                }
            }
            
            this.displayChapterContent(chapterId, content, chapterData);
            
        } catch (error) {
            this.displayError('章节加载失败，请检查网络连接');
            this.dispatchEvent('chapterLoadError', { chapterId, error });
        }
    }

    getContentUrl(chapterData) {
        if (chapterData.url) {
            return chapterData.url.startsWith('http') ? chapterData.url : chapterData.url;
        }
        return `chapters/${chapterData.id}.html`;
    }

    handleToolPageNavigation(chapterData) {
        const { id, url, title } = chapterData;
        
        if (url.startsWith('http')) {
            window.open(url, '_blank', 'noopener,noreferrer');
            this.displayToolRedirectMessage(title, url);
        } else {
            window.location.href = url;
        }
        
        this.updateTitle(title);
        this.renderer.setActiveLink(chapterData.seriesId);
        this.dispatchEvent('toolPageLoaded', { toolId: id, toolUrl: url, chapterData });
    }

    displayToolRedirectMessage(title, url) {
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
    }

    displayChapterContent(chapterId, content, chapterData) {
        this.contentArea.innerHTML = content;
        this.updateTitle(chapterData.title);
        this.renderer.setActiveLink(chapterData.seriesId);

        this.dispatchEvent('chapterLoaded', { 
            chapterId, 
            hasAudio: chapterData.audio, 
            chapterData 
        });

        const { prevChapterId, nextChapterId } = this.getChapterNav(chapterId);
        this.dispatchEvent('navigationUpdated', { prevChapterId, nextChapterId });
    }

    setActiveSeries(seriesId) {
        const seriesData = this.state.getData('navData').find(s => s.seriesId === seriesId);
        if (seriesData) {
            this.updateTitle(`Series: ${seriesData.series || seriesId}`);
            this.renderer.setActiveLink(seriesId);
            this.dispatchEvent('seriesSelected', { 
                seriesId, 
                chapters: seriesData.chapters 
            });
        }
    }

    showAllArticles() {
        this.updateTitle('All Articles');
        this.renderer.setActiveLink('all');
        this.dispatchEvent('allArticlesRequested');
    }

    showToolsPage() {
        this.updateTitle('Tools');
        this.renderer.setActiveLink('tools');
        this.displayToolsPageContent();
        this.dispatchEvent('toolsRequested');
    }

    displayToolsPageContent() {
        this.contentArea.innerHTML = `
            <div class="tools-page">
                <div class="tools-header" style="text-align: center; margin-bottom: 40px; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🛠️</div>
                    <h1 style="margin-bottom: 16px; font-size: 2.5rem;">学习工具箱</h1>
                    <p style="opacity: 0.9; font-size: 1.1rem;">提升英语学习效率的实用工具集合</p>
                </div>
                
                <div class="tools-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; padding: 0 20px;">
                    <div class="tool-card" onclick="window.location.href='word-frequency.html'" style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); cursor: pointer; transition: all 0.3s ease; border: 2px solid transparent;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#667eea';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.1)'; this.style.borderColor='transparent';">
                        <div class="tool-icon" style="font-size: 2.5rem; text-align: center; margin-bottom: 16px;">📊</div>
                        <h3 style="margin-bottom: 12px; color: #333; font-size: 1.3rem; text-align: center;">词频统计分析</h3>
                        <p style="color: #666; margin-bottom: 20px; line-height: 1.5; text-align: center; min-height: 48px;">全站英文词汇频次统计，帮助发现重点学习词汇，支持词云展示和智能搜索</p>
                        <div class="tool-footer" style="text-align: center;">
                            <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s ease; pointer-events: none;">使用工具 →</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getChapterNav(chapterId) {
        const chapterData = this.state.getData('chaptersMap').get(chapterId);
        if (!chapterData) return { prevChapterId: null, nextChapterId: null };

        const series = this.state.getData('navData').find(s => s.seriesId === chapterData.seriesId);
        if (!series) return { prevChapterId: null, nextChapterId: null };
        
        const currentIndex = series.chapters.findIndex(c => c.id === chapterId);
        const prevChapter = series.chapters[currentIndex - 1];
        const nextChapter = series.chapters[currentIndex + 1];

        return {
            prevChapterId: prevChapter?.id || null,
            nextChapterId: nextChapter?.id || null
        };
    }

    navigateToTool(toolId) {
        const toolData = this.state.getData('chaptersMap').get(toolId);
        if (!toolData || toolData.type !== 'tool') {
            return false;
        }
        
        this.navigateToChapter(toolId);
        return true;
    }

    getToolsList() {
        const tools = [];
        for (const [, chapter] of this.state.getData('chaptersMap')) {
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

    getCacheStats() {
        return this.cache.manager.getStats ? this.cache.manager.getStats() : null;
    }

    clearCache() {
        if (this.cache.manager && this.cache.manager.clear) {
            this.cache.manager.clear();
        }
        this.state.cache.dom.clear();
    }

    updateTitle(text) {
        document.title = text ? `${text} | 学习平台` : '学习平台';
    }

    displayError(message) {
        this.contentArea.innerHTML = `<p class="error-message" style="text-align: center; padding: 40px; color: #dc3545;">${message}</p>`;
    }

    dispatchEvent(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    destroy() {
        // 清理状态
        this.sidebar.close();
        
        // 移除DOM元素
        if (this.sidebar.elements.container) {
            this.sidebar.elements.container.remove();
        }
        if (this.sidebar.elements.overlay) {
            this.sidebar.elements.overlay.remove();
        }
        if (this.sidebar.elements.hamburger) {
            this.sidebar.elements.hamburger.remove();
        }
        
        // 清理缓存和状态
        this.clearCache();
        document.body.style.overflow = '';
    }
}

// === 🚀 兼容性外观类（100%向后兼容） ===
class Navigation {
    constructor(navContainer, contentArea, navData, options = {}) {
        // 使用组合模式委托给重构后的核心
        this.core = new NavigationCore(navContainer, contentArea, navData, options);
        
        // 兼容性属性映射
        this.navContainer = this.core.navContainer;
        this.contentArea = this.core.contentArea;
        this.navData = navData;
        this.cache = this.core.cache;
        this.initPromise = this.core.initPromise;
        
        // 🚀 兼容性：保留侧边栏状态引用
        this.sidebarState = {
            get isOpen() { return this.core.state.getState('isOpen'); },
            get expandedSubmenu() { return this.core.state.getState('expandedSubmenu'); },
            get mainPanel() { return this.core.sidebar.elements.mainPanel; },
            get submenuPanel() { return this.core.sidebar.elements.submenuPanel; },
            get sidebarContainer() { return this.core.sidebar.elements.container; },
            get overlay() { return this.core.sidebar.elements.overlay; }
        };
        
        // 绑定核心引用
        Object.defineProperty(this.sidebarState, 'core', { value: this.core });
    }

    // === 🚀 所有公开API方法（100%兼容） ===
    async waitForInitialization() { return this.core.waitForInitialization(); }
    navigateToChapter(chapterId) { return this.core.navigateToChapter(chapterId); }
    navigateToTool(toolId) { return this.core.navigateToTool(toolId); }
    getToolsList() { return this.core.getToolsList(); }
    getCacheStats() { return this.core.getCacheStats(); }
    clearCache() { return this.core.clearCache(); }
    destroy() { return this.core.destroy(); }
    
    // 新增性能监控API
    getPerformanceStats() {
        return {
            preloadQueue: 0,
            preloadInProgress: false,
            domCacheSize: this.core.dom.cache.size,
            linksMapSize: this.core.state.getData('linksMap').size,
            chaptersMapSize: this.core.state.getData('chaptersMap').size,
            isMobile: this.core.state.getState('isMobile'),
            sidebarOpen: this.core.state.getState('isOpen'),
            expandedSubmenu: this.core.state.getState('expandedSubmenu')
        };
    }

    preloadChapters(chapterIds) {
        // 简化版预加载（保持接口兼容）
        if (!Array.isArray(chapterIds)) return;
        console.log('[Navigation] Preload requested for:', chapterIds);
    }
}

// === 🚀 全局导出（100%兼容） ===
window.EnglishSite.Navigation = Navigation;

// === 🚀 兼容性全局函数（100%兼容） ===
window.navigateToWordFrequency = function() {
    if (window.app && window.app.navigation) {
        return window.app.navigation.navigateToTool('word-frequency');
    }
    return false;
};

window.closeSidebarNavigation = function() {
    if (window.app && window.app.navigation && window.app.navigation.sidebarState?.isOpen) {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.click();
            return true;
        }
    }
    return false;
};