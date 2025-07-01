// js/navigation.js - 完整修复版本
window.EnglishSite = window.EnglishSite || {};

/**
 * 🚀 真正的自定义导航系统 - 完整修复版
 * - 修复子菜单定位问题
 * - 确保子菜单内容正确显示在右侧
 * - 完全兼容现有功能
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
            debug: true, // 🔧 强制开启调试
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
            debug: true, // 🔧 强制开启调试
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
            console.log('[Navigation] 🚀 开始初始化...');
            
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
            
            console.log('[Navigation] ✅ 初始化完成');
            console.log('[Navigation] 📊 导航树:', this.state.navigationTree);
            console.log('[Navigation] 📚 章节映射:', this.state.chaptersMap.size);
            
        } catch (error) {
            console.error('[Navigation] ❌ 初始化失败:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // === 🔑 自定义导航核心：自动解析任意JSON结构 ===
    parseNavigationStructure() {
        this.state.navigationTree = this.buildNavigationTree(this.navData, 0);
        console.log('[Navigation] 🌳 导航结构解析完成');
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

    hasAnyChildren(item) {
        return !!(item.children || item.subItems || item.subSeries || 
                 item.categories || item.sections);
    }

    hasAnyChapters(item) {
        return !!(item.chapters || item.articles || item.pages || 
                 item.items || item.content);
    }

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
        
        console.log(`[Navigation] 📚 构建章节映射: ${this.state.chaptersMap.size} 个章节`);
    }

    walkNavigationTree(nodes, callback) {
        if (!Array.isArray(nodes)) return;
        
        nodes.forEach(node => {
            callback(node);
            if (node.children && node.children.length > 0) {
                this.walkNavigationTree(node.children, callback);
            }
        });
    }

    // === 🎨 渲染系统 ===
    
    renderCurrentLevel() {
        const currentNodes = this.getCurrentLevelNodes();
        this.renderBreadcrumb();
        this.renderNavigationLevel(currentNodes, this.state.elements.mainContent);
        this.hideSubmenu();
    }

    getCurrentLevelNodes() {
        if (this.state.currentPath.length === 0) {
            return this.state.navigationTree;
        }
        
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
        if (!container || !nodes) {
            console.warn('[Navigation] ⚠️ 渲染失败：容器或节点为空', { container, nodes });
            return;
        }
        
        console.log('[Navigation] 📝 渲染导航层级:', nodes.length, '个节点');
        
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

    // 🔧 关键修复：章节列表渲染
    renderChaptersList(chapters, container) {
        if (!container) {
            console.error('[Navigation] ❌ 子菜单容器不存在！无法渲染章节列表');
            return;
        }
        
        if (!chapters || chapters.length === 0) {
            console.warn('[Navigation] ⚠️ 没有章节数据');
            return;
        }
        
        console.log('[Navigation] 📚 渲染章节列表:', chapters.length, '个章节');
        console.log('[Navigation] 📍 目标容器:', container.className);
        
        const fragment = document.createDocumentFragment();
        
        chapters.forEach(chapter => {
            const element = document.createElement('div');
            element.className = `nav-item level-${this.state.currentLevel + 1} clickable chapter-item`;
            element.setAttribute('data-id', chapter.id);
            element.setAttribute('data-action', 'navigate-chapter');
            
            const iconHtml = chapter.icon ? `<span class="nav-icon">${chapter.icon}</span>` : '';
            element.innerHTML = `${iconHtml}<span class="nav-title">${chapter.title}</span>`;
            
            fragment.appendChild(element);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        console.log('[Navigation] ✅ 章节列表渲染完成');
    }

    // === 🎯 导航核心逻辑 ===
    
    handleNavItemClick(itemId) {
        const node = this.findNodeById(itemId);
        if (!node) {
            console.error('[Navigation] ❌ 找不到节点:', itemId);
            return;
        }
        
        console.log('[Navigation] 🎯 点击节点:', node.title, '类型:', node.type);
        
        const hasChildren = node.children && node.children.length > 0;
        const hasChapters = node.chapters && node.chapters.length > 0;
        
        console.log('[Navigation] 📊 节点分析:', {
            hasChildren: hasChildren,
            hasChapters: hasChapters,
            childrenCount: node.children?.length || 0,
            chaptersCount: node.chapters?.length || 0
        });
        
        if (hasChildren) {
            console.log('[Navigation] 📁 进入子级别');
            this.navigateToLevel(node);
        } else if (hasChapters) {
            console.log('[Navigation] 📚 显示章节列表');
            this.showChaptersList(node);
        } else {
            console.log('[Navigation] 🔗 直接导航');
            this.handleDirectNavigation(node);
        }
    }

    navigateToLevel(node) {
        this.state.currentPath.push({
            id: node.id,
            title: node.title,
            level: node.level,
            data: node
        });
        
        this.state.currentLevel = node.level + 1;
        
        this.renderBreadcrumb();
        this.renderNavigationLevel(node.children, this.state.elements.mainContent);
        this.updateActiveState(node.id);
        
        console.log('[Navigation] 📁 导航到层级:', this.state.currentPath.map(p => p.title).join(' > '));
    }

    // 🔧 关键修复：显示章节列表方法
    showChaptersList(node) {
        console.log('[Navigation] 🚀 开始显示章节列表:', node.title);
        
        // 验证子菜单容器
        const submenuContent = this.state.elements.submenuContent;
        if (!submenuContent) {
            console.error('[Navigation] ❌ 子菜单内容容器不存在！');
            console.log('[Navigation] 🔍 当前元素状态:', this.state.elements);
            
            // 🔧 应急修复：重新查找或创建子菜单容器
            this.emergencyFixSubmenuContainer();
            return;
        }
        
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
        this.renderChaptersList(node.chapters, submenuContent);
        this.showSubmenu();
        this.updateActiveState(node.id);
        
        console.log('[Navigation] ✅ 章节列表显示完成');
    }

    // 🔧 应急修复：重新创建子菜单容器
    emergencyFixSubmenuContainer() {
        console.log('[Navigation] 🚑 应急修复：重新创建子菜单容器');
        
        let submenu = document.querySelector('.sidebar-submenu');
        if (!submenu) {
            console.log('[Navigation] 📦 创建子菜单面板');
            submenu = document.createElement('div');
            submenu.className = 'sidebar-submenu';
            
            const sidebarContainer = document.querySelector('.sidebar-container');
            if (sidebarContainer) {
                sidebarContainer.appendChild(submenu);
            } else {
                console.error('[Navigation] ❌ 连侧边栏容器都找不到了！');
                return;
            }
        }
        
        let submenuContent = submenu.querySelector('.submenu-content');
        if (!submenuContent) {
            console.log('[Navigation] 📦 创建子菜单内容区');
            submenuContent = document.createElement('div');
            submenuContent.className = 'submenu-content';
            submenu.appendChild(submenuContent);
        }
        
        // 重新缓存元素
        this.state.elements.submenuPanel = submenu;
        this.state.elements.submenuContent = submenuContent;
        
        console.log('[Navigation] ✅ 应急修复完成，重新尝试显示章节列表');
        
        // 重新尝试显示章节列表
        const node = this.state.currentPath[this.state.currentPath.length - 1]?.data;
        if (node && node.chapters) {
            this.renderChaptersList(node.chapters, submenuContent);
            this.showSubmenu();
        }
    }

    handleDirectNavigation(node) {
        this.close();
        this.state.isMainPage = false;
        
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
                this.handleCustomNavigation(node);
                break;
        }
        
        this.setActiveLink(node.id);
    }

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
        if (node.customProps.customAction) {
            this.dispatchEvent('customNavigation', { 
                action: node.customProps.customAction,
                node: node
            });
        } else if (node.url) {
            window.location.href = node.url;
        } else if (node.chapters && node.chapters.length > 0) {
            this.handleSeriesNavigation(node);
        } else {
            this.dispatchEvent('navigationItemSelected', { item: node });
        }
        
        this.updateTitle(node.title);
    }

    navigateBack() {
        if (this.state.currentPath.length === 0) {
            this.close();
            return;
        }
        
        this.state.currentPath.pop();
        this.state.currentLevel--;
        
        if (this.state.currentPath.length === 0) {
            this.renderCurrentLevel();
        } else {
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

    navigateToSpecificLevel(level, nodeId) {
        const targetLevel = parseInt(level);
        
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

    // === 🔧 DOM和UI控制 ===
    
    validateRequiredElements() {
        if (!this.navContainer || !this.contentArea) {
            throw new Error('Navigation: 缺少必需的DOM元素');
        }
    }

    createSidebarStructure() {
        console.log('[Navigation] 🏗️ 创建侧边栏结构');
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

    // 🔧 完全重写：createSidebarContainer方法
    createSidebarContainer() {
        console.log('[Navigation] 📦 创建侧边栏容器...');
        
        // 清除旧的侧边栏
        const oldSidebar = document.querySelector('.sidebar-container');
        if (oldSidebar) {
            console.log('[Navigation] 🗑️ 移除旧侧边栏');
            oldSidebar.remove();
        }
        
        // 🔧 关键修复：分步创建确保DOM结构完整
        
        // 1. 创建侧边栏容器
        const sidebarContainer = document.createElement('div');
        sidebarContainer.className = 'sidebar-container';
        sidebarContainer.setAttribute('data-state', 'closed');
        console.log('[Navigation] ✅ 创建侧边栏容器');
        
        // 2. 创建主导航面板
        const sidebarMain = document.createElement('nav');
        sidebarMain.className = 'sidebar-main';
        console.log('[Navigation] ✅ 创建主导航面板');
        
        // 3. 创建面包屑导航
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'nav-breadcrumb';
        console.log('[Navigation] ✅ 创建面包屑导航');
        
        // 4. 创建导航内容区
        const navContent = document.createElement('div');
        navContent.className = 'nav-content';
        console.log('[Navigation] ✅ 创建导航内容区');
        
        // 5. 组装主导航面板
        sidebarMain.appendChild(breadcrumb);
        sidebarMain.appendChild(navContent);
        console.log('[Navigation] ✅ 组装主导航面板');
        
        // 6. 🔧 关键修复：创建子菜单面板
        const submenu = document.createElement('div');
        submenu.className = 'sidebar-submenu';
        console.log('[Navigation] ✅ 创建子菜单面板');
        
        // 7. 🔧 关键修复：创建子菜单内容区
        const submenuContent = document.createElement('div');
        submenuContent.className = 'submenu-content';
        console.log('[Navigation] ✅ 创建子菜单内容区');
        
        // 8. 🔧 确保子菜单内容区被正确添加
        submenu.appendChild(submenuContent);
        console.log('[Navigation] ✅ 子菜单内容区添加到子菜单面板');
        
        // 9. 组装整个侧边栏容器
        sidebarContainer.appendChild(sidebarMain);
        sidebarContainer.appendChild(submenu);
        console.log('[Navigation] ✅ 组装完整侧边栏容器');
        
        // 10. 添加到页面
        document.body.appendChild(sidebarContainer);
        console.log('[Navigation] ✅ 侧边栏容器添加到页面');
        
        // 11. 立即验证DOM结构
        const verification = {
            sidebarContainer: !!document.querySelector('.sidebar-container'),
            sidebarMain: !!document.querySelector('.sidebar-main'),
            submenuPanel: !!document.querySelector('.sidebar-submenu'),
            submenuContent: !!document.querySelector('.submenu-content'),
            breadcrumb: !!document.querySelector('.nav-breadcrumb'),
            navContent: !!document.querySelector('.nav-content')
        };
        
        console.log('[Navigation] 📊 DOM结构验证:', verification);
        
        // 如果有任何元素缺失，立即报错
        const failed = Object.entries(verification).filter(([key, value]) => !value);
        if (failed.length > 0) {
            console.error('[Navigation] ❌ DOM创建失败:', failed.map(([key]) => key));
            throw new Error(`DOM创建失败: ${failed.map(([key]) => key).join(', ')}`);
        }
        
        console.log('[Navigation] ✅ 侧边栏容器创建完成');
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

    // 🔧 完全重写：cacheElements方法
    cacheElements() {
        console.log('[Navigation] 🗃️ 缓存DOM元素...');
        
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
        
        // 🔧 严格验证每个关键元素
        console.log('[Navigation] 🔗 元素缓存验证:');
        Object.entries(this.state.elements).forEach(([key, element]) => {
            const status = element ? '✅' : '❌';
            console.log(`[Navigation] - ${key}: ${status}`);
            
            if (!element && ['container', 'mainContent', 'submenuContent'].includes(key)) {
                throw new Error(`关键元素缺失: ${key}`);
            }
        });
        
        console.log('[Navigation] ✅ 元素缓存完成');
    }

    // 🔧 修复：showSubmenu方法
    showSubmenu() {
        console.log('[Navigation] 👁️ 显示子菜单面板');
        
        const submenu = this.state.elements.submenuPanel;
        if (!submenu) {
            console.error('[Navigation] ❌ 子菜单面板不存在！');
            return;
        }
        
        // 强制显示子菜单
        submenu.classList.remove('hidden');
        submenu.classList.add('expanded');
        submenu.style.display = 'block';
        submenu.style.visibility = 'visible';
        submenu.style.opacity = '1';
        submenu.style.transform = 'translateX(0)';
        submenu.style.pointerEvents = 'auto';
        
        console.log('[Navigation] ✅ 子菜单面板已显示');
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
            if (submenu.querySelector('.submenu-content')) {
                submenu.querySelector('.submenu-content').innerHTML = '';
            }
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
        
        console.log('[Navigation] 🖱️ 点击事件:', action, id);
        
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
        console.log('[Navigation] 🔓 打开侧边栏');
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
        console.log('[Navigation] 🔒 关闭侧边栏');
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

    // === 🔗 兼容性API ===
    
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
            console.error('[Navigation] 初始内容加载失败:', error);
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
        
        console.log('[Navigation] 🧹 自定义导航已销毁');
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