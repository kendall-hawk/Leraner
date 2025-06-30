// js/navigation.js - 修复版导航系统（解决主页内容显示问题）
window.EnglishSite = window.EnglishSite || {};

/**
 * 🚀 修复版导航系统
 * 修复内容：
 * - 解决主页没有关联到所有文章页面的问题
 * - 确保页面初始化时有默认内容显示
 * - 优化事件派发和内容加载逻辑
 * - 支持新JSON结构（children + chapters）
 * - 保持100%接口兼容性
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
            lastElement: null,
            
            // 🆕 新增状态：内容管理
            hasInitialContent: false,  // 是否已加载初始内容
            defaultContentLoaded: false, // 默认内容是否已加载
            isMainPage: false          // 是否在主页状态
        };
        
        // 配置管理
        this.config = window.EnglishSite.ConfigManager?.createModuleConfig('navigation', {
            siteTitle: options.siteTitle || '互动学习平台',
            debug: options.debug || true, // 🔍 临时开启调试模式
            animationDuration: 250,
            maxLevels: 4,
            // 🆕 新增配置：内容管理
            autoLoadDefaultContent: true,  // 自动加载默认内容
            defaultContentType: 'all-articles', // 默认内容类型
            showWelcomeMessage: true,      // 显示欢迎信息
            ...options
        });
        
        // 缓存管理器（兼容性）
        this.cache = {
            manager: this.createCacheManager()
        };
        
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
            
            // 🆕 重要修复：确保主页有内容显示
            await this.ensureInitialContentDisplay();
            
            if (this.config.debug) {
                console.log('[Navigation] 🚀 修复版初始化完成，主页内容已加载');
            }
            
        } catch (error) {
            console.error('[Navigation] 初始化失败:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // 🆕 新增方法：确保初始内容显示
    async ensureInitialContentDisplay() {
        if (this.state.hasInitialContent) {
            return; // 已有内容，无需重复加载
        }

        try {
            // 检查当前URL是否指定了特定内容
            const urlParams = new URLSearchParams(window.location.search);
            const chapterId = urlParams.get('chapter');
            const seriesId = urlParams.get('series');
            
            if (chapterId) {
                // URL指定了章节，加载该章节
                this.navigateToChapter(chapterId);
                this.state.hasInitialContent = true;
                return;
            }
            
            if (seriesId) {
                // URL指定了系列，加载该系列
                const series = this.findItemById(seriesId);
                if (series) {
                    this.handleDirectNavigation(series);
                    this.state.hasInitialContent = true;
                    return;
                }
            }
            
            // 🔥 关键修复：默认显示所有文章页面
            if (this.config.autoLoadDefaultContent) {
                await this.loadDefaultContent();
            }
            
        } catch (error) {
            console.error('[Navigation] 初始内容加载失败:', error);
            // 即使出错也要显示一个基本页面
            this.displayFallbackContent();
        }
    }

    // 🔑 修复：加载默认内容（恢复事件驱动）
    async loadDefaultContent() {
        if (this.config.defaultContentType === 'all-articles') {
            // 🔑 不直接显示HTML，而是触发事件
            this.showAllArticles();
            this.state.isMainPage = true;
            
            if (this.config.debug) {
                console.log('[Navigation] 🏠 触发默认内容事件：所有文章');
            }
        } else if (this.config.defaultContentType === 'welcome') {
            // 显示欢迎页面
            this.displayWelcomePage();
        } else if (this.config.defaultContentType === 'tools') {
            // 显示工具页面
            this.showToolsPage();
        }
        
        this.state.hasInitialContent = true;
        this.state.defaultContentLoaded = true;
    }

    // 🆕 新增方法：显示欢迎页面
    displayWelcomePage() {
        const allChapters = this.getAllChapters();
        const recentChapters = allChapters.slice(0, 6); // 显示最近6个章节
        
        const welcomeHtml = `
            <div class="welcome-page">
                <div class="welcome-header" style="text-align: center; margin-bottom: 40px; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">📚</div>
                    <h1 style="margin-bottom: 16px; font-size: 2.5rem;">欢迎来到英语学习平台</h1>
                    <p style="opacity: 0.9; font-size: 1.1rem;">探索丰富的学习资源，提升您的英语水平</p>
                </div>
                
                <div class="quick-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px;">
                    <div class="stat-card" style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
                        <div style="font-size: 2rem; color: #28a745; margin-bottom: 8px;">${allChapters.length}</div>
                        <div style="color: #666;">篇章节内容</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
                        <div style="font-size: 2rem; color: #dc3545; margin-bottom: 8px;">${this.state.processedData.length}</div>
                        <div style="color: #666;">个学习系列</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center;">
                        <div style="font-size: 2rem; color: #ffc107; margin-bottom: 8px;">${this.state.availableTools.length}</div>
                        <div style="color: #666;">个学习工具</div>
                    </div>
                </div>
                
                <div class="quick-actions" style="margin-bottom: 40px;">
                    <h2 style="margin-bottom: 20px; color: #333;">快速开始</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                        <button onclick="window.app.navigation.showAllArticles()" class="action-btn" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 16px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: transform 0.2s ease;">
                            📖 浏览所有文章
                        </button>
                        <button onclick="window.app.navigation.showToolsPage()" class="action-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 16px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: transform 0.2s ease;">
                            🛠️ 学习工具
                        </button>
                    </div>
                </div>
                
                ${recentChapters.length > 0 ? `
                <div class="recent-content">
                    <h2 style="margin-bottom: 20px; color: #333;">最新内容</h2>
                    <div class="chapters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                        ${recentChapters.map(chapter => `
                            <div class="chapter-card" onclick="window.app.navigation.navigateToChapter('${chapter.id}')" 
                                 style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;"
                                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#667eea';" 
                                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)'; this.style.borderColor='transparent';">
                                <h3 style="margin-bottom: 8px; color: #333; font-size: 1.1rem;">${chapter.title}</h3>
                                <p style="color: #666; font-size: 0.9rem; margin: 0;">${chapter.description || '点击查看详细内容'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            
            <style>
            .action-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            </style>
        `;
        
        this.contentArea.innerHTML = welcomeHtml;
        this.updateTitle('欢迎');
        this.dispatchEvent('welcomePageLoaded');
    }

    // 🆕 新增方法：显示备用内容
    displayFallbackContent() {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📚</div>
                <h1 style="margin-bottom: 16px; font-size: 2rem;">英语学习平台</h1>
                <p style="margin-bottom: 24px; opacity: 0.9;">正在加载内容，请稍候...</p>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                    <button onclick="window.app.navigation.showAllArticles()" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        📖 浏览所有文章
                    </button>
                    <button onclick="window.app.navigation.showToolsPage()" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        🛠️ 学习工具
                    </button>
                </div>
            </div>
        `;
        
        this.updateTitle('加载中');
        this.state.hasInitialContent = true;
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
            header.insertBefore(hamburger, header.firstChild);
        } else {
            // 更新现有按钮的action
            const existingHamburger = header.querySelector('.nav-toggle');
            existingHamburger.setAttribute('data-action', 'toggle-sidebar');
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
        overlay.setAttribute('data-action', 'close-sidebar');
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
        // 🔑 关键修复：支持新JSON结构（children + chapters）并保持原有事件机制
        this.state.processedData = this.normalizeNavigationData(this.navData);
        
        // 🔑 重要：按照新版本方式构建章节映射
        this.buildChaptersMapV2();
        
        // 加载工具数据
        this.loadToolsData();
        
        if (this.config.debug) {
            console.log('[Navigation] 📊 数据预处理完成');
            console.log('[Navigation] 📚 章节映射大小:', this.state.chaptersMap.size);
            console.log('[Navigation] 📚 示例章节:', Array.from(this.state.chaptersMap.values())[0]);
        }
    }

    // 🔑 新增：兼容新JSON结构的章节映射构建
    buildChaptersMapV2() {
        this.state.chaptersMap.clear();
        let totalChapters = 0;
        
        this.state.processedData.forEach(series => {
            if (!series.id && !series.seriesId) return;
            
            const seriesId = series.seriesId || series.id;
            
            // 🔑 处理直接的chapters
            if (series.chapters && Array.isArray(series.chapters)) {
                series.chapters.forEach(chapter => {
                    if (!chapter.id) return;
                    
                    const chapterWithSeriesInfo = {
                        ...chapter, // 🔑 保持所有原始字段，包括thumbnail和audio
                        seriesId: seriesId,
                        seriesTitle: series.series || series.title
                    };
                    
                    this.state.chaptersMap.set(chapter.id, chapterWithSeriesInfo);
                    totalChapters++;
                    
                    if (this.config.debug && chapter.thumbnail) {
                        console.log(`[Navigation] 🖼️ 章节 ${chapter.id} 缓存缩略图:`, chapter.thumbnail);
                    }
                });
            }
            
            // 🔑 处理children结构（新增支持）
            if (series.children && Array.isArray(series.children)) {
                series.children.forEach(child => {
                    if (child.chapters && Array.isArray(child.chapters)) {
                        child.chapters.forEach(chapter => {
                            if (!chapter.id) return;
                            
                            const chapterWithSeriesInfo = {
                                ...chapter, // 🔑 保持所有原始字段
                                seriesId: seriesId,
                                seriesTitle: series.series || series.title,
                                childId: child.id,
                                childTitle: child.title
                            };
                            
                            this.state.chaptersMap.set(chapter.id, chapterWithSeriesInfo);
                            totalChapters++;
                            
                            if (this.config.debug && chapter.thumbnail) {
                                console.log(`[Navigation] 🖼️ 子章节 ${chapter.id} 缓存缩略图:`, chapter.thumbnail);
                            }
                        });
                    }
                });
            }
        });
        
        if (this.config.debug) {
            console.log(`[Navigation] 🗺️ 构建完成，总章节数: ${totalChapters}`);
        }
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
            children: [], // 先初始化为空数组
            chapters: item.chapters || [],
            url: item.url,
            description: item.description,
            thumbnail: item.thumbnail,
            openInNewTab: item.openInNewTab
        };
        
        // 🔑 修复：正确处理子项（支持3级结构）
        if (item.children && Array.isArray(item.children)) {
            normalized.children = item.children.map(child => 
                this.normalizeNavItem(child, level + 1)
            );
            
            if (this.config.debug) {
                console.log(`[Navigation] 📂 项目 "${normalized.title}" 有 ${normalized.children.length} 个子项`);
            }
        }
        
        return normalized;
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
        return [];
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
        element.setAttribute('data-type', item.type || 'category');
        
        // 🎯 统一使用nav-item action，让数据决定行为
        element.setAttribute('data-action', 'nav-item');
        
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

    // === 🎯 灵活数据驱动导航核心逻辑 ===
    
    handleNavItemClick(itemId) {
        const item = this.findItemById(itemId);
        if (!item) {
            console.error('[Navigation] 找不到项目:', itemId);
            return;
        }
        
        if (this.config.debug) {
            console.log('[Navigation] 🎯 点击项目:', item.title);
            console.log('[Navigation] 📊 项目数据:', item);
            console.log('[Navigation] 📂 子项数量:', item.children ? item.children.length : 0);
            console.log('[Navigation] 📚 章节数量:', item.chapters ? item.chapters.length : 0);
        }
        
        // 🎯 完全基于数据结构决定行为
        if (item.children && item.children.length > 0) {
            // 有子分类 → 展开子菜单（任意层级）
            console.log('[Navigation] 🔄 展开子菜单，子项:', item.children);
            this.expandSubmenu(item);
        } else if (item.chapters && item.chapters.length > 0) {
            // 有文章列表 → 展开文章列表  
            console.log('[Navigation] 📚 展开文章列表');
            this.expandSubmenu(item);
        } else {
            // 无子项 → 直接导航，关闭侧边栏
            console.log('[Navigation] 🎯 直接导航');
            this.handleDirectNavigation(item);
        }
    }
    
    expandSubmenu(item) {
        if (this.config.debug) {
            console.log('[Navigation] 🔄 展开子菜单，项目:', item.title);
            console.log('[Navigation] 📂 子项:', item.children);
            console.log('[Navigation] 📚 章节:', item.chapters);
        }
        
        // 更新导航路径
        this.updateNavigationPath(item);
        
        // 渲染面包屑
        this.renderBreadcrumb();
        
        // 🔑 修复：根据数据类型渲染内容
        if (item.children && item.children.length > 0) {
            // 渲染子分类
            console.log('[Navigation] 🎯 渲染子分类列表');
            this.renderNavigationLevel(item.children, this.state.elements.submenuContent);
        } else if (item.chapters && item.chapters.length > 0) {
            // 渲染文章列表
            console.log('[Navigation] 🎯 渲染文章列表');
            this.renderChaptersList(item.chapters, this.state.elements.submenuContent);
        }
        
        // 显示子菜单
        this.showSubmenu();
        
        // 更新主面板选中状态
        this.updateActiveState(item.id);
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
        this.state.navigationPath.push({
            id: item.id,
            title: item.title,
            level: item.level
        });
        
        this.state.currentLevel = item.level + 1;
    }

    handleDirectNavigation(item) {
        // 🎯 直接导航：关闭侧边栏，触发相应事件
        this.close();
        
        // 标记不再是主页状态
        this.state.isMainPage = false;
        
        // 🎯 处理外部链接类型
        if (item.type === 'external' && item.url) {
            const openInNew = item.openInNewTab !== false;
            if (openInNew) {
                window.open(item.url, '_blank', 'noopener,noreferrer');
                this.displayExternalLinkMessage({
                    title: item.title || item.series,
                    description: item.description,
                    externalUrl: item.url
                });
            } else {
                window.location.href = item.url;
            }
            return;
        }
        
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
        } else if (item.type === 'tools-category' && item.chapters) {
            // 工具分类，展开显示工具列表
            this.expandSubmenu(item);
            return; // 不关闭侧边栏
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

    // === 🎭 子菜单显示/隐藏逻辑（修复动画方向）===
    
    showSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        if (this.config.debug) {
            console.log('[Navigation] 🎭 显示子菜单');
        }
        
        // 🔑 修复：确保子菜单从右侧滑入
        submenu.classList.remove('hidden');
        submenu.classList.add('expanded');
        submenu.style.display = 'block';
        
        // 🔑 关键修复：设置正确的初始位置和动画
        submenu.style.transform = 'translateX(100%)'; // 初始位置在右侧
        submenu.style.opacity = '0';
        submenu.style.visibility = 'visible';
        submenu.style.pointerEvents = 'auto';
        
        // 强制重绘后应用显示样式
        requestAnimationFrame(() => {
            submenu.style.transform = 'translateX(0)'; // 滑入到正常位置
            submenu.style.opacity = '1';
        });
    }

    hideSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        if (this.config.debug) {
            console.log('[Navigation] 🎭 隐藏子菜单');
        }
        
        // 🔑 修复：确保子菜单向右侧滑出
        submenu.style.transform = 'translateX(100%)'; // 滑出到右侧
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

    handleResize() {
        this.state.isMobile = window.innerWidth <= 768;
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
        
        // 标记不再是主页状态
        this.state.isMainPage = false;
        
        this.loadChapterContent(chapterId, chapterData);
    }

    async loadChapterContent(chapterId, chapterData) {
        try {
            // 🎯 处理外部链接
            if (chapterData.externalUrl) {
                const openInNew = chapterData.openInNewTab !== false; // 默认新窗口
                if (openInNew) {
                    window.open(chapterData.externalUrl, '_blank', 'noopener,noreferrer');
                    this.displayExternalLinkMessage(chapterData);
                } else {
                    window.location.href = chapterData.externalUrl;
                }
                return;
            }
            
            // 🎯 处理工具页面导航
            if (chapterData.type === 'tool' && chapterData.url) {
                this.handleToolPageNavigation(chapterData);
                return;
            }
            
            // 🎯 处理外部工具
            if (chapterData.type === 'external-tool' && chapterData.url) {
                const openInNew = chapterData.openInNewTab !== false;
                if (openInNew) {
                    window.open(chapterData.url, '_blank', 'noopener,noreferrer');
                    this.displayExternalToolMessage(chapterData);
                } else {
                    window.location.href = chapterData.url;
                }
                return;
            }
            
            // 🎯 加载章节内容（支持自定义URL）
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
            console.error('Chapter loading failed:', error);
            this.displayError('章节加载失败，请检查网络连接');
            this.dispatchEvent('chapterLoadError', { chapterId, error });
        }
    }

    getContentUrl(chapterData) {
        // 🎯 优先使用JSON中的url字段
        if (chapterData.url) {
            return chapterData.url.startsWith('http') ? chapterData.url : chapterData.url;
        }
        // 🎯 回退到默认路径
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

        // 🔑 修复：正确处理音频数据传递
        const hasAudio = chapterData.audio === true || 
                         !!chapterData.audioFile || 
                         !!chapterData.audio || // 🔑 支持 "audio": "audio/chap1.mp3" 格式
                         !!chapterData.srtFile;

        this.dispatchEvent('chapterLoaded', { 
            chapterId, 
            hasAudio: hasAudio, 
            chapterData: {
                ...chapterData,
                // 🔑 修复：正确传递音频文件路径
                audioFile: chapterData.audioFile || chapterData.audio || `audio/${chapterId}.mp3`,
                srtFile: chapterData.srtFile || `srt/${chapterId}.srt`,
                duration: chapterData.duration,
                // 🔑 传递其他有用信息
                difficulty: chapterData.difficulty,
                tags: chapterData.tags,
                publishDate: chapterData.publishDate,
                description: chapterData.description,
                thumbnail: chapterData.thumbnail
            }
        });

        const { prevChapterId, nextChapterId } = this.getChapterNav(chapterId);
        this.dispatchEvent('navigationUpdated', { prevChapterId, nextChapterId });
        
        if (this.config.debug) {
            console.log('[Navigation] 🎵 章节加载完成，音频信息:', {
                chapterId,
                hasAudio,
                audioFile: chapterData.audioFile || chapterData.audio,
                thumbnail: chapterData.thumbnail
            });
        }
    }

    displayExternalLinkMessage(chapterData) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🌐</div>
                <h2 style="margin-bottom: 16px;">${chapterData.title}</h2>
                <p style="margin-bottom: 24px; opacity: 0.9;">${chapterData.description || '外部链接已在新窗口打开'}</p>
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                    <small style="opacity: 0.8;">如果页面没有自动打开，请点击下方链接：</small><br>
                    <a href="${chapterData.externalUrl}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 500;">
                        ${chapterData.externalUrl}
                    </a>
                </div>
            </div>
        `;
    }

    displayExternalToolMessage(chapterData) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">${chapterData.icon || '🔧'}</div>
                <h2 style="margin-bottom: 16px;">${chapterData.title}</h2>
                <p style="margin-bottom: 24px; opacity: 0.9;">${chapterData.description || '外部工具已在新窗口打开'}</p>
                ${chapterData.features ? `
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                        <strong>主要功能：</strong><br>
                        ${chapterData.features.map(f => `• ${f}`).join('<br>')}
                    </div>
                ` : ''}
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px auto; max-width: 400px;">
                    <small style="opacity: 0.8;">如果页面没有自动打开，请点击下方链接：</small><br>
                    <a href="${chapterData.url}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 500;">
                        ${chapterData.url}
                    </a>
                </div>
            </div>
        `;
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

    createCacheManager() {
        return window.EnglishSite.CacheManager?.createCache('navigation', {
            maxSize: 50,
            ttl: 300000,
            strategy: 'lru'
        }) || new Map();
    }

    // === 📊 增强的兼容性方法 ===
    
    // 🔑 修复：获取所有章节（支持新JSON结构）
    getAllChapters() {
        // 直接从章节映射中获取所有章节，确保包含完整数据
        const allChapters = Array.from(this.state.chaptersMap.values());
        
        if (this.config.debug) {
            console.log('[Navigation] 📚 获取所有章节，总数:', allChapters.length);
            if (allChapters.length > 0) {
                console.log('[Navigation] 📚 第一个章节示例:', allChapters[0]);
                const withThumbnails = allChapters.filter(ch => ch.thumbnail);
                const withAudio = allChapters.filter(ch => ch.audio);
                console.log('[Navigation] 🖼️ 有缩略图的章节数:', withThumbnails.length);
                console.log('[Navigation] 🎵 有音频的章节数:', withAudio.length);
            }
        }
        
        return allChapters;
    }

    // 🔑 修复：确保事件监听器能接收到完整数据
    showAllArticles() {
        // 标记为主页状态
        this.state.isMainPage = true;
        
        // 🔑 获取完整的章节数据，包含缩略图和音频信息
        const allChapters = this.getAllChapters();
        
        // 🔑 触发事件，传递完整数据给监听器
        this.dispatchEvent('allArticlesRequested', {
            chapters: allChapters // 传递完整的章节数据
        });
        
        this.setActiveLink('all-articles');
        this.updateTitle('所有文章');
        
        if (this.config.debug) {
            console.log('[Navigation] 🎯 触发 allArticlesRequested 事件');
            console.log('[Navigation] 📊 传递章节数量:', allChapters.length);
            console.log('[Navigation] 📊 章节数据示例:', allChapters[0]);
            
            const withThumbnails = allChapters.filter(ch => ch.thumbnail);
            const withAudio = allChapters.filter(ch => ch.audio);
            console.log('[Navigation] 🖼️ 有缩略图:', withThumbnails.length);
            console.log('[Navigation] 🎵 有音频:', withAudio.length);
        }
    }

    showToolsPage() {
        this.dispatchEvent('toolsRequested');
        this.setActiveLink('tools');
        this.updateTitle('学习工具');
        
        if (this.config.debug) {
            console.log('[Navigation] 🛠️ 触发 toolsRequested 事件');
        }
    }

    displayToolsPageContent() {
        const toolsHtml = this.state.availableTools.map(tool => `
            <div class="tool-card" onclick="window.location.href='${tool.url || 'word-frequency.html'}'" 
                 style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); cursor: pointer; transition: all 0.3s ease; border: 2px solid transparent; margin-bottom: 20px;"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#667eea';" 
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.1)'; this.style.borderColor='transparent';">
                <div class="tool-icon" style="font-size: 2.5rem; text-align: center; margin-bottom: 16px;">${tool.icon || '🔧'}</div>
                <h3 style="margin-bottom: 12px; color: #333; font-size: 1.3rem; text-align: center;">${tool.title}</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5; text-align: center; min-height: 48px;">${tool.description || ''}</p>
                <div class="tool-footer" style="text-align: center;">
                    <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s ease; pointer-events: none;">使用工具 →</button>
                </div>
            </div>
        `).join('');

        this.contentArea.innerHTML = `
            <div class="tools-page">
                <div class="tools-header" style="text-align: center; margin-bottom: 40px; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🛠️</div>
                    <h1 style="margin-bottom: 16px; font-size: 2.5rem;">学习工具箱</h1>
                    <p style="opacity: 0.9; font-size: 1.1rem;">提升英语学习效率的实用工具集合</p>
                </div>
                
                <div class="tools-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; padding: 0 20px;">
                    ${toolsHtml}
                </div>
            </div>
        `;
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
            processedDataLength: this.state.processedData.length,
            hasInitialContent: this.state.hasInitialContent,
            isMainPage: this.state.isMainPage
        };
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

// 🔍 调试函数：检查导航数据状态
window.debugNavigationData = function() {
    if (window.app && window.app.navigation) {
        const nav = window.app.navigation;
        console.log('=== 🔍 导航系统调试信息 ===');
        console.log('📊 处理后的数据:', nav.state.processedData);
        console.log('🗺️ 章节映射大小:', nav.state.chaptersMap.size);
        console.log('📚 所有章节:', nav.getAllChapters());
        
        const allChapters = nav.getAllChapters();
        const withThumbnails = allChapters.filter(ch => ch.thumbnail);
        const withAudio = allChapters.filter(ch => ch.audio);
        
        console.log(`🖼️ 缩略图统计: ${withThumbnails.length}/${allChapters.length} 个章节有缩略图`);
        console.log(`🎵 音频统计: ${withAudio.length}/${allChapters.length} 个章节有音频`);
        
        if (withThumbnails.length > 0) {
            console.log('🖼️ 有缩略图的章节:', withThumbnails.map(ch => ({
                id: ch.id,
                title: ch.title,
                thumbnail: ch.thumbnail
            })));
        }
        
        if (withAudio.length > 0) {
            console.log('🎵 有音频的章节:', withAudio.map(ch => ({
                id: ch.id,
                title: ch.title,
                audio: ch.audio
            })));
        }
        
        return {
            processedData: nav.state.processedData,
            chaptersMap: nav.state.chaptersMap,
            allChapters: allChapters,
            withThumbnails: withThumbnails,
            withAudio: withAudio
        };
    }
    return null;
};

// 🔍 调试函数：测试事件触发
window.testAllArticlesEvent = function() {
    if (window.app && window.app.navigation) {
        console.log('🧪 测试触发 allArticlesRequested 事件...');
        window.app.navigation.showAllArticles();
        return true;
    }
    return false;
};

// 🔍 调试函数：检查事件监听器
window.checkEventListeners = function() {
    console.log('🔍 检查文档上的事件监听器...');
    
    // 临时添加一个测试监听器
    const testHandler = function(event) {
        console.log('✅ 接收到 allArticlesRequested 事件:', event.detail);
        const chapters = event.detail.chapters;
        if (chapters && chapters.length > 0) {
            console.log('📊 事件包含章节数量:', chapters.length);
            console.log('📊 第一个章节数据:', chapters[0]);
            const withThumbnails = chapters.filter(ch => ch.thumbnail);
            console.log('🖼️ 事件中有缩略图的章节:', withThumbnails.length);
        }
    };
    
    document.addEventListener('allArticlesRequested', testHandler, { once: true });
    
    // 触发事件进行测试
    if (window.app && window.app.navigation) {
        setTimeout(() => {
            window.app.navigation.showAllArticles();
        }, 100);
    }
    
    return '测试监听器已添加，即将触发事件...';
};

// 🔍 新增调试函数：检查导航结构
window.debugNavigationStructure = function() {
    if (window.app && window.app.navigation) {
        const nav = window.app.navigation;
        console.log('=== 🏗️ 导航结构调试 ===');
        
        nav.state.processedData.forEach((item, index) => {
            console.log(`${index + 1}. ${item.title} (ID: ${item.id})`);
            console.log(`   - 类型: ${item.type}`);
            console.log(`   - 子项数量: ${item.children ? item.children.length : 0}`);
            console.log(`   - 章节数量: ${item.chapters ? item.chapters.length : 0}`);
            
            if (item.children && item.children.length > 0) {
                item.children.forEach((child, childIndex) => {
                    console.log(`   └─ ${childIndex + 1}. ${child.title} (ID: ${child.id})`);
                    console.log(`      - 章节数量: ${child.chapters ? child.chapters.length : 0}`);
                    if (child.chapters && child.chapters.length > 0) {
                        child.chapters.forEach((chapter, chapterIndex) => {
                            console.log(`         └─ ${chapterIndex + 1}. ${chapter.title} (ID: ${chapter.id})`);
                        });
                    }
                });
            }
            
            if (item.chapters && item.chapters.length > 0) {
                item.chapters.forEach((chapter, chapterIndex) => {
                    console.log(`   └─ ${chapterIndex + 1}. ${chapter.title} (ID: ${chapter.id})`);
                });
            }
        });
        
        return nav.state.processedData;
    }
    return null;
};

// 🔍 新增调试函数：测试BBC English点击
window.testBBCEnglishClick = function() {
    if (window.app && window.app.navigation) {
        console.log('🧪 模拟点击 BBC English...');
        const nav = window.app.navigation;
        
        // 查找BBC English项目
        const bbcItem = nav.findItemById('bbc-english');
        if (bbcItem) {
            console.log('✅ 找到 BBC English:', bbcItem);
            nav.handleNavItemClick('bbc-english');
        } else {
            console.error('❌ 找不到 BBC English 项目');
        }
        
        return bbcItem;
    }
    return null;
};