// js/word-frequency-ui.js - 完全重构版 v3.0 (彻底解决搜索问题)
window.EnglishSite = window.EnglishSite || {};

// 🔧 搜索状态管理器 - 完全重构
class SearchStateManager {
    constructor() {
        this.reset();
        this.debugMode = false;
        this.errorCount = 0;
        this.maxErrors = 3;
    }
    
    reset() {
        this.clearAllTimeouts();
        this.state = {
            isActive: false,
            currentMode: 'intelligent',
            currentQuery: '',
            sanitizedQuery: '',
            rawQuery: '',
            currentResults: [],
            alternativeResults: [],
            lastSearchData: null,
            suggestion: null,
            suggestionTimeout: null,
            frozenResults: null,
            lastValidQuery: '',
            errorState: false,
            processingState: false
        };
        this.logDebug('搜索状态已完全重置');
    }
    
    setState(updates) {
        try {
            Object.assign(this.state, updates);
            this.logDebug('状态更新:', Object.keys(updates));
        } catch (error) {
            this.logError('状态更新失败:', error);
            this.handleError(error);
        }
    }
    
    getState() {
        return Object.freeze({ ...this.state });
    }
    
    handleError(error) {
        this.errorCount++;
        this.state.errorState = true;
        this.logError(`搜索错误 #${this.errorCount}:`, error);
        
        if (this.errorCount >= this.maxErrors) {
            this.logError('错误次数过多，强制重置');
            this.forceReset();
        }
    }
    
    forceReset() {
        this.errorCount = 0;
        this.reset();
        this.logDebug('强制重置完成');
    }
    
    clearAllTimeouts() {
        if (this.state?.suggestionTimeout) {
            clearTimeout(this.state.suggestionTimeout);
            this.state.suggestionTimeout = null;
        }
    }
    
    logDebug(message, data = null) {
        if (this.debugMode) {
            console.log(`[SearchState] ${message}`, data || '');
        }
    }
    
    logError(message, error = null) {
        console.error(`[SearchState] ${message}`, error || '');
    }
    
    enableDebug() {
        this.debugMode = true;
        this.logDebug('调试模式已启用');
    }
}

// 🔧 输入处理器 - 彻底修复字符分割问题
class SearchInputProcessor {
    constructor() {
        this.cleaningRules = [
            { pattern: /\s+/g, replacement: ' ' },
            { pattern: /^\s+|\s+$/g, replacement: '' },
            { pattern: /[^a-zA-Z\-']/g, replacement: '' },
            { pattern: /[-']{2,}/g, replacement: '-' },
            { pattern: /^[-']+|[-']+$/g, replacement: '' }
        ];
    }
    
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        
        try {
            let cleaned = input.toLowerCase();
            
            for (const rule of this.cleaningRules) {
                cleaned = cleaned.replace(rule.pattern, rule.replacement);
            }
            
            if (cleaned.length > 50) {
                cleaned = cleaned.substring(0, 50);
            }
            
            return cleaned;
            
        } catch (error) {
            console.error('输入清理失败:', error);
            return '';
        }
    }
    
    isValidQuery(query) {
        return query && 
               typeof query === 'string' && 
               query.length >= 1 && 
               query.length <= 50 && 
               /^[a-zA-Z\-']+$/.test(query);
    }
}

// 🔧 防抖搜索管理器 - 完全重构
class DebouncedSearchManager {
    constructor(searchFunction, delay = 300) {
        this.searchFunction = searchFunction;
        this.delay = delay;
        this.timeoutId = null;
        this.lastQuery = '';
        this.isDestroyed = false;
    }
    
    search(query) {
        if (this.isDestroyed) {
            console.warn('DebouncedSearchManager已销毁');
            return;
        }
        
        this.clearTimeout();
        
        if (!query || query.trim() === '') {
            this.lastQuery = '';
            this.executeSearch('');
            return;
        }
        
        if (query === this.lastQuery) {
            return;
        }
        
        this.lastQuery = query;
        
        this.timeoutId = setTimeout(() => {
            try {
                if (!this.isDestroyed) {
                    this.executeSearch(query);
                }
            } catch (error) {
                console.error('防抖搜索执行失败:', error);
            }
            this.timeoutId = null;
        }, this.delay);
    }
    
    executeSearch(query) {
        if (this.searchFunction && typeof this.searchFunction === 'function') {
            this.searchFunction(query);
        }
    }
    
    clearTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        this.clearTimeout();
        this.searchFunction = null;
        this.lastQuery = '';
    }
}

// 🔧 主UI类 - 完全重构版
class WordFrequencyUI {
    constructor(container, manager) {
        this.container = container;
        this.manager = manager;
        this.currentView = 'cloud';
        this.currentFilter = 'all';
        this.selectedWord = null;
        this.isInitialized = false;
        
        // 初始化搜索系统
        this.initializeSearchSystem();
        
        // 状态管理
        this.jumpInProgress = false;
        this.lastJumpTime = 0;
        this.jumpCooldown = 2000;
        
        // DOM缓存系统
        this.domCache = new Map();
        this.eventDelegateRoot = null;
        
        // 虚拟滚动系统
        this.virtualScroll = {
            containerHeight: 600,
            itemHeight: 50,
            visibleStart: 0,
            visibleEnd: 0,
            scrollTop: 0,
            totalItems: 0,
            buffer: 3,
            lastScrollTop: 0,
            isScrolling: false,
            scrollTimeout: null,
            currentDataSource: 'normal'
        };
        
        // 渲染缓存
        this.renderCache = {
            renderedItems: new Map(),
            itemElements: new Map(),
            maxCacheSize: 200
        };
        
        // 节流函数
        this.throttledScroll = this.throttle(this.handleVirtualScroll.bind(this), 33);
        this.throttledResize = this.throttle(this.handleResize.bind(this), 100);
        
        // 渲染优化
        this.renderQueue = [];
        this.isRendering = false;
        this.useImmediateRender = true;
        
        // 数据缓存
        this.dataCache = new Map();
        this.lastDataVersion = null;
        
        // 移动端优化
        this.isMobile = this.detectMobile();
        this.touchState = {
            startY: 0,
            currentY: 0,
            isScrolling: false
        };
        
        this.render();
        this.setupAdvancedEventDelegation();
        this.initializeVirtualScroll();
    }
    
    // 🔧 初始化搜索系统
    initializeSearchSystem() {
        this.searchStateManager = new SearchStateManager();
        this.inputProcessor = new SearchInputProcessor();
        this.debouncedSearchManager = new DebouncedSearchManager(
            this.executeSafeSearch.bind(this), 
            300
        );
        
        if (this.isDebugMode()) {
            this.searchStateManager.enableDebug();
        }
        
        console.log('✅ 搜索系统初始化完成');
    }
    
    isDebugMode() {
        return document.body.classList.contains('debug-mode') || 
               localStorage.getItem('wordFreq_debugMode') === 'true';
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    getElement(selector) {
        if (!this.domCache.has(selector)) {
            const element = this.container.querySelector(selector);
            if (element) {
                this.domCache.set(selector, element);
            }
        }
        return this.domCache.get(selector);
    }
    
    createVirtualItem(tag = 'div', className = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        return element;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    render() {
        this.container.innerHTML = `
            <div class="word-freq-page">
                <header class="word-freq-header">
                    <div class="header-title">
                        <h1>📊 词频统计分析</h1>
                        <div class="stats-summary" id="stats-summary">
                            <span class="stat-item">分析中...</span>
                        </div>
                    </div>
                    
                    <div class="word-freq-controls">
                        <div class="search-section">
                            <div class="search-box">
                                <input type="text" id="word-search" placeholder="搜索单词..." autocomplete="off" />
                                <button id="search-btn" title="搜索">🔍</button>
                                <button id="clear-search" title="清除搜索" style="display: none;">✕</button>
                            </div>
                            
                            <div class="search-mode-tabs" id="search-mode-tabs" style="display: none;">
                                <button class="search-mode-tab active" data-mode="intelligent" title="基于词根的智能合并搜索">
                                    🧠 智能匹配
                                </button>
                                <button class="search-mode-tab" data-mode="exact" title="只显示包含具体变形词的文章">
                                    🎯 精确搜索
                                </button>
                            </div>
                            
                            <div class="search-suggestion" id="search-suggestion" style="display: none;">
                                <div class="suggestion-content">
                                    <span class="suggestion-text" id="suggestion-text"></span>
                                    <button class="suggestion-action" id="suggestion-action">切换模式</button>
                                </div>
                                <button class="suggestion-close" id="suggestion-close" title="关闭提示">✕</button>
                            </div>
                        </div>
                        
                        <div class="view-section">
                            <div class="view-toggles">
                                <button class="view-btn active" data-view="cloud" title="词云视图">☁️ 词云</button>
                                <button class="view-btn" data-view="list" title="列表视图">📋 列表</button>
                            </div>
                        </div>
                        
                        <div class="filter-section">
                            <select id="freq-filter" title="频次筛选">
                                <option value="all">所有频次</option>
                                <option value="high">高频词 (10+)</option>
                                <option value="medium">中频词 (5-9)</option>
                                <option value="low">低频词 (2-4)</option>
                                <option value="rare">稀有词 (1次)</option>
                            </select>
                        </div>
                    </div>
                </header>
                
                <main class="word-freq-content">
                    <div class="loading-section" id="freq-loading">
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <div class="loading-text">正在分析全站词频...</div>
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progress-fill"></div>
                                </div>
                                <div class="progress-text" id="progress-text">0%</div>
                            </div>
                            <div class="loading-tips">
                                <small>💡 首次分析需要一些时间，后续访问将使用缓存数据</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="word-freq-display" id="freq-display" style="display: none;">
                        <div class="virtual-scroll-container" id="virtual-container">
                            <div class="virtual-scroll-content" id="virtual-content"></div>
                        </div>
                    </div>
                    
                    <div class="word-details-panel" id="word-details" style="display: none;">
                        <!-- 单词详情面板 -->
                    </div>
                </main>
            </div>
        `;
        
        this.loadStyles();
        this.cacheKeyElements();
    }
    
    cacheKeyElements() {
        const selectors = [
            '#word-search', '#search-btn', '#clear-search', '#freq-filter',
            '#freq-loading', '#freq-display', '#word-details', '#stats-summary',
            '#progress-fill', '#progress-text', '.view-btn',
            '#virtual-container', '#virtual-content',
            '#search-mode-tabs', '.search-mode-tab', 
            '#search-suggestion', '#suggestion-text', '#suggestion-action', '#suggestion-close'
        ];
        
        selectors.forEach(selector => this.getElement(selector));
    }
    
    setupAdvancedEventDelegation() {
        if (this.eventDelegateRoot) {
            this.removeAllEventListeners();
        }
        
        this.eventDelegateRoot = this.container;
        
        this.boundHandlers = {
            click: this.handleDelegatedClick.bind(this),
            input: this.handleDelegatedInput.bind(this),
            change: this.handleDelegatedChange.bind(this),
            keypress: this.handleDelegatedKeypress.bind(this),
            scroll: this.handleDelegatedScroll.bind(this),
            touchstart: this.handleTouchStart.bind(this),
            touchmove: this.handleTouchMove.bind(this),
            touchend: this.handleTouchEnd.bind(this),
            resize: this.throttledResize
        };
        
        this.eventDelegateRoot.addEventListener('click', this.boundHandlers.click, { passive: false });
        this.eventDelegateRoot.addEventListener('input', this.boundHandlers.input, { passive: true });
        this.eventDelegateRoot.addEventListener('change', this.boundHandlers.change, { passive: true });
        this.eventDelegateRoot.addEventListener('keypress', this.boundHandlers.keypress, { passive: false });
        
        const virtualContainer = this.getElement('#virtual-container');
        if (virtualContainer) {
            virtualContainer.addEventListener('scroll', this.throttledScroll, { passive: true });
        }
        
        if (this.isMobile) {
            this.eventDelegateRoot.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: true });
            this.eventDelegateRoot.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });
            this.eventDelegateRoot.addEventListener('touchend', this.boundHandlers.touchend, { passive: true });
        }
        
        window.addEventListener('resize', this.boundHandlers.resize, { passive: true });
        
        document.addEventListener('wordFreqProgress', (e) => {
            this.updateProgress(e.detail.progress);
        }, { passive: true });
    }
    
    initializeVirtualScroll() {
        const container = this.getElement('#virtual-container');
        if (!container) return;
        
        this.virtualScroll.containerHeight = this.isMobile ? 
            Math.min(window.innerHeight * 0.6, 500) : 
            Math.min(window.innerHeight * 0.7, 600);
        
        container.style.height = `${this.virtualScroll.containerHeight}px`;
        container.style.overflowY = 'auto';
        container.style.position = 'relative';
        
        this.virtualScroll.itemHeight = this.currentView === 'list' ? 80 : 35;
    }
    
    handleVirtualScroll(e) {
        if (!e.target.matches('#virtual-container')) return;
        
        // 搜索状态下完全禁用虚拟滚动
        if (this.searchStateManager.getState().isActive) {
            return;
        }
        
        const scrollTop = e.target.scrollTop;
        
        if (Math.abs(scrollTop - this.virtualScroll.lastScrollTop) < 5) return;
        
        this.virtualScroll.scrollTop = scrollTop;
        this.virtualScroll.lastScrollTop = scrollTop;
        this.virtualScroll.isScrolling = true;
        
        if (this.virtualScroll.scrollTimeout) {
            clearTimeout(this.virtualScroll.scrollTimeout);
        }
        
        this.updateVirtualScrollViewportImmediate();
        
        this.virtualScroll.scrollTimeout = setTimeout(() => {
            this.virtualScroll.isScrolling = false;
        }, 150);
    }
    
    updateVirtualScrollViewportImmediate() {
        if (this.searchStateManager.getState().isActive) return;
        
        const { containerHeight, itemHeight, scrollTop, totalItems, buffer } = this.virtualScroll;
        
        if (totalItems === 0) return;
        
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);
        
        const newVisibleStart = Math.max(0, startIndex - buffer);
        const newVisibleEnd = Math.min(totalItems, startIndex + visibleCount + buffer * 2);
        
        if (Math.abs(newVisibleStart - this.virtualScroll.visibleStart) >= buffer ||
            Math.abs(newVisibleEnd - this.virtualScroll.visibleEnd) >= buffer) {
            
            this.virtualScroll.visibleStart = newVisibleStart;
            this.virtualScroll.visibleEnd = newVisibleEnd;
            
            this.renderVirtualItemsImmediate();
        }
    }
    
    handleTouchStart(e) {
        if (!e.target.closest('#virtual-container')) return;
        
        this.touchState.startY = e.touches[0].clientY;
        this.touchState.isScrolling = true;
    }
    
    handleTouchMove(e) {
        if (!this.touchState.isScrolling) return;
        
        this.touchState.currentY = e.touches[0].clientY;
        
        const container = this.getElement('#virtual-container');
        if (container) {
            if (container.scrollTop <= 0 && this.touchState.currentY > this.touchState.startY) {
                e.preventDefault();
            }
            
            const maxScroll = container.scrollHeight - container.clientHeight;
            if (container.scrollTop >= maxScroll && this.touchState.currentY < this.touchState.startY) {
                e.preventDefault();
            }
        }
    }
    
    handleTouchEnd(e) {
        this.touchState.isScrolling = false;
    }
    
    handleResize() {
        this.isMobile = this.detectMobile();
        this.initializeVirtualScroll();
        
        if (this.isInitialized) {
            const state = this.searchStateManager.getState();
            if (state.isActive) {
                this.displaySearchResults(state.frozenResults);
            } else {
                this.displayCurrentView();
            }
        }
    }
    
    // 🔧 完全重构的事件处理
    handleDelegatedClick(e) {
        const target = e.target;
        
        try {
            if (target.closest('.close-details-btn')) {
                e.preventDefault();
                this.hideWordDetails();
                return;
            }
            
            if (target.closest('.article-item')) {
                e.preventDefault();
                this.handleArticleClick(target.closest('.article-item'));
                return;
            }
            
            if (target.closest('.word-item, .word-list-item')) {
                e.preventDefault();
                this.handleWordClick(target.closest('.word-item, .word-list-item'));
                return;
            }
            
            if (target.closest('.view-btn')) {
                e.preventDefault();
                this.handleViewToggle(target.closest('.view-btn').dataset.view);
                return;
            }
            
            if (target.matches('#search-btn')) {
                e.preventDefault();
                this.handleSearchButton();
                return;
            }
            
            if (target.matches('#clear-search')) {
                e.preventDefault();
                this.clearSearchCompletely();
                return;
            }
            
            if (target.closest('.search-mode-tab')) {
                e.preventDefault();
                this.handleSearchModeSwitch(target.closest('.search-mode-tab').dataset.mode);
                return;
            }
            
            if (target.matches('#suggestion-action')) {
                e.preventDefault();
                this.handleSuggestionAction();
                return;
            }
            
            if (target.matches('#suggestion-close')) {
                e.preventDefault();
                this.hideSuggestion();
                return;
            }
        } catch (error) {
            console.error('点击事件处理失败:', error);
            this.searchStateManager.handleError(error);
        }
    }
    
    // 🔧 完全重构的输入处理
    handleDelegatedInput(e) {
        const target = e.target;
        
        if (target.matches('#word-search')) {
            try {
                const rawValue = target.value || '';
                const sanitizedValue = this.inputProcessor.sanitizeInput(rawValue);
                
                // 更新搜索状态
                this.searchStateManager.setState({
                    rawQuery: rawValue,
                    sanitizedQuery: sanitizedValue
                });
                
                // 更新UI状态
                this.updateSearchUI(rawValue.length > 0);
                
                // 执行搜索
                if (!sanitizedValue) {
                    this.clearSearchCompletely();
                } else {
                    this.debouncedSearchManager.search(sanitizedValue);
                }
                
            } catch (error) {
                console.error('输入处理失败:', error);
                this.showSearchError('输入处理失败，请重试');
                this.searchStateManager.handleError(error);
            }
        }
    }
    
    handleDelegatedChange(e) {
        const target = e.target;
        
        if (target.matches('#freq-filter')) {
            this.currentFilter = target.value;
            this.clearDataCache();
            
            const state = this.searchStateManager.getState();
            if (state.isActive) {
                this.executeSafeSearch(state.sanitizedQuery);
            } else {
                this.displayCurrentView();
            }
        }
    }
    
    handleDelegatedKeypress(e) {
        const target = e.target;
        
        if (target.matches('#word-search') && e.key === 'Enter') {
            e.preventDefault();
            this.handleSearchButton();
        }
    }
    
    handleDelegatedScroll(e) {
        // 由throttledScroll处理
    }
    
    // 🔧 更新搜索UI状态
    updateSearchUI(hasValue) {
        try {
            const clearBtn = this.getElement('#clear-search');
            const modeTabs = this.getElement('#search-mode-tabs');
            
            if (clearBtn) {
                clearBtn.style.display = hasValue ? 'block' : 'none';
            }
            
            if (modeTabs) {
                modeTabs.style.display = hasValue ? 'flex' : 'none';
            }
        } catch (error) {
            console.error('更新搜索UI失败:', error);
        }
    }
    
    // 🔧 安全的搜索执行器
    executeSafeSearch(query) {
        try {
            if (!query || !this.inputProcessor.isValidQuery(query)) {
                this.clearSearchCompletely();
                return;
            }
            
            this.searchStateManager.setState({
                processingState: true,
                errorState: false
            });
            
            this.performDualSearch(query);
            
        } catch (error) {
            console.error('搜索执行失败:', error);
            this.showSearchError(`搜索失败: ${error.message}`);
            this.searchStateManager.handleError(error);
        } finally {
            this.searchStateManager.setState({
                processingState: false
            });
        }
    }
    
    // 🔧 双模式搜索执行
    performDualSearch(query) {
        if (!query || query.trim() === '') {
            this.clearSearchCompletely();
            return;
        }
        
        const currentState = this.searchStateManager.getState();
        
        try {
            if (!this.manager || typeof this.manager.searchWordsDual !== 'function') {
                console.warn('searchWordsDual method not available, using fallback');
                const results = this.manager && typeof this.manager.searchWords === 'function' 
                    ? this.manager.searchWords(query) 
                    : [];
                this.displayLegacySearchResults(results, query);
                return;
            }
            
            const searchData = this.manager.searchWordsDual(query, currentState.currentMode);

            if (!searchData || typeof searchData !== 'object') {
                console.warn('Invalid search result:', searchData);
                this.showNoResults(`搜索出现错误`);
                return;
            }
            
            // 确保搜索数据完整性
            const safeSearchData = {
                currentMode: searchData.currentMode || currentState.currentMode,
                currentQuery: query,
                currentResults: Array.isArray(searchData.currentResults) ? searchData.currentResults : [],
                alternativeMode: searchData.alternativeMode || (currentState.currentMode === 'intelligent' ? 'exact' : 'intelligent'),
                alternativeResults: Array.isArray(searchData.alternativeResults) ? searchData.alternativeResults : [],
                suggestions: searchData.suggestions
            };
            
            // 更新搜索状态
            this.searchStateManager.setState({
                isActive: true,
                currentQuery: query,
                currentResults: safeSearchData.currentResults,
                alternativeResults: safeSearchData.alternativeResults,
                lastSearchData: safeSearchData,
                frozenResults: safeSearchData
            });
            
            // 显示搜索结果
            this.displaySearchResults(safeSearchData);
            this.showSearchSuggestion(safeSearchData.suggestions);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showNoResults(`搜索出现错误: ${error.message}`);
            this.searchStateManager.handleError(error);
        }
    }
    
    // 🔧 搜索按钮处理
    handleSearchButton() {
        try {
            const searchInput = this.getElement('#word-search');
            if (!searchInput) return;
            
            const query = searchInput.value.trim();
            const sanitizedQuery = this.inputProcessor.sanitizeInput(query);
            
            if (!sanitizedQuery) {
                this.clearSearchCompletely();
                return;
            }
            
            this.executeSafeSearch(sanitizedQuery);
        } catch (error) {
            console.error('搜索按钮处理失败:', error);
            this.searchStateManager.handleError(error);
        }
    }
    
    // 🔧 搜索模式切换
    handleSearchModeSwitch(newMode) {
        try {
            const currentState = this.searchStateManager.getState();
            
            if (newMode === currentState.currentMode) return;
            
            this.updateSearchModeUI(newMode);
            this.searchStateManager.setState({ currentMode: newMode });
            
            if (currentState.isActive && currentState.sanitizedQuery) {
                this.executeSafeSearch(currentState.sanitizedQuery);
            }
        } catch (error) {
            console.error('搜索模式切换失败:', error);
            this.searchStateManager.handleError(error);
        }
    }
    
    updateSearchModeUI(activeMode) {
        try {
            this.container.querySelectorAll('.search-mode-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.mode === activeMode);
            });
        } catch (error) {
            console.error('搜索模式UI更新失败:', error);
        }
    }
    
    // 🔧 智能建议处理
    showSearchSuggestion(suggestion) {
        if (!suggestion) {
            this.hideSuggestion();
            return;
        }
        
        try {
            const suggestionEl = this.getElement('#search-suggestion');
            const suggestionText = this.getElement('#suggestion-text');
            const suggestionAction = this.getElement('#suggestion-action');
            
            if (!suggestionEl || !suggestionText || !suggestionAction) {
                return;
            }
            
            const currentState = this.searchStateManager.getState();
            if (currentState.suggestionTimeout) {
                clearTimeout(currentState.suggestionTimeout);
            }
            
            suggestionText.textContent = suggestion.message || '';
            suggestionAction.textContent = '切换查看';
            suggestionAction.dataset.action = suggestion.action || '';
            
            suggestionEl.style.display = 'flex';
            
            const timeout = setTimeout(() => {
                this.hideSuggestion();
            }, 10000);
            
            this.searchStateManager.setState({
                suggestion: suggestion,
                suggestionTimeout: timeout
            });
            
        } catch (error) {
            console.warn('Failed to show suggestion:', error);
        }
    }
    
    hideSuggestion() {
        try {
            const suggestionEl = this.getElement('#search-suggestion');
            if (suggestionEl) {
                suggestionEl.style.display = 'none';
            }
            
            const currentState = this.searchStateManager.getState();
            if (currentState.suggestionTimeout) {
                clearTimeout(currentState.suggestionTimeout);
            }
            
            this.searchStateManager.setState({
                suggestion: null,
                suggestionTimeout: null
            });
        } catch (error) {
            console.warn('隐藏建议失败:', error);
        }
    }
    
    handleSuggestionAction() {
        try {
            const currentState = this.searchStateManager.getState();
            const suggestion = currentState.suggestion;
            
            if (!suggestion) return;
            
            const targetMode = suggestion.action === 'switch-to-exact' ? 'exact' : 'intelligent';
            this.handleSearchModeSwitch(targetMode);
            this.hideSuggestion();
        } catch (error) {
            console.error('建议操作处理失败:', error);
        }
    }
    
    // 🔧 彻底清除搜索状态
    clearSearchCompletely() {
        try {
            // 重置UI元素
            const searchInput = this.getElement('#word-search');
            const clearBtn = this.getElement('#clear-search');
            const modeTabs = this.getElement('#search-mode-tabs');
            
            if (searchInput) searchInput.value = '';
            if (clearBtn) clearBtn.style.display = 'none';
            if (modeTabs) modeTabs.style.display = 'none';
            
            // 彻底重置搜索状态
            this.searchStateManager.reset();
            
            // 隐藏建议
            this.hideSuggestion();
            
            // 清理缓存
            this.clearDataCache();
            this.clearRenderCache();
            
            // 重置虚拟滚动状态
            this.virtualScroll.currentDataSource = 'normal';
            
            // 恢复正常显示
            this.displayCurrentView();
            
            console.log('✅ 搜索状态已完全清除');
            
        } catch (error) {
            console.error('清除搜索失败:', error);
            // 强制重置
            this.searchStateManager.forceReset();
            this.displayCurrentView();
        }
    }
    
    // 🔧 显示搜索结果
    displaySearchResults(searchData) {
        if (!searchData || !searchData.currentResults) {
            this.showNoResults('搜索数据无效');
            return;
        }
        
        const { currentMode, currentQuery, currentResults } = searchData;
        
        if (!Array.isArray(currentResults) || currentResults.length === 0) {
            const modeText = currentMode === 'intelligent' ? '智能匹配' : '精确搜索';
            this.showNoResults(`📭 ${modeText}未找到 "${currentQuery}" 的相关结果`);
            return;
        }
        
        // 设置搜索状态
        this.searchStateManager.setState({
            isActive: true,
            frozenResults: searchData
        });
        
        this.virtualScroll.currentDataSource = 'search';
        
        // 直接渲染搜索结果
        this.renderSearchResultsDirectly(searchData);
    }
    
    // 🔧 直接渲染搜索结果
    renderSearchResultsDirectly(searchData) {
        try {
            const container = this.getElement('#virtual-container');
            const content = this.getElement('#virtual-content');
            const display = this.getElement('#freq-display');
            
            if (!container || !content || !display) return;
            
            const { currentMode, currentQuery, currentResults } = searchData;
            
            // 清空内容并重置样式
            content.innerHTML = '';
            content.style.height = 'auto';
            content.style.position = 'static';
            
            // 创建搜索结果容器
            const searchContainer = this.createVirtualItem('div', 'search-results-wrapper');
            searchContainer.style.cssText = `
                width: 100%;
                background: white;
                overflow: visible;
            `;
            
            // 创建搜索标题
            const searchHeader = this.createSearchHeader(searchData);
            searchContainer.appendChild(searchHeader);
            
            // 创建结果内容区域
            const resultsArea = this.createVirtualItem('div', 'search-results-area');
            resultsArea.style.cssText = `
                padding: 20px;
                background: white;
            `;
            
            // 根据视图模式渲染结果
            if (this.currentView === 'cloud') {
                this.renderSearchResultsAsCloud(resultsArea, currentResults);
            } else {
                this.renderSearchResultsAsList(resultsArea, currentResults);
            }
            
            searchContainer.appendChild(resultsArea);
            content.appendChild(searchContainer);
            
            // 显示容器并重置滚动
            container.style.display = 'block';
            display.style.display = 'block';
            container.scrollTop = 0;
            
        } catch (error) {
            console.error('渲染搜索结果失败:', error);
            this.showSearchError('渲染搜索结果时出错');
        }
    }
    
    createSearchHeader(searchData) {
        const { currentMode, currentQuery, currentResults } = searchData;
        
        const searchHeader = this.createVirtualItem('div', 'search-results-header');
        searchHeader.style.cssText = `
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            position: sticky;
            top: 0;
            z-index: 10;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        const modeText = currentMode === 'intelligent' ? '智能匹配' : '精确搜索';
        const resultCount = currentResults ? currentResults.length : 0;
        
        let modeDescription = '';
        if (currentMode === 'intelligent') {
            modeDescription = '显示所有相关变形词的合并结果';
        } else {
            modeDescription = `只显示包含 "${currentQuery}" 的文章`;
        }
        
        searchHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 20px; font-weight: 600;">
                    🔍 ${modeText}搜索结果
                </h3>
                <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px; font-size: 14px; font-weight: 500;">
                    ${resultCount} 个结果
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 12px 16px; border-radius: 6px; font-size: 14px; line-height: 1.4;">
                <div style="margin-bottom: 8px;">
                    <strong>搜索词：</strong> "${currentQuery}"
                </div>
                <div style="opacity: 0.9;">
                    ${modeDescription}
                </div>
            </div>
            <div style="margin-top: 12px; font-size: 12px; opacity: 0.8; text-align: center;">
                💡 可以通过上方的模式选项卡切换搜索方式
            </div>
        `;
        
        return searchHeader;
    }
    
    renderSearchResultsAsCloud(container, results) {
        const maxCount = results[0]?.totalCount || 1;
        const minCount = results[results.length - 1]?.totalCount || 1;
        
        const cloudContainer = this.createVirtualItem('div', 'search-word-cloud');
        cloudContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            gap: 15px;
            padding: 30px 20px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 12px;
            margin: 20px 0;
            min-height: 150px;
            border: 2px solid #dee2e6;
        `;
        
        results.forEach(item => {
            const wordElement = this.createVirtualItem('span', 'word-item');
            const fontSize = this.calculateFontSize(item.totalCount, minCount, maxCount);
            const color = this.getWordColor(item.totalCount, maxCount);
            
            wordElement.dataset.word = item.word;
            wordElement.style.cssText = `
                font-size: ${fontSize}px; 
                color: ${color};
                margin: 5px 8px;
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 20px;
                background: ${item.isExactMatch ? 'rgba(40, 167, 69, 0.15)' : 'rgba(0, 123, 255, 0.1)'};
                border: 2px solid ${item.isExactMatch ? 'rgba(40, 167, 69, 0.4)' : 'rgba(0, 123, 255, 0.3)'};
                transition: all 0.3s ease;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            
            wordElement.textContent = item.word;
            wordElement.title = `${item.word}: ${item.totalCount} 次，出现在 ${item.articleCount} 篇文章中`;
            
            // 添加悬停效果
            wordElement.addEventListener('mouseenter', () => {
                wordElement.style.transform = 'translateY(-2px)';
                wordElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            });
            
            wordElement.addEventListener('mouseleave', () => {
                wordElement.style.transform = 'translateY(0)';
                wordElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            });
            
            cloudContainer.appendChild(wordElement);
        });
        
        container.appendChild(cloudContainer);
    }
    
    renderSearchResultsAsList(container, results) {
        const listContainer = this.createVirtualItem('div', 'search-word-list');
        listContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 20px 0;
        `;
        
        results.forEach((item, index) => {
            const listItem = this.createVirtualItem('div', 'word-list-item');
            
            listItem.dataset.word = item.word;
            listItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border: 2px solid ${item.isExactMatch ? '#28a745' : '#e9ecef'};
                border-radius: 12px;
                cursor: pointer;
                background: ${item.isExactMatch ? 'rgba(40, 167, 69, 0.05)' : 'white'};
                transition: all 0.3s ease;
                box-sizing: border-box;
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            `;
            
            const matchTypeText = item.isExactMatch ? '精确匹配' : '智能匹配';
            const matchColor = item.isExactMatch ? '#28a745' : '#007bff';
            
            listItem.innerHTML = `
                <div class="word-info" style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <strong style="font-size: 18px; color: #2c3e50;">${item.word}</strong>
                        <span style="background: ${matchColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${matchTypeText}</span>
                    </div>
                    <div style="color: #6c757d; font-size: 14px; display: flex; gap: 20px;">
                        <span>📄 ${item.articleCount} 篇文章</span>
                        <span>🔢 总计 ${item.totalCount} 次</span>
                    </div>
                </div>
                <div class="word-count" style="background: linear-gradient(135deg, ${matchColor}, ${matchColor}dd); color: white; padding: 12px 20px; border-radius: 20px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ${item.totalCount}
                </div>
            `;
            
            // 添加悬停效果
            listItem.addEventListener('mouseenter', () => {
                listItem.style.transform = 'translateY(-2px)';
                listItem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            
            listItem.addEventListener('mouseleave', () => {
                listItem.style.transform = 'translateY(0)';
                listItem.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
            });
            
            listContainer.appendChild(listItem);
        });
        
        container.appendChild(listContainer);
    }
    
    // 🔧 显示搜索错误
    showSearchError(message) {
        console.error('搜索错误:', message);
        this.showNoResults(`❌ ${message}`);
    }
    
    displayLegacySearchResults(results, query) {
        try {
            const validResults = Array.isArray(results) ? results : [];
            
            if (validResults.length === 0) {
                this.showNoResults(`未找到包含 "${query}" 的单词`);
                return;
            }
            
            const searchData = {
                currentMode: 'intelligent',
                currentQuery: query,
                currentResults: validResults
            };
            
            this.displaySearchResults(searchData);
            
        } catch (error) {
            console.error('Failed to display legacy search results:', error);
            this.showNoResults(`显示搜索结果时出错`);
        }
    }
    
    async initialize() {
        this.showLoading();
        
        try {
            await this.manager.waitForReady();
            this.isInitialized = true;
            this.hideLoading();
            this.updateStatsSummary();
            this.displayCurrentView();
        } catch (error) {
            console.error('UI初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }
    
    updateStatsSummary() {
        const summary = this.manager.getStatsSummary();
        const summaryEl = this.getElement('#stats-summary');
        
        if (summaryEl && summary) {
            const statsHTML = [
                `📚 ${summary.totalArticlesAnalyzed} 篇文章`,
                `📝 ${summary.totalUniqueWords.toLocaleString()} 个不同单词`,
                `🔢 ${summary.totalWordOccurrences.toLocaleString()} 总词次`,
                `📊 平均 ${summary.averageWordsPerArticle} 词/篇`
            ];
            
            summaryEl.innerHTML = statsHTML.map(stat => 
                `<span class="stat-item">${stat}</span>`
            ).join('');
        }
    }
    
    handleViewToggle(view) {
        this.container.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        this.currentView = view;
        this.clearDataCache();
        this.clearRenderCache();
        this.initializeVirtualScroll();
        
        const state = this.searchStateManager.getState();
        if (state.isActive) {
            this.displaySearchResults(state.frozenResults);
        } else {
            this.displayCurrentView();
        }
    }
    
    displayCurrentView() {
        if (!this.isInitialized || this.searchStateManager.getState().isActive) return;
        
        this.virtualScroll.currentDataSource = 'normal';
        
        switch (this.currentView) {
            case 'cloud':
                this.displayWordCloudVirtual();
                break;
            case 'list':
                this.displayWordListVirtual();
                break;
        }
    }
    
    displayWordCloudVirtual() {
        const words = this.getFilteredWords();
        
        if (words.length === 0) {
            this.showNoResults();
            return;
        }
        
        this.currentWordsData = words;
        this.virtualScroll.totalItems = words.length;
        this.virtualScroll.itemHeight = 35;
        
        const container = this.getElement('#virtual-container');
        const content = this.getElement('#virtual-content');
        const display = this.getElement('#freq-display');
        
        if (container && content && display) {
            this.virtualScroll.scrollTop = 0;
            this.virtualScroll.visibleStart = 0;
            this.virtualScroll.visibleEnd = 0;
            
            const totalHeight = Math.ceil(words.length / this.getWordsPerRow()) * this.virtualScroll.itemHeight;
            content.style.height = `${totalHeight}px`;
            content.style.position = 'relative';
            
            container.scrollTop = 0;
            container.style.display = 'block';
            display.style.display = 'block';
            
            this.updateVirtualScrollViewportImmediate();
        }
    }
    
    displayWordListVirtual() {
        const words = this.getFilteredWords();
        
        if (words.length === 0) {
            this.showNoResults();
            return;
        }
        
        this.currentWordsData = words;
        this.virtualScroll.totalItems = words.length;
        this.virtualScroll.itemHeight = 80;
        
        const container = this.getElement('#virtual-container');
        const content = this.getElement('#virtual-content');
        const display = this.getElement('#freq-display');
        
        if (container && content && display) {
            this.virtualScroll.scrollTop = 0;
            this.virtualScroll.visibleStart = 0;
            this.virtualScroll.visibleEnd = 0;
            
            const totalHeight = words.length * this.virtualScroll.itemHeight;
            content.style.height = `${totalHeight}px`;
            content.style.position = 'relative';
            
            container.scrollTop = 0;
            container.style.display = 'block';
            display.style.display = 'block';
            
            this.updateVirtualScrollViewportImmediate();
        }
    }
    
    renderVirtualItemsImmediate() {
        if (this.searchStateManager.getState().isActive) return;
        if (!this.currentWordsData || this.currentWordsData.length === 0) return;
        
        const content = this.getElement('#virtual-content');
        if (!content) return;
        
        const { visibleStart, visibleEnd, itemHeight } = this.virtualScroll;
        const visibleItems = this.currentWordsData.slice(visibleStart, visibleEnd);
        
        content.innerHTML = '';
        
        const itemsContainer = this.createVirtualItem('div', 'virtual-items-container');
        itemsContainer.style.cssText = `
            position: absolute;
            top: ${visibleStart * itemHeight}px;
            left: 0;
            right: 0;
        `;
        
        if (this.currentView === 'cloud') {
            this.renderWordCloudItemsImmediate(itemsContainer, visibleItems, visibleStart);
        } else {
            this.renderWordListItemsImmediate(itemsContainer, visibleItems, visibleStart);
        }
        
        content.appendChild(itemsContainer);
    }
    
    renderWordCloudItemsImmediate(container, items, startIndex) {
        const wordsPerRow = this.getWordsPerRow();
        const maxCount = items[0]?.totalCount || 1;
        const minCount = items[items.length - 1]?.totalCount || 1;
        
        let currentRow = null;
        
        items.forEach((item, index) => {
            const globalIndex = startIndex + index;
            const rowIndex = Math.floor(globalIndex / wordsPerRow);
            const colIndex = globalIndex % wordsPerRow;
            
            if (colIndex === 0) {
                currentRow = this.createVirtualItem('div', 'word-cloud-row');
                currentRow.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-wrap: wrap;
                    padding: 5px;
                    min-height: ${this.virtualScroll.itemHeight}px;
                `;
                container.appendChild(currentRow);
            }
            
            const wordElement = this.createVirtualItem('span', 'word-item');
            const fontSize = this.calculateFontSize(item.totalCount, minCount, maxCount);
            const color = this.getWordColor(item.totalCount, maxCount);
            
            wordElement.dataset.word = item.word;
            wordElement.style.cssText = `
                font-size: ${fontSize}px; 
                color: ${color};
                margin: 3px 6px;
                padding: 4px 8px;
                cursor: pointer;
                border-radius: 15px;
                background: rgba(0, 123, 255, 0.05);
                border: 1px solid transparent;
                transition: all 0.2s ease;
                will-change: transform;
            `;
            
            wordElement.textContent = item.word;
            wordElement.title = `${item.word}: ${item.totalCount} 次，出现在 ${item.articleCount} 篇文章中`;
            
            if (currentRow) {
                currentRow.appendChild(wordElement);
            }
        });
    }
    
    renderWordListItemsImmediate(container, items, startIndex) {
        items.forEach((item, index) => {
            const listItem = this.createVirtualItem('div', 'word-list-item');
            
            listItem.dataset.word = item.word;
            listItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                margin-bottom: 8px;
                border: 1px solid #e9ecef;
                border-radius: 10px;
                cursor: pointer;
                background: white;
                transition: all 0.3s ease;
                height: ${this.virtualScroll.itemHeight - 8}px;
                box-sizing: border-box;
                will-change: transform;
            `;
            
            listItem.innerHTML = `
                <div class="word-info">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <strong style="font-size: 16px; color: #2c3e50;">${item.word}</strong>
                    </div>
                    <small style="color: #6c757d; font-size: 12px;">${item.articleCount} 篇文章</small>
                </div>
                <div class="word-count" style="background: #007bff; color: white; padding: 6px 12px; border-radius: 15px; font-weight: 600; font-size: 14px;">${item.totalCount}</div>
            `;
            
            container.appendChild(listItem);
        });
    }
    
    getWordsPerRow() {
        const containerWidth = this.getElement('#virtual-container')?.clientWidth || 800;
        const avgWordWidth = this.isMobile ? 80 : 100;
        return Math.max(1, Math.floor(containerWidth / avgWordWidth));
    }
    
    clearRenderCache() {
        this.renderCache.renderedItems.clear();
        this.renderCache.itemElements.clear();
    }
    
    getFilteredWords(limit = 2000) {
        const cacheKey = `${this.currentFilter}_${limit}`;
        
        if (this.dataCache.has(cacheKey)) {
            return this.dataCache.get(cacheKey);
        }
        
        let words = this.manager.getTopWords(limit);
        
        const filterMap = {
            'high': item => item.totalCount >= 10,
            'medium': item => item.totalCount >= 5 && item.totalCount <= 9,
            'low': item => item.totalCount >= 2 && item.totalCount <= 4,
            'rare': item => item.totalCount === 1
        };
        
        if (this.currentFilter !== 'all' && filterMap[this.currentFilter]) {
            words = words.filter(filterMap[this.currentFilter]);
        }
        
        this.dataCache.set(cacheKey, words);
        
        if (this.dataCache.size > 10) {
            const firstKey = this.dataCache.keys().next().value;
            this.dataCache.delete(firstKey);
        }
        
        return words;
    }
    
    clearDataCache() {
        this.dataCache.clear();
        this.currentWordsData = null;
    }
    
    calculateFontSize(count, minCount, maxCount) {
        const minSize = this.isMobile ? 12 : 14;
        const maxSize = this.isMobile ? 28 : 36;
        
        if (maxCount === minCount) return minSize;
        
        const ratio = (count - minCount) / (maxCount - minCount);
        return Math.round(minSize + ratio * (maxSize - minSize));
    }
    
    getWordColor(count, maxCount) {
        const intensity = count / maxCount;
        if (intensity > 0.8) return '#d32f2f';
        if (intensity > 0.6) return '#f57c00';
        if (intensity > 0.4) return '#388e3c';
        if (intensity > 0.2) return '#1976d2';
        return '#757575';
    }
    
    handleWordClick(wordElement) {
        const word = wordElement.dataset.word;
        
        if (!word || word.trim() === '') {
            console.error('无效的单词数据:', word);
            return;
        }
        
        const details = this.manager.getWordDetails(word.trim());
        if (!details) {
            console.warn('未找到单词详情:', word);
            return;
        }
        
        this.selectedWord = word.trim();
        this.showWordDetails(details);
    }
    
    showWordDetails(details) {
        const { word, totalCount, articleCount, articles } = details;
        
        const panel = this.getElement('#word-details');
        if (!panel) return;
        
        const detailsContainer = this.createVirtualItem('div', 'word-details');
        detailsContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            padding: 24px;
            margin: 20px 0;
        `;
        
        const header = this.createVirtualItem('h3');
        header.textContent = `📝 "${word}" 详细分析`;
        header.style.cssText = 'margin: 0 0 20px 0; color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px; font-size: 24px;';
        
        const statsContainer = this.createVirtualItem('div', 'word-stats');
        statsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 25px;';
        
        const stats = [
            ['总出现次数', totalCount, '#007bff'],
            ['出现文章数', articleCount, '#28a745'],
            ['平均每篇', (totalCount / articleCount).toFixed(1), '#fd7e14']
        ];
        
        stats.forEach(([label, value, color]) => {
            const statItem = this.createVirtualItem('div', 'stat');
            statItem.style.cssText = `
                background: linear-gradient(135deg, ${color}15, ${color}05);
                border: 2px solid ${color}30;
                padding: 16px;
                border-radius: 12px;
                text-align: center;
                transition: transform 0.2s ease;
            `;
            statItem.innerHTML = `
                <div style="color: ${color}; font-weight: 700; font-size: 24px; margin-bottom: 4px;">${value}</div>
                <div style="color: #6c757d; font-size: 14px; font-weight: 500;">${label}</div>
            `;
            
            statItem.addEventListener('mouseenter', () => {
                statItem.style.transform = 'translateY(-2px)';
            });
            statItem.addEventListener('mouseleave', () => {
                statItem.style.transform = 'translateY(0)';
            });
            
            statsContainer.appendChild(statItem);
        });
        
        const articlesHeader = this.createVirtualItem('h4');
        articlesHeader.textContent = '📚 相关文章 (按出现频次排序)';
        articlesHeader.style.cssText = 'color: #2c3e50; margin: 30px 0 15px 0; font-size: 18px;';
        
        const articlesList = this.createVirtualItem('div', 'article-list');
        articlesList.style.cssText = 'display: grid; gap: 16px; margin-top: 20px; max-height: 500px; overflow-y: auto; padding-right: 8px;';
        
        articles.forEach(article => {
            const articleItem = this.createArticleItem(article, word);
            articlesList.appendChild(articleItem);
        });
        
        const closeBtn = this.createVirtualItem('button', 'close-details-btn');
        closeBtn.textContent = '✕ 关闭详情';
        closeBtn.style.cssText = `
            background: linear-gradient(135deg, #6c757d, #5a6268);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            margin-top: 24px;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s ease;
            display: block;
            margin-left: auto;
            margin-right: auto;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'linear-gradient(135deg, #5a6268, #495057)';
            closeBtn.style.transform = 'translateY(-1px)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';
            closeBtn.style.transform = 'translateY(0)';
        });
        
        detailsContainer.appendChild(header);
        detailsContainer.appendChild(statsContainer);
        detailsContainer.appendChild(articlesHeader);
        detailsContainer.appendChild(articlesList);
        detailsContainer.appendChild(closeBtn);
        
        panel.innerHTML = '';
        panel.appendChild(detailsContainer);
        panel.style.display = 'block';
        
        setTimeout(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    
    createArticleItem(article, word) {
        const articleItem = this.createVirtualItem('div', 'article-item');
        
        articleItem.dataset.articleId = article.id;
        articleItem.dataset.word = word;
        articleItem.title = `点击跳转到文章并高亮 '${word}'`;
        articleItem.style.cssText = `
            position: relative;
            padding: 20px 24px;
            background: white;
            border-radius: 12px;
            border-left: 4px solid #007bff;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            border: 1px solid #e9ecef;
        `;
        
        const titleEl = this.createVirtualItem('div', 'article-title');
        titleEl.textContent = article.title;
        titleEl.style.cssText = 'font-weight: 600; color: #2c3e50; margin-bottom: 12px; font-size: 16px; line-height: 1.4;';
        
        const statsEl = this.createVirtualItem('div', 'article-stats');
        statsEl.innerHTML = `
            <span style="color: #6c757d; font-size: 14px;">在此文章中出现 </span>
            <strong style="color: #007bff; font-size: 16px; font-weight: 700;">${article.count}</strong>
            <span style="color: #6c757d; font-size: 14px;"> 次</span>
            <span class="click-hint" style="font-size: 12px; color: #007bff; opacity: 0; transition: opacity 0.3s; margin-left: 15px; font-weight: 500;">👆 点击跳转并高亮</span>
        `;
        statsEl.style.cssText = 'margin-bottom: 12px;';
        
        articleItem.appendChild(titleEl);
        articleItem.appendChild(statsEl);
        
        if (article.contexts && article.contexts.length > 0) {
            const contextsContainer = this.createVirtualItem('div', 'contexts');
            contextsContainer.style.cssText = 'margin-top: 16px;';
            
            article.contexts.forEach(ctx => {
                const contextEl = this.createVirtualItem('div', 'context');
                contextEl.innerHTML = ctx;
                contextEl.style.cssText = `
                    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin: 8px 0;
                    font-size: 13px;
                    line-height: 1.5;
                    border-left: 3px solid #28a745;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                `;
                contextsContainer.appendChild(contextEl);
            });
            
            articleItem.appendChild(contextsContainer);
        }
        
        // 添加悬停效果
        articleItem.addEventListener('mouseenter', () => {
            articleItem.style.transform = 'translateY(-2px)';
            articleItem.style.boxShadow = '0 4px 16px rgba(0, 123, 255, 0.15)';
            articleItem.style.borderLeftColor = '#0056b3';
            const hint = articleItem.querySelector('.click-hint');
            if (hint) hint.style.opacity = '1';
        });
        
        articleItem.addEventListener('mouseleave', () => {
            articleItem.style.transform = 'translateY(0)';
            articleItem.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
            articleItem.style.borderLeftColor = '#007bff';
            const hint = articleItem.querySelector('.click-hint');
            if (hint) hint.style.opacity = '0';
        });
        
        return articleItem;
    }
    
    hideWordDetails() {
        const panel = this.getElement('#word-details');
        if (panel) {
            panel.style.display = 'none';
            panel.innerHTML = '';
        }
        this.selectedWord = null;
    }
    
    handleArticleClick(articleElement) {
        const now = Date.now();
        
        if (this.jumpInProgress || (now - this.lastJumpTime) < this.jumpCooldown) {
            return;
        }
        
        this.jumpInProgress = true;
        this.lastJumpTime = now;
        
        const articleId = articleElement.dataset.articleId;
        const word = articleElement.dataset.word || this.selectedWord;
        
        if (!word || !articleId) {
            console.error('跳转数据无效:', { word, articleId });
            this.jumpInProgress = false;
            return;
        }
        
        this.prepareHighlightData(word.trim());
        this.performJump(articleId.trim(), word.trim());
        
        setTimeout(() => {
            this.jumpInProgress = false;
        }, 1000);
    }
    
    prepareHighlightData(word) {
        sessionStorage.removeItem('highlightWord');
        sessionStorage.removeItem('highlightSource');
        sessionStorage.removeItem('highlightVariants');
        
        setTimeout(() => {
            sessionStorage.setItem('highlightWord', word);
            sessionStorage.setItem('highlightSource', 'wordFreq');
            
            const wordDetails = this.manager.getWordDetails(word);
            if (wordDetails && wordDetails.variants) {
                const variants = wordDetails.variants.map(([variant]) => variant).filter(v => v && v.trim());
                if (variants.length > 0) {
                    sessionStorage.setItem('highlightVariants', JSON.stringify(variants));
                }
            }
        }, 50);
    }
    
    performJump(articleId, word) {
        this.showJumpNotification(articleId, word);
        
        setTimeout(() => {
            if (window.app?.navigation?.navigateToChapter) {
                window.app.navigation.navigateToChapter(articleId);
            } else if (window.location.pathname.includes('word-frequency.html')) {
                window.location.href = `index.html#${articleId}`;
            } else {
                window.location.hash = articleId;
            }
        }, 100);
    }
    
    showJumpNotification(articleId, word) {
        document.querySelectorAll('[data-jump-notification]').forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.setAttribute('data-jump-notification', 'true');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #28a745, #20c997); color: white;
            padding: 12px 20px; border-radius: 25px; z-index: 10000;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            font-size: 14px; font-weight: 500; max-width: 400px;
            backdrop-filter: blur(10px);
        `;
        
        notification.innerHTML = `🚀 正在跳转到文章 (高亮 "${word}")`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
    }
    
    showLoading() {
        const loading = this.getElement('#freq-loading');
        const display = this.getElement('#freq-display');
        
        if (loading) loading.style.display = 'flex';
        if (display) display.style.display = 'none';
    }
    
    hideLoading() {
        const loading = this.getElement('#freq-loading');
        const display = this.getElement('#freq-display');
        
        if (loading) loading.style.display = 'none';
        if (display) display.style.display = 'block';
    }
    
    updateProgress(progress) {
        const progressFill = this.getElement('#progress-fill');
        const progressText = this.getElement('#progress-text');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${progress}%`;
    }
    
    showNoResults(message = '暂无数据') {
        const display = this.getElement('#freq-display');
        const container = this.getElement('#virtual-container');
        
        if (display && container) {
            container.style.display = 'none';
            display.innerHTML = `
                <div class="no-results" style="text-align: center; padding: 60px 20px; color: #6c757d; background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 12px; margin: 20px 0; border: 2px dashed #dee2e6;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.6;">📭</div>
                    <h3 style="color: #495057; margin-bottom: 12px; font-size: 20px;">${message}</h3>
                    <p style="margin-bottom: 20px; font-size: 14px; line-height: 1.6;">尝试调整筛选条件或搜索其他关键词</p>
                    ${this.searchStateManager.getState().isActive ? `
                        <button onclick="this.closest('.word-freq-page').querySelector('#clear-search').click()" 
                                style="margin-top: 15px; padding: 12px 24px; background: linear-gradient(135deg, #007bff, #0056b3); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);">
                            🔄 清除搜索，返回浏览
                        </button>
                    ` : ''}
                </div>
            `;
            display.style.display = 'block';
        }
    }
    
    showError(message) {
        const display = this.getElement('#freq-display');
        const container = this.getElement('#virtual-container');
        
        if (display && container) {
            container.style.display = 'none';
            display.innerHTML = `
                <div class="no-results" style="text-align: center; padding: 60px 20px; color: #6c757d; background: linear-gradient(135deg, #fff5f5, #ffffff); border-radius: 12px; margin: 20px 0; border: 2px solid #f56565;">
                    <div style="font-size: 48px; margin-bottom: 16px; color: #e53e3e;">❌</div>
                    <h2 style="color: #e53e3e; margin-bottom: 16px;">发生错误</h2>
                    <p style="margin-bottom: 24px; font-size: 14px; line-height: 1.6;">${message}</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 12px 24px; background: linear-gradient(135deg, #e53e3e, #c53030); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(229, 62, 62, 0.3);">
                        🔄 重新加载页面
                    </button>
                </div>
            `;
            display.style.display = 'block';
        }
        this.hideLoading();
    }
    
    refreshData() {
        if (this.isInitialized) {
            this.clearDataCache();
            this.clearRenderCache();
            this.updateStatsSummary();
            
            const state = this.searchStateManager.getState();
            if (state.isActive) {
                this.executeSafeSearch(state.sanitizedQuery);
            } else {
                this.displayCurrentView();
            }
        }
    }
    
    removeAllEventListeners() {
        if (this.eventDelegateRoot && this.boundHandlers) {
            Object.entries(this.boundHandlers).forEach(([event, handler]) => {
                this.eventDelegateRoot.removeEventListener(event, handler);
            });
        }
        
        const virtualContainer = this.getElement('#virtual-container');
        if (virtualContainer) {
            virtualContainer.removeEventListener('scroll', this.throttledScroll);
        }
        
        window.removeEventListener('resize', this.throttledResize);
    }
    
    destroy() {
        // 销毁搜索系统
        if (this.searchStateManager) {
            this.searchStateManager.forceReset();
        }
        
        if (this.debouncedSearchManager) {
            this.debouncedSearchManager.destroy();
        }
        
        // 清理超时
        if (this.virtualScroll.scrollTimeout) {
            clearTimeout(this.virtualScroll.scrollTimeout);
        }
        
        // 移除事件监听器
        this.removeAllEventListeners();
        
        // 清理缓存
        this.domCache.clear();
        this.dataCache.clear();
        this.clearRenderCache();
        
        // 移除样式
        const styleEl = document.getElementById('word-freq-styles');
        if (styleEl) styleEl.remove();
        
        // 清空引用
        this.container = null;
        this.manager = null;
        this.currentWordsData = null;
        this.searchStateManager = null;
        this.inputProcessor = null;
        this.debouncedSearchManager = null;
        
        console.log('✅ WordFrequencyUI已完全销毁');
    }
    
    loadStyles() {
        if (document.getElementById('word-freq-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'word-freq-styles';
        style.textContent = `
            .word-freq-page { padding: 20px; max-width: 1400px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; min-height: 100vh; }
            .word-freq-header { margin-bottom: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 20px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            .header-title h1 { margin: 0 0 16px 0; color: #2c3e50; font-size: 2.2rem; font-weight: 700; }
            .stats-summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
            .stat-item { background: linear-gradient(135deg, #007bff15, #007bff05); padding: 12px 16px; border-radius: 20px; font-size: 0.9rem; color: #495057; border: 2px solid #007bff20; font-weight: 600; transition: all 0.3s ease; }
            .stat-item:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15); }
            .word-freq-controls { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-top: 20px; }
            .search-section { flex: 1; min-width: 300px; }
            .search-box { display: flex; gap: 8px; margin-bottom: 12px; }
            .search-box input { flex: 1; padding: 12px 20px; border: 2px solid #dee2e6; border-radius: 25px; font-size: 14px; outline: none; transition: all 0.3s ease; background: white; }
            .search-box input:focus { border-color: #007bff; box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1); transform: translateY(-1px); }
            .search-box button { padding: 12px 18px; border: none; border-radius: 20px; background: linear-gradient(135deg, #007bff, #0056b3); color: white; cursor: pointer; transition: all 0.3s ease; font-size: 14px; min-width: 48px; font-weight: 600; }
            .search-box button:hover { background: linear-gradient(135deg, #0056b3, #004085); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3); }
            #clear-search { background: linear-gradient(135deg, #6c757d, #5a6268) !important; }
            #clear-search:hover { background: linear-gradient(135deg, #5a6268, #495057) !important; }
            
            .search-mode-tabs { 
                display: flex; 
                gap: 6px; 
                background: #f8f9fa; 
                padding: 6px; 
                border-radius: 25px; 
                border: 2px solid #dee2e6; 
                margin-bottom: 12px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
            }
            .search-mode-tab { 
                padding: 10px 18px; 
                border: none; 
                background: transparent; 
                cursor: pointer; 
                border-radius: 20px; 
                transition: all 0.3s ease; 
                font-size: 13px; 
                white-space: nowrap; 
                min-width: 120px;
                color: #6c757d;
                font-weight: 600;
            }
            .search-mode-tab.active { 
                background: linear-gradient(135deg, #007bff, #0056b3); 
                color: white; 
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
                transform: translateY(-1px);
            }
            .search-mode-tab:not(.active):hover { 
                background: #e9ecef; 
                color: #495057;
                transform: translateY(-1px);
            }
            
            .search-suggestion {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
                border: 2px solid #90caf9;
                border-radius: 12px;
                padding: 14px 18px;
                margin-top: 12px;
                animation: slideInDown 0.4s ease-out;
                box-shadow: 0 2px 12px rgba(144, 202, 249, 0.3);
            }
            
            @keyframes slideInDown {
                from { opacity: 0; transform: translateY(-12px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .suggestion-content {
                display: flex;
                align-items: center;
                gap: 16px;
                flex: 1;
            }
            
            .suggestion-text {
                color: #1565c0;
                font-size: 13px;
                font-weight: 600;
                line-height: 1.4;
            }
            
            .suggestion-action {
                background: linear-gradient(135deg, #1976d2, #1565c0);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 18px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
                white-space: nowrap;
            }
            
            .suggestion-action:hover {
                background: linear-gradient(135deg, #1565c0, #0d47a1);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
            }
            
            .suggestion-close {
                background: rgba(0,0,0,0.1);
                color: #1565c0;
                border: none;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: 12px;
            }
            
            .suggestion-close:hover {
                background: rgba(0,0,0,0.2);
                transform: scale(1.1);
            }
            
            .view-section .view-toggles { display: flex; gap: 8px; }
            .view-btn { padding: 12px 20px; border: 2px solid #dee2e6; border-radius: 25px; background: white; cursor: pointer; transition: all 0.3s ease; font-size: 14px; font-weight: 600; color: #6c757d; }
            .view-btn.active { background: linear-gradient(135deg, #28a745, #20c997); color: white; border-color: #28a745; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); transform: translateY(-1px); }
            .view-btn:not(.active):hover { background: #f8f9fa; border-color: #adb5bd; transform: translateY(-1px); }
            
            .filter-section select { padding: 12px 16px; border: 2px solid #dee2e6; border-radius: 25px; background: white; font-size: 14px; color: #495057; cursor: pointer; transition: all 0.3s ease; font-weight: 600; }
            .filter-section select:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1); }
            
            .word-freq-content { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); min-height: 600px; }
            
            .loading-section { display: flex; align-items: center; justify-content: center; height: 500px; background: linear-gradient(135deg, #f8f9fa, #ffffff); border-radius: 12px; }
            .loading-indicator { text-align: center; padding: 40px; }
            .spinner { width: 48px; height: 48px; border: 4px solid #f3f4f6; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .loading-text { font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 20px; }
            .progress-container { margin: 20px 0; }
            .progress-bar { width: 300px; height: 8px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 0 auto; }
            .progress-fill { height: 100%; background: linear-gradient(90deg, #007bff, #28a745); transition: width 0.3s ease; border-radius: 10px; }
            .progress-text { margin-top: 12px; font-size: 14px; color: #6c757d; font-weight: 600; }
            .loading-tips { margin-top: 24px; color: #6c757d; font-size: 13px; line-height: 1.4; max-width: 300px; }
            
            .word-freq-display { padding: 20px; }
            .virtual-scroll-container { border-radius: 8px; overflow: hidden; background: #f8f9fa; }
            .virtual-scroll-content { position: relative; }
            
            .search-results-wrapper { background: white; border-radius: 8px; overflow: hidden; }
            .search-word-cloud .word-item:hover { transform: scale(1.05) translateY(-2px); }
            .search-word-list .word-list-item:hover { border-color: #007bff; }
            
            .word-cloud-row { min-height: 35px; }
            .word-item { display: inline-block; transition: all 0.2s ease; }
            .word-item:hover { transform: scale(1.05); background: rgba(0, 123, 255, 0.15) !important; }
            
            .word-list-item:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15); border-color: #007bff; }
            
            .word-details-panel { padding: 20px; background: #f8f9fa; border-radius: 12px; margin-top: 20px; }
            .article-item:hover .click-hint { opacity: 1 !important; }
            
            .no-results { animation: fadeIn 0.5s ease-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            
            /* 移动端优化 */
            @media (max-width: 768px) {
                .word-freq-page { padding: 12px; }
                .word-freq-header { padding: 16px; }
                .header-title h1 { font-size: 1.8rem; }
                .word-freq-controls { flex-direction: column; gap: 16px; }
                .search-section { min-width: auto; }
                .stats-summary { gap: 12px; }
                .stat-item { padding: 10px 14px; font-size: 0.85rem; }
                .view-btn { padding: 10px 16px; font-size: 13px; }
                .search-mode-tab { min-width: 100px; padding: 8px 14px; font-size: 12px; }
                .suggestion-content { flex-direction: column; align-items: flex-start; gap: 12px; }
                .word-details-panel { padding: 16px; }
                .virtual-scroll-container { margin: 0 -8px; }
            }
        `;
        
        document.head.appendChild(style);
    }
}

// 导出到全局
window.EnglishSite.WordFrequencyUI = WordFrequencyUI;

console.log('📊 词频UI模块已加载（完全重构版v3.0）- 搜索功能已彻底修复');

// 🔧 完整性验证
(function validateWordFrequencyUI() {
    const requiredClasses = ['SearchStateManager', 'SearchInputProcessor', 'DebouncedSearchManager', 'WordFrequencyUI'];
    const missingClasses = [];
    
    requiredClasses.forEach(className => {
        if (typeof eval(className) !== 'function') {
            missingClasses.push(className);
        }
    });
    
    if (missingClasses.length > 0) {
        console.error('❌ 缺少必要的类:', missingClasses);
        return false;
    }
    
    // 检查WordFrequencyUI的关键方法
    const ui = WordFrequencyUI.prototype;
    const requiredMethods = [
        'initializeSearchSystem', 'executeSafeSearch', 'performDualSearch', 
        'handleSearchModeSwitch', 'clearSearchCompletely', 'displaySearchResults',
        'renderSearchResultsDirectly', 'handleDelegatedInput', 'handleDelegatedClick',
        'showSearchSuggestion', 'updateSearchUI', 'initialize', 'destroy'
    ];
    
    const missingMethods = requiredMethods.filter(method => typeof ui[method] !== 'function');
    
    if (missingMethods.length > 0) {
        console.error('❌ WordFrequencyUI缺少必要的方法:', missingMethods);
        return false;
    }
    
    // 检查导出
    if (!window.EnglishSite || !window.EnglishSite.WordFrequencyUI) {
        console.error('❌ WordFrequencyUI未正确导出到全局');
        return false;
    }
    
    console.log('✅ 代码完整性验证通过');
    console.log('📋 包含的类:', requiredClasses);
    console.log('🔧 WordFrequencyUI方法数:', Object.getOwnPropertyNames(ui).filter(name => typeof ui[name] === 'function').length);
    
    return true;
})();