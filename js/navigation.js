// js/navigation.js - 真正的自定义导航系统
window.EnglishSite = window.EnglishSite || {};

/**
 * 🚀 真正的自定义导航系统
 * - 根据JSON配置自动生成任意层级导航
 * - 支持无限嵌套结构
 * - 重构版现代UI外观
 * - 完全兼容现有功能（不破坏任何现有模块）
 */
class Navigation {
    constructor(navContainer, contentArea, navData, options = {}) {
        this.navContainer = navContainer;
        this.contentArea = contentArea;
        this.navData = navData || [];
        this.options = options;
        
        // 🎯 自定义导航状态管理
        this.state = {
            // 侧边栏状态
            isOpen: false,
            isMobile: window.innerWidth <= 768,
            
            // 🔑 自定义导航核心状态
            currentPath: [],           // 当前导航路径 [{id, title, level, data}, ...]
            currentLevel: 0,           // 当前显示层级
            navigationStack: [],       // 导航栈，支持任意深度
            
            // DOM和数据缓存
            elements: {},
            linksMap: new Map(),
            chaptersMap: new Map(),
            navigationTree: null,      // 🔑 自动解析的导航树
            
            // 兼容性状态
            activeLink: null,
            hasInitialContent: false,
            isMainPage: false
        };
        
        this.config = window.EnglishSite.ConfigManager?.createModuleConfig('navigation', {
            siteTitle: options.siteTitle || 'Learner',
            debug: options.debug || false,
            animationDuration: 250,
            autoLoadDefaultContent: true,
            defaultContentType: 'all-articles',
            // 🔑 自定义导航配置
            maxDepth: 10,              // 最大支持层级数
            autoDetectStructure: true, // 自动检测JSON结构
            supportDynamicLoading: true, // 支持动态加载
            ...options
        }) || {
            siteTitle: options.siteTitle || 'Learner',
            debug: options.debug || false,
            animationDuration: 250,
            autoLoadDefaultContent: true,
            defaultContentType: 'all-articles',
            maxDepth: 10,
            autoDetectStructure: true,
            supportDynamicLoading: true,
            ...options
        };
        
        this.cache = window.EnglishSite.CacheManager?.createCache('navigation', {
            maxSize: 50,
            ttl: 300000,
            strategy: 'lru'
        }) || new Map();
        
        this.initPromise = this.initialize();
    }

    // === 🚀 核心初始化 ===
    async initialize() {
        try {
            if (window.EnglishSite.coreToolsReady) {
                await window.EnglishSite.coreToolsReady;
            }
            
            this.validateRequiredElements();
            this.createSidebarStructure();
            
            // 🔑 自定义导航核心：自动解析JSON结构
            this.parseNavigationStructure();
            this.buildChaptersMapping();
            
            this.setupEventListeners();
            this.renderCurrentLevel();
            this.ensureCorrectInitialState();
            
            // 确保兼容性
            await this.ensureInitialContentDisplay();
            
            if (this.config.debug) {
                console.log('[CustomNavigation] 🚀 自定义导航初始化完成');
                console.log('[CustomNavigation] 📊 导航树:', this.state.navigationTree);
                console.log('[CustomNavigation] 📚 章节映射:', this.state.chaptersMap.size);
            }
            
        } catch (error) {
            console.error('[CustomNavigation] 初始化失败:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // === 🔑 自定义导航核心：自动解析任意JSON结构 ===
    parseNavigationStructure() {
        this.state.navigationTree = this.buildNavigationTree(this.navData, 0);
        
        if (this.config.debug) {
            console.log('[CustomNavigation] 🌳 自动解析导航结构完成');
            this.debugNavigationTree(this.state.navigationTree);
        }
    }

    // 🔑 递归构建导航树（支持任意嵌套）
    buildNavigationTree(items, level) {
        if (!Array.isArray(items)) return [];
        
        return items.map(item => {
            const node = {
                // 基础信息
                id: item.seriesId || item.id || this.generateId(),
                title: item.series || item.title || 'Untitled',
                level: level,
                
                // 原始数据
                originalData: item,
                
                // 🔑 自动检测节点类型
                type: this.detectNodeType(item),
                
                // 🔑 自动解析子节点
                children: [],
                chapters: [],
                
                // 扩展属性
                url: item.url,
                description: item.description,
                thumbnail: item.thumbnail,
                icon: item.icon,
                openInNewTab: item.openInNewTab,
                
                // 🔑 自定义属性支持
                customProps: this.extractCustomProps(item)
            };
            
            // 🔑 自动解析子结构（支持多种命名方式）
            const childrenSources = [
                item.children,     // 标准的children
                item.subItems,     // 可能的subItems
                item.subSeries,    // 可能的subSeries
                item.categories,   // 可能的categories
                item.sections      // 可能的sections
            ].filter(Boolean);
            
            if (childrenSources.length > 0) {
                node.children = this.buildNavigationTree(childrenSources[0], level + 1);
            }
            
            // 🔑 自动解析章节（支持多种命名方式）
            const chapterSources = [
                item.chapters,     // 标准的chapters
                item.articles,     // 可能的articles
                item.pages,        // 可能的pages
                item.items,        // 可能的items
                item.content       // 可能的content
            ].filter(Boolean);
            
            if (chapterSources.length > 0) {
                node.chapters = this.normalizeChapters(chapterSources[0], node.id);
            }
            
            return node;
        });
    }

    // 🔑 自动检测节点类型
    detectNodeType(item) {
        // 明确指定的类型
        if (item.type) return item.type;
        
        // 自动推断
        if (item.url && item.url.startsWith('http')) return 'external';
        if (item.seriesId === 'tools' || item.category === 'tools') return 'tools';
        if (item.seriesId === 'all-articles') return 'all-articles';
        
        // 根据内容推断
        const hasChildren = this.hasAnyChildren(item);
        const hasChapters = this.hasAnyChapters(item);
        
        if (hasChildren && hasChapters) return 'category-with-content';
        if (hasChildren) return 'category';
        if (hasChapters) return 'series';
        
        return 'page';
    }

    // 🔑 检测是否有子项（支持多种命名）
    hasAnyChildren(item) {
        return !!(item.children || item.subItems || item.subSeries || 
                 item.categories || item.sections);
    }

    // 🔑 检测是否有章节（支持多种命名）
    hasAnyChapters(item) {
        return !!(item.chapters || item.articles || item.pages || 
                 item.items || item.content);
    }

    // 🔑 标准化章节数据
    normalizeChapters(chapters, parentId) {
        if (!Array.isArray(chapters)) return [];
        
        return chapters.map(chapter => ({
            ...chapter,
            id: chapter.id || this.generateId(),
            title: chapter.title || 'Untitled Chapter',
            seriesId: parentId,
            type: chapter.type || 'chapter'
        }));
    }

    // 🔑 提取自定义属性
    extractCustomProps(item) {
        const standardProps = new Set([
            'id', 'seriesId', 'title', 'series', 'children', 'chapters',
            'type', 'url', 'description', 'thumbnail', 'icon', 'openInNewTab',
            'subItems', 'subSeries', 'categories', 'sections',
            'articles', 'pages', 'items', 'content'
        ]);
        
        const customProps = {};
        Object.keys(item).forEach(key => {
            if (!standardProps.has(key)) {
                customProps[key] = item[key];
            }
        });
        
        return customProps;
    }

    // 🔑 构建章节映射（兼容现有模块）
    buildChaptersMapping() {
        this.state.chaptersMap.clear();
        this.walkNavigationTree(this.state.navigationTree, (node) => {
            if (node.chapters && node.chapters.length > 0) {
                node.chapters.forEach(chapter => {
                    const chapterWithMeta = {
                        ...chapter,
                        seriesId: node.id,
                        seriesTitle: node.title,
                        parentNode: node
                    };
                    this.state.chaptersMap.set(chapter.id, chapterWithMeta);
                });
            }
        });
        
        if (this.config.debug) {
            console.log(`[CustomNavigation] 📚 构建章节映射: ${this.state.chaptersMap.size} 个章节`);
        }
    }

    // 🔑 遍历导航树的工具函数
    walkNavigationTree(nodes, callback) {
        if (!Array.isArray(nodes)) return;
        
        nodes.forEach(node => {
            callback(node);
            if (node.children && node.children.length > 0) {
                this.walkNavigationTree(node.children, callback);
            }
        });
    }

    // === 🎨 自定义渲染系统 ===
    
    renderCurrentLevel() {
        const currentNodes = this.getCurrentLevelNodes();
        this.renderBreadcrumb();
        this.renderNavigationLevel(currentNodes, this.state.elements.mainContent);
        this.hideSubmenu();
    }

    // 🔑 获取当前层级的节点
    getCurrentLevelNodes() {
        if (this.state.currentPath.length === 0) {
            // 根级别
            return this.state.navigationTree;
        }
        
        // 当前路径的最后一个节点的子节点
        const currentParent = this.state.currentPath[this.state.currentPath.length - 1];
        return currentParent.data.children || [];
    }

    renderBreadcrumb() {
        const breadcrumbEl = this.state.elements.breadcrumb;
        if (!breadcrumbEl) return;
        
        if (this.state.currentPath.length === 0) {
            breadcrumbEl.style.display = 'none';
            return;
        }
        
        breadcrumbEl.style.display = 'block';
        const pathHtml = this.state.currentPath
            .map((pathItem, index) => {
                const isLast = index === this.state.currentPath.length - 1;
                if (isLast) {
                    return `<span class="breadcrumb-current">${pathItem.title}</span>`;
                } else {
                    return `<a href="#" class="breadcrumb-link" data-action="breadcrumb-link" data-level="${pathItem.level}" data-id="${pathItem.id}">${pathItem.title}</a>`;
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

    renderNavigationLevel(nodes, container) {
        if (!container || !nodes) return;
        
        const fragment = document.createDocumentFragment();
        
        nodes.forEach(node => {
            const element = this.createNavigationItem(node);
            fragment.appendChild(element);
            this.state.linksMap.set(node.id, element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createNavigationItem(node) {
        const hasChildren = node.children && node.children.length > 0;
        const hasChapters = node.chapters && node.chapters.length > 0;
        const isExpandable = hasChildren || hasChapters;
        
        const element = document.createElement('div');
        element.className = this.getItemClasses(node, isExpandable);
        element.setAttribute('data-id', node.id);
        element.setAttribute('data-level', node.level);
        element.setAttribute('data-type', node.type);
        element.setAttribute('data-action', 'nav-item');
        
        // 🔑 支持图标显示
        const iconHtml = node.icon ? `<span class="nav-icon">${node.icon}</span>` : '';
        
        element.innerHTML = `
            ${iconHtml}
            <span class="nav-title">${node.title}</span>
            ${isExpandable ? '<span class="expand-arrow">></span>' : ''}
        `;
        
        return element;
    }

    getItemClasses(node, isExpandable) {
        const classes = ['nav-item', `level-${node.level}`];
        
        if (isExpandable) {
            classes.push('expandable');
        } else {
            classes.push('clickable');
        }
        
        // 根据类型添加特殊样式
        if (node.type === 'tool' || node.type === 'tools') {
            classes.push('tools-item');
        }
        if (node.type === 'external') {
            classes.push('external-item');
        }
        if (node.type === 'all-articles') {
            classes.push('all-articles-item');
        }
        
        return classes.join(' ');
    }

renderChaptersList(chapters, container) {
    if (!container) return;
    
    // 🔑 最简单的测试版本
    let html = '<div style="padding: 10px; background: yellow; margin: 10px;">测试：章节列表</div>';
    
    if (chapters && chapters.length > 0) {
        chapters.forEach(chapter => {
            html += `
                <div style="
                    padding: 15px; 
                    margin: 10px; 
                    background: white; 
                    border: 2px solid red;
                    font-size: 16px;
                    cursor: pointer;
                " 
                onclick="alert('点击了: ${chapter.title}')"
                data-id="${chapter.id}"
                data-action="navigate-chapter">
                    📚 ${chapter.title}
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

    // === 🎯 自定义导航核心逻辑 ===
    
handleNavItemClick(itemId) {
    alert('点击了: ' + itemId); // 🔍 测试是否被调用
    
    const node = this.findNodeById(itemId);
    if (!node) {
        alert('找不到节点: ' + itemId); // 🔍 测试节点查找
        console.error('[CustomNavigation] 找不到节点:', itemId);
        return;
    }
    
    alert('找到节点: ' + node.title); // 🔍 测试节点数据
    
    // ... 原来的代码
        
        const node = this.findNodeById(itemId);
        if (!node) {
            console.error('[CustomNavigation] 找不到节点:', itemId);
            return;
        }
        
        if (this.config.debug) {
            console.log('[CustomNavigation] 🎯 点击节点:', node.title, '类型:', node.type);
        }
        
        // 🔑 根据节点类型和内容决定行为
        const hasChildren = node.children && node.children.length > 0;
        const hasChapters = node.chapters && node.chapters.length > 0;
        
        if (hasChildren) {
            // 有子节点 → 进入下一级
            this.navigateToLevel(node);
        } else if (hasChapters) {
            // 有章节 → 显示章节列表
            this.showChaptersList(node);
        } else {
            // 叶子节点 → 直接导航
            this.handleDirectNavigation(node);
        }
    }

    // 🔑 导航到指定层级
    navigateToLevel(node) {
        // 添加到导航路径
        this.state.currentPath.push({
            id: node.id,
            title: node.title,
            level: node.level,
            data: node
        });
        
        this.state.currentLevel = node.level + 1;
        
        // 渲染下一级
        this.renderBreadcrumb();
        this.renderNavigationLevel(node.children, this.state.elements.mainContent);
        this.updateActiveState(node.id);
        
        if (this.config.debug) {
            console.log('[CustomNavigation] 📁 导航到层级:', this.state.currentPath.map(p => p.title).join(' > '));
        }
    }

    // 🔑 显示章节列表
    showChaptersList(node) {
        // 添加到导航路径
        this.state.currentPath.push({
            id: node.id,
            title: node.title,
            level: node.level,
            data: node
        });
        
        this.state.currentLevel = node.level + 1;
        
        // 渲染面包屑和章节列表
        this.renderBreadcrumb();
        this.renderChaptersList(node.chapters, this.state.elements.submenuContent);
        this.showSubmenu();
        this.updateActiveState(node.id);
        
        if (this.config.debug) {
            console.log('[CustomNavigation] 📚 显示章节列表:', node.title);
        }
    }

    // 🔑 处理直接导航（叶子节点）
    handleDirectNavigation(node) {
        this.close();
        this.state.isMainPage = false;
        
        // 🔑 根据节点类型执行相应操作
        switch (node.type) {
            case 'external':
                this.handleExternalNavigation(node);
                break;
            case 'all-articles':
                this.handleAllArticlesNavigation(node);
                break;
            case 'tools':
                this.handleToolsNavigation(node);
                break;
            case 'tool':
                this.handleSingleToolNavigation(node);
                break;
            case 'chapter':
                this.navigateToChapter(node.id);
                break;
            case 'series':
                this.handleSeriesNavigation(node);
                break;
            default:
                // 自定义类型或未知类型的处理
                this.handleCustomNavigation(node);
                break;
        }
        
        this.setActiveLink(node.id);
    }

    // 🔑 各种类型的导航处理（保持兼容性）
    handleExternalNavigation(node) {
        const openInNew = node.openInNewTab !== false;
        if (openInNew) {
            window.open(node.url, '_blank', 'noopener,noreferrer');
            this.displayExternalLinkMessage(node);
        } else {
            window.location.href = node.url;
        }
    }

    handleAllArticlesNavigation(node) {
        this.state.isMainPage = true;
        const allChapters = this.getAllChapters();
        this.dispatchEvent('allArticlesRequested', { chapters: allChapters });
        this.updateTitle('所有文章');
    }

    handleToolsNavigation(node) {
        this.dispatchEvent('toolsRequested');
        this.updateTitle('学习工具');
    }

    handleSingleToolNavigation(node) {
        if (node.url) {
            if (node.url.startsWith('http')) {
                window.open(node.url, '_blank', 'noopener,noreferrer');
                this.displayToolRedirectMessage(node.title, node.url);
            } else {
                window.location.href = node.url;
            }
        }
        this.updateTitle(node.title);
        this.dispatchEvent('toolPageLoaded', { toolId: node.id, toolUrl: node.url, chapterData: node });
    }

    handleSeriesNavigation(node) {
        this.dispatchEvent('seriesSelected', { 
            seriesId: node.id, 
            chapters: node.chapters,
            item: node
        });
        this.updateTitle(`系列: ${node.title}`);
    }

    handleCustomNavigation(node) {
        // 🔑 支持完全自定义的导航行为
        if (node.customProps.customAction) {
            // 支持自定义action
            this.dispatchEvent('customNavigation', { 
                action: node.customProps.customAction,
                node: node
            });
        } else if (node.url) {
            // 有URL就跳转
            window.location.href = node.url;
        } else if (node.chapters && node.chapters.length > 0) {
            // 有章节就当作系列处理
            this.handleSeriesNavigation(node);
        } else {
            // 默认派发通用导航事件
            this.dispatchEvent('navigationItemSelected', { item: node });
        }
        
        this.updateTitle(node.title);
    }

    // 🔑 返回上级导航
    navigateBack() {
        if (this.state.currentPath.length === 0) {
            this.close();
            return;
        }
        
        // 移除最后一级
        this.state.currentPath.pop();
        this.state.currentLevel--;
        
        if (this.state.currentPath.length === 0) {
            // 返回根级别
            this.renderCurrentLevel();
        } else {
            // 返回上一级
            const parentNode = this.state.currentPath[this.state.currentPath.length - 1];
            
            this.renderBreadcrumb();
            
            if (parentNode.data.children && parentNode.data.children.length > 0) {
                this.renderNavigationLevel(parentNode.data.children, this.state.elements.mainContent);
            } else if (parentNode.data.chapters && parentNode.data.chapters.length > 0) {
                this.renderChaptersList(parentNode.data.chapters, this.state.elements.submenuContent);
                this.showSubmenu();
            }
        }
    }

    // 🔑 导航到指定层级（面包屑点击）
    navigateToSpecificLevel(level, nodeId) {
        const targetLevel = parseInt(level);
        
        // 截断导航路径
        this.state.currentPath = this.state.currentPath.filter(p => p.level <= targetLevel);
        this.state.currentLevel = targetLevel + 1;
        
        if (this.state.currentPath.length === 0) {
            this.renderCurrentLevel();
        } else {
            const targetNode = this.findNodeById(nodeId);
            if (targetNode) {
                this.navigateToLevel(targetNode);
            }
        }
    }

    // === 🔧 工具函数 ===
    
    findNodeById(id, nodes = null) {
        nodes = nodes || this.state.navigationTree;
        
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length > 0) {
                const found = this.findNodeById(id, node.children);
                if (found) return found;
            }
        }
        return null;
    }

    generateId() {
        return 'nav_' + Math.random().toString(36).substr(2, 9);
    }

    debugNavigationTree(nodes, depth = 0) {
        const indent = '  '.repeat(depth);
        nodes.forEach(node => {
            console.log(`${indent}${node.title} (${node.type}) - Level ${node.level}`);
            if (node.children && node.children.length > 0) {
                console.log(`${indent}  ├─ Children:`);
                this.debugNavigationTree(node.children, depth + 2);
            }
            if (node.chapters && node.chapters.length > 0) {
                console.log(`${indent}  └─ Chapters: ${node.chapters.length}`);
            }
        });
    }

    // === 侧边栏UI控制（保持重构版外观）===
    
    validateRequiredElements() {
        if (!this.navContainer || !this.contentArea) {
            throw new Error('Navigation: 缺少必需的DOM元素');
        }
    }

    createSidebarStructure() {
        this.hideOriginalNavigation();
        this.createHeaderElements();
        this.createSidebarContainer();
        this.createOverlay();
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
        let header = document.querySelector('.site-header');
        if (!header) {
            header = document.createElement('header');
            header.className = 'site-header';
            header.innerHTML = '<div class="brand-logo">Learner</div>';
            document.body.insertBefore(header, document.body.firstChild);
        }
        
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
        }
    }

    createSidebarContainer() {
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
    }

    showSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
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

    hideSubmenu() {
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) return;
        
        submenu.style.transform = 'translateX(100%)';
        submenu.style.opacity = '0';
        
        setTimeout(() => {
            submenu.style.display = 'none';
            submenu.style.visibility = 'hidden';
            submenu.style.pointerEvents = 'none';
            submenu.classList.remove('expanded');
            submenu.classList.add('hidden');
            submenu.innerHTML = '';
        }, this.config.animationDuration);
    }

    setupEventListeners() {
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        window.addEventListener('resize', this.throttle(this.handleResize.bind(this), 250));
        window.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    handleGlobalClick(event) {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        
        if (!actionElement) {
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
                this.navigateToSpecificLevel(actionElement.dataset.level, id);
                break;
        }
    }

    handleOutsideClick(event) {
        if (!this.state.isOpen) return;
        
        const sidebar = this.state.elements.container;
        const hamburger = this.state.elements.hamburger;
        const overlay = this.state.elements.overlay;
        
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

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
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
        
        this.resetNavigationState();
        this.updateHamburgerAction();
    }

    resetNavigationState() {
        this.state.currentPath = [];
        this.state.currentLevel = 0;
        this.hideSubmenu();
        this.renderCurrentLevel();
    }

    updateHamburgerAction() {
        const hamburger = this.state.elements.hamburger;
        if (hamburger) {
            hamburger.setAttribute('data-action', this.state.isOpen ? 'close-sidebar' : 'toggle-sidebar');
        }
    }

    ensureCorrectInitialState() {
        this.close();
        this.hideSubmenu();
        
        if (this.contentArea) {
            this.contentArea.style.marginLeft = '0';
            this.contentArea.style.width = '100%';
        }
    }

    // === 🔗 兼容性API（确保与现有模块完全兼容）===
    
    async waitForInitialization() {
        return this.initPromise;
    }

    async ensureInitialContentDisplay() {
        if (this.state.hasInitialContent) return;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const chapterId = urlParams.get('chapter');
            const seriesId = urlParams.get('series');
            
            if (chapterId) {
                this.navigateToChapter(chapterId);
                this.state.hasInitialContent = true;
                return;
            }
            
            if (seriesId) {
                const node = this.findNodeById(seriesId);
                if (node) {
                    this.handleDirectNavigation(node);
                    this.state.hasInitialContent = true;
                    return;
                }
            }
            
            if (this.config.autoLoadDefaultContent) {
                await this.loadDefaultContent();
            }
            
        } catch (error) {
            console.error('[CustomNavigation] 初始内容加载失败:', error);
            this.displayFallbackContent();
        }
    }

    async loadDefaultContent() {
        if (this.config.defaultContentType === 'all-articles') {
            this.showAllArticles();
            this.state.isMainPage = true;
        }
        
        this.state.hasInitialContent = true;
    }

    showAllArticles() {
        this.state.isMainPage = true;
        const allChapters = this.getAllChapters();
        this.dispatchEvent('allArticlesRequested', { chapters: allChapters });
        this.setActiveLink('all-articles');
        this.updateTitle('所有文章');
    }

    getAllChapters() {
        return Array.from(this.state.chaptersMap.values());
    }

    navigateToChapter(chapterId) {
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) {
            console.error('Chapter not found:', chapterId);
            return;
        }
        
        this.state.isMainPage = false;
        this.loadChapterContent(chapterId, chapterData);
    }

    async loadChapterContent(chapterId, chapterData) {
        try {
            if (chapterData.externalUrl) {
                const openInNew = chapterData.openInNewTab !== false;
                if (openInNew) {
                    window.open(chapterData.externalUrl, '_blank', 'noopener,noreferrer');
                    this.displayExternalLinkMessage(chapterData);
                } else {
                    window.location.href = chapterData.externalUrl;
                }
                return;
            }
            
            if (chapterData.type === 'tool' && chapterData.url) {
                this.handleToolPageNavigation(chapterData);
                return;
            }
            
            let content = this.cache.get ? this.cache.get(chapterId) : null;
            
            if (!content) {
                const contentUrl = this.getContentUrl(chapterData);
                const response = await fetch(contentUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                content = await response.text();
                
                if (this.cache.set) {
                    this.cache.set(chapterId, content);
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

        const hasAudio = chapterData.audio === true || 
                         !!chapterData.audioFile || 
                         !!chapterData.audio || 
                         !!chapterData.srtFile;

        this.dispatchEvent('chapterLoaded', { 
            chapterId, 
            hasAudio: hasAudio, 
            chapterData: {
                ...chapterData,
                audioFile: chapterData.audioFile || chapterData.audio || `audio/${chapterId}.mp3`,
                srtFile: chapterData.srtFile || `srt/${chapterId}.srt`,
                duration: chapterData.duration,
                difficulty: chapterData.difficulty,
                tags: chapterData.tags,
                publishDate: chapterData.publishDate,
                description: chapterData.description,
                thumbnail: chapterData.thumbnail
            }
        });

        const { prevChapterId, nextChapterId } = this.getChapterNav(chapterId);
        this.dispatchEvent('navigationUpdated', { prevChapterId, nextChapterId });
    }

    setActiveLink(id) {
        this.state.linksMap.forEach(link => link.classList.remove('active'));
        
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
        const chapterData = this.state.chaptersMap.get(chapterId);
        if (!chapterData) return null;
        
        return this.findNodeById(chapterData.seriesId);
    }

    updateTitle(text) {
        document.title = text ? `${text} | ${this.config.siteTitle}` : this.config.siteTitle;
    }

    displayError(message) {
        this.contentArea.innerHTML = `<p class="error-message" style="text-align: center; padding: 40px; color: #dc3545;">${message}</p>`;
    }

    displayExternalLinkMessage(data) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🌐</div>
                <h2 style="margin-bottom: 16px;">${data.title}</h2>
                <p style="margin-bottom: 24px; opacity: 0.9;">${data.description || '外部链接已在新窗口打开'}</p>
            </div>
        `;
    }

    displayToolRedirectMessage(title, url) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
                <h2 style="margin-bottom: 16px;">${title}</h2>
                <p style="margin-bottom: 24px; opacity: 0.9;">工具页面已在新窗口打开</p>
            </div>
        `;
    }

    displayFallbackContent() {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📚</div>
                <h1 style="margin-bottom: 16px; font-size: 2rem;">Learner</h1>
                <p style="margin-bottom: 24px; opacity: 0.9;">正在加载内容，请稍候...</p>
            </div>
        `;
        
        this.updateTitle('加载中');
        this.state.hasInitialContent = true;
    }

    dispatchEvent(eventName, detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    handleInitializationError(error) {
        this.contentArea.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #dc3545; margin-bottom: 16px;">自定义导航初始化失败</h2>
                <p>遇到了一些问题：${error.message}</p>
                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    重新加载
                </button>
            </div>
        `;
    }

    // === 🔧 实用方法 ===
    
    // 获取导航统计信息
    getNavigationStats() {
        return {
            totalNodes: this.countTotalNodes(this.state.navigationTree),
            totalChapters: this.state.chaptersMap.size,
            maxDepth: this.getMaxDepth(this.state.navigationTree),
            currentLevel: this.state.currentLevel,
            currentPath: this.state.currentPath.map(p => p.title),
            nodeTypes: this.getNodeTypeStats()
        };
    }

    countTotalNodes(nodes) {
        let count = nodes.length;
        nodes.forEach(node => {
            if (node.children && node.children.length > 0) {
                count += this.countTotalNodes(node.children);
            }
        });
        return count;
    }

    getMaxDepth(nodes, currentDepth = 0) {
        let maxDepth = currentDepth;
        nodes.forEach(node => {
            if (node.children && node.children.length > 0) {
                const childDepth = this.getMaxDepth(node.children, currentDepth + 1);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        });
        return maxDepth;
    }

    getNodeTypeStats() {
        const stats = {};
        this.walkNavigationTree(this.state.navigationTree, (node) => {
            stats[node.type] = (stats[node.type] || 0) + 1;
        });
        return stats;
    }

    destroy() {
        this.close();
        
        const elementsToRemove = ['container', 'overlay'];
        elementsToRemove.forEach(key => {
            const element = this.state.elements[key];
            if (element && element.parentElement) {
                element.remove();
            }
        });
        
        const hamburger = this.state.elements.hamburger;
        if (hamburger && hamburger.parentElement) {
            hamburger.remove();
        }
        
        this.state.linksMap.clear();
        this.state.chaptersMap.clear();
        this.state.currentPath = [];
        
        document.body.style.overflow = '';
        document.body.classList.remove('sidebar-open');
        
        if (this.config.debug) {
            console.log('[CustomNavigation] 🧹 自定义导航已销毁');
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
    if (window.app && window.app.navigation && window.app.navigation.state.isOpen) {
        window.app.navigation.close();
        return true;
    }
    return false;
};

// 🔍 调试函数
window.debugCustomNavigation = function() {
    if (window.app && window.app.navigation) {
        const nav = window.app.navigation;
        console.log('=== 🔍 自定义导航调试信息 ===');
        console.log('📊 导航统计:', nav.getNavigationStats());
        console.log('🌳 导航树:', nav.state.navigationTree);
        console.log('📚 章节映射:', nav.state.chaptersMap);
        console.log('🗂️ 当前路径:', nav.state.currentPath);
        return nav.getNavigationStats();
    }
    return null;
};