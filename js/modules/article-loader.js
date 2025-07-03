// js/modules/article-loader.js - 文章加载器模块
(function(global) {
    'use strict';

    function ArticleLoader(options) {
        options = options || {};
        
        var config = {
            articlesIndexUrl: options.articlesIndexUrl || '/data/articles/index.json',
            baseUrl: options.baseUrl || '/data/articles/',
            cacheTimeout: options.cacheTimeout || 30 * 60 * 1000 // 30分钟
        };
        
        var articlesIndex = null;
        var loadedArticles = {};
        var cacheManager = null;
        var eventHub = null;
        
        var self = this;
        
        // 初始化
        function initialize() {
            // 获取依赖
            if (global.EnglishSite) {
                cacheManager = global.EnglishSite.CacheManager ? 
                    new global.EnglishSite.CacheManager() : null;
                eventHub = global.EnglishSite.EventHub ? 
                    new global.EnglishSite.EventHub() : null;
            }
            
            // 加载文章索引
            loadArticlesIndex();
        }
        
        // 加载文章索引
        function loadArticlesIndex() {
            // 先尝试从缓存获取
            if (cacheManager) {
                var cached = cacheManager.get('articles_index');
                if (cached) {
                    articlesIndex = cached;
                    triggerEvent('articlesIndexLoaded', articlesIndex);
                    return;
                }
            }
            
            // 从网络加载
            fetch(config.articlesIndexUrl)
                .then(response => response.json())
                .then(data => {
                    articlesIndex = data;
                    
                    // 缓存数据
                    if (cacheManager) {
                        cacheManager.set('articles_index', data, config.cacheTimeout);
                    }
                    
                    triggerEvent('articlesIndexLoaded', articlesIndex);
                })
                .catch(error => {
                    console.error('加载文章索引失败:', error);
                    triggerEvent('articlesIndexError', error);
                });
        }
        
        // 获取文章列表
        this.getArticlesList = function() {
            if (!articlesIndex) return [];
            
            var allArticles = [];
            articlesIndex.categories.forEach(category => {
                category.articles.forEach(article => {
                    allArticles.push({
                        ...article,
                        category: category.id,
                        categoryTitle: category.title,
                        level: category.level
                    });
                });
            });
            
            return allArticles;
        };
        
        // 按分类获取文章
        this.getArticlesByCategory = function(categoryId) {
            if (!articlesIndex) return [];
            
            var category = articlesIndex.categories.find(cat => cat.id === categoryId);
            return category ? category.articles : [];
        };
        
        // 加载单篇文章
        this.loadArticle = function(articleId) {
            return new Promise((resolve, reject) => {
                // 检查缓存
                if (loadedArticles[articleId]) {
                    resolve(loadedArticles[articleId]);
                    return;
                }
                
                // 查找文章信息
                var articleInfo = this.findArticleInfo(articleId);
                if (!articleInfo) {
                    reject(new Error('文章未找到: ' + articleId));
                    return;
                }
                
                // 加载文章内容
                fetch(articleInfo.contentFile)
                    .then(response => response.json())
                    .then(articleData => {
                        // 缓存文章
                        loadedArticles[articleId] = articleData;
                        
                        // 触发事件
                        triggerEvent('articleLoaded', {
                            id: articleId,
                            data: articleData
                        });
                        
                        resolve(articleData);
                    })
                    .catch(error => {
                        console.error('加载文章失败:', error);
                        reject(error);
                    });
            });
        };
        
        // 查找文章信息
        this.findArticleInfo = function(articleId) {
            if (!articlesIndex) return null;
            
            for (let category of articlesIndex.categories) {
                var article = category.articles.find(art => art.id === articleId);
                if (article) {
                    return {
                        ...article,
                        category: category.id,
                        categoryTitle: category.title
                    };
                }
            }
            
            return null;
        };
        
        // 渲染文章内容
        this.renderArticleContent = function(articleData, container) {
            if (!container) return;
            
            var html = `
                <article class="article-content" data-article-id="${articleData.id}">
                    <header class="article-header">
                        <h1 class="article-title">${articleData.title}</h1>
                        <h2 class="article-subtitle">${articleData.subtitle || ''}</h2>
                        <div class="article-meta">
                            <span class="article-level">难度: ${this.getLevelText(articleData.level)}</span>
                            <span class="article-time">预计时间: ${articleData.estimatedTime}</span>
                        </div>
                    </header>
                    
                    <div class="article-objectives">
                        <h3>学习目标</h3>
                        <ul>
                            ${articleData.objectives.map(obj => `<li>${obj}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="article-body">
                        ${this.renderParagraphs(articleData.content.paragraphs)}
                    </div>
                    
                    <div class="article-vocabulary">
                        <h3>重点词汇</h3>
                        ${this.renderVocabulary(articleData.vocabulary)}
                    </div>
                </article>
            `;
            
            container.innerHTML = html;
            
            // 绑定词汇点击事件
            this.bindWordClickEvents(container);
        };
        
        // 渲染段落
        this.renderParagraphs = function(paragraphs) {
            return paragraphs.map(paragraph => {
                return `
                    <div class="paragraph" 
                         data-paragraph-id="${paragraph.id}"
                         data-start-time="${paragraph.startTime}"
                         data-end-time="${paragraph.endTime}">
                        ${this.renderSentences(paragraph.sentences)}
                        <div class="paragraph-translation">${paragraph.translation}</div>
                    </div>
                `;
            }).join('');
        };
        
        // 渲染句子
        this.renderSentences = function(sentences) {
            return sentences.map(sentence => {
                return `
                    <div class="sentence"
                         data-sentence-id="${sentence.id}"
                         data-start-time="${sentence.startTime}"
                         data-end-time="${sentence.endTime}">
                        ${this.renderWords(sentence.words)}
                    </div>
                `;
            }).join('');
        };
        
        // 渲染单词
        this.renderWords = function(words) {
            return words.map(word => {
                var classes = ['word'];
                if (word.difficulty && word.difficulty > 3) {
                    classes.push('word-difficult');
                }
                if (word.frequency === 'high') {
                    classes.push('word-frequent');
                }
                
                return `
                    <span class="${classes.join(' ')}"
                          data-word="${word.word}"
                          data-start-time="${word.startTime}"
                          data-end-time="${word.endTime}"
                          data-pos="${word.pos}"
                          data-definition="${word.definition || ''}"
                          data-phonetic="${word.phonetic || ''}"
                          data-difficulty="${word.difficulty || 1}">
                        ${word.word}
                    </span>
                `;
            }).join(' ');
        };
        
        // 渲染词汇表
        this.renderVocabulary = function(vocabulary) {
            if (!vocabulary.keyWords) return '';
            
            return `
                <div class="vocabulary-list">
                    ${vocabulary.keyWords.map(word => {
                        return `
                            <div class="vocabulary-item" data-word="${word.word}">
                                <span class="vocabulary-word">${word.word}</span>
                                <span class="vocabulary-category">${word.category}</span>
                                <span class="vocabulary-difficulty">难度: ${word.difficulty}/5</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        };
        
        // 绑定单词点击事件
        this.bindWordClickEvents = function(container) {
            var words = container.querySelectorAll('.word');
            words.forEach(wordElement => {
                wordElement.addEventListener('click', function() {
                    var word = this.getAttribute('data-word');
                    var definition = this.getAttribute('data-definition');
                    var phonetic = this.getAttribute('data-phonetic');
                    
                    // 触发词汇表显示事件
                    if (eventHub) {
                        eventHub.emit('showGlossary', {
                            word: word,
                            definition: definition,
                            phonetic: phonetic,
                            element: this
                        });
                    }
                });
            });
        };
        
        // 获取级别文本
        this.getLevelText = function(level) {
            var levels = {
                'beginner': '初级',
                'intermediate': '中级', 
                'advanced': '高级'
            };
            return levels[level] || level;
        };
        
        // 搜索文章
        this.searchArticles = function(query) {
            var articles = this.getArticlesList();
            var lowerQuery = query.toLowerCase();
            
            return articles.filter(article => {
                return article.title.toLowerCase().includes(lowerQuery) ||
                       article.description.toLowerCase().includes(lowerQuery) ||
                       article.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
            });
        };
        
        // 事件触发
        function triggerEvent(eventName, data) {
            if (eventHub) {
                eventHub.emit('articleLoader:' + eventName, data);
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ArticleLoader;
    } else if (typeof global !== 'undefined') {
        global.ArticleLoader = ArticleLoader;
        
        if (global.EnglishSite) {
            global.EnglishSite.ArticleLoader = ArticleLoader;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);