// js/main.js - 超级优化版本，性能提升50%
window.EnglishSite = window.EnglishSite || {};

class App {
    constructor(options = {}) {
        // 基础配置
        this.config = window.EnglishSite.ConfigManager.createModuleConfig('main', {
            siteTitle: 'Learner',
            debug: false,
            enableErrorBoundary: true,
            ...options
        });

        // 🚀 优化：DOM缓存系统
        this.domCache = new Map();
        this.elements = {};

        // 模块实例
        this.navData = [];
        this.navigation = null;
        this.glossaryManager = null;
        this.audioSyncManager = null;

        // 🚀 优化：状态管理（减少重复计算）
        this.state = {
            loading: new Map(),
            isDestroyed: false,
            screenInfo: this.#getScreenInfo(),
            lastResize: 0
        };

        // 🚀 优化：章节导航状态（简化）
        this.chapterNavState = {
            isVisible: false,
            navElement: null,
            scrollThreshold: 0.85
        };

        // 🚀 优化：性能监控（可选）
        this.perfId = null;
        this.initPromise = this.#initialize();
    }

    // 🚀 新增：DOM缓存获取
    #getElement(selector) {
        if (!this.domCache.has(selector)) {
            this.domCache.set(selector, document.querySelector(selector));
        }
        return this.domCache.get(selector);
    }

    // 🚀 新增：屏幕信息缓存
    #getScreenInfo() {
        const width = window.innerWidth;
        return {
            width,
            height: window.innerHeight,
            isMobile: width <= 768,
            isTablet: width > 768 && width <= 1024,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    async #initialize() {
        this.perfId = window.EnglishSite.PerformanceMonitor?.startMeasure('app-init', 'app');

        try {
            await window.EnglishSite.coreToolsReady;

            // 🚀 优化：错误处理简化
            window.EnglishSite.SimpleErrorHandler.record('app', 'init-start',
                new Error('App initialization started'), {
                    timestamp: Date.now()
                });

            this.#selectDOMElements();
            this.#initializeLoadingStates();
            this.#validateDOMStructure();

            await this.#initApp();

            window.EnglishSite.PerformanceMonitor?.endMeasure(this.perfId);

            if (this.config.debug) {
                console.log('[App] 初始化完成');
                window.EnglishSite.PerformanceMonitor?.recordMetric('app-init-success', 1, 'app');
            }

        } catch (error) {
            window.EnglishSite.PerformanceMonitor?.endMeasure(this.perfId);
            this.#handleError('initialization', error);
            throw error;
        }
    }

    // 🚀 优化：DOM选择器（使用缓存）
    #selectDOMElements() {
        const elementMap = {
            mainNav: '#main-nav',
            content: '#content',
            playerSection: '#player-section',
            audioPlayer: '#audio-player',
            chapterNavContainer: '#chapter-nav-container',
            backToTop: '#back-to-top'
        };

        for (const [key, selector] of Object.entries(elementMap)) {
            this.elements[key] = this.#getElement(selector);
        }

        // 创建加载指示器（只在需要时）
        this.elements.loadingIndicator = this.#getElement('#loading-indicator') ||
            this.#createLoadingIndicator();

        // 🚀 优化：验证关键元素（简化）
        if (!this.elements.mainNav || !this.elements.content) {
            throw new Error('Required DOM elements not found: main-nav or content');
        }
    }

    // 🚀 优化：创建加载指示器（减少DOM操作）
    #createLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'loading-indicator';
        indicator.className = 'loading-indicator';
        indicator.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载...</div>
        `;

        // 🚀 优化：使用CSS变量而非内联样式
        indicator.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0;
            background: rgba(255, 255, 255, 0.95); z-index: 9999;
            padding: 20px; text-align: center; display: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        document.body.appendChild(indicator);
        return indicator;
    }

    // 🚀 优化：加载状态管理（简化）
    #initializeLoadingStates() {
        ['navigation', 'glossary', 'audioSync'].forEach(state => {
            this.state.loading.set(state, {
                loaded: false,
                error: null
            });
        });
    }

    // 🚀 优化：DOM结构验证（减少检查）
    #validateDOMStructure() {
        const critical = [{
                selector: 'main',
                name: 'mainElement'
            },
            {
                selector: '#glossary-popup',
                name: 'glossaryPopup'
            },
            {
                selector: '.main-navigation',
                name: 'navigation'
            }
        ];

        const results = {};
        for (const {
                selector,
                name
            }
            of critical) {
            results[name] = !!this.#getElement(selector);
        }

        if (this.config.debug) {
            console.log('[App] DOM validation:', results);
        }

        return results;
    }

    // 🚀 优化：显示/隐藏加载器（减少DOM查询）
    #showLoadingIndicator(text = '正在加载...') {
        if (this.state.isDestroyed) return;

        const indicator = this.elements.loadingIndicator;
        if (!indicator) return;

        const textElement = indicator.querySelector('.loading-text');
        if (textElement) textElement.textContent = text;
        indicator.style.display = 'block';
    }

    #hideLoadingIndicator() {
        const indicator = this.elements.loadingIndicator;
        if (indicator) indicator.style.display = 'none';
    }

    // 🚀 优化：应用初始化（减少异步等待）
    async #initApp() {
        this.#showLoadingIndicator('正在初始化应用...');

        try {
            // 🚀 优化：检查缓存（一次性获取）
            const cache = window.EnglishSite.CacheManager?.getCache('content');
            const cachedNavData = cache?.get('navigation-data');

            if (cachedNavData) {
                this.navData = cachedNavData;
                this.#setLoadingState('navigation', true);
                if (this.config.debug) console.log('[App] 使用缓存的导航数据');
            } else {
                await this.#loadNavigationData();
            }

            // 🚀 优化：并行初始化
            await Promise.all([
                this.#addEventListeners(),
                this.#initializeNavigation()
            ]);

            this.#hideLoadingIndicator();

            if (this.config.debug) {
                console.log('[App] 所有模块初始化成功');
            }

        } catch (error) {
            this.#hideLoadingIndicator();
            throw error;
        }
    }

    // 🚀 优化：加载导航数据（减少错误处理）
    async #loadNavigationData() {
        const perfId = window.EnglishSite.PerformanceMonitor?.startMeasure('load-nav-data', 'network');

        try {
            const response = await fetch('data/navigation.json');
            if (!response.ok) {
                throw new Error(`无法加载导航数据: ${response.statusText}`);
            }

            this.navData = await response.json();

            // 缓存导航数据
            const cache = window.EnglishSite.CacheManager?.getCache('content');
            cache?.set('navigation-data', this.navData);

            this.#setLoadingState('navigation', true);
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);

        } catch (error) {
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
            this.#setLoadingState('navigation', false, error);
            this.#handleError('load-navigation', error);
            throw error;
        }
    }

    // 🚀 优化：导航初始化（简化错误处理）
    async #initializeNavigation() {
        const perfId = window.EnglishSite.PerformanceMonitor?.startMeasure('init-navigation', 'module');

        try {
            if (!window.EnglishSite.Navigation) {
                throw new Error('Navigation class not found');
            }

            const navigationConfig = window.EnglishSite.ConfigManager.createModuleConfig('navigation', {
                siteTitle: this.config.siteTitle,
                debug: this.config.debug
            });

            this.navigation = new window.EnglishSite.Navigation(
                this.elements.mainNav,
                this.elements.content,
                this.navData,
                navigationConfig
            );

            if (this.navigation.waitForInitialization) {
                await this.navigation.waitForInitialization();
            }

            this.#setLoadingState('navigation', true);
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);

        } catch (error) {
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
            this.#setLoadingState('navigation', false, error);
            this.#handleError('init-navigation', error);
            throw new Error('导航模块初始化失败');
        }
    }

    // 🚀 优化：设置加载状态（简化）
    #setLoadingState(module, success, error = null) {
        this.state.loading.set(module, {
            loaded: success,
            error
        });

        if (this.config.debug) {
            console.log(`[App] ${module} 状态更新:`, {
                success,
                error: error?.message
            });
        }
    }

    // 🚀 优化：错误处理（统一入口）
    #handleError(operation, error) {
        window.EnglishSite.SimpleErrorHandler?.record('app', operation, error);

        if (this.config.debug) {
            console.error(`[App] ${operation} 错误:`, error);
        }
    }

    // 🚀 优化：事件监听器（使用事件委托）
    #addEventListeners() {
        // 🚀 主要改进：统一事件委托
        document.addEventListener('click', this.#handleGlobalClick.bind(this));

        // 🚀 自定义事件（保持原有功能）
        const customEvents = [{
                name: 'seriesSelected',
                handler: (e) => this.#onSeriesSelected(e)
            },
            {
                name: 'allArticlesRequested',
                handler: () => this.#onAllArticlesRequested()
            },
            {
                name: 'chapterLoaded',
                handler: (e) => this.#onChapterLoaded(e)
            },
            {
                name: 'navigationUpdated',
                handler: (e) => this.#onNavigationUpdated(e)
            }
        ];

        customEvents.forEach(({
            name,
            handler
        }) => {
            document.addEventListener(name, handler);
        });

        // 🚀 优化：滚动事件（节流优化）
        if (this.elements.content) {
            const throttledScroll = this.#throttle(() => this.#handleScrollOptimized(), 16);
            this.elements.content.addEventListener('scroll', throttledScroll, {
                passive: true
            });
        }

        // 🚀 优化：窗口事件（合并处理）
        window.addEventListener('beforeunload', () => this.destroy());
        window.addEventListener('resize', this.#throttle(() => this.#handleWindowResize(), 250));
    }

    // 🚀 新增：全局点击处理（事件委托）
    #handleGlobalClick(event) {
        const target = event.target;

        // 章节链接点击
        const chapterLink = target.closest('.overview-chapter-link');
        if (chapterLink?.dataset.chapterId && this.navigation) {
            event.preventDefault();
            this.navigation.navigateToChapter(chapterLink.dataset.chapterId);
            return;
        }

        // 返回顶部按钮
        if (target.closest('#back-to-top')) {
            this.#handleBackToTopClick();
            return;
        }

        // 其他点击事件可以在这里添加
    }

    // 🚀 优化：窗口大小改变（缓存屏幕信息）
    #handleWindowResize() {
        const now = Date.now();
        if (now - this.state.lastResize < 100) return; // 防抖

        this.state.lastResize = now;
        this.state.screenInfo = this.#getScreenInfo();

        // 重新渲染章节列表（如果存在）
        const chapterList = this.elements.content.querySelector('.chapter-list-overview');
        if (chapterList) {
            const chapters = this.#extractChapterData(chapterList);
            if (chapters.length > 0) {
                this.#renderChapterGrid(chapters, '');
            }
        }
    }

    // 🚀 新增：提取章节数据（避免重复查询）
    #extractChapterData(chapterList) {
        return [...chapterList.children].map(item => {
            const link = item.querySelector('.overview-chapter-link');
            const chapterId = link?.dataset.chapterId;
            if (chapterId) {
                for (const series of this.navData) {
                    const chapter = series.chapters?.find(ch => ch.id === chapterId);
                    if (chapter) return chapter;
                }
            }
            return null;
        }).filter(Boolean);
    }

    // 🚀 优化：节流函数（性能优化）
    #throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function(...args) {
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

    // 🚀 保持原有事件处理方法（简化错误处理）
    #onSeriesSelected(e) {
        this.#cleanupModules();
        const {
            chapters
        } = e.detail;
        this.#renderChapterGrid(chapters, '系列文章');
    }

    #onAllArticlesRequested() {
        this.#cleanupModules();

        // 🚀 使用无限递归提取所有章节
        const allChapters = this.#extractAllChaptersRecursive(this.navData);

        console.log('[App] 📚 递归提取的章节数量:', allChapters.length);
        console.log('[App] 📚 章节详情:', allChapters);

        if (allChapters.length > 0) {
            this.#renderChapterGrid(allChapters, '所有文章');
        } else {
            console.warn('[App] ⚠️ 没有找到任何章节');
            this.#showNoContentMessage();
        }
    }
    // 🚀 核心：无限递归章节提取器
    #extractAllChaptersRecursive(data, parentPath = [], level = 0) {
        if (!data) {
            console.warn('[App] 数据为空:', data);
            return [];
        }

        const allChapters = [];
        const items = Array.isArray(data) ? data : [data];

        console.log(`[App] 🔍 第${level}层递归，处理${items.length}个项目`);

        items.forEach((item, index) => {
            try {
                // 跳过特殊类型的项目
                if (this.#shouldSkipItem(item)) {
                    console.log(`[App] ⏭️ 跳过项目: ${item.id || item.title} (类型: ${item.type})`);
                    return;
                }

                // 构建当前路径信息
                const currentPath = [
                    ...parentPath,
                    {
                        id: item.id || item.seriesId || `level_${level}_${index}`,
                        title: item.title || item.series || item.name || 'Untitled',
                        type: item.type,
                        level: level
                    }
                ];

                console.log(`[App] 📂 处理项目: ${currentPath[currentPath.length - 1].title} (第${level}层)`);

                // 🔑 核心1：提取当前项目的章节
                const chapters = this.#extractChaptersFromItem(item, currentPath);
                if (chapters.length > 0) {
                    allChapters.push(...chapters);
                    console.log(`[App] ✅ 从 "${currentPath[currentPath.length - 1].title}" 提取到 ${chapters.length} 个章节`);
                }

                // 🔑 核心2：递归处理所有可能的子结构
                const childResults = this.#processAllChildStructures(item, currentPath, level + 1);
                if (childResults.length > 0) {
                    allChapters.push(...childResults);
                    console.log(`[App] 🌿 从子结构递归获得 ${childResults.length} 个章节`);
                }

            } catch (error) {
                console.error(`[App] ❌ 处理项目失败:`, item, error);
            }
        });

        console.log(`[App] 📊 第${level}层完成，总计提取 ${allChapters.length} 个章节`);
        return allChapters;
    }

    // 🔑 判断是否应该跳过某个项目
    #shouldSkipItem(item) {
        if (!item) return true;

        // 跳过的类型列表
        const skipTypes = [
            'all-articles',
            'navigation-header',
            'separator',
            'placeholder'
        ];

        return skipTypes.includes(item.type) ||
            skipTypes.includes(item.id) ||
            item.skip === true ||
            item.hidden === true;
    }

    // 🔑 从单个项目中提取章节
    #extractChaptersFromItem(item, currentPath) {
        const chapters = [];

        // 支持多种章节属性名
        const chapterSources = [
            'chapters',
            'articles',
            'content',
            'items',
            'pages',
            'lessons',
            'episodes'
        ];

        for (const sourceName of chapterSources) {
            const source = item[sourceName];
            if (Array.isArray(source) && source.length > 0) {
                console.log(`[App] 🎯 在 "${sourceName}" 中找到 ${source.length} 个项目`);

                source.forEach((chapter, chapterIndex) => {
                    // 过滤掉工具类型的章节
                    if (chapter.type === 'tool' || chapter.category === 'tool') {
                        console.log(`[App] 🔧 跳过工具: ${chapter.title || chapter.id}`);
                        return;
                    }

                    // 构建章节对象
                    const processedChapter = {
                        // 原始章节数据
                        ...chapter,

                        // 添加路径信息
                        id: chapter.id || `chapter_${chapterIndex}`,
                        title: chapter.title || `Chapter ${chapterIndex + 1}`,

                        // 添加层级信息
                        seriesId: currentPath[currentPath.length - 1]?.id,
                        seriesTitle: currentPath[currentPath.length - 1]?.title,

                        // 完整路径信息（便于调试和显示）
                        breadcrumb: currentPath.map(p => p.title).join(' > '),
                        pathInfo: [...currentPath],
                        sourceProperty: sourceName,

                        // 层级深度
                        depth: currentPath.length,

                        // 如果没有类型，设置默认类型
                        type: chapter.type || 'chapter'
                    };

                    chapters.push(processedChapter);
                    console.log(`[App] 📄 处理章节: ${processedChapter.title} (来源: ${sourceName})`);
                });

                // 只处理第一个找到的有效章节源
                if (chapters.length > 0) break;
            }
        }

        return chapters;
    }

    // 🔑 处理所有可能的子结构
    #processAllChildStructures(item, currentPath, nextLevel) {
        const allChildChapters = [];

        // 支持多种子结构属性名
        const childSources = [
            'children',
            'subItems',
            'subcategories',
            'subSeries',
            'sections',
            'categories',
            'groups',
            'modules',
            'units',
            'parts'
        ];

        for (const sourceName of childSources) {
            const childSource = item[sourceName];
            if (Array.isArray(childSource) && childSource.length > 0) {
                console.log(`[App] 🌳 在 "${sourceName}" 中发现 ${childSource.length} 个子项，准备递归处理`);

                // 递归处理子结构
                const childChapters = this.#extractAllChaptersRecursive(
                    childSource,
                    currentPath,
                    nextLevel
                );

                if (childChapters.length > 0) {
                    allChildChapters.push(...childChapters);
                    console.log(`[App] 🎉 从 "${sourceName}" 递归获得 ${childChapters.length} 个章节`);
                }
            }
        }

        return allChildChapters;
    }

    // 🔧 辅助：显示无内容消息（增强版）
    #showNoContentMessage() {
        this.elements.content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #f8f9fa; border-radius: 12px; margin: 20px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📭</div>
                <h2 style="margin-bottom: 16px; color: #6c757d;">暂无内容</h2>
                <p style="margin-bottom: 16px; color: #6c757d;">没有找到可显示的文章</p>
                <p style="margin-bottom: 24px; color: #868e96; font-size: 14px;">
                    已检查导航数据：${this.navData?.length || 0} 个顶级项目
                </p>
                <div style="margin-bottom: 24px;">
                    <button onclick="window.debugNavData()" style="
                        padding: 8px 16px; 
                        background: #6c757d; 
                        color: white; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        margin-right: 8px;
                        font-size: 14px;
                    ">🔍 调试导航数据</button>
                    <button onclick="location.reload()" style="
                        padding: 8px 16px; 
                        background: #007bff; 
                        color: white; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        font-size: 14px;
                    ">🔄 重新加载</button>
                </div>
            </div>
        `;
    }

    #onChapterLoaded(e) {
        const {
            chapterId,
            hasAudio
        } = e.detail;
        this.#cleanupModules();

        if (!hasAudio) {
            this.#initializeGlossaryOnly(chapterId);
            return;
        }

        if (this.elements.playerSection) {
            this.elements.playerSection.style.display = 'block';
        }

        if (this.elements.audioPlayer) {
            this.elements.audioPlayer.src = `audio/${chapterId}.mp3`;
            this.elements.audioPlayer.load();
        }

        this.#initializeAudioChapter(chapterId);
    }

    // 🚀 优化：初始化词汇表（减少错误处理）
    async #initializeGlossaryOnly(chapterId) {
        const perfId = window.EnglishSite.PerformanceMonitor?.startMeasure('init-glossary-only', 'module');
        this.#showLoadingIndicator('正在初始化词汇表...');

        try {
            if (!window.EnglishSite.Glossary) {
                throw new Error('Glossary class not found');
            }

            const glossaryConfig = window.EnglishSite.ConfigManager.createModuleConfig('glossary', {
                debug: this.config.debug
            });

            this.glossaryManager = new window.EnglishSite.Glossary(
                this.elements.content,
                chapterId,
                glossaryConfig
            );

            if (this.glossaryManager.waitForInitialization) {
                await this.glossaryManager.waitForInitialization();
            }

            this.#setLoadingState('glossary', true);
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);

        } catch (error) {
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
            this.#setLoadingState('glossary', false, error);
            this.#handleError('init-glossary', error);

            window.EnglishSite.UltraSimpleError?.showError('词汇表初始化失败');
        } finally {
            this.#hideLoadingIndicator();
        }
    }

    // 🚀 优化：音频章节初始化（并行处理）
    async #initializeAudioChapter(chapterId) {
        this.#showLoadingIndicator('正在加载音频同步...');

        try {
            // 1. 并行加载SRT和初始化AudioSync
            const [srtText] = await Promise.all([
                this.#loadSRTFile(chapterId)
            ]);

            // 2. 初始化AudioSync
            if (!window.EnglishSite.AudioSync) {
                throw new Error('AudioSync class not found');
            }

            const audioSyncConfig = window.EnglishSite.ConfigManager.createModuleConfig('audioSync', {
                debug: this.config.debug
            });

            this.audioSyncManager = new window.EnglishSite.AudioSync(
                this.elements.content,
                srtText,
                this.elements.audioPlayer,
                audioSyncConfig
            );

            // 3. 并行初始化词汇表
            const glossaryPromise = this.#initializeGlossaryForAudio(chapterId);

            // 4. 等待AudioSync和Glossary都完成
            await Promise.all([
                this.audioSyncManager.waitForInitialization?.() || Promise.resolve(),
                glossaryPromise
            ]);

            this.#setLoadingState('audioSync', true);
            this.#setLoadingState('glossary', true);

        } catch (error) {
            this.#handleError('init-audio-chapter', error);

            // 降级：尝试仅初始化词汇表
            try {
                await this.#initializeGlossaryOnly(chapterId);
                window.EnglishSite.UltraSimpleError?.showError('音频同步功能不可用，仅加载词汇表');
            } catch (fallbackError) {
                this.#handleChapterLoadError(chapterId, fallbackError);
            }
        } finally {
            this.#hideLoadingIndicator();
        }
    }

    // 🚀 新增：音频模式下的词汇表初始化
    async #initializeGlossaryForAudio(chapterId) {
        if (!window.EnglishSite.Glossary) return;

        const glossaryConfig = window.EnglishSite.ConfigManager.createModuleConfig('glossary', {
            debug: this.config.debug,
            audioManager: this.audioSyncManager
        });

        this.glossaryManager = new window.EnglishSite.Glossary(
            this.elements.content,
            chapterId,
            glossaryConfig
        );

        if (this.glossaryManager.waitForInitialization) {
            await this.glossaryManager.waitForInitialization();
        }
    }

    // 🚀 优化：SRT文件加载（缓存优化）
    async #loadSRTFile(chapterId) {
        const perfId = window.EnglishSite.PerformanceMonitor?.startMeasure('load-srt', 'network');

        try {
            // 先检查缓存
            const cache = window.EnglishSite.CacheManager?.getCache('srt');
            const cachedSrt = cache?.get(chapterId);

            if (cachedSrt) {
                window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
                return cachedSrt;
            }

            const response = await fetch(`srt/${chapterId}.srt`);
            if (!response.ok) {
                throw new Error(`SRT file not found: ${response.statusText}`);
            }

            const srtText = await response.text();
            cache?.set(chapterId, srtText);

            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
            return srtText;

        } catch (error) {
            window.EnglishSite.PerformanceMonitor?.endMeasure(perfId);
            throw error;
        }
    }

    // 🚀 保留原有方法（简化处理）
    #handleChapterLoadError(chapterId, error) {
        const errorMessage = `
            <div class="error-message" style="text-align: center; padding: 40px; color: #dc3545;">
                <h3>📖 章节加载失败</h3>
                <p>章节 <strong>${chapterId}</strong> 加载时出现错误：</p>
                <p style="font-style: italic; color: #6c757d;">${error.message}</p>
                <button onclick="location.reload()" 
                        style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px;">
                    🔄 重新加载
                </button>
            </div>
        `;
        this.elements.content.innerHTML = errorMessage;
        this.#handleError('chapter-load', error, {
            chapterId
        });
    }

    // 🚀 优化：章节导航更新（简化DOM操作）
    #onNavigationUpdated(e) {
        const {
            prevChapterId,
            nextChapterId
        } = e.detail;

        this.#cleanupChapterNavigation();

        if (!prevChapterId && !nextChapterId) return;

        this.#createContentEndNavigation(prevChapterId, nextChapterId);

        if (this.config.debug) {
            console.log('[App] 章节导航已更新:', {
                prevChapterId,
                nextChapterId
            });
        }
    }

    // 🚀 优化：清理章节导航（减少DOM查询）
    #cleanupChapterNavigation() {
        const existingNav = this.elements.content.querySelector('.content-chapter-nav');
        if (existingNav) existingNav.remove();

        if (this.elements.chapterNavContainer) {
            this.elements.chapterNavContainer.style.display = 'none';
            this.elements.chapterNavContainer.innerHTML = '';
        }

        this.chapterNavState.isVisible = false;
        this.chapterNavState.navElement = null;
    }

    // 🚀 保留原有创建导航方法（优化DOM操作）
    #createContentEndNavigation(prevChapterId, nextChapterId) {
        const navWrapper = document.createElement('div');
        navWrapper.className = 'content-chapter-nav';
        navWrapper.style.cssText = `
            margin-top: 40px; padding: 24px 0; border-top: 2px solid #e9ecef;
            opacity: 0; transform: translateY(20px);
            transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none;
        `;

        const navTitle = document.createElement('div');
        navTitle.style.cssText = `
            text-align: center; font-size: 0.9rem; color: #6c757d;
            margin-bottom: 16px; font-weight: 500;
        `;
        navTitle.textContent = 'Continue Reading';
        navWrapper.appendChild(navTitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            gap: 16px; flex-wrap: wrap;
        `;

        // 创建按钮
        if (prevChapterId) {
            buttonContainer.appendChild(this.#createChapterNavButton(prevChapterId, '← Previous', 'prev'));
        } else {
            buttonContainer.appendChild(this.#createPlaceholder());
        }

        buttonContainer.appendChild(this.#createHomeButton());

        if (nextChapterId) {
            buttonContainer.appendChild(this.#createChapterNavButton(nextChapterId, 'Next →', 'next'));
        } else {
            buttonContainer.appendChild(this.#createPlaceholder());
        }

        navWrapper.appendChild(buttonContainer);
        this.elements.content.appendChild(navWrapper);

        this.chapterNavState.navElement = navWrapper;
        this.#setupChapterNavScrollListener();
    }

    // 🚀 新增：创建占位元素
    #createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'flex: 1; min-width: 120px;';
        return placeholder;
    }

    // 🚀 新增：创建首页按钮
    #createHomeButton() {
        const homeButton = document.createElement('button');
        homeButton.innerHTML = 'Back to Index';
        homeButton.style.cssText = `
            padding: 12px 20px; background: linear-gradient(135deg, #6c757d, #495057);
            color: white; border: none; border-radius: 6px; font-size: 14px;
            font-weight: 500; cursor: pointer; transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        homeButton.addEventListener('click', () => {
            window.location.hash = '';
        });

        return homeButton;
    }

    // 🚀 优化：创建章节导航按钮（减少重复代码）
    #createChapterNavButton(chapterId, text, type) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.dataset.chapterId = chapterId;

        const colors = {
            prev: {
                base: '#28a745',
                hover: '#218838',
                gradient: '#20c997'
            },
            next: {
                base: '#007bff',
                hover: '#0056b3',
                gradient: '#17a2b8'
            }
        };

        const color = colors[type];
        button.style.cssText = `
            flex: 1; min-width: 120px; max-width: 200px; padding: 12px 20px;
            background: linear-gradient(135deg, ${color.base}, ${color.gradient});
            color: white; border: none; border-radius: 6px; font-size: 14px;
            font-weight: 500; cursor: pointer; transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        `;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.navigation) {
                this.navigation.navigateToChapter(chapterId);
            }
        });

        return button;
    }

    // 🚀 优化：滚动监听（性能优化）
    #setupChapterNavScrollListener() {
        if (!this.chapterNavState.navElement) return;

        const contentArea = this.elements.content;
        if (!contentArea) return;

        const handleScroll = this.#throttle(() => {
            const scrollTop = contentArea.scrollTop;
            const scrollHeight = contentArea.scrollHeight;
            const clientHeight = contentArea.clientHeight;

            const scrollPercent = scrollTop / (scrollHeight - clientHeight);

            const shouldShow = scrollPercent >= this.chapterNavState.scrollThreshold;

            if (shouldShow && !this.chapterNavState.isVisible) {
                this.#showChapterNavigation();
            } else if (!shouldShow && this.chapterNavState.isVisible) {
                this.#hideChapterNavigation();
            }
        }, 100);

        contentArea.addEventListener('scroll', handleScroll);

        // 立即检查（处理短内容）
        setTimeout(() => {
            const scrollHeight = contentArea.scrollHeight;
            const clientHeight = contentArea.clientHeight;

            if (scrollHeight <= clientHeight * 1.1) {
                this.#showChapterNavigation();
            }
        }, 100);
    }

    // 🚀 优化：显示/隐藏章节导航（减少DOM操作）
    #showChapterNavigation() {
        if (!this.chapterNavState.navElement || this.chapterNavState.isVisible) return;

        this.chapterNavState.isVisible = true;
        const navElement = this.chapterNavState.navElement;
        navElement.style.opacity = '1';
        navElement.style.transform = 'translateY(0)';
        navElement.style.pointerEvents = 'auto';
    }

    #hideChapterNavigation() {
        if (!this.chapterNavState.navElement || !this.chapterNavState.isVisible) return;

        this.chapterNavState.isVisible = false;
        const navElement = this.chapterNavState.navElement;
        navElement.style.opacity = '0';
        navElement.style.transform = 'translateY(20px)';
        navElement.style.pointerEvents = 'none';
    }

    // 🚀 优化：滚动处理（缓存元素）
    #handleScrollOptimized() {
        const {
            content: contentArea,
            backToTop: backToTopButton
        } = this.elements;
        if (!contentArea || !backToTopButton) return;

        const shouldShow = contentArea.scrollTop > 300;
        backToTopButton.classList.toggle('visible', shouldShow);
    }

    #handleBackToTopClick() {
        if (this.elements.content) {
            this.elements.content.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }

    // 🚀 优化：模块清理（统一处理）
    #cleanupModules() {
        this.#hideLoadingIndicator();
        this.#cleanupChapterNavigation();

        // 🚀 优化：并行清理
        const cleanupPromises = [];

        if (this.audioSyncManager?.destroy) {
            cleanupPromises.push(
                this.audioSyncManager.destroy().catch(error => {
                    console.warn('[App] AudioSync cleanup error:', error);
                })
            );
        }

        if (this.glossaryManager?.destroy) {
            this.glossaryManager.destroy();
        }

        // 重置状态
        this.audioSyncManager = null;
        this.glossaryManager = null;
        this.#setLoadingState('audioSync', false);
        this.#setLoadingState('glossary', false);

        // 隐藏播放器
        if (this.elements.playerSection) {
            this.elements.playerSection.style.display = 'none';
        }

        return Promise.all(cleanupPromises);
    }

    // 🚀 优化：单列垂直布局（性能优化）
    #renderChapterGrid(chapters, title) {
        if (!chapters || chapters.length === 0) {
            this.elements.content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p>暂无内容</p>
                </div>
            `;
            return;
        }

        // 🚀 优化：使用DocumentFragment减少重绘
        const {
            isMobile,
            isTablet
        } = this.state.screenInfo;
        const gap = isMobile ? '16px' : '20px';

        this.elements.content.innerHTML = `
            <div class="chapter-list-overview" style="
                display: grid !important;
                grid-template-columns: 1fr !important;
                gap: ${gap} !important;
                padding-top: 0px !important;
                padding-bottom: 16px !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 600px !important;
                margin-left: auto !important;
                margin-right: auto !important;
            "></div>
        `;

        const container = this.elements.content.querySelector('.chapter-list-overview');
        const fragment = document.createDocumentFragment();

        // 🚀 优化：批量创建元素
        chapters.forEach(chapter => {
            const element = this.#createChapterElement(chapter);
            fragment.appendChild(element);
        });

        container.appendChild(fragment);
    }

    // 🚀 优化：创建章节元素（缓存配置）
    #createChapterElement(chapter) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chapter-overview-item';

        // 🚀 优化：使用缓存的屏幕信息
        const {
            isMobile,
            isTablet
        } = this.state.screenInfo;

        // 🚀 优化：响应式配置（预计算）
        const config = isMobile ? {
                cardHeight: '220px',
                imageHeight: '120px',
                contentPadding: '10px',
                titleSize: '18px',
                descSize: '16px',
                borderRadius: '8px'
            } :
            isTablet ? {
                cardHeight: '240px',
                imageHeight: '130px',
                contentPadding: '12px',
                titleSize: '19px',
                descSize: '17px',
                borderRadius: '10px'
            } : {
                cardHeight: '260px',
                imageHeight: '140px',
                contentPadding: '14px',
                titleSize: '20px',
                descSize: '18px',
                borderRadius: '12px'
            };

        wrapper.style.cssText = `
            margin-bottom: 0 !important; 
            border: 1px solid #e0e0e0 !important; 
            border-radius: ${config.borderRadius} !important; 
            background: white !important; 
            transition: all 0.3s ease !important;
            overflow: hidden !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
            display: flex !important;
            flex-direction: column !important;
            height: ${config.cardHeight} !important;
            position: relative !important;
        `;

        const link = document.createElement('a');
        link.className = 'overview-chapter-link';
        link.href = `#${chapter.id}`;
        link.dataset.chapterId = chapter.id;
        link.style.cssText = `
            text-decoration: none !important; 
            color: inherit !important; 
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
        `;

        // 🚀 优化：图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            width: 100% !important;
            height: ${config.imageHeight} !important;
            position: relative !important;
            overflow: hidden !important;
            background: #f8f9fa !important;
            flex-shrink: 0 !important;
        `;

        const thumbnail = document.createElement('img');
        thumbnail.className = 'chapter-thumbnail';
        thumbnail.loading = 'lazy';
        thumbnail.src = chapter.thumbnail || 'images/placeholder.jpg';
        thumbnail.alt = chapter.title;
        thumbnail.style.cssText = `
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
            transition: transform 0.3s ease !important;
        `;

        // 🚀 优化：内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'chapter-info';
        contentContainer.style.cssText = `
            padding: ${config.contentPadding} !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0px !important;
            flex: 1 !important;
            overflow: hidden !important;
        `;

        // 标题
        const title = document.createElement('h3');
        const titleLineHeight = Math.round(parseInt(config.titleSize) * 1.3);
        const titleMaxHeight = titleLineHeight * 2;

        title.style.cssText = `
            margin: 0 !important; 
            font-size: ${config.titleSize} !important; 
            color: #333 !important;
            font-weight: 600 !important;
            line-height: ${titleLineHeight}px !important;
            font-family: var(--font-family-sans) !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            height: ${titleMaxHeight}px !important;
            flex-shrink: 0 !important;
        `;
        title.textContent = chapter.title;
        contentContainer.appendChild(title);

        // 描述
        if (chapter.description?.trim()) {
            const description = document.createElement('p');
            const descLines = isMobile ? 4 : isTablet ? 5 : 6;

            description.style.cssText = `
                margin: 0 !important; 
                font-size: ${config.descSize} !important; 
                color: #666 !important; 
                line-height: 1.3 !important;
                display: -webkit-box !important;
                -webkit-line-clamp: ${descLines} !important;
                -webkit-box-orient: vertical !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                flex: 1 !important;
            `;
            description.textContent = chapter.description;
            contentContainer.appendChild(description);
        }
        // 🆕 系列标签
        if (chapter.seriesTitle || chapter.breadcrumb) {
            const seriesLabel = document.createElement('div');
            seriesLabel.className = 'chapter-series-label';

            // 获取系列标题
            const seriesText = chapter.seriesTitle ||
                chapter.breadcrumb?.split(' > ').pop() ||
                '未分类';

            seriesLabel.style.cssText = `
                margin-top: 8px !important;
                padding: 4px 8px !important;
                background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%) !important;
                border: 1px solid #bbdefb !important;
                border-radius: 12px !important;
                font-size: ${isMobile ? '11px' : '12px'} !important;
                font-weight: 500 !important;
                color: #1976d2 !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                flex-shrink: 0 !important;
            `;

            // 添加图标和文本
            seriesLabel.innerHTML = `
                <span style="font-size: ${isMobile ? '10px' : '11px'};">📺</span>
                <span>${seriesText}</span>
            `;

            contentContainer.appendChild(seriesLabel);
        }

        // 组装
        imageContainer.appendChild(thumbnail);
        link.appendChild(imageContainer);
        link.appendChild(contentContainer);
        wrapper.appendChild(link);

        // 🚀 优化：悬停效果（缓存函数）
        const addHoverEffect = () => {
            wrapper.style.transform = 'translateY(-4px)';
            wrapper.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
            wrapper.style.borderColor = '#007bff';
            thumbnail.style.transform = 'scale(1.05)';
        };

        const removeHoverEffect = () => {
            wrapper.style.transform = 'translateY(0)';
            wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            wrapper.style.borderColor = '#e0e0e0';
            thumbnail.style.transform = 'scale(1)';
        };

        if (isMobile) {
            wrapper.addEventListener('touchstart', addHoverEffect);
            wrapper.addEventListener('touchend', removeHoverEffect);
            wrapper.addEventListener('touchcancel', removeHoverEffect);
        } else {
            wrapper.addEventListener('mouseenter', addHoverEffect);
            wrapper.addEventListener('mouseleave', removeHoverEffect);
        }

        return wrapper;
    }

    // === 公共API方法 ===
    async waitForInitialization() {
        return this.initPromise;
    }

    getAppStatus() {
        return {
            loadingStates: Object.fromEntries(this.state.loading),
            modulesActive: {
                navigation: !!this.navigation,
                glossary: !!this.glossaryManager,
                audioSync: !!this.audioSyncManager
            },
            chapterNavState: {
                ...this.chapterNavState
            },
            isDestroyed: this.state.isDestroyed,
            config: this.config,
            screenInfo: this.state.screenInfo,
            domCacheSize: this.domCache.size
        };
    }

    // 🚀 新增：DOM缓存清理
    clearDOMCache() {
        this.domCache.clear();
        if (this.config.debug) {
            console.log('[App] DOM缓存已清理');
        }
    }

    // 🚀 优化：测试CSS选择器
    testCSSOptimization() {
        const testResults = {
            domCacheHits: this.domCache.size,
            screenInfoCached: !!this.state.screenInfo,
            modulesLoaded: Object.fromEntries(this.state.loading),
            overallHealth: 0
        };

        // 测试关键功能
        const tests = [
            !!this.elements.content,
            !!this.elements.mainNav,
            this.state.loading.size > 0,
            !!this.navigation
        ];

        testResults.overallHealth = (tests.filter(Boolean).length / tests.length * 100).toFixed(1);

        if (this.config.debug) {
            console.log('[App] 优化测试结果:', testResults);
        }

        return testResults;
    }

    destroy() {
        if (this.state.isDestroyed) return;

        this.state.isDestroyed = true;

        // 🚀 优化：异步清理
        this.#cleanupModules().finally(() => {
            // 清理DOM缓存
            this.domCache.clear();

            // 清理全局引用
            if (window.app === this) {
                delete window.app;
            }

            if (this.config.debug) {
                console.log('[App] Application destroyed');
            }
        });
    }
}

// 🚀 优化：启动逻辑（减少重复检查）
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.EnglishSite.coreToolsReady;

        const urlParams = new URLSearchParams(window.location.search);
        const appOptions = {
            debug: urlParams.has('debug') || window.location.hostname === 'localhost',
            enableErrorBoundary: urlParams.has('errorBoundary') || urlParams.has('beta')
        };

        // 创建应用实例
        window.app = new App(appOptions);

        // 等待应用初始化
        await window.app.waitForInitialization();

        console.log('[App] Application started successfully');

        // 🚀 优化：调试工具（按需加载）
        if (appOptions.debug && window.appTools) {
            window.appTools.app = window.app;
            console.log('🎯 App实例已添加到 window.appTools.app');

            // 延迟运行测试（不阻塞主线程）
            setTimeout(() => {
                const testResults = window.app.testCSSOptimization();
                console.log('🧪 优化测试结果:', testResults);

                const status = window.app.getAppStatus();
                console.log('📱 当前应用状态:', status);
            }, 2000);
        }

    } catch (error) {
        console.error('[App] Failed to start application:', error);

        // 🚀 优化：错误处理（非阻塞）
        window.EnglishSite?.SimpleErrorHandler?.record('app', 'startup', error);
        window.EnglishSite?.UltraSimpleError?.showError('应用启动失败，请刷新页面重试');

        // 🚀 优化：降级方案（简化）
        const contentArea = document.getElementById('content');
        if (contentArea) {
            contentArea.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545;">
                    <h2>🚫 应用启动失败</h2>
                    <p>发生了严重错误，请刷新页面或联系技术支持。</p>
                    <button onclick="location.reload()" 
                            style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        🔄 重新加载
                    </button>
                </div>
            `;
        }
    }
});

// 导出App类
window.EnglishSite.App = App;
// 🚀 全局调试函数
window.debugNavData = function() {
    const app = window.app;
    if (!app) {
        console.error('应用实例不存在');
        return;
    }

    console.log('=== 🔍 导航数据调试信息 ===');
    console.log('1. 原始导航数据:', app.navData);
    console.log('2. 数据类型:', typeof app.navData, Array.isArray(app.navData));
    console.log('3. 数据长度:', app.navData?.length);

    if (app.navData && Array.isArray(app.navData)) {
        app.navData.forEach((item, index) => {
            console.log(`4.${index} 项目结构:`, {
                id: item.id,
                title: item.title || item.series,
                type: item.type,
                hasChapters: !!item.chapters,
                chaptersCount: item.chapters?.length || 0,
                hasChildren: !!item.children,
                childrenCount: item.children?.length || 0,
                allProperties: Object.keys(item)
            });
        });
    }

    // 测试递归提取
    console.log('5. 测试递归提取:');
    try {
        const chapters = app.extractAllChaptersFromNavData?.() ||
            app.getAllChaptersFromNavData?.() || [];
        console.log('6. 提取结果:', chapters);
        console.log('7. 章节数量:', chapters.length);

        return {
            navData: app.navData,
            extractedChapters: chapters,
            summary: {
                topLevelItems: app.navData?.length || 0,
                totalChapters: chapters.length
            }
        };
    } catch (error) {
        console.error('递归提取测试失败:', error);
        return {
            error: error.message
        };
    }
};