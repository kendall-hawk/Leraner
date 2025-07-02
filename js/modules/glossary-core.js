// js/modules/glossary-core.js - iOS兼容版词汇表核心
// 🚀 智能词汇表系统，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

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
            offset: options.offset || 10,
            maxWidth: options.maxWidth || 350,
            minWidth: options.minWidth || 250,
            maxHeight: options.maxHeight || 400,
            animationDuration: options.animationDuration || 200,
            enableTouch: options.enableTouch !== false,
            enableKeyboard: options.enableKeyboard !== false,
            enableAudio: options.enableAudio !== false,
            enableBookmark: options.enableBookmark !== false,
            autoClose: options.autoClose !== false,
            autoCloseDelay: options.autoCloseDelay || 5000,
            preloadCount: options.preloadCount || 20,
            cacheSize: options.cacheSize || 100,
            searchThreshold: options.searchThreshold || 0.8,
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
                
                console.log('[GlossaryCore] 初始化成功');
                
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
            try {
                options = options || {};
                
                if (!word || typeof word !== 'string') {
                    throw new Error('Invalid word parameter');
                }
                
                // 查找词汇数据
                var wordData = findWordData(word);
                if (!wordData) {
                    console.warn('[GlossaryCore] Word not found:', word);
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
            try {
                limit = limit || 10;
                
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
            try {
                if (!config.enableAudio) {
                    console.warn('[GlossaryCore] Audio is disabled');
                    return false;
                }
                
                word = word || currentWord;
                if (!word) {
                    throw new Error('No word specified for audio playback');
                }
                
                var wordData = findWordData(word);
                if (!wordData || !wordData.audio) {
                    console.warn('[GlossaryCore] No audio available for word:', word);
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
                cacheHitRate: statistics.cacheHits / (statistics.cacheHits + statistics.cacheMisses) || 0
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
                statistics: statistics
            };
        };
        
        /**
         * 销毁实例
         */
        this.destroy = function() {
            try {
                // 隐藏弹窗
                this.hide();
                
                // 移除事件监听器
                unbindEvents();
                
                // 清理DOM
                cleanupDOM();
                
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
                
                console.log('[GlossaryCore] 实例已销毁');
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
        }
        
        function initializeTemplates() {
            // 词汇条目模板
            templateCache.wordEntry = function(data) {
                var bookmarkClass = bookmarkedWords.has(data.word) ? 'bookmarked' : '';
                var audioButton = config.enableAudio && data.audio ? 
                    '<button class="glossary-audio-btn" data-word="' + data.word + '">🔊</button>' : '';
                var bookmarkButton = config.enableBookmark ? 
                    '<button class="glossary-bookmark-btn ' + bookmarkClass + '" data-word="' + data.word + '">★</button>' : '';
                
                return [
                    '<div class="glossary-content">',
                        '<div class="glossary-header">',
                            '<div class="glossary-word-info">',
                                '<h3 class="glossary-word">' + data.word + '</h3>',
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
                        '<p>加载失败: ' + message + '</p>',
                        '<button class="glossary-retry-btn">重试</button>',
                    '</div>'
                ].join('');
            };
        }
        
        function renderDefinitions(definitions) {
            if (!definitions || definitions.length === 0) {
                return '';
            }
            
            var html = ['<div class="glossary-definitions">'];
            
            definitions.forEach(function(def, index) {
                html.push('<div class="glossary-definition">');
                html.push('<span class="glossary-def-number">' + (index + 1) + '.</span>');
                html.push('<span class="glossary-def-text">' + def + '</span>');
                html.push('</div>');
            });
            
            html.push('</div>');
            return html.join('');
        }
        
        function renderExamples(examples) {
            if (!examples || examples.length === 0) {
                return '';
            }
            
            var html = ['<div class="glossary-examples">'];
            html.push('<h4>例句</h4>');
            
            examples.forEach(function(example) {
                html.push('<div class="glossary-example">');
                html.push('<p class="glossary-example-text">' + example.text + '</p>');
                if (example.translation) {
                    html.push('<p class="glossary-example-translation">' + example.translation + '</p>');
                }
                html.push('</div>');
            });
            
            html.push('</div>');
            return html.join('');
        }
        
        function renderRelated(related) {
            if (!related || Object.keys(related).length === 0) {
                return '';
            }
            
            var html = ['<div class="glossary-related">'];
            html.push('<h4>相关词汇</h4>');
            
            if (related.synonyms && related.synonyms.length > 0) {
                html.push('<div class="glossary-related-group">');
                html.push('<span class="glossary-related-label">同义词:</span>');
                html.push('<span class="glossary-related-words">' + related.synonyms.join(', ') + '</span>');
                html.push('</div>');
            }
            
            if (related.antonyms && related.antonyms.length > 0) {
                html.push('<div class="glossary-related-group">');
                html.push('<span class="glossary-related-label">反义词:</span>');
                html.push('<span class="glossary-related-words">' + related.antonyms.join(', ') + '</span>');
                html.push('</div>');
            }
            
            html.push('</div>');
            return html.join('');
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
            fetch(url)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(onSuccess)
                .catch(onError);
        }
        
        function loadWithXHR(url, onSuccess, onError) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            onSuccess(data);
                        } catch (parseError) {
                            onError(parseError);
                        }
                    } else {
                        onError(new Error('HTTP ' + xhr.status));
                    }
                }
            };
            xhr.send();
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
            
            if (Array.isArray(data)) {
                // 数组格式 [{word: ..., definitions: ...}, ...]
                data.forEach(function(item) {
                    if (item.word) {
                        processed[item.word.toLowerCase()] = normalizeWordData(item);
                    }
                });
            } else if (typeof data === 'object') {
                // 对象格式 {word: {definitions: ...}, ...}
                for (var word in data) {
                    if (data.hasOwnProperty(word)) {
                        processed[word.toLowerCase()] = normalizeWordData(data[word], word);
                    }
                }
            }
            
            return processed;
        }
        
        function normalizeWordData(data, word) {
            return {
                word: data.word || word,
                phonetic: data.phonetic || data.pronunciation || null,
                partOfSpeech: data.partOfSpeech || data.pos || null,
                definitions: Array.isArray(data.definitions) ? data.definitions : 
                           (data.definition ? [data.definition] : []),
                examples: Array.isArray(data.examples) ? data.examples : 
                         (data.example ? [{ text: data.example }] : []),
                related: {
                    synonyms: data.synonyms || [],
                    antonyms: data.antonyms || []
                },
                audio: data.audio || data.audioUrl || null,
                frequency: data.frequency || 0,
                difficulty: data.difficulty || 1
            };
        }
        
        function buildSearchIndex() {
            searchIndex = [];
            
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
                        data.definitions.forEach(function(def) {
                            var keywords = extractKeywords(def);
                            keywords.forEach(function(keyword) {
                                searchIndex.push({
                                    term: keyword,
                                    word: word,
                                    score: 0.7,
                                    type: 'definition'
                                });
                            });
                        });
                    }
                    
                    // 添加同义词
                    if (data.related && data.related.synonyms) {
                        data.related.synonyms.forEach(function(synonym) {
                            searchIndex.push({
                                term: synonym.toLowerCase(),
                                word: word,
                                score: 0.8,
                                type: 'synonym'
                            });
                        });
                    }
                }
            }
        }
        
        function extractKeywords(text) {
            // 提取定义中的关键词
            var words = text.toLowerCase().split(/\s+/);
            var keywords = [];
            var stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
            
            words.forEach(function(word) {
                word = word.replace(/[^\w]/g, '');
                if (word.length > 3 && stopWords.indexOf(word) === -1) {
                    keywords.push(word);
                }
            });
            
            return keywords;
        }
        
        function findWordData(word) {
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
        }
        
        function searchWords(query, limit) {
            var results = [];
            var queryLength = query.length;
            
            // 搜索索引
            searchIndex.forEach(function(item) {
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
            });
            
            // 排序并去重
            results.sort(function(a, b) {
                return b.score - a.score;
            });
            
            // 去重（同一个词只保留最高分的结果）
            var uniqueResults = [];
            var seen = {};
            
            results.forEach(function(result) {
                if (!seen[result.word]) {
                    seen[result.word] = true;
                    uniqueResults.push(result);
                }
            });
            
            return uniqueResults.slice(0, limit);
        }
        
        function calculateSimilarity(str1, str2) {
            if (str1 === str2) return 1.0;
            if (str1.length === 0 || str2.length === 0) return 0.0;
            
            var longer = str1.length > str2.length ? str1 : str2;
            var shorter = str1.length > str2.length ? str2 : str1;
            
            var editDistance = calculateLevenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / longer.length;
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
                document.addEventListener('keydown', handleKeyDown);
            }
            
            // 窗口大小变化
            if (typeof window !== 'undefined') {
                window.addEventListener('resize', handleResize);
            }
        }
        
        function bindClickEvents() {
            elements.container.addEventListener('click', function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    e.preventDefault();
                    var word = getWordFromElement(wordElement);
                    if (word) {
                        self.show(word, wordElement);
                    }
                }
            });
        }
        
        function bindHoverEvents() {
            var hoverTimeout;
            
            elements.container.addEventListener('mouseenter', function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(function() {
                        var word = getWordFromElement(wordElement);
                        if (word) {
                            self.show(word, wordElement);
                        }
                    }, 300);
                }
            }, true);
            
            elements.container.addEventListener('mouseleave', function(e) {
                clearTimeout(hoverTimeout);
                if (config.autoClose) {
                    startAutoCloseTimer();
                }
            }, true);
        }
        
        function bindLongPressEvents() {
            var isPassiveSupported = checkPassiveSupport();
            var touchOptions = isPassiveSupported ? { passive: true } : false;
            
            elements.container.addEventListener('touchstart', function(e) {
                var wordElement = findWordElement(e.target);
                if (wordElement) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    
                    longPressTimer = setTimeout(function() {
                        var word = getWordFromElement(wordElement);
                        if (word) {
                            self.show(word, wordElement);
                        }
                    }, 500);
                }
            }, touchOptions);
            
            elements.container.addEventListener('touchmove', function(e) {
                if (longPressTimer) {
                    var deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                    var deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                    
                    if (deltaX > 10 || deltaY > 10) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            }, touchOptions);
            
            elements.container.addEventListener('touchend', function() {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }, touchOptions);
        }
        
        function unbindEvents() {
            if (typeof document !== 'undefined') {
                document.removeEventListener('keydown', handleKeyDown);
            }
            
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', handleResize);
            }
        }
        
        function findWordElement(target) {
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
        }
        
        function getWordFromElement(element) {
            // 提取元素中的词汇
            return element.getAttribute('data-word') ||
                   element.getAttribute('data-glossary') ||
                   element.textContent.trim();
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
            
            // 关闭按钮
            var closeBtn = elements.popup.querySelector('.glossary-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    self.hide();
                });
            }
            
            // 音频按钮
            var audioBtn = elements.popup.querySelector('.glossary-audio-btn');
            if (audioBtn) {
                audioBtn.addEventListener('click', function() {
                    var word = this.getAttribute('data-word');
                    self.playAudio(word);
                });
            }
            
            // 书签按钮
            var bookmarkBtn = elements.popup.querySelector('.glossary-bookmark-btn');
            if (bookmarkBtn) {
                bookmarkBtn.addEventListener('click', function() {
                    var word = this.getAttribute('data-word');
                    self.toggleBookmark(word);
                });
            }
            
            // 重试按钮
            var retryBtn = elements.popup.querySelector('.glossary-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    loadGlossaryData();
                });
            }
            
            // 滑动关闭（移动端）
            if (config.enableTouch && isMobile()) {
                bindSwipeToClose();
            }
            
            // 覆盖层点击关闭
            if (elements.overlay) {
                elements.overlay.addEventListener('click', function() {
                    self.hide();
                });
            }
        }
        
        function bindSwipeToClose() {
            var startY = 0;
            var currentY = 0;
            var isDragging = false;
            
            var isPassiveSupported = checkPassiveSupport();
            var touchOptions = isPassiveSupported ? { passive: true } : false;
            
            elements.popup.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                isDragging = true;
            }, touchOptions);
            
            elements.popup.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                
                currentY = e.touches[0].clientY;
                var deltaY = currentY - startY;
                
                if (deltaY > 0) {
                    // 向下拖拽
                    var opacity = Math.max(0.3, 1 - (deltaY / 200));
                    elements.popup.style.opacity = opacity;
                    elements.popup.style.transform = 'translateY(' + deltaY + 'px) scale(0.95)';
                }
            }, touchOptions);
            
            elements.popup.addEventListener('touchend', function() {
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
            }, touchOptions);
        }
        
        function calculatePosition(triggerElement, preferredPosition) {
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
        }
        
        function chooseBestPosition(triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight) {
            var positions = ['bottom', 'top', 'right', 'left'];
            var scores = {};
            
            positions.forEach(function(pos) {
                scores[pos] = calculatePositionScore(pos, triggerRect, popupWidth, popupHeight, viewportWidth, viewportHeight);
            });
            
            // 选择得分最高的位置
            var bestPosition = 'bottom';
            var bestScore = -1;
            
            for (var pos in scores) {
                if (scores[pos] > bestScore) {
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
            if (!elements.popup || isAnimating) return;
            
            isAnimating = true;
            isVisible = true;
            
            // 设置位置
            elements.popup.style.top = position.top + 'px';
            elements.popup.style.left = position.left + 'px';
            
            // 显示覆盖层（移动端）
            if (elements.overlay) {
                elements.overlay.style.display = 'block';
                setTimeout(function() {
                    elements.overlay.style.opacity = '1';
                }, 10);
            }
            
            // 显示弹窗
            elements.popup.style.visibility = 'visible';
            setTimeout(function() {
                elements.popup.style.opacity = '1';
                elements.popup.style.transform = 'scale(1)';
            }, 10);
            
            // 动画完成
            setTimeout(function() {
                isAnimating = false;
                
                // 启动自动关闭定时器
                if (config.autoClose) {
                    startAutoCloseTimer();
                }
            }, config.animationDuration);
        }
        
        function hidePopup() {
            if (!elements.popup || isAnimating) return;
            
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
                elements.popup.style.visibility = 'hidden';
                
                if (elements.overlay) {
                    elements.overlay.style.display = 'none';
                }
                
                isAnimating = false;
            }, config.animationDuration);
        }
        
        function updateBookmarkButton(isBookmarked) {
            var bookmarkBtn = elements.popup.querySelector('.glossary-bookmark-btn');
            if (bookmarkBtn) {
                if (isBookmarked) {
                    bookmarkBtn.classList.add('bookmarked');
                } else {
                    bookmarkBtn.classList.remove('bookmarked');
                }
            }
        }
        
        function playWordAudio(audioUrl) {
            try {
                var audio = new Audio(audioUrl);
                
                audio.addEventListener('error', function() {
                    console.warn('[GlossaryCore] Audio playback failed:', audioUrl);
                });
                
                var playPromise = audio.play();
                
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.catch(function(error) {
                        console.warn('[GlossaryCore] Audio playback error:', error);
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
            
            autoCloseTimer = setTimeout(function() {
                self.hide();
            }, config.autoCloseDelay);
        }
        
        function clearAutoCloseTimer() {
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
                autoCloseTimer = null;
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
            if (stateManager) {
                stateManager.setState('glossary.currentWord', currentWord);
                stateManager.setState('glossary.frequentWords', frequentWords);
                stateManager.setState('glossary.statistics', statistics);
            }
        }
        
        function saveBookmarks() {
            if (stateManager) {
                stateManager.setState('glossary.bookmarkedWords', Array.from(bookmarkedWords), true);
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
        }
        
        function handleError(context, error) {
            var errorInfo = {
                context: 'GlossaryCore:' + context,
                message: error.message || String(error),
                timestamp: Date.now(),
                currentWord: currentWord,
                isVisible: isVisible
            };
            
            console.error('[GlossaryCore:' + context + ']', error);
            
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
        if (global.EnglishSite) {
            global.EnglishSite.GlossaryCore = GlossaryCore;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);