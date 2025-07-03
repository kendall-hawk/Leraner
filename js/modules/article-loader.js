// js/modules/article-loader-enhanced.js - 增强版文章加载器
// 🚀 完整支持多层级文件夹结构和主题分类

(function(global) {
    'use strict';

    function ArticleLoaderEnhanced(options) {
        options = options || {};
        
        var config = {
            articlesIndexUrl: options.articlesIndexUrl || '/data/articles/index.json',
            baseUrl: options.baseUrl || '/data/articles/',
            cacheTimeout: options.cacheTimeout || 30 * 60 * 1000,
            supportMultiLevel: options.supportMultiLevel !== false // 默认支持多层级
        };
        
        var articlesIndex = null;
        var loadedArticles = {};
        var cacheManager = null;
        var eventHub = null;
        
        var self = this;
        
        // 初始化
        function initialize() {
            if (global.EnglishSite) {
                cacheManager = global.EnglishSite.CacheManager ? 
                    new global.EnglishSite.CacheManager() : null;
                eventHub = global.EnglishSite.EventHub ? 
                    new global.EnglishSite.EventHub() : null;
            }
            
            loadArticlesIndex();
        }
        
        // 加载文章索引
        function loadArticlesIndex() {
            if (cacheManager) {
                var cached = cacheManager.get('articles_index');
                if (cached) {
                    articlesIndex = cached;
                    triggerEvent('articlesIndexLoaded', articlesIndex);
                    return;
                }
            }
            
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
        
        // 获取扁平化的文章列表
        this.getArticlesList = function() {
            if (!articlesIndex) return [];
            
            var allArticles = [];
            
            articlesIndex.categories.forEach(category => {
                // 支持旧格式：直接在category下的articles
                if (category.articles) {
                    category.articles.forEach(article => {
                        allArticles.push(enhanceArticleInfo(article, category));
                    });
                }
                
                // 支持新格式：themes和subthemes
                if (category.themes) {
                    category.themes.forEach(theme => {
                        if (theme.articles) {
                            theme.articles.forEach(article => {
                                allArticles.push(enhanceArticleInfo(article, category, theme));
                            });
                        }
                        
                        // 支持更深层级：subthemes
                        if (theme.subthemes) {
                            theme.subthemes.forEach(subtheme => {
                                if (subtheme.articles) {
                                    subtheme.articles.forEach(article => {
                                        allArticles.push(enhanceArticleInfo(article, category, theme, subtheme));
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            return allArticles;
        };
        
        // 增强文章信息
        function enhanceArticleInfo(article, category, theme, subtheme) {
            return {
                ...article,
                category: category.id,
                categoryTitle: category.title,
                categoryIcon: category.icon,
                level: category.level,
                theme: theme ? theme.id : null,
                themeTitle: theme ? theme.title : null,
                subtheme: subtheme ? subtheme.id : null,
                subthemeTitle: subtheme ? subtheme.title : null,
                // 构建层级路径
                hierarchyPath: buildHierarchyPath(category, theme, subtheme),
                breadcrumb: buildBreadcrumb(category, theme, subtheme)
            };
        }
        
        // 构建层级路径
        function buildHierarchyPath(category, theme, subtheme) {
            var path = [category.title];
            if (theme) path.push(theme.title);
            if (subtheme) path.push(subtheme.title);
            return path;
        }
        
        // 构建面包屑导航
        function buildBreadcrumb(category, theme, subtheme) {
            var breadcrumb = [{
                id: category.id,
                title: category.title,
                icon: category.icon
            }];
            
            if (theme) {
                breadcrumb.push({
                    id: theme.id,
                    title: theme.title
                });
            }
            
            if (subtheme) {
                breadcrumb.push({
                    id: subtheme.id,
                    title: subtheme.title
                });
            }
            
            return breadcrumb;
        }
        
        // 按分类获取文章
        this.getArticlesByCategory = function(categoryId) {
            return this.getArticlesList().filter(article => article.category === categoryId);
        };
        
        // 按主题获取文章
        this.getArticlesByTheme = function(categoryId, themeId) {
            return this.getArticlesList().filter(article => 
                article.category === categoryId && article.theme === themeId
            );
        };
        
        // 按子主题获取文章
        this.getArticlesBySubtheme = function(categoryId, themeId, subthemeId) {
            return this.getArticlesList().filter(article => 
                article.category === categoryId && 
                article.theme === themeId && 
                article.subtheme === subthemeId
            );
        };
        
        // 获取分类结构
        this.getCategoryStructure = function() {
            if (!articlesIndex) return [];
            
            return articlesIndex.categories.map(category => ({
                id: category.id,
                title: category.title,
                icon: category.icon,
                level: category.level,
                description: category.description,
                themes: category.themes ? category.themes.map(theme => ({
                    id: theme.id,
                    title: theme.title,
                    description: theme.description,
                    articleCount: theme.articles ? theme.articles.length : 0,
                    subthemes: theme.subthemes ? theme.subthemes.map(subtheme => ({
                        id: subtheme.id,
                        title: subtheme.title,
                        articleCount: subtheme.articles ? subtheme.articles.length : 0
                    })) : []
                })) : [],
                directArticleCount: category.articles ? category.articles.length : 0
            }));
        };
        
        // 加载单篇文章
        this.loadArticle = function(articleId) {
            return new Promise((resolve, reject) => {
                if (loadedArticles[articleId]) {
                    resolve(loadedArticles[articleId]);
                    return;
                }
                
                var articleInfo = this.findArticleInfo(articleId);
                if (!articleInfo) {
                    reject(new Error('文章未找到: ' + articleId));
                    return;
                }
                
                // 支持多层级路径
                var articleUrl, audioUrl, subtitlesUrl, thumbnailUrl;
                
                if (articleInfo.folder && articleInfo.files) {
                    // 新格式：多层级文件夹结构
                    var articleFolder = config.baseUrl + articleInfo.folder + '/';
                    articleUrl = articleFolder + (articleInfo.files.article || 'article.json');
                    audioUrl = articleFolder + (articleInfo.files.audio || 'audio.mp3');
                    subtitlesUrl = articleFolder + (articleInfo.files.subtitles || 'subtitles.srt');
                    thumbnailUrl = articleFolder + (articleInfo.files.thumbnail || 'thumbnail.jpg');
                } else {
                    // 旧格式兼容
                    articleUrl = articleInfo.contentFile || (config.baseUrl + articleId + '.json');
                    audioUrl = articleInfo.audioFile;
                    subtitlesUrl = articleInfo.srtFile;
                    thumbnailUrl = articleInfo.thumbnail;
                }
                
                fetch(articleUrl)
                    .then(response => response.json())
                    .then(articleData => {
                        // 合并层级信息
                        articleData = Object.assign({}, articleData, {
                            hierarchyPath: articleInfo.hierarchyPath,
                            breadcrumb: articleInfo.breadcrumb,
                            category: articleInfo.category,
                            categoryTitle: articleInfo.categoryTitle,
                            theme: articleInfo.theme,
                            themeTitle: articleInfo.themeTitle,
                            subtheme: articleInfo.subtheme,
                            subthemeTitle: articleInfo.subthemeTitle
                        });
                        
                        // 文件路径信息
                        articleData.files = {
                            audioUrl: audioUrl,
                            subtitlesUrl: subtitlesUrl,
                            thumbnailUrl: thumbnailUrl
                        };
                        
                        // 向后兼容
                        articleData.audioFile = audioUrl;
                        articleData.srtFile = subtitlesUrl;
                        
                        // 扩展资源
                        if (articleInfo.extras) {
                            articleData.extras = {};
                            var articleFolder = config.baseUrl + articleInfo.folder + '/';
                            for (var key in articleInfo.extras) {
                                articleData.extras[key + 'Url'] = articleFolder + articleInfo.extras[key];
                            }
                        }
                        
                        loadedArticles[articleId] = articleData;
                        
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
        
        // 查找文章信息（支持多层级）
        this.findArticleInfo = function(articleId) {
            var articles = this.getArticlesList();
            return articles.find(article => article.id === articleId) || null;
        };
        
        // 渲染文章内容（增强版）
        this.renderArticleContent = function(articleData, container) {
            if (!container) return;
            
            var html = `
                <article class="article-content" data-article-id="${articleData.id}">
                    <!-- 面包屑导航 -->
                    ${articleData.breadcrumb ? this.renderBreadcrumb(articleData.breadcrumb) : ''}
                    
                    <header class="article-header">
                        ${(articleData.files && articleData.files.thumbnailUrl) ? 
                            `<img src="${articleData.files.thumbnailUrl}" alt="${articleData.title}" class="article-thumbnail" onerror="this.style.display='none'">` : 
                            ''
                        }
                        <div class="article-category-badge">
                            ${articleData.categoryIcon || '📖'} ${articleData.categoryTitle}
                            ${articleData.themeTitle ? ` > ${articleData.themeTitle}` : ''}
                            ${articleData.subthemeTitle ? ` > ${articleData.subthemeTitle}` : ''}
                        </div>
                        <h1 class="article-title">${articleData.title}</h1>
                        <h2 class="article-subtitle">${articleData.subtitle || ''}</h2>
                        <div class="article-meta">
                            <span class="article-level">难度: ${this.getLevelText(articleData.level)}</span>
                            <span class="article-time">预计时间: ${articleData.estimatedTime || '未知'}</span>
                            ${((articleData.files && articleData.files.audioUrl) || articleData.audioFile) ? 
                                `<button class="audio-load-btn" onclick="window.articleLoader.loadAudio('${articleData.files ? articleData.files.audioUrl : articleData.audioFile}')">
                                    🎵 加载音频
                                </button>` : 
                                ''
                            }
                        </div>
                    </header>
                    
                    ${articleData.objectives ? `
                        <div class="article-objectives">
                            <h3>学习目标</h3>
                            <ul>
                                ${articleData.objectives.map(obj => `<li>${obj}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="article-body">
                        ${articleData.content && articleData.content.paragraphs ? 
                            this.renderParagraphs(articleData.content.paragraphs) :
                            `<p>${articleData.content || '内容加载中...'}</p>`
                        }
                    </div>
                    
                    ${articleData.vocabulary ? `
                        <div class="article-vocabulary">
                            <h3>重点词汇</h3>
                            ${this.renderVocabulary(articleData.vocabulary)}
                        </div>
                    ` : ''}
                    
                    ${articleData.extras ? `
                        <div class="article-extras">
                            <h3>扩展资源</h3>
                            ${this.renderExtras(articleData.extras)}
                        </div>
                    ` : ''}
                </article>
            `;
            
            container.innerHTML = html;
            this.bindWordClickEvents(container);
            window.articleLoader = this;
        };
        
        // 渲染面包屑导航
        this.renderBreadcrumb = function(breadcrumb) {
            return `
                <nav class="article-breadcrumb">
                    ${breadcrumb.map((item, index) => `
                        <span class="breadcrumb-item">
                            ${item.icon ? item.icon + ' ' : ''}${item.title}
                        </span>
                        ${index < breadcrumb.length - 1 ? '<span class="breadcrumb-separator">></span>' : ''}
                    `).join('')}
                </nav>
            `;
        };
        
        // 多条件搜索
        this.searchArticles = function(query, filters) {
            var articles = this.getArticlesList();
            var lowerQuery = query ? query.toLowerCase() : '';
            filters = filters || {};
            
            return articles.filter(article => {
                // 文本搜索
                var textMatch = !query || 
                    article.title.toLowerCase().includes(lowerQuery) ||
                    article.description.toLowerCase().includes(lowerQuery) ||
                    (article.tags && article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) ||
                    article.categoryTitle.toLowerCase().includes(lowerQuery) ||
                    (article.themeTitle && article.themeTitle.toLowerCase().includes(lowerQuery));
                
                // 分类过滤
                var categoryMatch = !filters.category || article.category === filters.category;
                
                // 主题过滤
                var themeMatch = !filters.theme || article.theme === filters.theme;
                
                // 难度过滤
                var levelMatch = !filters.level || article.level === filters.level;
                
                // 标签过滤
                var tagMatch = !filters.tags || !filters.tags.length || 
                    (article.tags && filters.tags.some(tag => article.tags.includes(tag)));
                
                return textMatch && categoryMatch && themeMatch && levelMatch && tagMatch;
            });
        };
        
        // 获取学习路径推荐
        this.getLearningPath = function(currentArticleId) {
            var currentArticle = this.findArticleInfo(currentArticleId);
            if (!currentArticle) return [];
            
            var sameCategoryArticles = this.getArticlesByCategory(currentArticle.category);
            var currentIndex = sameCategoryArticles.findIndex(article => article.id === currentArticleId);
            
            return {
                previous: currentIndex > 0 ? sameCategoryArticles[currentIndex - 1] : null,
                next: currentIndex < sameCategoryArticles.length - 1 ? sameCategoryArticles[currentIndex + 1] : null,
                related: sameCategoryArticles.filter((article, index) => 
                    index !== currentIndex && 
                    (article.theme === currentArticle.theme || 
                     (article.tags && currentArticle.tags && 
                      article.tags.some(tag => currentArticle.tags.includes(tag))))
                ).slice(0, 3)
            };
        };
        
        // 获取统计信息
        this.getStatistics = function() {
            var articles = this.getArticlesList();
            var categories = this.getCategoryStructure();
            
            return {
                totalArticles: articles.length,
                totalCategories: categories.length,
                totalThemes: categories.reduce((sum, cat) => sum + cat.themes.length, 0),
                articlesByLevel: {
                    beginner: articles.filter(a => a.level === 1).length,
                    intermediate: articles.filter(a => a.level === 2).length,
                    advanced: articles.filter(a => a.level === 3).length
                },
                averageDifficulty: articles.reduce((sum, a) => sum + (a.difficulty || 1), 0) / articles.length
            };
        };
        
        // 其他方法保持不变...
        this.loadAudio = function(audioUrl) {
            var audioPlayer = document.getElementById('audio-player');
            var audioContainer = document.getElementById('audio-container');
            
            if (audioPlayer && audioUrl) {
                audioContainer.style.display = 'block';
                audioPlayer.src = audioUrl;
                triggerEvent('audioLoaded', { url: audioUrl });
                if (eventHub) {
                    eventHub.emit('audio:loaded', { url: audioUrl });
                }
            }
        };
        
        this.renderParagraphs = function(paragraphs) {
            return paragraphs.map(paragraph => `
                <div class="paragraph" 
                     data-paragraph-id="${paragraph.id}"
                     data-start-time="${paragraph.startTime || 0}"
                     data-end-time="${paragraph.endTime || 0}">
                    ${paragraph.sentences ? 
                        this.renderSentences(paragraph.sentences) : 
                        `<p class="paragraph-text">${paragraph.text}</p>`
                    }
                    ${paragraph.translation ? 
                        `<div class="paragraph-translation">${paragraph.translation}</div>` : 
                        ''
                    }
                </div>
            `).join('');
        };
        
        this.renderSentences = function(sentences) {
            return sentences.map(sentence => `
                <div class="sentence"
                     data-sentence-id="${sentence.id}"
                     data-start-time="${sentence.startTime || 0}"
                     data-end-time="${sentence.endTime || 0}">
                    ${sentence.words ? this.renderWords(sentence.words) : sentence.text}
                </div>
            `).join('');
        };
        
        this.renderWords = function(words) {
            return words.map(word => {
                var classes = ['word'];
                if (word.difficulty && word.difficulty > 3) classes.push('word-difficult');
                if (word.frequency === 'high') classes.push('word-frequent');
                
                return `
                    <span class="${classes.join(' ')}"
                          data-word="${word.word}"
                          data-definition="${word.definition || ''}"
                          data-phonetic="${word.phonetic || ''}">
                        ${word.word}
                    </span>
                `;
            }).join(' ');
        };
        
        this.renderVocabulary = function(vocabulary) {
            if (!vocabulary.keyWords) return '';
            return `
                <div class="vocabulary-list">
                    ${vocabulary.keyWords.map(word => `
                        <div class="vocabulary-item">
                            <span class="vocabulary-word">${word.word}</span>
                            <span class="vocabulary-category">${word.category}</span>
                            <span class="vocabulary-difficulty">难度: ${word.difficulty}/5</span>
                        </div>
                    `).join('')}
                </div>
            `;
        };
        
        this.renderExtras = function(extras) {
            var html = '<div class="extras-list">';
            for (var key in extras) {
                var name = key.replace('Url', '');
                html += `
                    <button class="extra-resource-btn" onclick="window.articleLoader.loadExtra('${extras[key]}', '${name}')">
                        📎 加载${this.getExtraName(name)}
                    </button>
                `;
            }
            html += '</div>';
            return html;
        };
        
        this.loadExtra = function(url, type) {
            fetch(url)
                .then(response => response.json())
                .then(data => triggerEvent('extraLoaded', { type: type, data: data, url: url }))
                .catch(error => console.error('加载扩展资源失败:', error));
        };
        
        this.getExtraName = function(key) {
            var names = {
                'vocabulary': '词汇表',
                'exercises': '练习题',
                'grammar': '语法说明',
                'phrases': '常用短语',
                'culturalNotes': '文化注释'
            };
            return names[key] || key;
        };
        
        this.bindWordClickEvents = function(container) {
            var words = container.querySelectorAll('.word');
            words.forEach(wordElement => {
                wordElement.addEventListener('click', function() {
                    if (eventHub) {
                        eventHub.emit('showGlossary', {
                            word: this.getAttribute('data-word'),
                            definition: this.getAttribute('data-definition'),
                            phonetic: this.getAttribute('data-phonetic'),
                            element: this
                        });
                    }
                });
            });
        };
        
        this.getLevelText = function(level) {
            var levels = { 'beginner': '初级', 'intermediate': '中级', 'advanced': '高级' };
            return levels[level] || level;
        };
        
        function triggerEvent(eventName, data) {
            if (eventHub) {
                eventHub.emit('articleLoader:' + eventName, data);
            }
        }
        
        // 初始化
        initialize();
    }
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ArticleLoaderEnhanced;
    } else if (typeof global !== 'undefined') {
        global.ArticleLoaderEnhanced = ArticleLoaderEnhanced;
        
        if (global.EnglishSite) {
            global.EnglishSite.ArticleLoader = ArticleLoaderEnhanced;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);