// js/modules/audio-sync-core.js - iOS兼容版音频同步核心
// 🚀 SRT字幕同步系统，确保iOS Safari 12+兼容性

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
        try {
            return JSON.parse(str);
        } catch (error) {
            DEBUG_WARN('[AudioSyncCore] JSON解析失败:', error.message);
            return fallback || null;
        }
    }

    function safeJSONStringify(obj, fallback) {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            DEBUG_WARN('[AudioSyncCore] JSON序列化失败:', error.message);
            return fallback || '{}';
        }
    }

    /**
     * 🎯 AudioSyncCore - 音频同步核心
     * 功能：SRT解析、实时高亮、智能滚动、多策略查找、播放控制
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function AudioSyncCore(contentArea, srtText, audioPlayer, options) {
        options = options || {};
        
        // 配置参数
        var config = {
            highlightClass: options.highlightClass || 'highlighted-current',
            nextHighlightClass: options.nextHighlightClass || 'highlighted-next',
            scrollOffset: options.scrollOffset || 100,
            scrollBehavior: options.scrollBehavior || 'smooth',
            syncTolerance: options.syncTolerance || 200, // 200ms容错
            updateInterval: options.updateInterval || 100, // 100ms更新间隔
            preloadBuffer: options.preloadBuffer || 3, // 预加载3个字幕
            enableTouch: options.enableTouch !== false,
            enableKeyboard: options.enableKeyboard !== false,
            enableWheel: options.enableWheel !== false,
            cacheKey: 'audio_sync_data'
        };
        
        // 私有变量
        var srtData = [];
        var currentIndex = -1;
        var nextIndex = -1;
        var isPlaying = false;
        var isPaused = false;
        var currentTime = 0;
        var duration = 0;
        var playbackRate = 1.0;
        var volume = 1.0;
        var isMuted = false;
        
        // DOM缓存
        var elementCache = {};
        var searchStrategies = [];
        var lastHighlightedElement = null;
        var scrollTimeout = null;
        var updateTimer = null;
        
        // 🔧 事件监听器管理
        var boundEventHandlers = {};
        var isDestroyed = false;
        
        // 性能监控
        var performanceStats = {
            syncCount: 0,
            missedSyncs: 0,
            searchTime: 0,
            renderTime: 0
        };
        
        // 依赖注入
        var stateManager = null;
        var eventHub = null;
        var cacheManager = null;
        var errorBoundary = null;
        
        var self = this;
        
        // DOM元素引用
        var elements = {
            contentArea: null,
            audioPlayer: null
        };
        
        // 🎯 初始化
        function initialize() {
            try {
                if (isDestroyed) {
                    DEBUG_ERROR('[AudioSyncCore] 尝试初始化已销毁的实例');
                    return;
                }
                
                // 注入依赖
                injectDependencies();
                
                // 验证参数
                if (!contentArea) {
                    throw new Error('Content area is required');
                }
                
                if (!audioPlayer) {
                    throw new Error('Audio player is required');
                }
                
                // 获取DOM元素
                elements.contentArea = typeof contentArea === 'string' ? 
                    document.getElementById(contentArea) : contentArea;
                elements.audioPlayer = typeof audioPlayer === 'string' ? 
                    document.getElementById(audioPlayer) : audioPlayer;
                
                if (!elements.contentArea) {
                    throw new Error('Content area not found');
                }
                
                if (!elements.audioPlayer) {
                    throw new Error('Audio player not found');
                }
                
                // 初始化搜索策略
                initializeSearchStrategies();
                
                // 解析SRT数据
                if (srtText) {
                    parseSRTData(srtText);
                }
                
                // 绑定音频事件
                bindAudioEvents();
                
                // 绑定交互事件
                bindInteractionEvents();
                
                // 恢复状态
                restoreState();
                
                DEBUG_LOG('[AudioSyncCore] 初始化成功');
                
                // 触发初始化完成事件
                if (eventHub) {
                    eventHub.emit('audioSync:initialized', {
                        srtCount: srtData.length,
                        duration: duration,
                        config: config
                    });
                }
                
            } catch (error) {
                handleError('initialize', error);
            }
        }
        
        // 🔑 公开API
        
        /**
         * 加载SRT字幕数据
         * @param {string} srtContent - SRT字幕内容
         */
        this.loadSRT = function(srtContent) {
            try {
                if (isDestroyed) return false;
                
                if (typeof srtContent !== 'string') {
                    throw new Error('SRT content must be a string');
                }
                
                parseSRTData(srtContent);
                
                // 缓存SRT数据
                if (cacheManager) {
                    cacheManager.cache(config.cacheKey + ':srt', srtContent, 24 * 60 * 60 * 1000);
                }
                
                // 重新初始化同步
                resetSync();
                
                // 触发加载事件
                if (eventHub) {
                    eventHub.emit('audioSync:loaded', {
                        srtCount: srtData.length,
                        firstTimestamp: srtData.length > 0 ? srtData[0].start : 0,
                        lastTimestamp: srtData.length > 0 ? srtData[srtData.length - 1].end : 0
                    });
                }
                
                return true;
            } catch (error) {
                handleError('loadSRT', error);
                return false;
            }
        };
        
        /**
         * 开始播放
         */
        this.play = function() {
            if (isDestroyed) return false;
            
            try {
                if (elements.audioPlayer.play) {
                    var playPromise = elements.audioPlayer.play();
                    
                    // 处理Promise返回的现代浏览器
                    if (playPromise && typeof playPromise.then === 'function') {
                        playPromise.then(function() {
                            handlePlayStart();
                        }).catch(function(error) {
                            handleError('play', error);
                        });
                    } else {
                        // 处理不返回Promise的老版本浏览器
                        setTimeout(handlePlayStart, 100);
                    }
                } else {
                    throw new Error('Audio player does not support play method');
                }
                
                return true;
            } catch (error) {
                handleError('play', error);
                return false;
            }
        };
        
        /**
         * 暂停播放
         */
        this.pause = function() {
            if (isDestroyed) return false;
            
            try {
                if (elements.audioPlayer.pause) {
                    elements.audioPlayer.pause();
                    handlePlayPause();
                } else {
                    throw new Error('Audio player does not support pause method');
                }
                
                return true;
            } catch (error) {
                handleError('pause', error);
                return false;
            }
        };
        
        /**
         * 停止播放
         */
        this.stop = function() {
            if (isDestroyed) return false;
            
            try {
                this.pause();
                this.seekTo(0);
                handlePlayStop();
                
                return true;
            } catch (error) {
                handleError('stop', error);
                return false;
            }
        };
        
        /**
         * 跳转到指定时间
         * @param {number} time - 时间（秒）
         */
        this.seekTo = function(time) {
            if (isDestroyed) return false;
            
            try {
                if (typeof time !== 'number' || time < 0) {
                    throw new Error('Invalid seek time');
                }
                
                elements.audioPlayer.currentTime = time;
                currentTime = time;
                
                // 更新同步状态
                updateSyncState();
                
                // 触发跳转事件
                if (eventHub) {
                    eventHub.emit('audioSync:seeked', {
                        time: time,
                        index: currentIndex
                    });
                }
                
                return true;
            } catch (error) {
                handleError('seekTo', error);
                return false;
            }
        };
        
        /**
         * 设置播放速率
         * @param {number} rate - 播放速率
         */
        this.setPlaybackRate = function(rate) {
            if (isDestroyed) return false;
            
            try {
                if (typeof rate !== 'number' || rate <= 0) {
                    throw new Error('Invalid playback rate');
                }
                
                if (elements.audioPlayer.playbackRate !== undefined) {
                    elements.audioPlayer.playbackRate = rate;
                    playbackRate = rate;
                    
                    // 触发速率变化事件
                    if (eventHub) {
                        eventHub.emit('audioSync:rateChanged', { rate: rate });
                    }
                } else {
                    DEBUG_WARN('[AudioSyncCore] Playback rate not supported');
                }
                
                return true;
            } catch (error) {
                handleError('setPlaybackRate', error);
                return false;
            }
        };
        
        /**
         * 设置音量
         * @param {number} vol - 音量 (0-1)
         */
        this.setVolume = function(vol) {
            if (isDestroyed) return false;
            
            try {
                if (typeof vol !== 'number' || vol < 0 || vol > 1) {
                    throw new Error('Invalid volume level');
                }
                
                elements.audioPlayer.volume = vol;
                volume = vol;
                
                // 触发音量变化事件
                if (eventHub) {
                    eventHub.emit('audioSync:volumeChanged', { volume: vol });
                }
                
                return true;
            } catch (error) {
                handleError('setVolume', error);
                return false;
            }
        };
        
        /**
         * 静音/取消静音
         */
        this.toggleMute = function() {
            if (isDestroyed) return false;
            
            try {
                isMuted = !isMuted;
                elements.audioPlayer.muted = isMuted;
                
                // 触发静音状态变化事件
                if (eventHub) {
                    eventHub.emit('audioSync:muteChanged', { muted: isMuted });
                }
                
                return isMuted;
            } catch (error) {
                handleError('toggleMute', error);
                return false;
            }
        };
        
        /**
         * 跳转到指定字幕
         * @param {number} index - 字幕索引
         */
        this.seekToSubtitle = function(index) {
            if (isDestroyed) return false;
            
            try {
                if (typeof index !== 'number' || index < 0 || index >= srtData.length) {
                    throw new Error('Invalid subtitle index');
                }
                
                var subtitle = srtData[index];
                this.seekTo(subtitle.start / 1000); // 转换为秒
                
                return true;
            } catch (error) {
                handleError('seekToSubtitle', error);
                return false;
            }
        };
        
        /**
         * 获取当前状态
         */
        this.getState = function() {
            return {
                isPlaying: isPlaying,
                isPaused: isPaused,
                currentTime: currentTime,
                duration: duration,
                currentIndex: currentIndex,
                nextIndex: nextIndex,
                playbackRate: playbackRate,
                volume: volume,
                isMuted: isMuted,
                srtCount: srtData.length,
                performance: performanceStats,
                isDestroyed: isDestroyed
            };
        };
        
        /**
         * 获取字幕数据
         */
        this.getSRTData = function() {
            return srtData.slice(); // 返回副本
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
                
                // 停止播放
                this.stop();
                
                // 清理定时器
                clearUpdateTimer();
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = null;
                }
                
                // 移除事件监听器
                unbindAudioEvents();
                unbindInteractionEvents();
                
                // 清理高亮
                clearAllHighlights();
                
                // 清理缓存
                elementCache = {};
                
                // 重置变量
                srtData = [];
                currentIndex = -1;
                nextIndex = -1;
                lastHighlightedElement = null;
                
                // 清理状态
                if (stateManager) {
                    stateManager.clearState('audioSync');
                }
                
                // 触发销毁事件
                if (eventHub) {
                    eventHub.emit('audioSync:destroyed');
                }
                
                DEBUG_LOG('[AudioSyncCore] 实例已销毁');
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
        
        function parseSRTData(srtContent) {
            try {
                srtData = [];
                
                if (!srtContent || typeof srtContent !== 'string') {
                    return;
                }
                
                // 标准化换行符
                var normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                
                // 分割字幕块
                var blocks = normalizedContent.split('\n\n').filter(function(block) {
                    return block.trim().length > 0;
                });
                
                blocks.forEach(function(block, index) {
                    var subtitle = parseSRTBlock(block, index);
                    if (subtitle) {
                        srtData.push(subtitle);
                    }
                });
                
                // 按时间排序
                srtData.sort(function(a, b) {
                    return a.start - b.start;
                });
                
                // 验证时间重叠
                validateSRTTiming();
                
                DEBUG_LOG('[AudioSyncCore] SRT解析完成，共' + srtData.length + '条字幕');
                
            } catch (error) {
                handleError('parseSRTData', error);
                srtData = [];
            }
        }
        
        function parseSRTBlock(block, index) {
            try {
                var lines = block.trim().split('\n');
                
                if (lines.length < 3) {
                    DEBUG_WARN('[AudioSyncCore] Invalid SRT block at index ' + index);
                    return null;
                }
                
                // 解析序号（可选）
                var sequenceNumber = parseInt(lines[0], 10);
                if (isNaN(sequenceNumber)) {
                    // 如果第一行不是数字，可能缺少序号
                    lines.unshift(String(index + 1));
                    sequenceNumber = index + 1;
                }
                
                // 解析时间轴
                var timeString = lines[1];
                var timeMatch = timeString.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
                
                if (!timeMatch) {
                    DEBUG_WARN('[AudioSyncCore] Invalid time format at index ' + index);
                    return null;
                }
                
                var startTime = parseTimeToMilliseconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
                var endTime = parseTimeToMilliseconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
                
                // 解析文本内容
                var text = lines.slice(2).join('\n').trim();
                
                // 清理HTML标签和特殊字符
                text = cleanSubtitleText(text);
                
                return {
                    index: index,
                    sequence: sequenceNumber,
                    start: startTime,
                    end: endTime,
                    duration: endTime - startTime,
                    text: text,
                    words: text.split(/\s+/).filter(function(word) { return word.length > 0; })
                };
                
            } catch (error) {
                DEBUG_WARN('[AudioSyncCore] Error parsing SRT block at index ' + index + ':', error);
                return null;
            }
        }
        
        function parseTimeToMilliseconds(hours, minutes, seconds, milliseconds) {
            return parseInt(hours, 10) * 3600000 + 
                   parseInt(minutes, 10) * 60000 + 
                   parseInt(seconds, 10) * 1000 + 
                   parseInt(milliseconds, 10);
        }
        
        function cleanSubtitleText(text) {
            // 移除HTML标签
            text = text.replace(/<[^>]*>/g, '');
            
            // 移除SRT样式标签
            text = text.replace(/\{[^}]*\}/g, '');
            
            // 标准化空白字符
            text = text.replace(/\s+/g, ' ').trim();
            
            return text;
        }
        
        function validateSRTTiming() {
            for (var i = 0; i < srtData.length - 1; i++) {
                var current = srtData[i];
                var next = srtData[i + 1];
                
                // 检查时间重叠
                if (current.end > next.start) {
                    DEBUG_WARN('[AudioSyncCore] Timing overlap detected between subtitle ' + 
                               current.sequence + ' and ' + next.sequence);
                    
                    // 自动修正：调整结束时间
                    current.end = next.start - 1;
                    current.duration = current.end - current.start;
                }
                
                // 检查无效时间
                if (current.start >= current.end) {
                    DEBUG_WARN('[AudioSyncCore] Invalid timing for subtitle ' + current.sequence);
                }
            }
        }
        
        function initializeSearchStrategies() {
            searchStrategies = [
                // 策略1：精确文本匹配
                function(text) {
                    return elements.contentArea.querySelector('[data-text="' + text + '"]');
                },
                
                // 策略2：部分文本匹配
                function(text) {
                    var words = text.split(/\s+/).slice(0, 3); // 取前3个词
                    var selector = words.map(function(word) {
                        return '[data-text*="' + word + '"]';
                    }).join('');
                    return elements.contentArea.querySelector(selector);
                },
                
                // 策略3：文本内容查找
                function(text) {
                    var elements = Array.prototype.slice.call(
                        elements.contentArea.querySelectorAll('p, span, div')
                    );
                    
                    return elements.find(function(el) {
                        return el.textContent && el.textContent.indexOf(text) !== -1;
                    });
                },
                
                // 策略4：单词级匹配
                function(text) {
                    var words = text.split(/\s+/);
                    var firstWord = words[0];
                    
                    if (firstWord) {
                        return elements.contentArea.querySelector('[data-word="' + firstWord + '"]');
                    }
                    return null;
                },
                
                // 策略5：模糊匹配
                function(text) {
                    var elements = Array.prototype.slice.call(
                        elements.contentArea.querySelectorAll('[data-text]')
                    );
                    
                    return elements.find(function(el) {
                        var elementText = el.getAttribute('data-text') || '';
                        return calculateSimilarity(text, elementText) > 0.7;
                    });
                }
            ];
        }
        
        function calculateSimilarity(str1, str2) {
            var longer = str1.length > str2.length ? str1 : str2;
            var shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.length === 0) {
                return 1.0;
            }
            
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
        
        function bindAudioEvents() {
            if (!elements.audioPlayer || isDestroyed) return;
            
            // 创建绑定的处理器
            boundEventHandlers.timeupdate = createBoundHandler(handleTimeUpdate);
            boundEventHandlers.play = createBoundHandler(handlePlayStart);
            boundEventHandlers.pause = createBoundHandler(handlePlayPause);
            boundEventHandlers.ended = createBoundHandler(handlePlayEnd);
            boundEventHandlers.loadedmetadata = createBoundHandler(handleMetadataLoaded);
            boundEventHandlers.durationchange = createBoundHandler(handleDurationChange);
            boundEventHandlers.error = createBoundHandler(handleAudioError);
            boundEventHandlers.canplay = createBoundHandler(handleCanPlay);
            boundEventHandlers.waiting = createBoundHandler(handleWaiting);
            
            // 绑定事件
            for (var eventType in boundEventHandlers) {
                if (boundEventHandlers.hasOwnProperty(eventType)) {
                    elements.audioPlayer.addEventListener(eventType, boundEventHandlers[eventType]);
                }
            }
        }
        
        function unbindAudioEvents() {
            if (!elements.audioPlayer || !boundEventHandlers) return;
            
            for (var eventType in boundEventHandlers) {
                if (boundEventHandlers.hasOwnProperty(eventType)) {
                    try {
                        elements.audioPlayer.removeEventListener(eventType, boundEventHandlers[eventType]);
                    } catch (error) {
                        DEBUG_WARN('[AudioSyncCore] 移除事件监听器失败:', eventType, error);
                    }
                }
            }
            
            boundEventHandlers = {};
        }
        
        function bindInteractionEvents() {
            if (!elements.contentArea || isDestroyed) return;
            
            // 点击字幕跳转
            boundEventHandlers.contentClick = createBoundHandler(handleContentClick);
            elements.contentArea.addEventListener('click', boundEventHandlers.contentClick);
            
            // 键盘快捷键
            if (config.enableKeyboard && typeof document !== 'undefined') {
                boundEventHandlers.keydown = createBoundHandler(handleKeyDown);
                document.addEventListener('keydown', boundEventHandlers.keydown);
            }
            
            // 滚轮控制（桌面端）
            if (config.enableWheel) {
                boundEventHandlers.wheel = createBoundHandler(handleWheel);
                elements.contentArea.addEventListener('wheel', boundEventHandlers.wheel, 
                    checkPassiveSupport() ? { passive: false } : false);
            }
            
            // 触摸控制（移动端）
            if (config.enableTouch && 'ontouchstart' in window) {
                bindTouchControls();
            }
        }
        
        function unbindInteractionEvents() {
            if (!elements.contentArea) return;
            
            // 移除内容区域事件
            if (boundEventHandlers.contentClick) {
                elements.contentArea.removeEventListener('click', boundEventHandlers.contentClick);
            }
            
            if (boundEventHandlers.wheel) {
                elements.contentArea.removeEventListener('wheel', boundEventHandlers.wheel);
            }
            
            // 移除文档级事件
            if (typeof document !== 'undefined' && boundEventHandlers.keydown) {
                document.removeEventListener('keydown', boundEventHandlers.keydown);
            }
            
            // 移除触摸事件
            if (boundEventHandlers.touchstart) {
                elements.contentArea.removeEventListener('touchstart', boundEventHandlers.touchstart);
            }
            if (boundEventHandlers.touchend) {
                elements.contentArea.removeEventListener('touchend', boundEventHandlers.touchend);
            }
        }
        
        function bindTouchControls() {
            var touchStartX = 0;
            var touchStartY = 0;
            var touchStartTime = 0;
            
            var touchOptions = checkPassiveSupport() ? { passive: true } : false;
            
            boundEventHandlers.touchstart = createBoundHandler(function(e) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            });
            
            boundEventHandlers.touchend = createBoundHandler(function(e) {
                var touchEndX = e.changedTouches[0].clientX;
                var touchEndY = e.changedTouches[0].clientY;
                var touchEndTime = Date.now();
                
                var deltaX = touchEndX - touchStartX;
                var deltaY = touchEndY - touchStartY;
                var deltaTime = touchEndTime - touchStartTime;
                
                // 水平滑动手势
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && deltaTime < 500) {
                    if (deltaX > 0) {
                        // 右滑：后退10秒
                        self.seekTo(Math.max(0, currentTime - 10));
                    } else {
                        // 左滑：前进10秒
                        self.seekTo(Math.min(duration, currentTime + 10));
                    }
                }
                
                // 双击手势
                if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 300) {
                    // 检查是否为双击
                    var now = Date.now();
                    if (self._lastTouchTime && now - self._lastTouchTime < 300) {
                        // 双击：播放/暂停
                        if (isPlaying) {
                            self.pause();
                        } else {
                            self.play();
                        }
                    }
                    self._lastTouchTime = now;
                }
            });
            
            elements.contentArea.addEventListener('touchstart', boundEventHandlers.touchstart, touchOptions);
            elements.contentArea.addEventListener('touchend', boundEventHandlers.touchend, touchOptions);
        }
        
        function handleTimeUpdate() {
            try {
                currentTime = elements.audioPlayer.currentTime;
                updateSyncState();
            } catch (error) {
                handleError('handleTimeUpdate', error);
            }
        }
        
        function handlePlayStart() {
            isPlaying = true;
            isPaused = false;
            
            startUpdateTimer();
            
            // 更新状态
            updateState();
            
            // 触发播放事件
            if (eventHub) {
                eventHub.emit('audioSync:play', { currentTime: currentTime });
            }
        }
        
        function handlePlayPause() {
            isPlaying = false;
            isPaused = true;
            
            clearUpdateTimer();
            
            // 更新状态
            updateState();
            
            // 触发暂停事件
            if (eventHub) {
                eventHub.emit('audioSync:pause', { currentTime: currentTime });
            }
        }
        
        function handlePlayEnd() {
            isPlaying = false;
            isPaused = false;
            
            clearUpdateTimer();
            clearAllHighlights();
            
            // 重置索引
            currentIndex = -1;
            nextIndex = -1;
            
            // 更新状态
            updateState();
            
            // 触发结束事件
            if (eventHub) {
                eventHub.emit('audioSync:ended', { duration: duration });
            }
        }
        
        function handlePlayStop() {
            isPlaying = false;
            isPaused = false;
            currentTime = 0;
            currentIndex = -1;
            nextIndex = -1;
            
            clearUpdateTimer();
            clearAllHighlights();
            
            // 更新状态
            updateState();
            
            // 触发停止事件
            if (eventHub) {
                eventHub.emit('audioSync:stop');
            }
        }
        
        function handleMetadataLoaded() {
            duration = elements.audioPlayer.duration || 0;
            
            // 触发元数据加载事件
            if (eventHub) {
                eventHub.emit('audioSync:metadataLoaded', { duration: duration });
            }
        }
        
        function handleDurationChange() {
            duration = elements.audioPlayer.duration || 0;
            
            // 触发时长变化事件
            if (eventHub) {
                eventHub.emit('audioSync:durationChange', { duration: duration });
            }
        }
        
        function handleAudioError(e) {
            var error = new Error('Audio error: ' + (e.target.error ? e.target.error.message : 'Unknown error'));
            handleError('audio', error);
        }
        
        function handleCanPlay() {
            // 触发可播放事件
            if (eventHub) {
                eventHub.emit('audioSync:canPlay', { duration: duration });
            }
        }
        
        function handleWaiting() {
            // 触发缓冲事件
            if (eventHub) {
                eventHub.emit('audioSync:waiting', { currentTime: currentTime });
            }
        }
        
        function handleContentClick(e) {
            var clickedElement = e.target;
            
            // 查找包含时间信息的元素
            var timeElement = clickedElement.closest('[data-time]') || 
                             clickedElement.closest('[data-start]') ||
                             clickedElement.closest('[data-subtitle-index]');
            
            if (timeElement) {
                e.preventDefault();
                
                var time = timeElement.getAttribute('data-time') || 
                          timeElement.getAttribute('data-start');
                var index = timeElement.getAttribute('data-subtitle-index');
                
                if (time) {
                    self.seekTo(parseFloat(time));
                } else if (index) {
                    self.seekToSubtitle(parseInt(index, 10));
                }
            }
        }
        
        function handleKeyDown(e) {
            // 空格键：播放/暂停
            if (e.code === 'Space' || e.keyCode === 32) {
                e.preventDefault();
                if (isPlaying) {
                    self.pause();
                } else {
                    self.play();
                }
            }
            
            // 左箭头：后退5秒
            if (e.code === 'ArrowLeft' || e.keyCode === 37) {
                e.preventDefault();
                self.seekTo(Math.max(0, currentTime - 5));
            }
            
            // 右箭头：前进5秒
            if (e.code === 'ArrowRight' || e.keyCode === 39) {
                e.preventDefault();
                self.seekTo(Math.min(duration, currentTime + 5));
            }
            
            // 上箭头：音量增加
            if (e.code === 'ArrowUp' || e.keyCode === 38) {
                e.preventDefault();
                self.setVolume(Math.min(1, volume + 0.1));
            }
            
            // 下箭头：音量减少
            if (e.code === 'ArrowDown' || e.keyCode === 40) {
                e.preventDefault();
                self.setVolume(Math.max(0, volume - 0.1));
            }
            
            // M键：静音切换
            if (e.code === 'KeyM' || e.keyCode === 77) {
                e.preventDefault();
                self.toggleMute();
            }
        }
        
        function handleWheel(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                
                // Ctrl+滚轮：调整播放速度
                var delta = e.deltaY > 0 ? -0.1 : 0.1;
                var newRate = Math.max(0.5, Math.min(2.0, playbackRate + delta));
                self.setPlaybackRate(newRate);
            }
        }
        
        function startUpdateTimer() {
            if (isDestroyed) return;
            
            clearUpdateTimer();
            
            updateTimer = setInterval(function() {
                if (isPlaying && !isDestroyed) {
                    updateSyncState();
                }
            }, config.updateInterval);
        }
        
        function clearUpdateTimer() {
            if (updateTimer) {
                clearInterval(updateTimer);
                updateTimer = null;
            }
        }
        
        function updateSyncState() {
            if (isDestroyed) return;
            
            try {
                var currentTimeMs = currentTime * 1000;
                var newIndex = findCurrentSubtitleIndex(currentTimeMs);
                var newNextIndex = findNextSubtitleIndex(currentTimeMs);
                
                // 检查是否需要更新高亮
                if (newIndex !== currentIndex || newNextIndex !== nextIndex) {
                    updateHighlights(newIndex, newNextIndex);
                    currentIndex = newIndex;
                    nextIndex = newNextIndex;
                    
                    // 更新滚动位置
                    updateScrollPosition();
                    
                    // 更新性能统计
                    performanceStats.syncCount++;
                }
                
                // 更新状态
                updateState();
                
            } catch (error) {
                handleError('updateSyncState', error);
                performanceStats.missedSyncs++;
            }
        }
        
        function findCurrentSubtitleIndex(timeMs) {
            for (var i = 0; i < srtData.length; i++) {
                var subtitle = srtData[i];
                if (timeMs >= subtitle.start - config.syncTolerance && 
                    timeMs <= subtitle.end + config.syncTolerance) {
                    return i;
                }
            }
            return -1;
        }
        
        function findNextSubtitleIndex(timeMs) {
            for (var i = 0; i < srtData.length; i++) {
                var subtitle = srtData[i];
                if (timeMs < subtitle.start) {
                    return i;
                }
            }
            return -1;
        }
        
        function updateHighlights(newIndex, newNextIndex) {
            if (isDestroyed) return;
            
            var startTime = performance.now ? performance.now() : Date.now();
            
            try {
                // 清除旧高亮
                clearAllHighlights();
                
                // 设置当前高亮
                if (newIndex >= 0 && newIndex < srtData.length) {
                    var currentElement = findElementForSubtitle(srtData[newIndex]);
                    if (currentElement) {
                        highlightElement(currentElement, config.highlightClass);
                        lastHighlightedElement = currentElement;
                    }
                }
                
                // 设置下一个高亮（预告）
                if (newNextIndex >= 0 && newNextIndex < srtData.length) {
                    var nextElement = findElementForSubtitle(srtData[newNextIndex]);
                    if (nextElement && nextElement !== lastHighlightedElement) {
                        highlightElement(nextElement, config.nextHighlightClass);
                    }
                }
                
                // 触发高亮更新事件
                if (eventHub) {
                    eventHub.emit('audioSync:highlightUpdated', {
                        currentIndex: newIndex,
                        nextIndex: newNextIndex,
                        currentSubtitle: newIndex >= 0 ? srtData[newIndex] : null,
                        nextSubtitle: newNextIndex >= 0 ? srtData[newNextIndex] : null
                    });
                }
                
            } catch (error) {
                handleError('updateHighlights', error);
            } finally {
                var endTime = performance.now ? performance.now() : Date.now();
                performanceStats.renderTime += endTime - startTime;
            }
        }
        
        function findElementForSubtitle(subtitle) {
            var startTime = performance.now ? performance.now() : Date.now();
            
            try {
                // 先检查缓存
                var cacheKey = 'subtitle_' + subtitle.index;
                if (elementCache[cacheKey]) {
                    var cachedElement = elementCache[cacheKey];
                    // 验证缓存的元素是否仍在DOM中
                    if (cachedElement.parentNode) {
                        return cachedElement;
                    } else {
                        delete elementCache[cacheKey];
                    }
                }
                
                // 使用搜索策略查找元素
                var element = null;
                for (var i = 0; i < searchStrategies.length; i++) {
                    element = searchStrategies[i](subtitle.text);
                    if (element) {
                        break;
                    }
                }
                
                // 缓存找到的元素
                if (element) {
                    elementCache[cacheKey] = element;
                }
                
                return element;
                
            } catch (error) {
                handleError('findElementForSubtitle', error);
                return null;
            } finally {
                var endTime = performance.now ? performance.now() : Date.now();
                performanceStats.searchTime += endTime - startTime;
            }
        }
        
        function highlightElement(element, className) {
            if (element && className) {
                element.classList.add(className);
                element.setAttribute('aria-current', 'true');
            }
        }
        
        function clearAllHighlights() {
            if (isDestroyed || !elements.contentArea) return;
            
            // 清除当前高亮
            var currentHighlights = elements.contentArea.querySelectorAll('.' + config.highlightClass);
            for (var i = 0; i < currentHighlights.length; i++) {
                currentHighlights[i].classList.remove(config.highlightClass);
                currentHighlights[i].removeAttribute('aria-current');
            }
            
            // 清除下一个高亮
            var nextHighlights = elements.contentArea.querySelectorAll('.' + config.nextHighlightClass);
            for (var j = 0; j < nextHighlights.length; j++) {
                nextHighlights[j].classList.remove(config.nextHighlightClass);
            }
            
            lastHighlightedElement = null;
        }
        
        function updateScrollPosition() {
            if (!lastHighlightedElement || isDestroyed) return;
            
            // 防抖滚动
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            scrollTimeout = setTimeout(function() {
                if (!isDestroyed) {
                    scrollToElement(lastHighlightedElement);
                }
            }, 100);
        }
        
        function scrollToElement(element) {
            if (isDestroyed) return;
            
            try {
                var elementRect = element.getBoundingClientRect();
                var containerRect = elements.contentArea.getBoundingClientRect();
                
                // 检查元素是否已经可见
                var isVisible = elementRect.top >= containerRect.top + config.scrollOffset &&
                               elementRect.bottom <= containerRect.bottom - config.scrollOffset;
                
                if (!isVisible) {
                    // 计算滚动位置
                    var scrollTop = elements.contentArea.scrollTop;
                    var targetScrollTop = scrollTop + elementRect.top - containerRect.top - config.scrollOffset;
                    
                    // 平滑滚动
                    if (config.scrollBehavior === 'smooth' && elements.contentArea.scrollTo) {
                        elements.contentArea.scrollTo({
                            top: targetScrollTop,
                            behavior: 'smooth'
                        });
                    } else {
                        // 降级到立即滚动
                        elements.contentArea.scrollTop = targetScrollTop;
                    }
                }
                
            } catch (error) {
                handleError('scrollToElement', error);
            }
        }
        
        function resetSync() {
            currentIndex = -1;
            nextIndex = -1;
            clearAllHighlights();
            clearUpdateTimer();
            
            if (isPlaying) {
                startUpdateTimer();
            }
        }
        
        function updateState() {
            if (stateManager && !isDestroyed) {
                stateManager.setState('audioSync.isPlaying', isPlaying);
                stateManager.setState('audioSync.currentTime', currentTime);
                stateManager.setState('audioSync.currentIndex', currentIndex);
                stateManager.setState('audioSync.playbackRate', playbackRate);
                stateManager.setState('audioSync.volume', volume);
            }
        }
        
        function restoreState() {
            if (!stateManager) return;
            
            try {
                var savedRate = stateManager.getState('audioSync.playbackRate');
                if (savedRate && typeof savedRate === 'number') {
                    self.setPlaybackRate(savedRate);
                }
                
                var savedVolume = stateManager.getState('audioSync.volume');
                if (savedVolume && typeof savedVolume === 'number') {
                    self.setVolume(savedVolume);
                }
                
            } catch (error) {
                handleError('restoreState', error);
            }
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
        
        function handleError(context, error) {
            var errorInfo = {
                context: 'AudioSyncCore:' + context,
                message: error.message || String(error),
                timestamp: Date.now(),
                currentTime: currentTime,
                currentIndex: currentIndex
            };
            
            DEBUG_ERROR('[AudioSyncCore:' + context + ']', error);
            
            // 使用错误边界处理
            if (errorBoundary) {
                errorBoundary.handle(error, errorInfo);
            }
            
            // 触发错误事件
            if (eventHub) {
                eventHub.emit('audioSync:error', errorInfo);
            }
        }
        
        // 立即初始化
        initialize();
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AudioSyncCore;
    } else if (typeof global !== 'undefined') {
        global.AudioSyncCore = AudioSyncCore;
        
        // 🔧 安全的命名空间添加
        if (typeof global.EnglishSite === 'undefined') {
            global.EnglishSite = {};
        }
        
        // 检查是否已存在，避免覆盖
        if (!global.EnglishSite.AudioSyncCore) {
            global.EnglishSite.AudioSyncCore = AudioSyncCore;
        } else {
            DEBUG_WARN('[AudioSyncCore] EnglishSite.AudioSyncCore 已存在，跳过覆盖');
        }
    }
    
})(typeof window !== 'undefined' ? window : this);