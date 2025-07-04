// js/modules/glossary-core.js - iOS兼容版词汇表核心
// 🚀 智能词汇表系统，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    // 🔧 环境检测和生产环境优化
    var IS_PRODUCTION = typeof window !== 'undefined' && 
        (window.location.hostname !== 'localhost' && 
         window.location.hostname !== '127.0.0.1' &&
         window.location.hostname !== '' &&
         !window.location.hostname.startsWith('192.168.') &&
         !window.location.hostname.startsWith('10.') &&
         !window.location.hostname.startsWith('172.'));

    var DEBUG_LOG = IS_PRODUCTION ? function(){} : console.log;
    var DEBUG_WARN = IS_PRODUCTION ? function(){} : console.warn;
    var DEBUG_ERROR = IS_PRODUCTION ? function(){} : console.error;

    // 🔧 安全工具函数
    function safeJSONParse(str, fallback) {
        if (!str || typeof str !== 'string') {
            return fallback || {};
        }
        try {
            var result = JSON.parse(str);
            return result !== null ? result : (fallback || {});
        } catch (error) {
            DEBUG_WARN('[GlossaryCore] JSON解析失败:', error.message);
            return fallback || {};
        }
    }

    function safeJSONStringify(obj, fallback) {
        if (obj === null || obj === undefined) {
            return fallback || '{}';
        }
        try {
            return JSON.stringify(obj);
        } catch (error) {
            DEBUG_WARN('[GlossaryCore] JSON序列化失败:', error.message);
            return fallback || '{}';
        }
    }

    function createSafeTimeout(callback, delay, context) {
        var timeoutId;
        var executed = false;
        
        var safeCallback = function() {
            if (executed) return;
            executed = true;
            
            try {
                if (typeof callback === 'function') {
                    callback.call(context);
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 定时器回调错误:', error);
            }
        };
        
        timeoutId = setTimeout(safeCallback, delay);
        
        return {
            clear: function() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    executed = true;
                }
            },
            execute: safeCallback
        };
    }

    /**
     * 🎯 GlossaryCore - 词汇表核心
     * 功能：智能弹窗、词汇管理、上下文显示、性能渲染、触摸优化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function GlossaryCore(container, options) {
        options = options || {};
        
        // 配置参数
        var config = {
            triggerEvent: options.triggerEvent || 'click', // click, hover, longpress
            closeEvent: options.closeEvent || 'click', // click, swipe, auto
            position: options.position || 'auto', // auto, top, bottom, left, right
            offset: Math.max(5, Math.min(50, options.offset || 10)),
            maxWidth: Math.max(200, Math.min(600, options.maxWidth || 350)),
            minWidth: Math.max(150, Math.min(400, options.minWidth || 250)),
            maxHeight: Math.max(200, Math.min(800, options.maxHeight || 400)),
            animationDuration: Math.max(100, Math.min(1000, options.animationDuration || 200)),
            enableTouch: options.enableTouch !== false,
            enableKeyboard: options.enableKeyboard !== false,
            enableAudio: options.enableAudio !== false,
            enableBookmark: options.enableBookmark !== false,
            autoClose: options.autoClose !== false,
            autoCloseDelay: Math.max(1000, Math.min(30000, options.autoCloseDelay || 5000)),
            preloadCount: Math.max(10, Math.min(100, options.preloadCount || 20)),
            cacheSize: Math.max(50, Math.min(500, options.cacheSize || 100)),
            searchThreshold: Math.max(0.5, Math.min(1.0, options.searchThreshold || 0.8)),
            dataUrl: options.dataUrl || null,
            cacheKey: 'glossary_data'
        };
        
        // 私有变量
        var glossaryData = {};
        var frequentWords = {};
        var bookmarkedWords = new Set();
        var searchIndex = [];
        var currentWord = null;
        var currentPopup = null;
        var isVisible = false;
        var isAnimating = false;
        var touchStartX = 0;
        var touchStartY = 0;
        var longPressTimer = null;
        var autoCloseTimer = null;
        
        // 性能缓存
        var elementCache = {};
        var templateCache = {};
        var renderQueue = [];
        var isRendering = false;
        
        // 统计数据
        var statistics = {
            lookups: 0,
            bookmarks: 0,
            audioPlays: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // 🔧 清理和销毁相关
        var isDestroyed = false;
        var boundEventHandlers = {};
        
        // 依赖注入
        var stateManager = null;
        var eventHub = null;
        var cacheManager = null;
        var errorBoundary = null;
        
        var self = this;
        
        // DOM元素引用
        var elements = {
            container: null,
            popup: null,
            overlay: null
        };
        
        // 🎯 初始化
        function initialize() {
            if (isDestroyed) {
                DEBUG_ERROR('[GlossaryCore] 尝试初始化已销毁的实例');
                return;
            }
            
            try {
                // 注入依赖
                injectDependencies();
                
                // 验证容器
                if (!container) {
                    throw new Error('Glossary container is required');
                }
                
                elements.container = typeof container === 'string' ? 
                    document.getElementById(container) : container;
                
                if (!elements.container) {
                    throw new Error('Glossary container not found');
                }
                
                // 创建弹窗结构
                createPopupStructure();
                
                // 初始化模板缓存
                initializeTemplates();
                
                // 加载词汇数据
                loadGlossaryData();
                
                // 绑定事件
                bindEvents();
                
                // 恢复状态
                restoreState();
                
                DEBUG_LOG('[GlossaryCore] 初始化成功');
                
                // 触发初始化完成事件
                if (eventHub) {
                    eventHub.emit('glossary:initialized', {
                        wordCount: Object.keys(glossaryData).length,
                        config: config
                    });
                }
                
            } catch (error) {
                handleError('initialize', error);
            }
        }
        
        // 🔑 公开API
        
        /**
         * 加载词汇数据
         * @param {Object|string} data - 词汇数据或URL
         */
        this.load = function(data) {
            if (isDestroyed) {
                DEBUG_WARN('[GlossaryCore] 实例已销毁，无法加载数据');
                return false;
            }
            
            try {
                if (typeof data === 'string') {
                    // 从URL加载
                    loadFromUrl(data);
                } else if (typeof data === 'object') {
                    // 直接设置数据
                    setGlossaryData(data);
                } else {
                    throw new Error('Invalid glossary data format');
                }
                return true;
            } catch (error) {
                handleError('load', error);
                return false;
            }
        };
        
        /**
         * 显示词汇弹窗
         * @param {string} word - 词汇
         * @param {HTMLElement} triggerElement - 触发元素
         * @param {Object} options - 选项
         */
        this.show = function(word, triggerElement, options) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                options = options || {};
                
                if (!word || typeof word !== 'string') {
                    throw new Error('Invalid word parameter');
                }
                
                // 查找词汇数据
                var wordData = findWordData(word);
                if (!wordData) {
                    DEBUG_WARN('[GlossaryCore] Word not found:', word);
                    return false;
                }
                
                // 关闭当前弹窗
                if (isVisible) {
                    this.hide();
                }
                
                // 设置当前词汇
                currentWord = word;
                
                // 渲染弹窗内容
                renderPopupContent(wordData);
                
                // 计算位置
                var position = calculatePosition(triggerElement, options.position);
                
                // 显示弹窗
                showPopup(position);
                
                // 更新统计
                updateWordFrequency(word);
                statistics.lookups++;
                
                // 保存状态
                saveState();
                
                // 触发显示事件
                if (eventHub) {
                    eventHub.emit('glossary:shown', {
                        word: word,
                        data: wordData,
                        position: position
                    });
                }
                
                return true;
            } catch (error) {
                handleError('show', error);
                return false;
            }
        };
        
        /**
         * 隐藏词汇弹窗
         */
        this.hide = function() {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!isVisible || isAnimating) {
                    return false;
                }
                
                hidePopup();
                
                // 清理状态
                currentWord = null;
                
                // 清理定时器
                clearAutoCloseTimer();
                
                // 触发隐藏事件
                if (eventHub) {
                    eventHub.emit('glossary:hidden');
                }
                
                return true;
            } catch (error) {
                handleError('hide', error);
                return false;
            }
        };
        
        /**
         * 切换弹窗显示状态
         */
        this.toggle = function(word, triggerElement, options) {
            if (isVisible && currentWord === word) {
                return this.hide();
            } else {
                return this.show(word, triggerElement, options);
            }
        };
        
        /**
         * 搜索词汇
         * @param {string} query - 搜索关键词
         * @param {number} limit - 结果限制
         */
        this.search = function(query, limit) {
            if (isDestroyed) {
                return [];
            }
            
            try {
                limit = Math.max(5, Math.min(50, limit || 10));
                
                if (!query || typeof query !== 'string' || query.length < 2) {
                    return [];
                }
                
                var results = searchWords(query.toLowerCase(), limit);
                
                // 触发搜索事件
                if (eventHub) {
                    eventHub.emit('glossary:searched', {
                        query: query,
                        results: results,
                        count: results.length
                    });
                }
                
                return results;
            } catch (error) {
                handleError('search', error);
                return [];
            }
        };
        
        /**
         * 添加/移除书签
         * @param {string} word - 词汇
         */
        this.toggleBookmark = function(word) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!word || typeof word !== 'string') {
                    throw new Error('Invalid word parameter');
                }
                
                var isBookmarked = bookmarkedWords.has(word);
                
                if (isBookmarked) {
                    bookmarkedWords.delete(word);
                } else {
                    bookmarkedWords.add(word);
                    statistics.bookmarks++;
                }
                
                // 更新弹窗中的书签状态
                if (currentWord === word && isVisible) {
                    updateBookmarkButton(!isBookmarked);
                }
                
                // 保存书签状态
                saveBookmarks();
                
                // 触发书签事件
                if (eventHub) {
                    eventHub.emit('glossary:bookmarkChanged', {
                        word: word,
                        bookmarked: !isBookmarked
                    });
                }
                
                return !isBookmarked;
            } catch (error) {
                handleError('toggleBookmark', error);
                return false;
            }
        };
        
        /**
         * 播放单词发音
         * @param {string} word - 词汇
         */
        this.playAudio = function(word) {
            if (isDestroyed) {
                return false;
            }
            
            try {
                if (!config.enableAudio) {
                    DEBUG_WARN('[GlossaryCore] Audio is disabled');
                    return false;
                }
                
                word = word || currentWord;
                if (!word) {
                    throw new Error('No word specified for audio playback');
                }
                
                var wordData = findWordData(word);
                if (!wordData || !wordData.audio) {
                    DEBUG_WARN('[GlossaryCore] No audio available for word:', word);
                    return false;
                }
                
                playWordAudio(wordData.audio);
                statistics.audioPlays++;
                
                // 触发音频播放事件
                if (eventHub) {
                    eventHub.emit('glossary:audioPlayed', {
                        word: word,
                        audioUrl: wordData.audio
                    });
                }
                
                return true;
            } catch (error) {
                handleError('playAudio', error);
                return false;
            }
        };
        
        /**
         * 获取词汇统计信息
         */
        this.getStats = function() {
            return {
                wordCount: Object.keys(glossaryData).length,
                frequentWords: Object.keys(frequentWords).length,
                bookmarkedWords: bookmarkedWords.size,
                lookups: statistics.lookups,
                bookmarks: statistics.bookmarks,
                audioPlays: statistics.audioPlays,
                cacheHits: statistics.cacheHits,
                cacheMisses: statistics.cacheMisses,
                cacheHitRate: statistics.cacheHits / (statistics.cacheHits + statistics.cacheMisses) || 0,
                isDestroyed: isDestroyed
            };
        };
        
        /**
         * 获取当前状态
         */
        this.getState = function() {
            return {
                isVisible: isVisible,
                currentWord: currentWord,
                bookmarkedWords: Array.from(bookmarkedWords),
                statistics: statistics,
                isDestroyed: isDestroyed
            };
        };
        
        /**
         * 销毁实例
         */
        this.destroy = function() {
            if (isDestroyed) {
                return true;
            }
            
            try {
                // 标记为已销毁
                isDestroyed = true;
                
                // 隐藏弹窗
                this.hide();
                
                // 移除事件监听器
                unbindEvents();
                
                // 清理DOM
                cleanupDOM();
                
                // 清理定时器
                clearAllTimers();
                
                // 清理缓存
                elementCache = {};
                templateCache = {};
                renderQueue = [];
                
                // 清理状态
                if (stateManager) {
                    stateManager.clearState('glossary');
                }
                
                // 触发销毁事件
                if (eventHub) {
                    eventHub.emit('glossary:destroyed');
                }
                
                DEBUG_LOG('[GlossaryCore] 实例已销毁');
                return true;
            } catch (error) {
                handleError('destroy', error);
                return false;
            }
        };
        
        // 🔧 内部方法
        
        function injectDependencies() {
            // 尝试获取全局依赖
            if (typeof global.EnglishSite !== 'undefined') {
                stateManager = global.EnglishSite.StateManager ? 
                    new global.EnglishSite.StateManager() : null;
                eventHub = global.EnglishSite.EventHub ? 
                    new global.EnglishSite.EventHub() : null;
                cacheManager = global.EnglishSite.CacheManager ? 
                    new global.EnglishSite.CacheManager() : null;
                errorBoundary = global.EnglishSite.ErrorBoundary ? 
                    new global.EnglishSite.ErrorBoundary() : null;
            }
            
            // 如果用户传入了依赖，则使用用户提供的
            if (options.stateManager) stateManager = options.stateManager;
            if (options.eventHub) eventHub = options.eventHub;
            if (options.cacheManager) cacheManager = options.cacheManager;
            if (options.errorBoundary) errorBoundary = options.errorBoundary;
        }
        
        function createPopupStructure() {
            try {
                // 创建弹窗容器
                elements.popup = document.createElement('div');
                elements.popup.className = 'glossary-popup';
                elements.popup.style.cssText = [
                    'position: absolute',
                    'z-index: 9999',
                    'background: white',
                    'border: 1px solid #ddd',
                    'border-radius: 8px',
                    'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
                    'padding: 0',
                    'margin: 0',
                    'visibility: hidden',
                    'opacity: 0',
                    'transform: scale(0.95)',
                    'transition: all ' + config.animationDuration + 'ms ease-out',
                    'max-width: ' + config.maxWidth + 'px',
                    'min-width: ' + config.minWidth + 'px',
                    'max-height: ' + config.maxHeight + 'px',
                    'overflow: hidden'
                ].join(';');
                
                // 创建覆盖层（移动端）
                if (isMobile()) {
                    elements.overlay = document.createElement('div');
                    elements.overlay.className = 'glossary-overlay';
                    elements.overlay.style.cssText = [
                        'position: fixed',
                        'top: 0',
                        'left: 0',
                        'right: 0',
                        'bottom: 0',
                        'background: rgba(0,0,0,0.3)',
                        'z-index: 9998',
                        'display: none',
                        'opacity: 0',
                        'transition: opacity ' + config.animationDuration + 'ms ease-out'
                    ].join(';');
                    
                    document.body.appendChild(elements.overlay);
                }
                
                document.body.appendChild(elements.popup);
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 弹窗结构创建失败:', error);
            }
        }
        
        function initializeTemplates() {
            // 词汇条目模板
            templateCache.wordEntry = function(data) {
                try {
                    var bookmarkClass = bookmarkedWords.has(data.word) ? 'bookmarked' : '';
                    var audioButton = config.enableAudio && data.audio ? 
                        '<button class="glossary-audio-btn" data-word="' + data.word + '">🔊</button>' : '';
                    var bookmarkButton = config.enableBookmark ? 
                        '<button class="glossary-bookmark-btn ' + bookmarkClass + '" data-word="' + data.word + '">★</button>' : '';
                    
                    return [
                        '<div class="glossary-content">',
                            '<div class="glossary-header">',
                                '<div class="glossary-word-info">',
                                    '<h3 class="glossary-word">' + (data.word || '') + '</h3>',
                                    data.phonetic ? '<span class="glossary-phonetic">' + data.phonetic + '</span>' : '',
                                    data.partOfSpeech ? '<span class="glossary-pos">' + data.partOfSpeech + '</span>' : '',
                                '</div>',
                                '<div class="glossary-actions">',
                                    audioButton,
                                    bookmarkButton,
                                    '<button class="glossary-close-btn">×</button>',
                                '</div>',
                            '</div>',
                            '<div class="glossary-body">',
                                renderDefinitions(data.definitions || []),
                                renderExamples(data.examples || []),
                                renderRelated(data.related || {}),
                            '</div>',
                        '</div>'
                    ].join('');
                } catch (error) {
                    DEBUG_ERROR('[GlossaryCore] 词汇模板渲染失败:', error);
                    return '<div class="glossary-error">词汇渲染失败</div>';
                }
            };
            
            // 加载中模板
            templateCache.loading = function() {
                return [
                    '<div class="glossary-loading">',
                        '<div class="glossary-spinner"></div>',
                        '<p>加载中...</p>',
                    '</div>'
                ].join('');
            };
            
            // 错误模板
            templateCache.error = function(message) {
                return [
                    '<div class="glossary-error">',
                        '<p>加载失败: ' + (message || '未知错误') + '</p>',
                        '<button class="glossary-retry-btn">重试</button>',
                    '</div>'
                ].join('');
            };
        }
        
        function renderDefinitions(definitions) {
            if (!definitions || definitions.length === 0) {
                return '';
            }
            
            try {
                var html = ['<div class="glossary-definitions">'];
                
                for (var i = 0; i < Math.min(definitions.length, 10); i++) { // 限制定义数量
                    var def = definitions[i];
                    html.push('<div class="glossary-definition">');
                    html.push('<span class="glossary-def-number">' + (i + 1) + '.</span>');
                    html.push('<span class="glossary-def-text">' + (def || '') + '</span>');
                    html.push('</div>');
                }
                
                html.push('</div>');
                return html.join('');
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 定义渲染失败:', error);
                return '';
            }
        }
        
        function renderExamples(examples) {
            if (!examples || examples.length === 0) {
                return '';
            }
            
            try {
                var html = ['<div class="glossary-examples">'];
                html.push('<h4>例句</h4>');
                
                for (var i = 0; i < Math.min(examples.length, 5); i++) { // 限制例句数量
                    var example = examples[i];
                    html.push('<div class="glossary-example">');
                    html.push('<p class="glossary-example-text">' + (example.text || '') + '</p>');
                    if (example.translation) {
                        html.push('<p class="glossary-example-translation">' + example.translation + '</p>');
                    }
                    html.push('</div>');
                }
                
                html.push('</div>');
                return html.join('');
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 例句渲染失败:', error);
                return '';
            }
        }
        
        function renderRelated(related) {
            if (!related || Object.keys(related).length === 0) {
                return '';
            }
            
            try {
                var html = ['<div class="glossary-related">'];
                html.push('<h4>相关词汇</h4>');
                
                if (related.synonyms && related.synonyms.length > 0) {
                    html.push('<div class="glossary-related-group">');
                    html.push('<span class="glossary-related-label">同义词:</span>');
                    html.push('<span class="glossary-related-words">' + related.synonyms.slice(0, 5).join(', ') + '</span>');
                    html.push('</div>');
                }
                
                if (related.antonyms && related.antonyms.length > 0) {
                    html.push('<div class="glossary-related-group">');
                    html.push('<span class="glossary-related-label">反义词:</span>');
                    html.push('<span class="glossary-related-words">' + related.antonyms.slice(0, 5).join(', ') + '</span>');
                    html.push('</div>');
                }
                
                html.push('</div>');
                return html.join('');
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 相关词汇渲染失败:', error);
                return '';
            }
        }
        
        function loadGlossaryData() {
            try {
                // 先尝试从缓存加载
                if (cacheManager) {
                    var cachedData = cacheManager.cache(config.cacheKey);
                    if (cachedData) {
                        setGlossaryData(cachedData);
                        statistics.cacheHits++;
                        return;
                    }
                    statistics.cacheMisses++;
                }
                
                // 从选项加载
                if (options.data) {
                    setGlossaryData(options.data);
                    return;
                }
                
                // 从URL加载
                if (config.dataUrl || options.dataUrl) {
                    loadFromUrl(config.dataUrl || options.dataUrl);
                    return;
                }
                
                // 使用空数据
                setGlossaryData({});
                
            } catch (error) {
                handleError('loadGlossaryData', error);
                setGlossaryData({});
            }
        }
        
        function loadFromUrl(url) {
            try {
                // 显示加载状态
                if (elements.popup) {
                    elements.popup.innerHTML = templateCache.loading();
                }
                
                var loadFunction = typeof fetch !== 'undefined' ? 
                    loadWithFetch : loadWithXHR;
                
                loadFunction(url, function(data) {
                    setGlossaryData(data);
                    
                    // 缓存数据
                    if (cacheManager) {
                        cacheManager.cache(config.cacheKey, data, 24 * 60 * 60 * 1000); // 24小时
                    }
                }, function(error) {
                    handleError('loadFromUrl', error);
                    
                    // 显示错误状态
                    if (elements.popup) {
                        elements.popup.innerHTML = templateCache.error(error.message);
                    }
                });
                
            } catch (error) {
                handleError('loadFromUrl', error);
            }
        }
        
        function loadWithFetch(url, onSuccess, onError) {
            try {
                var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                var signal = controller ? controller.signal : undefined;
                
                var timeoutId = setTimeout(function() {
                    if (controller) controller.abort();
                    onError(new Error('请求超时'));
                }, 10000);
                
                fetch(url, { signal: signal })
                    .then(function(response) {
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            throw new Error('HTTP ' + response.status);
                        }
                        return response.json();
                    })
                    .then(onSuccess)
                    .catch(onError);
            } catch (error) {
                onError(error);
            }
        }
        
        function loadWithXHR(url, onSuccess, onError) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = 10000; // 10秒超时
                
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                var data = safeJSONParse(xhr.responseText);
                                if (data) {
                                    onSuccess(data);
                                } else {
                                    onError(new Error('数据解析失败'));
                                }
                            } catch (parseError) {
                                onError(parseError);
                            }
                        } else {
                            onError(new Error('HTTP ' + xhr.status));
                        }
                    }
                };
                
                xhr.ontimeout = function() {
                    onError(new Error('请求超时'));
                };
                
                xhr.onerror = function() {
                    onError(new Error('网络错误'));
                };
                
                xhr.send();
            } catch (error) {
                onError(error);
            }
        }
        
        function setGlossaryData(data) {
            try {
                glossaryData = processGlossaryData(data);
                buildSearchIndex();
                
                // 触发数据加载事件
                if (eventHub) {
                    eventHub.emit('glossary:loaded', {
                        wordCount: Object.keys(glossaryData).length
                    });
                }
                
            } catch (error) {
                handleError('setGlossaryData', error);
                glossaryData = {};
            }
        }
        
        function processGlossaryData(data) {
            var processed = {};
            
            try {
                if (Array.isArray(data)) {
                    // 数组格式 [{word: ..., definitions: ...}, ...]
                    for (var i = 0; i < Math.min(data.length, 10000); i++) { // 限制数量
                        var item = data[i];
                        if (item && item.word) {
                            processed[item.word.toLowerCase()] = normalizeWordData(item);
                        }
                    }
                } else if (typeof data === 'object' && data !== null) {
                    // 对象格式 {word: {definitions: ...}, ...}
                    var count = 0;
                    for (var word in data) {
                        if (data.hasOwnProperty(word) && count < 10000) {
                            processed[word.toLowerCase()] = normalizeWordData(data[word], word);
                            count++;
                        }
                    }
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 数据处理失败:', error);
            }
            
            return processed;
        }
        
        function normalizeWordData(data, word) {
            try {
                return {
                    word: data.word || word,
                    phonetic: data.phonetic || data.pronunciation || null,
                    partOfSpeech: data.partOfSpeech || data.pos || null,
                    definitions: Array.isArray(data.definitions) ? data.definitions.slice(0, 10) : 
                               (data.definition ? [data.definition] : []),
                    examples: Array.isArray(data.examples) ? data.examples.slice(0, 5) : 
                             (data.example ? [{ text: data.example }] : []),
                    related: {
                        synonyms: Array.isArray(data.synonyms) ? data.synonyms.slice(0, 10) : [],
                        antonyms: Array.isArray(data.antonyms) ? data.antonyms.slice(0, 10) : []
                    },
                    audio: data.audio || data.audioUrl || null,
                    frequency: data.frequency || 0,
                    difficulty: data.difficulty || 1
                };
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 词汇数据标准化失败:', error);
                return {
                    word: word || 'unknown',
                    phonetic: null,
                    partOfSpeech: null,
                    definitions: [],
                    examples: [],
                    related: { synonyms: [], antonyms: [] },
                    audio: null,
                    frequency: 0,
                    difficulty: 1
                };
            }
        }
        
        function buildSearchIndex() {
            searchIndex = [];
            
            try {
                for (var word in glossaryData) {
                    if (glossaryData.hasOwnProperty(word)) {
                        var data = glossaryData[word];
                        
                        // 添加词汇本身
                        searchIndex.push({
                            term: word,
                            word: word,
                            score: 1.0,
                            type: 'word'
                        });
                        
                        // 添加定义中的关键词
                        if (data.definitions) {
                            for (var i = 0; i < data.definitions.length; i++) {
                                var keywords = extractKeywords(data.definitions[i]);
                                for (var j = 0; j < keywords.length; j++) {
                                    searchIndex.push({
                                        term: keywords[j],
                                        word: word,
                                        score: 0.7,
                                        type: 'definition'
                                    });
                                }
                            }
                        }
                        
                        // 添加同义词
                        if (data.related && data.related.synonyms) {
                            for (var k = 0; k < data.related.synonyms.length; k++) {
                                searchIndex.push({
                                    term: data.related.synonyms[k].toLowerCase(),
                                    word: word,
                                    score: 0.8,
                                    type: 'synonym'
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 搜索索引构建失败:', error);
            }
        }
        
        function extractKeywords(text) {
            try {
                if (!text || typeof text !== 'string') return [];
                
                // 提取定义中的关键词
                var words = text.toLowerCase().split(/\s+/);
                var keywords = [];
                var stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
                
                for (var i = 0; i < words.length; i++) {
                    var word = words[i].replace(/[^\w]/g, '');
                    if (word.length > 3 && stopWords.indexOf(word) === -1) {
                        keywords.push(word);
                    }
                }
                
                return keywords.slice(0, 20); // 限制关键词数量
            } catch (error) {
                return [];
            }
        }
        
        function findWordData(word) {
            try {
                var normalizedWord = word.toLowerCase();
                
                // 精确匹配
                if (glossaryData[normalizedWord]) {
                    return glossaryData[normalizedWord];
                }
                
                // 模糊匹配
                var bestMatch = null;
                var bestScore = 0;
                
                for (var key in glossaryData) {
                    if (glossaryData.hasOwnProperty(key)) {
                        var score = calculateSimilarity(normalizedWord, key);
                        if (score > bestScore && score >= config.searchThreshold) {
                            bestScore = score;
                            bestMatch = glossaryData[key];
                        }
                    }
                }
                
                return bestMatch;
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 词汇查找失败:', error);
                return null;
            }
        }
        
        function searchWords(query, limit) {
            var results = [];
            
            try {
                var queryLength = query.length;
                
                // 搜索索引
                for (var i = 0; i < searchIndex.length; i++) {
                    var item = searchIndex[i];
                    var score = 0;
                    
                    if (item.term === query) {
                        // 精确匹配
                        score = item.score * 1.0;
                    } else if (item.term.indexOf(query) === 0) {
                        // 前缀匹配
                        score = item.score * 0.8;
                    } else if (item.term.indexOf(query) !== -1) {
                        // 包含匹配
                        score = item.score * 0.6;
                    } else {
                        // 模糊匹配
                        var similarity = calculateSimilarity(query, item.term);
                        if (similarity >= config.searchThreshold) {
                            score = item.score * similarity * 0.4;
                        }
                    }
                    
                    if (score > 0) {
                        results.push({
                            word: item.word,
                            term: item.term,
                            score: score,
                            type: item.type,
                            data: glossaryData[item.word]
                        });
                    }
                }
                
                // 排序并去重
                results.sort(function(a, b) {
                    return b.score - a.score;
                });
                
                // 去重（同一个词只保留最高分的结果）
                var uniqueResults = [];
                var seen = {};
                
                for (var j = 0; j < results.length; j++) {
                    var result = results[j];
                    if (!seen[result.word]) {
                        seen[result.word] = true;
                        uniqueResults.push(result);
                    }
                }
                
                return uniqueResults.slice(0, limit);
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 搜索失败:', error);
                return [];
            }
        }
        
        function calculateSimilarity(str1, str2) {
            try {
                if (str1 === str2) return 1.0;
                if (!str1 || !str2 || str1.length === 0 || str2.length === 0) return 0.0;
                
                var longer = str1.length > str2.length ? str1 : str2;
                var shorter = str1.length > str2.length ? str2 : str1;
                
                var editDistance = calculateLevenshteinDistance(longer, shorter);
                return (longer.length - editDistance) / longer.length;
            } catch (error) {
                return 0.0;
            }
        }
        
        function calculateLevenshteinDistance(str1, str2) {
            var matrix = [];
            
            for (var i = 0; i <= str2.length; i++) {
                matrix[i] = [i];
            }
            
            for (var j = 0; j <= str1.length; j++) {
                matrix[0][j] = j;
            }
            
            for (i = 1; i <= str2.length; i++) {
                for (j = 1; j <= str1.length; j++) {
                    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            
            return matrix[str2.length][str1.length];
        }
        
        function bindEvents() {
            try {
                // 根据触发事件类型绑定
                if (config.triggerEvent === 'click') {
                    bindClickEvents();
                } else if (config.triggerEvent === 'hover') {
                    bindHoverEvents();
                } else if (config.triggerEvent === 'longpress') {
                    bindLongPressEvents();
                }
                
                // 键盘事件
                if (config.enableKeyboard && typeof document !== 'undefined') {
                    boundEventHandlers.keydown = createBoundHandler(handleKeyDown);
                    document.addEventListener('keydown', boundEventHandlers.keydown);
                }
                
                // 窗口大小变化
                if (typeof window !== 'undefined') {
                    boundEventHandlers.resize = createBoundHandler(handleResize);
                    window.addEventListener('resize', boundEventHandlers.resize);
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 事件绑定失败:', error);
            }
        }
        
        function createBoundHandler(handler, context) {
            return function boundHandler() {
                if (isDestroyed) return;
                try {
                    return handler.apply(context || self, arguments);
                } catch (error) {
                    handleError('eventHandler', error);
                }
            };
        }
        
        function bindClickEvents() {
            boundEventHandlers.click = createBoundHandler(function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    e.preventDefault();
                    var word = getWordFromElement(wordElement);
                    if (word) {
                        self.show(word, wordElement);
                    }
                }
            });
            
            elements.container.addEventListener('click', boundEventHandlers.click);
        }
        
        function bindHoverEvents() {
            var hoverTimeout;
            
            boundEventHandlers.mouseenter = createBoundHandler(function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(function() {
                        if (!isDestroyed) {
                            var word = getWordFromElement(wordElement);
                            if (word) {
                                self.show(word, wordElement);
                            }
                        }
                    }, 300);
                }
            });
            
            boundEventHandlers.mouseleave = createBoundHandler(function(e) {
                clearTimeout(hoverTimeout);
                if (config.autoClose) {
                    startAutoCloseTimer();
                }
            });
            
            elements.container.addEventListener('mouseenter', boundEventHandlers.mouseenter, true);
            elements.container.addEventListener('mouseleave', boundEventHandlers.mouseleave, true);
        }
        
        function bindLongPressEvents() {
            var isPassiveSupported = checkPassiveSupport();
            var touchOptions = isPassiveSupported ? { passive: true } : false;
            
            boundEventHandlers.touchstart = createBoundHandler(function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    
                    longPressTimer = createSafeTimeout(function() {
                        if (!isDestroyed) {
                            var word = getWordFromElement(wordElement);
                            if (word) {
                                self.show(word, wordElement);
                            }
                        }
                    }, 500);
                }
            });
            
            boundEventHandlers.touchmove = createBoundHandler(function(e) {
                if (longPressTimer) {
                    var deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                    var deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                    
                    if (deltaX > 10 || deltaY > 10) {
                        longPressTimer.clear();
                        longPressTimer = null;
                    }
                }
            });
            
            boundEventHandlers.touchend = createBoundHandler(function() {
                if (longPressTimer) {
                    longPressTimer.clear();
                    longPressTimer = null;
                }
            });
            
            elements.container.addEventListener('touchstart', boundEventHandlers.touchstart, touchOptions);
            elements.container.addEventListener('touchmove', boundEventHandlers.touchmove, touchOptions);
            elements.container.addEventListener('touchend', boundEventHandlers.touchend, touchOptions);
        }
        
        function unbindEvents() {
            try {
                // 移除容器事件
                if (elements.container) {
                    if (boundEventHandlers.click) {
                        elements.container.removeEventListener('click', boundEventHandlers.click);
                    }
                    if (boundEventHandlers.mouseenter) {
                        elements.container.removeEventListener('mouseenter', boundEventHandlers.mouseenter, true);
                    }
                    if (boundEventHandlers.mouseleave) {
                        elements.container.removeEventListener('mouseleave', boundEventHandlers.mouseleave, true);
                    }
                    if (boundEventHandlers.touchstart) {
                        elements.container.removeEventListener('touchstart', boundEventHandlers.touchstart);
                    }
                    if (boundEventHandlers.touchmove) {
                        elements.container.removeEventListener('touchmove', boundEventHandlers.touchmove);
                    }
                    if (boundEventHandlers.touchend) {
                        elements.container.removeEventListener('touchend', boundEventHandlers.touchend);
                    }
                }
                
                // 移除文档级事件
                if (typeof document !== 'undefined' && boundEventHandlers.keydown) {
                    document.removeEventListener('keydown', boundEventHandlers.keydown);
                }
                
                // 移除窗口事件
                if (typeof window !== 'undefined' && boundEventHandlers.resize) {
                    window.removeEventListener('resize', boundEventHandlers.resize);
                }
                
                // 清空处理器引用
                boundEventHandlers = {};
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 事件解绑失败:', error);
            }
        }
        
        function findWordElement(target) {
            try {
                // 查找包含词汇数据的元素
                var element = target;
                var maxDepth = 5;
                var depth = 0;
                
                while (element && depth < maxDepth) {
                    if (element.hasAttribute && (
                        element.hasAttribute('data-word') ||
                        element.hasAttribute('data-glossary') ||
                        element.classList.contains('glossary-word') ||
                        element.classList.contains('word')
                    )) {
                        return element;
                    }
                    
                    element = element.parentElement;
                    depth++;
                }
                
                return null;
            } catch (error) {
                return null;
            }
        }
        
        function getWordFromElement(element) {
            try {
                // 提取元素中的词汇
                return element.getAttribute('data-word') ||
                       element.getAttribute('data-glossary') ||
                       element.textContent.trim();
            } catch (error) {
                return null;
            }
        }
        
        function renderPopupContent(wordData) {
            if (!elements.popup || !wordData) return;
            
            queueRender(function() {
                elements.popup.innerHTML = templateCache.wordEntry(wordData);
                bindPopupEvents();
            });
        }
        
        function queueRender(renderFunction) {
            renderQueue.push(renderFunction);
            
            if (!isRendering) {
                processRenderQueue();
            }
        }
        
        function processRenderQueue() {
            if (renderQueue.length === 0) {
                isRendering = false;
                return;
            }
            
            isRendering = true;
            
            var renderFunction = renderQueue.shift();
            
            // 使用requestAnimationFrame或setTimeout
            var scheduleFunction = typeof requestAnimationFrame !== 'undefined' ? 
                requestAnimationFrame : function(fn) { setTimeout(fn, 16); };
            
            scheduleFunction(function() {
                try {
                    renderFunction();
                } catch (error) {
                    handleError('renderQueue', error);
                } finally {
                    processRenderQueue();
                }
            });
        }
        
        function bindPopupEvents() {
            if (!elements.popup) return;
            
            try {
                // 关闭按钮
                var closeBtn = elements.popup.querySelector('.glossary-close-btn');
                if (closeBtn) {
                    closeBtn.onclick = function() {
                        self.hide();
                    };
                }
                
                // 音频按钮
                var audioBtn = elements.popup.querySelector('.glossary-audio-btn');
                if (audioBtn) {
                    audioBtn.onclick = function() {
                        var word = this.getAttribute('data-word');
                        self.playAudio(word);
                    };
                }
                
                // 书签按钮
                var bookmarkBtn = elements.popup.querySelector('.glossary-bookmark-btn');
                if (bookmarkBtn) {
                    bookmarkBtn.onclick = function() {
                        var word = this.getAttribute('data-word');
                        self.toggleBookmark(word);
                    };
                }
                
                // 重试按钮
                var retryBtn = elements.popup.querySelector('.glossary-retry-btn');
                if (retryBtn) {
                    retryBtn.onclick = function() {
                        loadGlossaryData();
                    };
                }
                
                // 滑动关闭（移动端）
                if (config.enableTouch && isMobile()) {
                    bindSwipeToClose();
                }
                
                // 覆盖层点击关闭
                if (elements.overlay) {
                    elements.overlay.onclick = function() {
                        self.hide();
                    };
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 弹窗事件绑定失败:', error);
            }
        }
        
        function bindSwipeToClose() {
            var startY = 0;
            var currentY = 0;
            var isDragging = false;
            
            var isPassiveSupported = checkPassiveSupport();
            var touchOptions = isPassiveSupported ? { passive: true } : false;
            
            var touchStartHandler = function(e) {
                startY = e.touches[0].clientY;
                isDragging = true;
            };
            
            var touchMoveHandler = function(e) {
                if (!isDragging) return;
                
                currentY = e.touches[0].clientY;
                var deltaY = currentY - startY;
                
                if (deltaY > 0) {
                    // 向下拖拽
                    var opacity = Math.max(0.3, 1 - (deltaY / 200));
                    elements.popup.style.opacity = opacity;
                    elements.popup.style.transform = 'translateY(' + deltaY + 'px) scale(0.95)';
                }
            };
            
            var touchEndHandler = function() {
                if (!isDragging) return;
                
                isDragging = false;
                var deltaY = currentY - startY;
                
                if (deltaY > 100) {
                    // 滑动距离足够，关闭弹窗
                    self.hide();
                } else {
                    // 滑动距离不够，恢复位置
                    elements.popup.style.opacity = '';
                    elements.popup.style.transform = '';
                }
            };
            
            elements.popup.addEventListener('touchstart', touchStartHandler, touchOptions);
            elements.popup.addEventListener('touchmove', touchMoveHandler, touchOptions);
            elements.popup.addEventListener('touchend', touchEndHandler, touchOptions);
        }
        
        function calculatePosition(triggerElement, preferredPosition) {
            try {
                if (!triggerElement || !elements.popup) {
                    return { top: 100, left: 100 };
                }
                
                var triggerRect = triggerElement.getBoundingClientRect();
                var popupWidth = config.maxWidth;
                var popupHeight = config.maxHeight;
                var viewportWidth = window.innerWidth;
                var viewportHeight = window.innerHeight;
                var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                
                var position = { top: 0, left: 0 };
                
                if (isMobile()) {
                    // 移动端：居中显示
                    position.top = scrollTop + (viewportHeight - popupHeight) / 2;
                    position.left = scrollLeft + (viewportWidth - popupWidth) / 2;
                } else {
                    // 桌面端：智能定位
                    var pos = preferredPosition || config.position;
                    
                    if (pos === 'auto') {
                        // 自动选择最佳位置
                        pos = chooseBestPosition(triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight);
                    }
                    
                    switch (pos) {
                        case 'top':
                            position.top = scrollTop + triggerRect.top - popupHeight - config.offset;
                            position.left = scrollLeft + triggerRect.left + (triggerRect.width - popupWidth) / 2;
                            break;
                        case 'bottom':
                            position.top = scrollTop + triggerRect.bottom + config.offset;
                            position.left = scrollLeft + triggerRect.left + (triggerRect.width - popupWidth) / 2;
                            break;
                        case 'left':
                            position.top = scrollTop + triggerRect.top + (triggerRect.height - popupHeight) / 2;
                            position.left = scrollLeft + triggerRect.left - popupWidth - config.offset;
                            break;
                        case 'right':
                            position.top = scrollTop + triggerRect.top + (triggerRect.height - popupHeight) / 2;
                            position.left = scrollLeft + triggerRect.right + config.offset;
                            break;
                    }
                    
                    // 边界检查和调整
                    position = adjustPositionForViewport(position, popupWidth, popupHeight, viewportWidth, viewportHeight, scrollTop, scrollLeft);
                }
                
                return position;
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 位置计算失败:', error);
                return { top: 100, left: 100 };
            }
        }
        
        function chooseBestPosition(triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight) {
            var positions = ['bottom', 'top', 'right', 'left'];
            var scores = {};
            
            for (var i = 0; i < positions.length; i++) {
                var pos = positions[i];
                scores[pos] = calculatePositionScore(pos, triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight);
            }
            
            // 选择得分最高的位置
            var bestPosition = 'bottom';
            var bestScore = -1;
            
            for (var pos in scores) {
                if (scores.hasOwnProperty(pos) && scores[pos] > bestScore) {
                    bestScore = scores[pos];
                    bestPosition = pos;
                }
            }
            
            return bestPosition;
        }
        
        function calculatePositionScore(position, triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight) {
            var score = 0;
            var tempPos = { top: 0, left: 0 };
            
            switch (position) {
                case 'top':
                    tempPos.top = triggerRect.top - popupHeight - config.offset;
                    tempPos.left = triggerRect.left + (triggerRect.width - popupWidth) / 2;
                    break;
                case 'bottom':
                    tempPos.top = triggerRect.bottom + config.offset;
                    tempPos.left = triggerRect.left + (triggerRect.width - popupWidth) / 2;
                    break;
                case 'left':
                    tempPos.top = triggerRect.top + (triggerRect.height - popupHeight) / 2;
                    tempPos.left = triggerRect.left - popupWidth - config.offset;
                    break;
                case 'right':
                    tempPos.top = triggerRect.top + (triggerRect.height - popupHeight) / 2;
                    tempPos.left = triggerRect.right + config.offset;
                    break;
            }
            
            // 检查是否完全在视口内
            if (tempPos.top >= 0 && tempPos.left >= 0 && 
                tempPos.top + popupHeight <= viewportHeight && 
                tempPos.left + popupWidth <= viewportWidth) {
                score = 100;
            } else {
                // 计算部分可见的得分
                var visibleArea = calculateVisibleArea(tempPos, popupWidth, popupHeight, viewportWidth, viewportHeight);
                score = (visibleArea / (popupWidth * popupHeight)) * 100;
            }
            
            return score;
        }
        
        function calculateVisibleArea(pos, width, height, viewportWidth, viewportHeight) {
            var visibleLeft = Math.max(0, pos.left);
            var visibleTop = Math.max(0, pos.top);
            var visibleRight = Math.min(viewportWidth, pos.left + width);
            var visibleBottom = Math.min(viewportHeight, pos.top + height);
            
            var visibleWidth = Math.max(0, visibleRight - visibleLeft);
            var visibleHeight = Math.max(0, visibleBottom - visibleTop);
            
            return visibleWidth * visibleHeight;
        }
        
        function adjustPositionForViewport(position, popupWidth, popupHeight, viewportWidth, viewportHeight, scrollTop, scrollLeft) {
            // 调整水平位置
            if (position.left < scrollLeft) {
                position.left = scrollLeft + config.offset;
            } else if (position.left + popupWidth > scrollLeft + viewportWidth) {
                position.left = scrollLeft + viewportWidth - popupWidth - config.offset;
            }
            
            // 调整垂直位置
            if (position.top < scrollTop) {
                position.top = scrollTop + config.offset;
            } else if (position.top + popupHeight > scrollTop + viewportHeight) {
                position.top = scrollTop + viewportHeight - popupHeight - config.offset;
            }
            
            return position;
        }
        
        function showPopup(position) {
            if (!elements.popup || isAnimating || isDestroyed) return;
            
            try {
                isAnimating = true;
                isVisible = true;
                
                // 设置位置
                elements.popup.style.top = position.top + 'px';
                elements.popup.style.left = position.left + 'px';
                
                // 显示覆盖层（移动端）
                if (elements.overlay) {
                    elements.overlay.style.display = 'block';
                    setTimeout(function() {
                        if (!isDestroyed) {
                            elements.overlay.style.opacity = '1';
                        }
                    }, 10);
                }
                
                // 显示弹窗
                elements.popup.style.visibility = 'visible';
                setTimeout(function() {
                    if (!isDestroyed) {
                        elements.popup.style.opacity = '1';
                        elements.popup.style.transform = 'scale(1)';
                    }
                }, 10);
                
                // 动画完成
                setTimeout(function() {
                    if (!isDestroyed) {
                        isAnimating = false;
                        
                        // 启动自动关闭定时器
                        if (config.autoClose) {
                            startAutoCloseTimer();
                        }
                    }
                }, config.animationDuration);
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 弹窗显示失败:', error);
                isAnimating = false;
            }
        }
        
        function hidePopup() {
            if (!elements.popup || isAnimating || isDestroyed) return;
            
            try {
                isAnimating = true;
                isVisible = false;
                
                // 隐藏动画
                elements.popup.style.opacity = '0';
                elements.popup.style.transform = 'scale(0.95)';
                
                // 隐藏覆盖层
                if (elements.overlay) {
                    elements.overlay.style.opacity = '0';
                }
                
                // 动画完成后隐藏
                setTimeout(function() {
                    if (!isDestroyed) {
                        elements.popup.style.visibility = 'hidden';
                        
                        if (elements.overlay) {
                            elements.overlay.style.display = 'none';
                        }
                        
                        isAnimating = false;
                    }
                }, config.animationDuration);
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 弹窗隐藏失败:', error);
                isAnimating = false;
            }
        }
        
        function updateBookmarkButton(isBookmarked) {
            try {
                var bookmarkBtn = elements.popup.querySelector('.glossary-bookmark-btn');
                if (bookmarkBtn) {
                    if (isBookmarked) {
                        bookmarkBtn.classList.add('bookmarked');
                    } else {
                        bookmarkBtn.classList.remove('bookmarked');
                    }
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 书签按钮更新失败:', error);
            }
        }
        
        function playWordAudio(audioUrl) {
            try {
                var audio = new Audio(audioUrl);
                
                audio.addEventListener('error', function() {
                    DEBUG_WARN('[GlossaryCore] Audio playback failed:', audioUrl);
                });
                
                var playPromise = audio.play();
                
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.catch(function(error) {
                        DEBUG_WARN('[GlossaryCore] Audio playback error:', error);
                    });
                }
                
            } catch (error) {
                handleError('playWordAudio', error);
            }
        }
        
        function updateWordFrequency(word) {
            if (!frequentWords[word]) {
                frequentWords[word] = 0;
            }
            frequentWords[word]++;
        }
        
        function startAutoCloseTimer() {
            clearAutoCloseTimer();
            
            autoCloseTimer = createSafeTimeout(function() {
                if (!isDestroyed) {
                    self.hide();
                }
            }, config.autoCloseDelay);
        }
        
        function clearAutoCloseTimer() {
            if (autoCloseTimer) {
                autoCloseTimer.clear();
                autoCloseTimer = null;
            }
        }
        
        function clearAllTimers() {
            clearAutoCloseTimer();
            
            if (longPressTimer) {
                longPressTimer.clear();
                longPressTimer = null;
            }
        }
        
        function handleKeyDown(e) {
            if (!isVisible) return;
            
            // ESC键关闭弹窗
            if (e.keyCode === 27) {
                e.preventDefault();
                self.hide();
            }
            
            // P键播放音频
            if (e.keyCode === 80 && currentWord) {
                e.preventDefault();
                self.playAudio(currentWord);
            }
            
            // B键切换书签
            if (e.keyCode === 66 && currentWord) {
                e.preventDefault();
                self.toggleBookmark(currentWord);
            }
        }
        
        function handleResize() {
            if (isVisible && !isMobile()) {
                // 重新计算位置
                var triggerElement = document.querySelector('[data-word="' + currentWord + '"]');
                if (triggerElement) {
                    var position = calculatePosition(triggerElement);
                    elements.popup.style.top = position.top + 'px';
                    elements.popup.style.left = position.left + 'px';
                }
            }
        }
        
        function saveState() {
            try {
                if (stateManager && !isDestroyed) {
                    stateManager.setState('glossary.currentWord', currentWord);
                    stateManager.setState('glossary.frequentWords', frequentWords);
                    stateManager.setState('glossary.statistics', statistics);
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 状态保存失败:', error);
            }
        }
        
        function saveBookmarks() {
            try {
                if (stateManager && !isDestroyed) {
                    stateManager.setState('glossary.bookmarkedWords', Array.from(bookmarkedWords), true);
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] 书签保存失败:', error);
            }
        }
        
        function restoreState() {
            if (!stateManager) return;
            
            try {
                var savedBookmarks = stateManager.getState('glossary.bookmarkedWords');
                if (Array.isArray(savedBookmarks)) {
                    bookmarkedWords = new Set(savedBookmarks);
                }
                
                var savedFrequent = stateManager.getState('glossary.frequentWords');
                if (savedFrequent && typeof savedFrequent === 'object') {
                    frequentWords = savedFrequent;
                }
                
                var savedStats = stateManager.getState('glossary.statistics');
                if (savedStats && typeof savedStats === 'object') {
                    Object.assign(statistics, savedStats);
                }
                
            } catch (error) {
                handleError('restoreState', error);
            }
        }
        
        function isMobile() {
            return typeof window !== 'undefined' && window.innerWidth < 768;
        }
        
        function checkPassiveSupport() {
            var passiveSupported = false;
            try {
                var options = Object.defineProperty({}, 'passive', {
                    get: function() { passiveSupported = true; }
                });
                window.addEventListener('test', null, options);
            } catch (err) {}
            return passiveSupported;
        }
        
        function cleanupDOM() {
            try {
                if (elements.popup && elements.popup.parentNode) {
                    elements.popup.parentNode.removeChild(elements.popup);
                }
                
                if (elements.overlay && elements.overlay.parentNode) {
                    elements.overlay.parentNode.removeChild(elements.overlay);
                }
                
                // 清空元素引用
                for (var key in elements) {
                    elements[key] = null;
                }
            } catch (error) {
                DEBUG_ERROR('[GlossaryCore] DOM清理失败:', error);
            }
        }
        
        function handleError(context, error) {
            var errorInfo = {
                context: 'GlossaryCore:' + context,
                message: error.message || String(error),
                timestamp: Date.now(),
                currentWord: currentWord,
                isVisible: isVisible
            };
            
            DEBUG_ERROR('[GlossaryCore:' + context + ']', error);
            
            // 使用错误边界处理
            if (errorBoundary) {
                errorBoundary.handle(error, errorInfo);
            }
            
            // 触发错误事件
            if (eventHub) {
                eventHub.emit('glossary:error', errorInfo);
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GlossaryCore;
    } else if (typeof global !== 'undefined') {
        global.GlossaryCore = GlossaryCore;
        
        // 添加到EnglishSite命名空间
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        if (!global.EnglishSite.GlossaryCore) {
            global.EnglishSite.GlossaryCore = GlossaryCore;
        } else {
            DEBUG_WARN('[GlossaryCore] EnglishSite.GlossaryCore 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);