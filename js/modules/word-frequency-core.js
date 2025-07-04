// js/modules/word-frequency-core.js - iOS兼容版智能词频核心
// 🚀 智能词频分析系统，确保iOS Safari 12+兼容性

(function(global) {
        'use strict';

        /**
         * 🎯 WordFrequencyCore - 智能词频分析核心
         * 功能：智能词干提取、个性化难度计算、实时学习分析、预测性推荐
         * 兼容：iOS Safari 12+, Android Chrome 80+
         */
        function WordFrequencyCore(options) {
            options = options || {};

            // 配置参数
            var config = {
                enablePersonalization: options.enablePersonalization !== false,
                enableRealTimeAnalysis: options.enableRealTimeAnalysis !== false,
                enablePredictiveAnalysis: options.enablePredictiveAnalysis !== false,
                cacheTimeout: options.cacheTimeout || 24 * 60 * 60 * 1000, // 24小时
                maxCacheSize: options.maxCacheSize || 1000,
                analysisInterval: options.analysisInterval || 5000, // 5秒
                difficultyLevels: options.difficultyLevels || 5,
                personalizationWeight: options.personalizationWeight || 0.3,
                cacheKey: 'word_frequency_analysis'
            };

            // 核心组件
            var wordStemmer = null;
            var frequencyAnalyzer = null;
            var personalizedEngine = null;
            var realTimeAnalyzer = null;

            // 数据存储
            var wordStats = {};
            var articleContents = {};
            var userProfile = {
                readingSpeed: 200, // 每分钟词数
                comprehensionLevel: 0.7,
                preferredDifficulty: 3,
                learningHistory: [],
                weakSpots: [],
                strengths: []
            };

            // 分析状态
            var analysisState = {
                isInitialized: false,
                isAnalyzing: false,
                currentProgress: 0,
                lastAnalysisTime: 0,
                processedArticles: 0,
                totalArticles: 0
            };

            // 实时分析数据
            var realTimeData = {
                currentSession: {
                    startTime: 0,
                    wordsRead: 0,
                    lookupsCount: 0,
                    timeSpent: 0,
                    difficultyEncountered: []
                },
                sessionHistory: []
            };

            // 定时器
            var analysisTimer = null;
            var realTimeTimer = null;

            // 依赖注入
            var stateManager = null;
            var eventHub = null;
            var cacheManager = null;
            var errorBoundary = null;

            var self = this;

            // 🎯 初始化
            function initialize() {
                try {
                    // 注入依赖
                    injectDependencies();

                    // 初始化组件
                    initializeComponents();

                    // 恢复用户档案
                    restoreUserProfile();

                    // 启动分析引擎
                    startAnalysisEngine();

                    // 设置实时分析
                    if (config.enableRealTimeAnalysis) {
                        setupRealTimeAnalysis();
                    }

                    console.log('[WordFrequencyCore] 智能词频分析系统初始化成功');

                    // 触发初始化完成事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:initialized', {
                            personalization: config.enablePersonalization,
                            realTime: config.enableRealTimeAnalysis,
                            predictive: config.enablePredictiveAnalysis
                        });
                    }

                } catch (error) {
                    handleError('initialize', error);
                }
            }

            // 🔑 公开API - 核心分析功能

            /**
             * 开始分析文章集合
             * @param {Array} articles - 文章列表
             */
            this.analyzeArticles = function(articles) {
                try {
                    if (!Array.isArray(articles) || articles.length === 0) {
                        throw new Error('无效的文章列表');
                    }

                    analysisState.isAnalyzing = true;
                    analysisState.totalArticles = articles.length;
                    analysisState.processedArticles = 0;

                    // 异步处理文章
                    processArticlesSequentially(articles);

                    return true;
                } catch (error) {
                    handleError('analyzeArticles', error);
                    return false;
                }
            };

            /**
             * 智能搜索词汇
             * @param {string} query - 搜索查询
             * @param {Object} options - 搜索选项
             */
            this.searchWords = function(query, options) {
                try {
                    options = options || {};

                    if (!query || typeof query !== 'string') {
                        return [];
                    }

                    var searchResults = frequencyAnalyzer.performSmartSearch(query, options);

                    // 个性化排序
                    if (config.enablePersonalization) {
                        searchResults = personalizedEngine.personalizeResults(searchResults, userProfile);
                    }

                    // 触发搜索事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:searched', {
                            query: query,
                            results: searchResults.length,
                            personalized: config.enablePersonalization
                        });
                    }

                    return searchResults;
                } catch (error) {
                    handleError('searchWords', error);
                    return [];
                }
            };

            /**
             * 计算文章个性化难度
             * @param {string} articleId - 文章ID
             */
            this.calculatePersonalizedDifficulty = function(articleId) {
                try {
                    var baseDifficulty = frequencyAnalyzer.calculateBaseDifficulty(articleId);

                    if (config.enablePersonalization) {
                        return personalizedEngine.adjustDifficultyForUser(baseDifficulty, userProfile);
                    }

                    return baseDifficulty;
                } catch (error) {
                    handleError('calculatePersonalizedDifficulty', error);
                    return {
                        stars: 3,
                        label: '⭐⭐⭐ 中等'
                    };
                }
            };

            /**
             * 获取个性化学习建议
             * @param {string} word - 目标词汇
             */
            this.getPersonalizedRecommendations = function(word) {
                try {
                    if (!config.enablePersonalization) {
                        return this.getBasicWordInfo(word);
                    }

                    var basicInfo = this.getBasicWordInfo(word);
                    var personalizedInfo = personalizedEngine.generatePersonalizedInsights(word, userProfile);

                    return Object.assign({}, basicInfo, personalizedInfo);
                } catch (error) {
                    handleError('getPersonalizedRecommendations', error);
                    return null;
                }
            };

            /**
             * 开始实时学习会话
             */
            this.startLearningSession = function() {
                try {
                    realTimeData.currentSession = {
                        startTime: Date.now(),
                        wordsRead: 0,
                        lookupsCount: 0,
                        timeSpent: 0,
                        difficultyEncountered: []
                    };

                    if (config.enableRealTimeAnalysis) {
                        startRealTimeAnalysis();
                    }

                    // 触发会话开始事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:sessionStarted', {
                            timestamp: realTimeData.currentSession.startTime
                        });
                    }

                    return true;
                } catch (error) {
                    handleError('startLearningSession', error);
                    return false;
                }
            };

            /**
             * 结束学习会话
             */
            this.endLearningSession = function() {
                try {
                    if (realTimeTimer) {
                        clearInterval(realTimeTimer);
                        realTimeTimer = null;
                    }

                    var session = realTimeData.currentSession;
                    session.endTime = Date.now();
                    session.timeSpent = session.endTime - session.startTime;

                    // 分析会话数据
                    var sessionAnalysis = realTimeAnalyzer.analyzeSession(session);

                    // 更新用户档案
                    updateUserProfile(sessionAnalysis);

                    // 保存会话历史
                    realTimeData.sessionHistory.push(session);
                    if (realTimeData.sessionHistory.length > 50) {
                        realTimeData.sessionHistory.shift();
                    }

                    // 触发会话结束事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:sessionEnded', {
                            session: session,
                            analysis: sessionAnalysis
                        });
                    }

                    return sessionAnalysis;
                } catch (error) {
                    handleError('endLearningSession', error);
                    return null;
                }
            };

            /**
             * 记录词汇查找行为
             * @param {string} word - 查找的词汇
             * @param {Object} context - 查找上下文
             */
            this.recordWordLookup = function(word, context) {
                try {
                    context = context || {};

                    // 更新实时会话数据
                    realTimeData.currentSession.lookupsCount++;

                    // 分析查找行为
                    var lookupAnalysis = realTimeAnalyzer.analyzeLookup(word, context, userProfile);

                    // 更新用户档案
                    updateUserBehavior('lookup', lookupAnalysis);

                    // 触发查找事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:wordLookup', {
                            word: word,
                            analysis: lookupAnalysis,
                            suggestions: lookupAnalysis.suggestions
                        });
                    }

                    return lookupAnalysis;
                } catch (error) {
                    handleError('recordWordLookup', error);
                    return null;
                }
            };

            /**
             * 获取学习进度分析
             */
            this.getLearningProgress = function() {
                try {
                    var progress = {
                        overall: calculateOverallProgress(),
                        vocabulary: calculateVocabularyProgress(),
                        difficulty: calculateDifficultyProgress(),
                        trends: calculateLearningTrends(),
                        predictions: null
                    };

                    // 预测性分析
                    if (config.enablePredictiveAnalysis) {
                        progress.predictions = generateLearningPredictions();
                    }

                    return progress;
                } catch (error) {
                    handleError('getLearningProgress', error);
                    return null;
                }
            };

            // 🔧 内部方法 - 依赖注入和组件初始化

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

            function initializeComponents() {
                // 初始化词干提取器
                wordStemmer = createWordStemmer();

                // 初始化频率分析器
                frequencyAnalyzer = createFrequencyAnalyzer();

                // 初始化个性化引擎
                if (config.enablePersonalization) {
                    personalizedEngine = createPersonalizedEngine();
                }

                // 初始化实时分析器
                if (config.enableRealTimeAnalysis) {
                    realTimeAnalyzer = createRealTimeAnalyzer();
                }
            }

            // 🔧 内部方法 - 核心组件实现

            function createWordStemmer() {
                return {
                    // 不规则动词映射
                    irregularVerbs: {
                        'am': 'be',
                        'is': 'be',
                        'are': 'be',
                        'was': 'be',
                        'were': 'be',
                        'took': 'take',
                        'taken': 'take',
                        'went': 'go',
                        'gone': 'go',
                        'came': 'come',
                        'saw': 'see',
                        'seen': 'see',
                        'did': 'do',
                        'done': 'do',
                        'had': 'have',
                        'said': 'say',
                        'got': 'get',
                        'made': 'make',
                        'knew': 'know',
                        'known': 'know'
                    },

                    // 后缀规则
                    suffixRules: [{
                            pattern: /ies$/,
                            replacement: 'y',
                            minLength: 5
                        },
                        {
                            pattern: /ves$/,
                            replacement: 'f',
                            minLength: 5
                        },
                        {
                            pattern: /ses$/,
                            replacement: 's',
                            minLength: 5
                        },
                        {
                            pattern: /s$/,
                            replacement: '',
                            minLength: 4
                        },
                        {
                            pattern: /ed$/,
                            replacement: '',
                            minLength: 4
                        },
                        {
                            pattern: /ing$/,
                            replacement: '',
                            minLength: 5
                        },
                        {
                            pattern: /ly$/,
                            replacement: '',
                            minLength: 5
                        },
                        {
                            pattern: /er$/,
                            replacement: '',
                            minLength: 4
                        },
                        {
                            pattern: /est$/,
                            replacement: '',
                            minLength: 5
                        }
                    ],

                    // 缓存
                    stemCache: {},

                    getStem: function(word) {
                        var lowerWord = word.toLowerCase();

                        // 检查缓存
                        if (this.stemCache[lowerWord]) {
                            return this.stemCache[lowerWord];
                        }

                        var stem = lowerWord;

                        // 检查不规则动词
                        if (this.irregularVerbs[lowerWord]) {
                            stem = this.irregularVerbs[lowerWord];
                        } else {
                            // 应用后缀规则
                            for (var i = 0; i < this.suffixRules.length; i++) {
                                var rule = this.suffixRules[i];
                                if (lowerWord.length >= rule.minLength && rule.pattern.test(lowerWord)) {
                                    stem = lowerWord.replace(rule.pattern, rule.replacement);
                                    break;
                                }
                            }
                        }

                        // 缓存结果
                        if (Object.keys(this.stemCache).length < config.maxCacheSize) {
                            this.stemCache[lowerWord] = stem;
                        }

                        return stem;
                    }
                };
            }

            function createFrequencyAnalyzer() {
                return {
                    stopWords: new Set([
                        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
                        'by', 'from', 'this', 'that', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
                        'is', 'are', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does', 'did'
                    ]),

                    analyzeText: function(text, articleId, title) {
                        var words = this.extractWords(text);
                        var wordCounts = {};
                        var totalWords = words.length;

                        // 统计词频
                        for (var i = 0; i < words.length; i++) {
                            var word = words[i];
                            if (this.isValidWord(word)) {
                                var stem = wordStemmer.getStem(word);

                                if (!wordCounts[stem]) {
                                    wordCounts[stem] = {
                                        count: 0,
                                        variants: {}
                                    };
                                }

                                wordCounts[stem].count++;

                                if (!wordCounts[stem].variants[word]) {
                                    wordCounts[stem].variants[word] = 0;
                                }
                                wordCounts[stem].variants[word]++;
                            }
                        }

                        // 更新全局统计
                        this.updateGlobalStats(articleId, title, text, wordCounts, totalWords);

                        return {
                            totalWords: totalWords,
                            uniqueWords: Object.keys(wordCounts).length,
                            wordCounts: wordCounts
                        };
                    },

                    extractWords: function(text) {
                        if (!text || typeof text !== 'string') {
                            return [];
                        }

                        return text
                            .toLowerCase()
                            .replace(/[^\w\s'-]/g, ' ')
                            .replace(/\s+/g, ' ')
                            .split(' ')
                            .map(function(word) {
                                return word.replace(/^[-']+|[-']+$/g, '');
                            })
                            .filter(function(word) {
                                return word.length > 0;
                            });
                    },

                    isValidWord: function(word) {
                        return word.length >= 3 &&
                            word.length <= 20 &&
                            !this.stopWords.has(word) &&
                            /^[a-zA-Z]+$/.test(word);
                    },

                    updateGlobalStats: function(articleId, title, text, wordCounts, totalWords) {
                        // 保存文章信息
                        articleContents[articleId] = {
                            title: title,
                            content: text,
                            totalWords: totalWords,
                            uniqueWords: Object.keys(wordCounts).length,
                            analysis: Date.now()
                        };

                        // 更新全局词频统计
                        for (var stem in wordCounts) {
                            if (!wordStats[stem]) {
                                wordStats[stem] = {
                                    totalCount: 0,
                                    articleCount: 0,
                                    variants: {},
                                    articles: {},
                                    distributionScore: 0
                                };
                            }

                            var globalStat = wordStats[stem];
                            var wordData = wordCounts[stem];

                            globalStat.totalCount += wordData.count;

                            if (!globalStat.articles[articleId]) {
                                globalStat.articleCount++;
                            }

                            globalStat.articles[articleId] = {
                                count: wordData.count,
                                title: title,
                                density: wordData.count / totalWords
                            };

                            // 更新变形词统计
                            for (var variant in wordData.variants) {
                                if (!globalStat.variants[variant]) {
                                    globalStat.variants[variant] = 0;
                                }
                                globalStat.variants[variant] += wordData.variants[variant];
                            }

                            // 计算分布评分
                            globalStat.distributionScore = this.calculateDistributionScore(globalStat);
                        }
                    },

                    calculateDistributionScore: function(stats) {
                        var totalArticles = Object.keys(articleContents).length;
                        if (totalArticles === 0) return 0;

                        var distributionRatio = stats.articleCount / totalArticles;
                        var avgDensity = stats.totalCount / stats.articleCount;

                        var distributionWeight = Math.sqrt(distributionRatio);
                        var stabilityWeight = Math.log(avgDensity + 1) / Math.log(10);

                        return stats.totalCount * distributionWeight * stabilityWeight;
                    },

                    calculateBaseDifficulty: function(articleId) {
                        var article = articleContents[articleId];
                        if (!article) {
                            return {
                                stars: 3,
                                label: '⭐⭐⭐ 中等'
                            };
                        }

                        var words = this.extractWords(article.content);
                        var totalDifficulty = 0;
                        var validWords = 0;

                        for (var i = 0; i < words.length; i++) {
                            var word = words[i];
                            if (this.isValidWord(word)) {
                                var stem = wordStemmer.getStem(word);
                                var stats = wordStats[stem];

                                if (stats) {
                                    var wordDifficulty = this.convertScoreToDifficulty(stats.distributionScore);
                                    totalDifficulty += wordDifficulty;
                                    validWords++;
                                }
                            }
                        }

                        if (validWords === 0) {
                            return {
                                stars: 3,
                                label: '⭐⭐⭐ 中等'
                            };
                        }

                        var avgDifficulty = totalDifficulty / validWords;
                        var stars = Math.max(1, Math.min(5, Math.round(avgDifficulty)));

                        return {
                            stars: stars,
                            avgDifficulty: avgDifficulty,
                            validWords: validWords,
                            label: this.getStarLabel(stars)
                        };
                    },

                    convertScoreToDifficulty: function(distributionScore) {
                        if (distributionScore >= 20) return 1;
                        if (distributionScore >= 10) return 2;
                        if (distributionScore >= 5) return 3;
                        if (distributionScore >= 2) return 4;
                        return 5;
                    },

                    getStarLabel: function(stars) {
                        var labels = {
                            1: '⭐ 入门级',
                            2: '⭐⭐ 简单',
                            3: '⭐⭐⭐ 中等',
                            4: '⭐⭐⭐⭐ 困难',
                            5: '⭐⭐⭐⭐⭐ 专家级'
                        };
                        return labels[stars] || '⭐⭐⭐ 中等';
                    },

                    performSmartSearch: function(query, options) {
                        var results = [];
                        var lowerQuery = query.toLowerCase().trim();

                        if (!lowerQuery) return results;

                        // 搜索匹配的词汇
                        for (var stem in wordStats) {
                            var stats = wordStats[stem];
                            var relevance = 0;

                            // 词干匹配
                            if (stem === lowerQuery) {
                                relevance = 10;
                            } else if (stem.indexOf(lowerQuery) === 0) {
                                relevance = 8;
                            } else if (stem.indexOf(lowerQuery) !== -1) {
                                relevance = 6;
                            }

                            // 变形词匹配
                            var maxVariantRelevance = 0;
                            for (var variant in stats.variants) {
                                if (variant === lowerQuery) {
                                    maxVariantRelevance = Math.max(maxVariantRelevance, 9);
                                } else if (variant.indexOf(lowerQuery) === 0) {
                                    maxVariantRelevance = Math.max(maxVariantRelevance, 7);
                                } else if (variant.indexOf(lowerQuery) !== -1) {
                                    maxVariantRelevance = Math.max(maxVariantRelevance, 5);
                                }
                            }

                            relevance = Math.max(relevance, maxVariantRelevance);

                            if (relevance > 0) {
                                results.push({
                                    word: stem,
                                    relevance: relevance,
                                    frequency: stats.totalCount,
                                    articleCount: stats.articleCount,
                                    distributionScore: stats.distributionScore,
                                    difficulty: this.convertScoreToDifficulty(stats.distributionScore),
                                    variants: Object.keys(stats.variants).slice(0, 5)
                                });
                            }
                        }

                        // 排序：相关性优先，然后按分布评分
                        results.sort(function(a, b) {
                            if (a.relevance !== b.relevance) {
                                return b.relevance - a.relevance;
                            }
                            return b.distributionScore - a.distributionScore;
                        });

                        return results.slice(0, options.limit || 20);
                    }
                };
            }

            function createPersonalizedEngine() {
                return {
                    adjustDifficultyForUser: function(baseDifficulty, profile) {
                        var adjustment = 0;

                        // 基于用户偏好调整
                        var prefDiff = profile.preferredDifficulty - 3; // 标准化到-2到+2
                        adjustment += prefDiff * 0.3;

                        // 基于理解能力调整
                        var compAdj = (profile.comprehensionLevel - 0.7) * 2; // 标准化
                        adjustment += compAdj * 0.2;

                        // 基于阅读速度调整
                        var speedAdj = (profile.readingSpeed - 200) / 100; // 标准化
                        adjustment -= speedAdj * 0.1; // 读得快的，难度可以高一点

                        var personalizedStars = Math.max(1, Math.min(5,
                            Math.round(baseDifficulty.stars + adjustment)));

                        return {
                            stars: personalizedStars,
                            originalStars: baseDifficulty.stars,
                            adjustment: adjustment,
                            label: frequencyAnalyzer.getStarLabel(personalizedStars),
                            personalizedFor: 'user',
                            factors: {
                                preference: prefDiff,
                                comprehension: compAdj,
                                readingSpeed: speedAdj
                            }
                        };
                    },

                    personalizeResults: function(results, profile) {
                        return results.map(function(result) {
                            var personalizedDifficulty = result.difficulty;

                            // 基于用户历史调整相关性
                            var historyBonus = 0;
                            if (profile.weakSpots.indexOf(result.word) !== -1) {
                                historyBonus = 2; // 弱项词汇提高相关性
                            } else if (profile.strengths.indexOf(result.word) !== -1) {
                                historyBonus = -1; // 强项词汇降低相关性
                            }

                            return Object.assign({}, result, {
                                personalizedRelevance: result.relevance + historyBonus,
                                personalizedDifficulty: personalizedDifficulty,
                                isPersonalized: true
                            });
                        }).sort(function(a, b) {
                            return b.personalizedRelevance - a.personalizedRelevance;
                        });
                    },

                    generatePersonalizedInsights: function(word, profile) {
                        var insights = {
                            difficultyForUser: 'medium',
                            recommendedAction: 'study',
                            learningTips: [],
                            relatedWords: [],
                            practiceExercises: []
                        };

                        var stats = wordStats[word];
                        if (!stats) return insights;

                        // 分析用户对这个词的掌握情况
                        var userMastery = this.estimateUserMastery(word, profile);

                        // 生成个性化建议
                        if (userMastery < 0.3) {
                            insights.recommendedAction = 'focus_study';
                            insights.learningTips.push('这个词对您来说比较困难，建议重点学习');
                            insights.learningTips.push('尝试在不同语境中使用这个词');
                        } else if (userMastery > 0.8) {
                            insights.recommendedAction = 'review';
                            insights.learningTips.push('您已经很好地掌握了这个词');
                            insights.learningTips.push('可以学习相关的高级用法');
                        } else {
                            insights.recommendedAction = 'practice';
                            insights.learningTips.push('通过练习巩固对这个词的理解');
                        }

                        return insights;
                    },

                    estimateUserMastery: function(word, profile) {
                        // 基于用户历史估算掌握程度
                        var baseMastery = 0.5; // 默认中等掌握

                        if (profile.strengths.indexOf(word) !== -1) {
                            baseMastery = 0.9;
                        } else if (profile.weakSpots.indexOf(word) !== -1) {
                            baseMastery = 0.2;
                        }

                        // 根据学习历史微调
                        var historyCount = profile.learningHistory.filter(function(item) {
                            return item.word === word;
                        }).length;

                        if (historyCount > 5) {
                            baseMastery = Math.min(0.95, baseMastery + 0.1);
                        }

                        return baseMastery;
                    }
                };
            }

            function createRealTimeAnalyzer() {
                return {
                    analyzeLookup: function(word, context, profile) {
                        var analysis = {
                            word: word,
                            difficulty: 'unknown',
                            suggestions: [],
                            learningTip: '',
                            shouldFocus: false
                        };

                        var stats = wordStats[word];
                        if (stats) {
                            analysis.difficulty = frequencyAnalyzer.convertScoreToDifficulty(stats.distributionScore);

                            // 生成建议
                            if (analysis.difficulty >= 4) {
                                analysis.suggestions.push('这是一个较难的词汇，建议加入学习清单');
                                analysis.shouldFocus = true;
                            } else if (analysis.difficulty <= 2) {
                                analysis.suggestions.push('这是一个常用词汇，很好掌握');
                            }

                            // 生成学习提示
                            analysis.learningTip = this.generateLearningTip(word, stats, profile);
                        }

                        return analysis;
                    },

                    analyzeSession: function(session) {
                        var analysis = {
                            duration: session.timeSpent,
                            wordsPerMinute: 0,
                            lookupRate: 0,
                            difficultyTrend: 'stable',
                            comprehensionEstimate: 0.7,
                            recommendations: []
                        };

                        if (session.timeSpent > 0) {
                            analysis.wordsPerMinute = (session.wordsRead / session.timeSpent) * 60000; // 转换为分钟
                            analysis.lookupRate = session.lookupsCount / session.wordsRead;
                        }

                        // 分析困难度趋势
                        if (session.difficultyEncountered.length > 0) {
                            var avgDifficulty = session.difficultyEncountered.reduce(function(sum, d) {
                                return sum + d;
                            }, 0) / session.difficultyEncountered.length;

                            if (avgDifficulty > 3.5) {
                                analysis.difficultyTrend = 'increasing';
                                analysis.recommendations.push('建议选择稍微简单一些的内容');
                            } else if (avgDifficulty < 2.5) {
                                analysis.difficultyTrend = 'decreasing';
                                analysis.recommendations.push('可以尝试更有挑战性的内容');
                            }
                        }

                        // 估算理解程度
                        if (analysis.lookupRate < 0.02) {
                            analysis.comprehensionEstimate = 0.9;
                        } else if (analysis.lookupRate > 0.05) {
                            analysis.comprehensionEstimate = 0.5;
                        }

                        return analysis;
                    },

                    generateLearningTip: function(word, stats, profile) {
                        var tips = [
                            '这个词在 ' + stats.articleCount + ' 篇文章中出现',
                            '总共出现了 ' + stats.totalCount + ' 次',
                            '建议在阅读中注意这个词的使用场景'
                        ];

                        return tips[Math.floor(Math.random() * tips.length)];
                    }
                };
            }

            // 🔧 内部方法 - 分析引擎和状态管理

            function startAnalysisEngine() {
                // 尝试从缓存恢复
                restoreFromCache();

                analysisState.isInitialized = true;
                analysisState.lastAnalysisTime = Date.now();
            }

            function setupRealTimeAnalysis() {
                // 监听相关事件
                if (eventHub) {
                    eventHub.on('glossary:shown', function(data) {
                        self.recordWordLookup(data.word, {
                            source: 'glossary'
                        });
                    });

                    eventHub.on('audioSync:highlightUpdated', function(data) {
                        if (data.currentSubtitle && data.currentSubtitle.text) {
                            updateReadingProgress(data.currentSubtitle.text);
                        }
                    });
                }
            }

            function startRealTimeAnalysis() {
                if (realTimeTimer) {
                    clearInterval(realTimeTimer);
                }

                realTimeTimer = setInterval(function() {
                    analyzeCurrentState();
                }, config.analysisInterval);
            }

            function analyzeCurrentState() {
                try {
                    var session = realTimeData.currentSession;
                    session.timeSpent = Date.now() - session.startTime;

                    // 分析当前状态
                    var currentAnalysis = realTimeAnalyzer.analyzeSession(session);

                    // 触发实时分析事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:realTimeAnalysis', currentAnalysis);
                    }

                    // 检查是否需要建议
                    if (currentAnalysis.recommendations.length > 0) {
                        eventHub.emit('wordFreq:suggestions', {
                            recommendations: currentAnalysis.recommendations,
                            urgent: currentAnalysis.lookupRate > 0.08
                        });
                    }

                } catch (error) {
                    handleError('analyzeCurrentState', error);
                }
            }

            function processArticlesSequentially(articles) {
                var index = 0;

                function processNext() {
                    if (index >= articles.length) {
                        // 所有文章处理完成
                        analysisState.isAnalyzing = false;
                        analysisState.currentProgress = 100;

                        // 保存分析结果
                        saveToCache();

                        // 触发完成事件
                        if (eventHub) {
                            eventHub.emit('wordFreq:analysisComplete', {
                                totalArticles: articles.length,
                                processedArticles: analysisState.processedArticles,
                                totalWords: Object.keys(wordStats).length
                            });
                        }

                        return;
                    }

                    var article = articles[index];

                    try {
                        // 分析文章
                        var result = frequencyAnalyzer.analyzeText(
                            article.content,
                            article.id,
                            article.title
                        );

                        analysisState.processedArticles++;
                        analysisState.currentProgress = Math.round(
                            (analysisState.processedArticles / articles.length) * 100
                        );

                        // 触发进度事件
                        if (eventHub) {
                            eventHub.emit('wordFreq:progress', {
                                progress: analysisState.currentProgress,
                                currentArticle: article.title,
                                processed: analysisState.processedArticles,
                                total: articles.length
                            });
                        }

                    } catch (error) {
                        console.warn('[WordFrequencyCore] 分析文章失败:', article.id, error);
                    }

                    index++;

                    // 异步处理下一篇，避免阻塞
                    setTimeout(processNext, 10);
                }

                processNext();
            }

            function updateReadingProgress(text) {
                if (!realTimeData.currentSession.startTime) return;

                var words = frequencyAnalyzer.extractWords(text);
                realTimeData.currentSession.wordsRead += words.length;

                // 分析遇到的词汇难度
                for (var i = 0; i < words.length; i++) {
                    var word = words[i];
                    if (frequencyAnalyzer.isValidWord(word)) {
                        var stem = wordStemmer.getStem(word);
                        var stats = wordStats[stem];
                        if (stats) {
                            var difficulty = frequencyAnalyzer.convertScoreToDifficulty(stats.distributionScore);
                            realTimeData.currentSession.difficultyEncountered.push(difficulty);
                        }
                    }
                }
            }

            function updateUserProfile(sessionAnalysis) {
                if (!sessionAnalysis) return;

                // 更新阅读速度
                if (sessionAnalysis.wordsPerMinute > 0) {
                    userProfile.readingSpeed = (userProfile.readingSpeed * 0.8) + (sessionAnalysis.wordsPerMinute * 0.2);
                }

                // 更新理解水平
                userProfile.comprehensionLevel = (userProfile.comprehensionLevel * 0.8) +
                    (sessionAnalysis.comprehensionEstimate * 0.2);

                // 保存用户档案
                saveUserProfile();
            }

            function updateUserBehavior(action, data) {
                userProfile.learningHistory.push({
                    action: action,
                    word: data.word,
                    timestamp: Date.now(),
                    difficulty: data.difficulty
                });

                // 限制历史记录大小
                if (userProfile.learningHistory.length > 1000) {
                    userProfile.learningHistory = userProfile.learningHistory.slice(-500);
                }

                saveUserProfile();
            }

            // 🔧 内部方法 - 状态持久化

            function restoreUserProfile() {
                try {
                    if (stateManager) {
                        var savedProfile = stateManager.getState('wordFreq.userProfile');
                        if (savedProfile) {
                            for (var key in savedProfile) {
                                if (savedProfile.hasOwnProperty(key)) {
                                    userProfile[key] = savedProfile[key];
                                }

                            }
                        }
                    } catch (error) {
                        console.warn('[WordFrequencyCore] 用户档案恢复失败:', error);
                    }
                }

                function saveUserProfile() {
                    try {
                        if (stateManager) {
                            stateManager.setState('wordFreq.userProfile', userProfile, true);
                        }
                    } catch (error) {
                        console.warn('[WordFrequencyCore] 用户档案保存失败:', error);
                    }
                }

                function restoreFromCache() {
                    try {
                        if (cacheManager) {
                            var cachedData = cacheManager.cache(config.cacheKey);
                            if (cachedData && isCacheValid(cachedData)) {
                                wordStats = cachedData.wordStats || {};
                                articleContents = cachedData.articleContents || {};

                                console.log('[WordFrequencyCore] 从缓存恢复数据成功');
                                return true;
                            }
                        }
                    } catch (error) {
                        console.warn('[WordFrequencyCore] 缓存恢复失败:', error);
                    }
                    return false;
                }

                function saveToCache() {
                    try {
                        if (cacheManager) {
                            var cacheData = {
                                wordStats: wordStats,
                                articleContents: articleContents,
                                timestamp: Date.now(),
                                version: '1.0'
                            };

                            cacheManager.cache(config.cacheKey, cacheData, config.cacheTimeout);
                            console.log('[WordFrequencyCore] 分析结果已缓存');
                        }
                    } catch (error) {
                        console.warn('[WordFrequencyCore] 缓存保存失败:', error);
                    }
                }

                function isCacheValid(cachedData) {
                    if (!cachedData || typeof cachedData !== 'object') {
                        return false;
                    }

                    var age = Date.now() - (cachedData.timestamp || 0);
                    return age < config.cacheTimeout;
                }

                // 🔧 内部方法 - 分析计算

                function calculateOverallProgress() {
                    var totalSessions = realTimeData.sessionHistory.length;
                    if (totalSessions === 0) return 0;

                    var recentSessions = realTimeData.sessionHistory.slice(-10);
                    var avgComprehension = recentSessions.reduce(function(sum, session) {
                        return sum + (session.comprehensionEstimate || 0.7);
                    }, 0) / recentSessions.length;

                    return Math.round(avgComprehension * 100);
                }

                function calculateVocabularyProgress() {
                    var knownWords = userProfile.strengths.length;
                    var totalWords = Object.keys(wordStats).length;

                    if (totalWords === 0) return 0;

                    return {
                        known: knownWords,
                        total: totalWords,
                        percentage: Math.round((knownWords / totalWords) * 100)
                    };
                }

                function calculateDifficultyProgress() {
                    var difficulties = {
                        1: 0,
                        2: 0,
                        3: 0,
                        4: 0,
                        5: 0
                    };

                    for (var word in wordStats) {
                        var stats = wordStats[word];
                        var difficulty = frequencyAnalyzer.convertScoreToDifficulty(stats.distributionScore);
                        difficulties[difficulty]++;
                    }

                    return difficulties;
                }

                function calculateLearningTrends() {
                    if (realTimeData.sessionHistory.length < 2) {
                        return {
                            trend: 'insufficient_data'
                        };
                    }

                    var recent = realTimeData.sessionHistory.slice(-5);
                    var older = realTimeData.sessionHistory.slice(-10, -5);

                    var recentAvg = recent.reduce(function(sum, s) {
                        return sum + (s.comprehensionEstimate || 0.7);
                    }, 0) / recent.length;

                    var olderAvg = older.reduce(function(sum, s) {
                        return sum + (s.comprehensionEstimate || 0.7);
                    }, 0) / Math.max(older.length, 1);

                    var improvement = recentAvg - olderAvg;

                    return {
                        trend: improvement > 0.05 ? 'improving' : improvement < -0.05 ? 'declining' : 'stable',
                        improvement: improvement,
                        recentPerformance: recentAvg
                    };
                }

                function generateLearningPredictions() {
                    if (!config.enablePredictiveAnalysis) return null;

                    try {
                        var predictions = {
                            nextWeekProgress: predictProgressGain(7),
                            monthlyGoal: calculateMonthlyGoal(),
                            recommendedFocus: identifyRecommendedFocus(),
                            difficultyProgression: suggestDifficultyProgression()
                        };

                        return predictions;
                    } catch (error) {
                        console.warn('[WordFrequencyCore] 预测分析失败:', error);
                        return null;
                    }
                }

                function predictProgressGain(days) {
                    var recentTrend = calculateLearningTrends();
                    if (recentTrend.trend === 'insufficient_data') {
                        return {
                            confidence: 'low',
                            estimatedGain: 5
                        };
                    }

                    var dailyGain = recentTrend.improvement * 100 / 7; // 转换为每日百分比
                    var predictedGain = dailyGain * days;

                    return {
                        confidence: Math.abs(recentTrend.improvement) > 0.1 ? 'high' : 'medium',
                        estimatedGain: Math.max(0, Math.round(predictedGain))
                    };
                }

                function calculateMonthlyGoal() {
                    var currentProgress = calculateOverallProgress();
                    var weeklyPrediction = predictProgressGain(7);
                    var monthlyGain = weeklyPrediction.estimatedGain * 4;

                    return {
                        current: currentProgress,
                        target: Math.min(100, currentProgress + monthlyGain),
                        achievable: weeklyPrediction.confidence !== 'low'
                    };
                }

                function identifyRecommendedFocus() {
                    var weakAreas = [];

                    if (userProfile.comprehensionLevel < 0.6) {
                        weakAreas.push('基础理解能力');
                    }

                    if (userProfile.readingSpeed < 150) {
                        weakAreas.push('阅读速度');
                    }

                    if (userProfile.weakSpots.length > userProfile.strengths.length) {
                        weakAreas.push('词汇掌握');
                    }

                    return weakAreas.length > 0 ? weakAreas : ['继续保持当前学习节奏'];
                }

                function suggestDifficultyProgression() {
                    var currentLevel = userProfile.preferredDifficulty;
                    var performance = calculateOverallProgress();

                    if (performance > 80 && currentLevel < 5) {
                        return {
                            suggestion: 'increase',
                            target: currentLevel + 1,
                            reason: '您的表现很好，可以尝试更有挑战性的内容'
                        };
                    } else if (performance < 60 && currentLevel > 1) {
                        return {
                            suggestion: 'decrease',
                            target: currentLevel - 1,
                            reason: '建议先巩固基础，选择稍微简单的内容'
                        };
                    } else {
                        return {
                            suggestion: 'maintain',
                            target: currentLevel,
                            reason: '当前难度很适合您，继续保持'
                        };
                    }
                }

                // 🔧 内部方法 - 辅助功能

                function handleError(context, error) {
                    var errorInfo = {
                        context: 'WordFrequencyCore:' + context,
                        message: error.message || String(error),
                        timestamp: Date.now()
                    };

                    console.error('[WordFrequencyCore:' + context + ']', error);

                    // 使用错误边界处理
                    if (errorBoundary) {
                        errorBoundary.handle(error, errorInfo);
                    }

                    // 触发错误事件
                    if (eventHub) {
                        eventHub.emit('wordFreq:error', errorInfo);
                    }
                }

                // 🔑 公开API - 基础功能

                this.getBasicWordInfo = function(word) {
                    try {
                        var stem = wordStemmer.getStem(word);
                        var stats = wordStats[stem];

                        if (!stats) return null;

                        return {
                            word: stem,
                            frequency: stats.totalCount,
                            articleCount: stats.articleCount,
                            distributionScore: stats.distributionScore,
                            difficulty: frequencyAnalyzer.convertScoreToDifficulty(stats.distributionScore),
                            variants: Object.keys(stats.variants).slice(0, 5),
                            isPersonalized: false
                        };
                    } catch (error) {
                        handleError('getBasicWordInfo', error);
                        return null;
                    }
                };

                this.getAnalysisState = function() {
                    return {
                        isInitialized: analysisState.isInitialized,
                        isAnalyzing: analysisState.isAnalyzing,
                        progress: analysisState.currentProgress,
                        processedArticles: analysisState.processedArticles,
                        totalArticles: analysisState.totalArticles,
                        totalWords: Object.keys(wordStats).length
                    };
                };

                this.getUserProfile = function() {
                    return Object.assign({}, userProfile);
                };

                this.updateUserPreference = function(key, value) {
                    try {
                        if (userProfile.hasOwnProperty(key)) {
                            userProfile[key] = value;
                            saveUserProfile();

                            // 触发偏好更新事件
                            if (eventHub) {
                                eventHub.emit('wordFreq:preferenceUpdated', {
                                    key: key,
                                    value: value,
                                    profile: userProfile
                                });
                            }

                            return true;
                        }
                        return false;
                    } catch (error) {
                        handleError('updateUserPreference', error);
                        return false;
                    }
                };

                this.destroy = function() {
                    try {
                        // 清理定时器
                        if (analysisTimer) {
                            clearInterval(analysisTimer);
                            analysisTimer = null;
                        }

                        if (realTimeTimer) {
                            clearInterval(realTimeTimer);
                            realTimeTimer = null;
                        }

                        // 保存最终状态
                        saveUserProfile();
                        saveToCache();

                        // 清理数据
                        wordStats = {};
                        articleContents = {};
                        realTimeData.sessionHistory = [];

                        // 重置状态
                        analysisState.isInitialized = false;

                        // 触发销毁事件
                        if (eventHub) {
                            eventHub.emit('wordFreq:destroyed');
                        }

                        console.log('[WordFrequencyCore] 模块已销毁');
                        return true;
                    } catch (error) {
                        handleError('destroy', error);
                        return false;
                    }
                };

                // 立即初始化
                initialize();
            }

            // 🔗 导出
            if (typeof module !== 'undefined' && module.exports) {
                module.exports = WordFrequencyCore;
            } else if (typeof global !== 'undefined') {
                global.WordFrequencyCore = WordFrequencyCore;

                // 添加到EnglishSite命名空间
                if (global.EnglishSite) {
                    global.EnglishSite.WordFrequencyCore = WordFrequencyCore;
                }
            }

        })(typeof window !== 'undefined' ? window : this);