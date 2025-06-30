// js/navigation.js - 重构版导航系统 (简化架构 + 3级支持)
window.EnglishSite = window.EnglishSite || {};

/**
 * 🚀 全新简化导航系统
 * 特点：
 * - 单类架构，简化维护
 * - 原生支持3级导航
 * - 完全修复二级菜单隐藏问题
 * - 保持100%外观一致性
 * - 不干扰音频播放器
 */
class Navigation {
    constructor(navContainer, contentArea, navData, options = {}) {
        // 基础属性
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.navData = navData || [];
        this.options = options;
        
        // 🎯 简化状态管理（统一在一个对象中）
        this.state = {
            // 侧边栏状态
            isOpen: false,
            isMobile: window.innerWidth <= 768,
            
            // 导航层级状态
            currentLevel: 1,           // 当前显示的层级 (1-4)
            navigationPath: [],        // 导航路径 [{id, title, level}, ...]
            expandedMenus: new Map(),  // 展开的菜单缓存
            
            // DOM元素缓存
            elements: {},
            linksMap: new Map(),
            chaptersMap: new Map(),
            
            // 数据缓存
            processedData: [],         // 处理后的导航数据
            availableTools: [],        // 可用的工具数据
            
            // 性能优化
            lastUpdate: 0,
            renderQueue: [],
            
            // 兼容性状态  
            activeLink: null,
            lastElement: null
        };
        
        // 配置管理
        this.config = window.EnglishSite.ConfigManager?.createModuleConfig('navigation', {
            siteTitle: options.siteTitle || '互动学习平台',
            debug: options.debug || false,
            animationDuration: 250,
            maxLevels: 4,
            ...options
        });
        
        // 初始化Promise
        this.initPromise = this.initialize();
    }

    // === 🚀 核心初始化方法 ===
    async initialize() {
        try {
            await window.EnglishSite.coreToolsReady;
            
            this.validateRequiredElements();
            this.createSidebarStructure();
            this.preprocessNavigationData();
            this.setupEventListeners();
            this.renderMainNavigation();
            this.ensureCorrectInitialState();
            
            if (this.config.debug) {
                console.log('[Navigation] 🚀 重构版初始化完成');
            }
            
        } catch (error) {
            console.error('[Navigation] 初始化失败:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // === 🏗️ 核心架构方法 ===
    
    validateRequiredElements() {
        if (!this.navContainer || !this.contentArea) {
            throw new Error('Navigation: 缺少必需的DOM元素');
        }
    }

    createSidebarStructure() {
        // 隐藏原导航
        this.hideOriginalNavigation();
        
        // 创建头部和汉堡按钮
        this.createHeaderElements();
        
        // 创建侧边栏容器
        this.createSidebarContainer();
        
        // 创建遮罩
        this.createOverlay();
        
        // 缓存关键DOM元素
        this.cacheElements();
    }

    hideOriginalNavigation() {
        const originalNav = document.querySelector('.main-navigation');
        if (originalNav) {
            originalNav.style.display = 'none';
            originalNav.setAttribute('data-backup', 'true');
        }
    }

    createHeaderElements() {
        // 确保头部存在
        let header = document.querySelector('.site-header');
        if (!header) {
            header = document.createElement('header');
            header.className = 'site-header';
            header.innerHTML = '<div class="brand-logo">学习平台</div>';
            document.body.insertBefore(header, document.body.firstChild);
        }
        
        // 创建汉堡按钮
        if (!header.querySelector('.nav-toggle')) {
            const hamburger = document.createElement('button');
            hamburger.className = 'nav-toggle';
            hamburger.setAttribute('aria-label', '打开导航菜单');
            hamburger.innerHTML = `
                <span class="hamburger-icon">
                    <span></span><span></span><span></span>
                </span>
            `;
            header.insertBefore(hamburger, header.firstChild);
        }
    }

    createSidebarContainer() {
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

    createOverlay() {
        const oldOverlay = document.querySelector('.sidebar-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.setAttribute('aria-label', '点击关闭导航');
        document.body.appendChild(overlay);
    }

    cacheElements() {
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

    // === 📊 数据处理方法 ===
    
    preprocessNavigationData() {
        // 标准化数据格式，支持2级和3级混合
        this.state.processedData = this.normalizeNavigationData(this.navData);
        
        // 构建章节映射
        this.buildChaptersMap();
        
        // 加载工具数据
        this.loadToolsData();
    }

    normalizeNavigationData(data) {
        return data.map(item => this.normalizeNavItem(item, 1));
    }

    normalizeNavItem(item, level) {
        const normalized = {
            id: item.seriesId || item.id || this.generateId(),
            title: item.series || item.title,
            level: level,
            type: item.type || 'category',
            children: [],
            chapters: item.chapters || []
        };
        
        // 处理子项（支持3级结构）
        if (item.children && Array.isArray(item.children)) {
            normalized.children = item.children.map(child => 
                this.normalizeNavItem(child, level + 1)
            );
        } 
        // 兼容旧格式：如果有chapters且level=1，自动创建中间层
        else if (item.chapters && level === 1 && item.chapters.length > 0) {
            // 保持2级结构兼容
            normalized.chapters = item.chapters;
        }
        
        return normalized;
    }

    buildChaptersMap() {
        this.state.chaptersMap.clear();
        this.walkDataTree(this.state.processedData, (item) => {
            if (item.chapters) {
                item.chapters.forEach(chapter => {
                    this.state.chaptersMap.set(chapter.id, {
                        ...chapter,
                        parentPath: this.getItemPath(item)
                    });
                });
            }
        });
    }

    walkDataTree(items, callback) {
        for (const item of items) {
            callback(item);
            if (item.children) {
                this.walkDataTree(item.children, callback);
            }
        }
    }

    getItemPath(item) {
        // 返回到达此项目的路径
        return []; // 简化版，可以后续扩展
    }

    async loadToolsData() {
        // 🎯 可选的工具数据加载 - 不自动添加到导航
        // 用户可以在JSON中自主决定是否包含工具导航
        try {
            const response = await fetch('./data/tools.json');
            if (response.ok) {
                const toolsData = await response.json();
                
                // 将工具数据存储起来，供后续使用
                this.state.availableTools = toolsData.map(tool => ({
                    ...tool,
                    type: 'tool'
                }));
                
                // 🎯 不再自动添加到导航数据
                // 完全由navigation.json决定是否显示工具导航
                
                if (this.config.debug) {
                    console.log('[Navigation] 工具数据已加载:', this.state.availableTools.length);
                }
            }
        } catch (error) {
            console.warn('[Navigation] 工具数据加载失败:', error);
        }
    }

    generateId() {
        return 'nav_' + Math.random().toString(36).substr(2, 9);
    }

    // === 🎨 渲染方法 ===
    
    renderMainNavigation() {
        this.state.currentLevel = 1;
        this.state.navigationPath = [];
        this.renderBreadcrumb();
        this.renderNavigationLevel(this.state.processedData, this.state.elements.mainContent);
        this.hideSubmenu();
    }

    renderBreadcrumb() {
        const breadcrumbEl = this.state.elements.breadcrumb;
        if (!breadcrumbEl) return;
        
        if (this.state.navigationPath.length === 0) {
            breadcrumbEl.style.display = 'none';
            return;
        }
        
        breadcrumbEl.style.display = 'block';
        const pathHtml = this.state.navigationPath
            .map((item, index) => {
                const isLast = index === this.state.navigationPath.length - 1;
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

    renderNavigationLevel(items, container) {
        if (!container || !items) return;
        
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
            const element = this.createNavigationItem(item);
            fragment.appendChild(element);
            
            // 缓存链接映射
            this.state.linksMap.set(item.id, element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createNavigationItem(item) {
        const hasChildren = item.children && item.children.length > 0;
        const hasChapters = item.chapters && item.chapters.length > 0;
        const isExpandable = hasChildren || hasChapters;
        
        const element = document.createElement('div');
        element.className = this.getItemClasses(item, isExpandable);
        element.setAttribute('data-id', item.id);
        element.setAttribute('data-level', item.level);
        element.setAttribute('data-type', item.type);
        
        if (isExpandable) {
            element.setAttribute('data-action', 'expand');
        } else {
            element.setAttribute('data-action', 'navigate');
        }
        
        element.innerHTML = `
            <span class="nav-title">${item.title}</span>
            ${isExpandable ? '<span class="expand-arrow">></span>' : ''}
        `;
        
        return element;
    }

    getItemClasses(item, isExpandable) {
        const classes = ['nav-item', `level-${item.level}`];
        
        if (isExpandable) {
            classes.push('expandable');
        } else {
            classes.push('clickable');
        }
        
        if (item.type === 'tool') {
            classes.push('tools-item');
        }
        
        return classes.join(' ');
    }

    // === 🎯 灵活数据驱动导航核心逻辑 ===
    
    handleNavItemClick(itemId) {
        const item = this.findItemById(itemId);
        if (!item) return;
        
        // 🎯 完全基于数据结构决定行为
        if (item.children && item.children.length > 0) {
            // 有子分类 → 展开子菜单（任意层级）
            this.expandSubmenu(item);
        } else if (item.chapters && item.chapters.length > 0) {
            // 有文章列表 → 展开文章列表  
            this.expandSubmenu(item);
        } else {
            // 无子项 → 直接导航，关闭侧边栏
            this.handleDirectNavigation(item);
        }
    }
    
    expandSubmenu(item) {
        // 更新导航路径
        this.updateNavigationPath(item);
        
        // 渲染面包屑
        this.renderBreadcrumb();
        
        // 根据数据类型渲染内容
        if (item.children && item.children.length > 0) {
            // 渲染子分类
            this.renderNavigationLevel(item.children, this.state.elements.submenuContent);
        } else if (item.chapters && item.chapters.length > 0) {
            // 渲染文章列表
            this.renderChaptersList(item.chapters, this.state.elements.submenuContent);
        }
        
        // 显示子菜单
        this.showSubmenu();
        
        // 更新主面板选中状态
        this.updateActiveState(item.id);
    }
    
    handleDirectNavigation(item) {
        // 🎯 直接导航：关闭侧边栏，触发相应事件
        this.close();
        
        // 🎯 完全基于item的属性决定行为，不硬编码特定ID
        if (item.action) {
            // 自定义action
            this.dispatchEvent('customNavigation', { item });
        } else if (item.seriesId === 'all-articles' || item.type === 'all-articles') {
            // 显示所有文章
            this.dispatchEvent('allArticlesRequested');
        } else if (item.seriesId === 'tools' || item.type === 'tools') {
            // 显示工具页面
            this.dispatchEvent('toolsRequested');
        } else if (item.chapters && item.chapters.length > 0) {
            // 有文章的分类
            this.dispatchEvent('seriesSelected', { 
                seriesId: item.id, 
                chapters: item.chapters,
                item: item
            });
        } else {
            // 默认：自定义导航事件
            this.dispatchEvent('navigationItemSelected', { item });
        }
        
        this.setActiveLink(item.id);
    }

    findItemById(id, items = null) {
        items = items || this.state.processedData;
        
        for (const item of items) {
            if (item.id === id) return item;
            if (item.children) {
                const found = this.findItemById(id, item.children);
                if (found) return found;
            }
        }
        return null;
    }

    updateNavigationPath(item) {
        // 简化版：直接添加到路径
        // 实际项目中可能需要更复杂的路径计算
        this.state.navigationPath.push({
            id: item.id,
            title: item.title,
            level: item.level
        });
        
        this.state.currentLevel = item.level + 1;
    }

    renderChaptersList(chapters, container) {
        if (!container || !chapters) return;
        
        const fragment = document.createDocumentFragment();
        
        chapters.forEach(chapter => {
            const element = document.createElement('div');
            element.className = `nav-item level-${this.state.currentLevel} clickable chapter-item`;
            element.setAttribute('data-id', chapter.id);
            element.setAttribute('data-action', 'navigate-chapter');
            element.innerHTML = `<span class="nav-title">${chapter.title}</span>`;
            
            fragment.appendChild(element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    showSubmenuWithContent(children, parentItem) {
        this.renderNavigationLevel(children, this.state.elements.submenuContent);
        this.showSubmenu();
    }

    showSubmenuWithChapters(chapters, parentItem) {
        this.renderChaptersList(chapters, this.state.elements.submenuContent);
        this.showSubmenu();
    }

    navigateToLevel(level, itemId) {
        // 面包屑导航：返回到指定层级
        const targetLevel = parseInt(level);
        
        // 移除当前层级之后的路径
        this.state.navigationPath = this.state.navigationPath.filter(p => p.level <= targetLevel);
        this.state.currentLevel = targetLevel + 1;
        
        if (this.state.navigationPath.length === 0) {
            // 返回主菜单
            this.renderMainNavigation();
        } else {
            // 重新渲染指定层级
            const targetItem = this.findItemById(itemId);
            if (targetItem) {
                this.expandSubmenu(targetItem);
            }
        }
    }

    // === 🎭 子菜单显示/隐藏逻辑 ===
    
    showSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        // 移除隐藏类，添加显示类
        submenu.classList.remove('hidden');
        submenu.classList.add('expanded');
        submenu.style.display = 'block';
        
        // 强制重绘后应用显示样式
        requestAnimationFrame(() => {
            submenu.style.transform = 'translateX(0)';
            submenu.style.opacity = '1';
            submenu.style.visibility = 'visible';
            submenu.style.pointerEvents = 'auto';
        });
    }

    hideSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        // 立即开始隐藏动画
        submenu.style.transform = 'translateX(100%)';
        submenu.style.opacity = '0';
        
        // 动画完成后完全隐藏
        setTimeout(() => {
            submenu.style.display = 'none';
            submenu.style.visibility = 'hidden';
            submenu.style.pointerEvents = 'none';
            submenu.classList.remove('expanded');
            submenu.classList.add('hidden');
            submenu.innerHTML = '';
        }, this.config.animationDuration);
    }

    // === 🎮 事件处理 ===
    
    setupEventListeners() {
        // 统一事件委托
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        window.addEventListener('resize', this.throttle(this.handleResize.bind(this), 250));
        window.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    handleGlobalClick(event) {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        
        if (!actionElement) {
            // 检查是否点击了外部区域
            this.handleOutsideClick(event);
            return;
        }
        
        const action = actionElement.dataset.action;
        const id = actionElement.dataset.id;
        
        event.preventDefault();
        event.stopPropagation();
        
        switch (action) {
            case 'toggle-sidebar':
                this.toggle();
                break;
            case 'close-sidebar':
                this.close();
                break;
            case 'nav-item':
                // 🎯 统一的导航项处理 - 完全数据驱动
                this.handleNavItemClick(id);
                break;
            case 'navigate-chapter':
                this.navigateToChapter(id);
                this.close();
                break;
            case 'breadcrumb-back':
                this.navigateBack();
                break;
            case 'breadcrumb-link':
                this.navigateToLevel(actionElement.dataset.level, id);
                break;
        }
    }

    handleOutsideClick(event) {
        if (!this.state.isOpen) return;
        
        const sidebar = this.state.elements.container;
        const hamburger = this.state.elements.hamburger;
        const overlay = this.state.elements.overlay;
        
        // 点击了遮罩或外部区域
        if (event.target === overlay || 
            (!sidebar.contains(event.target) && !hamburger.contains(event.target))) {
            this.close();
        }
    }

    handleDirectNavigation(id) {
        // 处理直接导航（如工具页面）
        const item = this.findItemById(id);
        if (!item) return;
        
        if (item.type === 'tool' && item.chapters) {
            // 工具分类，展开显示工具列表
            this.expandNavItem(id);
        } else {
            // 其他直接导航
            this.dispatchNavigationEvent(item);
            this.close();
        }
    }

    navigateBack() {
        if (this.state.navigationPath.length === 0) {
            this.close();
            return;
        }
        
        // 移除最后一级
        this.state.navigationPath.pop();
        this.state.currentLevel--;
        
        if (this.state.navigationPath.length === 0) {
            // 回到主菜单
            this.renderMainNavigation();
        } else {
            // 回到上一级 - 重新渲染父级的内容
            const parentItem = this.state.navigationPath[this.state.navigationPath.length - 1];
            const parent = this.findItemById(parentItem.id);
            
            if (parent) {
                // 重新渲染面包屑
                this.renderBreadcrumb();
                
                // 重新渲染父级内容
                if (parent.children && parent.children.length > 0) {
                    this.renderNavigationLevel(parent.children, this.state.elements.submenuContent);
                } else if (parent.chapters && parent.chapters.length > 0) {
                    this.renderChaptersList(parent.chapters, this.state.elements.submenuContent);
                }
                
                this.showSubmenu();
            } else {
                // 找不到父级，回到主菜单
                this.renderMainNavigation();
            }
        }
    }

    handleResize() {
        this.state.isMobile = window.innerWidth <= 768;
        // 可以添加其他响应式逻辑
    }

    handleKeydown(event) {
        if (event.key === 'Escape' && this.state.isOpen) {
            event.preventDefault();
            this.close();
        }
    }

    // === 🎭 侧边栏控制 ===
    
    toggle() {
        this.state.isOpen ? this.close() : this.open();
    }

    open() {
        this.state.isOpen = true;
        
        const { container, overlay } = this.state.elements;
        
        container.setAttribute('data-state', 'open');
        container.classList.add('open');
        overlay.classList.add('visible');
        
        document.body.style.overflow = 'hidden';
        document.body.classList.add('sidebar-open');
        
        // 确保汉堡按钮更新action
        this.updateHamburgerAction();
    }

    close() {
        this.state.isOpen = false;
        
        const { container, overlay } = this.state.elements;
        
        container.setAttribute('data-state', 'closed');
        container.classList.remove('open');
        overlay.classList.remove('visible');
        
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
        
        // 重置导航状态
        this.resetNavigationState();
        
        // 确保汉堡按钮更新action
        this.updateHamburgerAction();
    }

    resetNavigationState() {
        this.state.navigationPath = [];
        this.state.currentLevel = 1;
        this.hideSubmenu();
        this.renderMainNavigation();
    }

    updateHamburgerAction() {
        const hamburger = this.state.elements.hamburger;
        if (hamburger) {
            hamburger.setAttribute('data-action', this.state.isOpen ? 'close-sidebar' : 'toggle-sidebar');
        }
    }

    ensureCorrectInitialState() {
        // 确保初始状态正确
        this.close();
        this.hideSubmenu();
        
        // 确保内容区域不被遮挡
        if (this.contentArea) {
            this.contentArea.style.marginLeft = '0';
            this.contentArea.style.width = '100%';
        }
    }

    // === 🔗 兼容性API ===
    
    async waitForInitialization() {
        return this.initPromise;
    }

    navigateToChapter(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) {
            console.error('Chapter not found:', chapterId);
            return;
        }
        
        this.loadChapterContent(chapterId, chapterData);
    }

    async loadChapterContent(chapterId, chapterData) {
        try {
            // 处理工具页面导航
            if (chapterData.type === 'tool' && chapterData.url) {
                this.handleToolPageNavigation(chapterData);
                return;
            }
            
            // 加载章节内容
            const contentUrl = this.getContentUrl(chapterData);
            const response = await fetch(contentUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const content = await response.text();
            this.displayChapterContent(chapterId, content, chapterData);
            
        } catch (error) {
            console.error('Chapter loading failed:', error);
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
        this.setActiveLink(id);
        this.dispatchEvent('toolPageLoaded', { toolId: id, toolUrl: url, chapterData });
    }

    displayChapterContent(chapterId, content, chapterData) {
        this.contentArea.innerHTML = content;
        this.updateTitle(chapterData.title);
        this.setActiveLink(chapterData.id);

        this.dispatchEvent('chapterLoaded', { 
            chapterId, 
            hasAudio: chapterData.audio, 
            chapterData 
        });

        const { prevChapterId, nextChapterId } = this.getChapterNav(chapterId);
        this.dispatchEvent('navigationUpdated', { prevChapterId, nextChapterId });
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

    navigateToTool(toolId) {
        const toolData = this.state.chaptersMap.get(toolId);
        if (!toolData || toolData.type !== 'tool') {
            return false;
        }
        
        this.navigateToChapter(toolId);
        return true;
    }

    setActiveLink(id) {
        // 清除所有激活状态
        this.state.linksMap.forEach(link => link.classList.remove('active'));
        
        // 设置新的激活状态
        const newActiveLink = this.state.linksMap.get(id);
        if (newActiveLink) {
            newActiveLink.classList.add('active');
            this.state.activeLink = newActiveLink;
        }
    }

    updateActiveState(itemId) {
        this.setActiveLink(itemId);
    }

    getChapterNav(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) return { prevChapterId: null, nextChapterId: null };

        // 查找章节所在的父级
        const parentItem = this.findParentItem(chapterId);
        if (!parentItem || !parentItem.chapters) {
            return { prevChapterId: null, nextChapterId: null };
        }
        
        const currentIndex = parentItem.chapters.findIndex(c => c.id === chapterId);
        const prevChapter = parentItem.chapters[currentIndex - 1];
        const nextChapter = parentItem.chapters[currentIndex + 1];

        return {
            prevChapterId: prevChapter?.id || null,
            nextChapterId: nextChapter?.id || null
        };
    }

    findParentItem(chapterId) {
        // 简化版查找，实际项目中可能需要更复杂的逻辑
        for (const item of this.state.processedData) {
            if (item.chapters && item.chapters.some(c => c.id === chapterId)) {
                return item;
            }
            if (item.children) {
                for (const child of item.children) {
                    if (child.chapters && child.chapters.some(c => c.id === chapterId)) {
                        return child;
                    }
                }
            }
        }
        return null;
    }

    // === 🛠️ 工具方法 ===
    
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return (...args) => {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    updateTitle(text) {
        document.title = text ? `${text} | ${this.config.siteTitle}` : this.config.siteTitle;
    }

    displayError(message) {
        this.contentArea.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px; color: #dc3545;">
                ${message}
            </div>
        `;
    }

    dispatchEvent(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    dispatchNavigationEvent(item) {
        if (item.chapters && item.chapters.length > 0) {
            this.dispatchEvent('seriesSelected', { 
                seriesId: item.id, 
                chapters: item.chapters 
            });
        }
    }

    handleInitializationError(error) {
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

    // === 🧹 清理方法 ===
    
    destroy() {
        // 关闭侧边栏
        this.close();
        
        // 恢复原导航
        this.restoreOriginalNavigation();
        
        // 移除DOM元素
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
        
        // 清理状态
        this.state.linksMap.clear();
        this.state.chaptersMap.clear();
        this.state.expandedMenus.clear();
        
        // 清理body样式
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
    }

    restoreOriginalNavigation() {
        const originalNav = document.querySelector('[data-backup="true"]');
        if (originalNav) {
            originalNav.style.display = '';
            originalNav.removeAttribute('data-backup');
        }
    }

    // === 📊 兼容性方法保持 ===
    
    getToolsList() {
        const tools = [];
        
        // 从可用工具数据中获取
        if (this.state.availableTools) {
            tools.push(...this.state.availableTools);
        }
        
        // 也从章节映射中查找工具类型
        this.state.chaptersMap.forEach((chapter, id) => {
            if (chapter.type === 'tool') {
                tools.push({
                    id: chapter.id,
                    title: chapter.title,
                    description: chapter.description,
                    url: chapter.url,
                    category: chapter.category
                });
            }
        });
        
        return tools;
    }

    getCacheStats() {
        return {
            linksMapSize: this.state.linksMap.size,
            chaptersMapSize: this.state.chaptersMap.size,
            expandedMenusSize: this.state.expandedMenus.size
        };
    }

    clearCache() {
        this.state.linksMap.clear();
        this.state.chaptersMap.clear();
        this.state.expandedMenus.clear();
    }

    getPerformanceStats() {
        return {
            currentLevel: this.state.currentLevel,
            navigationPathLength: this.state.navigationPath.length,
            isOpen: this.state.isOpen,
            processedDataLength: this.state.processedData.length
        };
    }
}

// === 🌐 全局导出 ===
window.EnglishSite.Navigation = Navigation;

// === 🔗 兼容性全局函数 ===
window.navigateToWordFrequency = function() {
    if (window.app && window.app.navigation) {
        return window.app.navigation.navigateToTool('word-frequency');
    }
    return false;
};

window.closeSidebarNavigation = function() {
    if (window.app && window.app.navigation && window.app.navigation.state.isOpen) {
        window.app.navigation.close();
        return true;
    }
    return false;
};