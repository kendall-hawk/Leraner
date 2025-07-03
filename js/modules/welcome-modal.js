// js/modules/welcome-modal.js - iOS兼容版欢迎弹窗模块
// 🚀 独立欢迎弹窗系统，确保iOS Safari 12+兼容性

(function(global) {
    'use strict';

    /**
     * 🎯 WelcomeModal - 欢迎弹窗模块
     * 功能：内容管理、样式定制、用户交互、状态持久化
     * 兼容：iOS Safari 12+, Android Chrome 80+
     */
    function WelcomeModal(options) {
        options = options || {};
        
        // 配置参数
        var config = {
            // 显示设置
            showDelay: options.showDelay || 1500,          // 显示延迟(ms)
            autoHide: options.autoHide || false,           // 自动隐藏
            autoHideDelay: options.autoHideDelay || 0,     // 自动隐藏延迟(ms)
            showOnce: options.showOnce !== false,          // 只显示一次
            
            // 动画设置
            animationDuration: options.animationDuration || 300,
            animationEasing: options.animationEasing || 'ease-out',
            
            // 交互设置
            closeOnBackdropClick: options.closeOnBackdropClick !== false,
            closeOnEscape: options.closeOnEscape !== false,
            enableKeyboard: options.enableKeyboard !== false,
            
            // 内容配置
            content: options.content || getDefaultContent(),
            
            // 样式配置
            theme: options.theme || 'default',
            customCSS: options.customCSS || '',
            
            // 存储配置
            storageKey: options.storageKey || 'welcome_modal_seen',
            
            // 回调函数
            onShow: options.onShow || null,
            onHide: options.onHide || null,
            onStart: options.onStart || null,
            
            // 依赖注入
            stateManager: options.stateManager || null,
            eventHub: options.eventHub || null,
            cacheManager: options.cacheManager || null,
            errorBoundary: options.errorBoundary || null
        };
        
        // 私有变量
        var isVisible = false;
        var isAnimating = false;
        var modalElement = null;
        var eventHandlers = {};
        var isInitialized = false;
        
        // 依赖引用
        var stateManager = config.stateManager;
        var eventHub = config.eventHub;
        var cacheManager = config.cacheManager;
        var errorBoundary = config.errorBoundary;
        
        var self = this;
        
        // 🎯 初始化
        function initialize() {
            try {
                if (isInitialized) return true;
                
                // 创建DOM结构
                createModalElement();
                
                // 应用样式
                applyStyles();
                
                // 绑定事件
                bindEvents();
                
                isInitialized = true;
                
                // 触发初始化事件
                emitEvent('welcomeModal:initialized');
                
                console.log('[WelcomeModal] 模块初始化完成');
                return true;
                
            } catch (error) {
                handleError('initialize', error);
                return false;
            }
        }
        
        // 🔑 公开API
        
        /**
         * 显示欢迎弹窗
         */
        this.show = function() {
            try {
                if (!isInitialized) {
                    initialize();
                }
                
                if (isVisible || isAnimating) {
                    return false;
                }
                
                // 检查是否应该显示
                if (!shouldShow()) {
                    return false;
                }
                
                showModal();
                return true;
                
            } catch (error) {
                handleError('show', error);
                return false;
            }
        };
        
        /**
         * 隐藏欢迎弹窗
         */
        this.hide = function() {
            try {
                if (!isVisible || isAnimating) {
                    return false;
                }
                
                hideModal();
                return true;
                
            } catch (error) {
                handleError('hide', error);
                return false;
            }
        };
        
        /**
         * 更新内容
         */
        this.updateContent = function(newContent) {
            try {
                config.content = Object.assign({}, config.content, newContent);
                
                if (modalElement) {
                    updateModalContent();
                }
                
                // 触发内容更新事件
                emitEvent('welcomeModal:contentUpdated', newContent);
                
                return true;
            } catch (error) {
                handleError('updateContent', error);
                return false;
            }
        };
        
        /**
         * 更新样式主题
         */
        this.setTheme = function(theme) {
            try {
                config.theme = theme;
                
                if (modalElement) {
                    applyTheme();
                }
                
                return true;
            } catch (error) {
                handleError('setTheme', error);
                return false;
            }
        };
        
        /**
         * 重置显示状态
         */
        this.reset = function() {
            try {
                clearSeenFlag();
                
                // 触发重置事件
                emitEvent('welcomeModal:reset');
                
                return true;
            } catch (error) {
                handleError('reset', error);
                return false;
            }
        };
        
        /**
         * 获取当前状态
         */
        this.getState = function() {
            return {
                isVisible: isVisible,
                isAnimating: isAnimating,
                isInitialized: isInitialized,
                hasSeen: hasSeenBefore(),
                config: config
            };
        };
        
        /**
         * 销毁模块
         */
        this.destroy = function() {
            try {
                // 隐藏弹窗
                if (isVisible) {
                    this.hide();
                }
                
                // 移除DOM元素
                if (modalElement && modalElement.parentNode) {
                    modalElement.parentNode.removeChild(modalElement);
                    modalElement = null;
                }
                
                // 清理事件监听器
                unbindEvents();
                
                // 清理状态
                isInitialized = false;
                
                // 触发销毁事件
                emitEvent('welcomeModal:destroyed');
                
                console.log('[WelcomeModal] 模块已销毁');
                return true;
                
            } catch (error) {
                handleError('destroy', error);
                return false;
            }
        };
        
        // 🔧 内部方法 - DOM管理
        
        function createModalElement() {
            modalElement = document.createElement('div');
            modalElement.className = 'welcome-modal-overlay';
            modalElement.setAttribute('role', 'dialog');
            modalElement.setAttribute('aria-modal', 'true');
            modalElement.setAttribute('aria-labelledby', 'welcome-modal-title');
            
            modalElement.innerHTML = buildModalHTML();
            
            document.body.appendChild(modalElement);
        }
        
        function buildModalHTML() {
            var content = config.content;
            
            return [
                '<div class="welcome-modal-backdrop"></div>',
                '<div class="welcome-modal-container">',
                    '<div class="welcome-modal-content">',
                        // 关闭按钮
                        '<button class="welcome-modal-close" aria-label="关闭">',
                            content.closeIcon || '×',
                        '</button>',
                        
                        // 图标
                        content.icon ? '<div class="welcome-modal-icon">' + content.icon + '</div>' : '',
                        
                        // 标题
                        '<h2 class="welcome-modal-title" id="welcome-modal-title">',
                            content.title || '欢迎！',
                        '</h2>',
                        
                        // 描述
                        content.description ? '<div class="welcome-modal-description">' + content.description + '</div>' : '',
                        
                        // 特性列表
                        content.features ? buildFeaturesHTML(content.features) : '',
                        
                        // 按钮
                        '<div class="welcome-modal-actions">',
                            '<button class="welcome-modal-start-btn">',
                                content.startButtonText || 'Reading Start 🚀',
                            '</button>',
                        '</div>',
                        
                        // 提示文字
                        content.hint ? '<p class="welcome-modal-hint">' + content.hint + '</p>' : '',
                    '</div>',
                '</div>'
            ].join('');
        }
        
        function buildFeaturesHTML(features) {
            if (!Array.isArray(features) || features.length === 0) {
                return '';
            }
            
            var html = ['<div class="welcome-modal-features">'];
            
            features.forEach(function(feature) {
                html.push('<div class="welcome-modal-feature">');
                if (feature.icon) {
                    html.push('<span class="welcome-modal-feature-icon">' + feature.icon + '</span>');
                }
                html.push('<div class="welcome-modal-feature-content">');
                if (feature.title) {
                    html.push('<strong>' + feature.title + '</strong>');
                }
                if (feature.description) {
                    html.push(' - ' + feature.description);
                }
                html.push('</div></div>');
            });
            
            html.push('</div>');
            return html.join('');
        }
        
        function updateModalContent() {
            if (!modalElement) return;
            
            modalElement.innerHTML = buildModalHTML();
            bindEvents();
        }
        
        // 🎨 样式管理
        
        function applyStyles() {
            if (!modalElement) return;
            
            // 添加基础样式
            addBaseStyles();
            
            // 应用主题
            applyTheme();
            
            // 应用自定义CSS
            if (config.customCSS) {
                addCustomStyles();
            }
        }
        
        function addBaseStyles() {
            var styleId = 'welcome-modal-styles';
            if (document.getElementById(styleId)) return;
            
            var style = document.createElement('style');
            style.id = styleId;
            style.textContent = getBaseCSS();
            document.head.appendChild(style);
        }
        
        function getBaseCSS() {
            return [
                // 覆盖层
                '.welcome-modal-overlay {',
                    'position: fixed;',
                    'top: 0;',
                    'left: 0;',
                    'right: 0;',
                    'bottom: 0;',
                    'z-index: 10001;',
                    'display: none;',
                    'align-items: center;',
                    'justify-content: center;',
                    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
                    'opacity: 0;',
                    'transition: opacity ' + config.animationDuration + 'ms ' + config.animationEasing + ';',
                '}',
                
                // 背景
                '.welcome-modal-backdrop {',
                    'position: absolute;',
                    'top: 0;',
                    'left: 0;',
                    'right: 0;',
                    'bottom: 0;',
                    'background: rgba(0, 0, 0, 0.6);',
                    'backdrop-filter: blur(4px);',
                '}',
                
                // 容器
                '.welcome-modal-container {',
                    'position: relative;',
                    'z-index: 1;',
                    'margin: 20px;',
                    'transform: scale(0.9);',
                    'transition: transform ' + config.animationDuration + 'ms ' + config.animationEasing + ';',
                '}',
                
                // 内容
                '.welcome-modal-content {',
                    'background: white;',
                    'border-radius: 16px;',
                    'padding: 40px;',
                    'text-align: center;',
                    'box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);',
                    'position: relative;',
                    'max-width: 500px;',
                    'width: 100%;',
                '}',
                
                // 关闭按钮
                '.welcome-modal-close {',
                    'position: absolute;',
                    'top: 16px;',
                    'right: 16px;',
                    'background: none;',
                    'border: none;',
                    'font-size: 24px;',
                    'color: #999;',
                    'cursor: pointer;',
                    'width: 32px;',
                    'height: 32px;',
                    'border-radius: 50%;',
                    'display: flex;',
                    'align-items: center;',
                    'justify-content: center;',
                    'transition: all 200ms ease;',
                '}',
                
                '.welcome-modal-close:hover {',
                    'background: #f0f0f0;',
                    'color: #666;',
                '}',
                
                // 图标
                '.welcome-modal-icon {',
                    'font-size: 64px;',
                    'margin-bottom: 24px;',
                    'line-height: 1;',
                '}',
                
                // 标题
                '.welcome-modal-title {',
                    'color: #007AFF;',
                    'margin: 0 0 16px 0;',
                    'font-size: 28px;',
                    'font-weight: 600;',
                    'line-height: 1.2;',
                '}',
                
                // 描述
                '.welcome-modal-description {',
                    'color: #333;',
                    'font-size: 16px;',
                    'line-height: 1.6;',
                    'margin-bottom: 24px;',
                '}',
                
                // 特性列表
                '.welcome-modal-features {',
                    'text-align: left;',
                    'margin-bottom: 32px;',
                '}',
                
                '.welcome-modal-feature {',
                    'display: flex;',
                    'align-items: flex-start;',
                    'margin-bottom: 16px;',
                    'padding: 12px;',
                    'border-radius: 8px;',
                    'background: #f8f9fa;',
                '}',
                
                '.welcome-modal-feature:last-child {',
                    'margin-bottom: 0;',
                '}',
                
                '.welcome-modal-feature-icon {',
                    'margin-right: 12px;',
                    'font-size: 20px;',
                    'flex-shrink: 0;',
                '}',
                
                '.welcome-modal-feature-content {',
                    'flex: 1;',
                    'font-size: 15px;',
                    'line-height: 1.5;',
                    'color: #333;',
                '}',
                
                // 按钮
                '.welcome-modal-actions {',
                    'margin-bottom: 16px;',
                '}',
                
                '.welcome-modal-start-btn {',
                    'background: linear-gradient(135deg, #007AFF, #5856D6);',
                    'color: white;',
                    'border: none;',
                    'padding: 16px 32px;',
                    'border-radius: 12px;',
                    'font-size: 18px;',
                    'font-weight: 600;',
                    'cursor: pointer;',
                    'transition: all 200ms ease;',
                    'box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);',
                    'min-width: 180px;',
                '}',
                
                '.welcome-modal-start-btn:hover {',
                    'transform: translateY(-2px);',
                    'box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);',
                '}',
                
                '.welcome-modal-start-btn:active {',
                    'transform: translateY(0);',
                '}',
                
                // 提示文字
                '.welcome-modal-hint {',
                    'color: #999;',
                    'font-size: 14px;',
                    'margin: 0;',
                    'line-height: 1.4;',
                '}',
                
                // 显示状态
                '.welcome-modal-overlay.show {',
                    'opacity: 1;',
                '}',
                
                '.welcome-modal-overlay.show .welcome-modal-container {',
                    'transform: scale(1);',
                '}',
                
                // 移动端适配
                '@media (max-width: 767px) {',
                    '.welcome-modal-content {',
                        'margin: 0;',
                        'padding: 32px 24px;',
                        'border-radius: 16px;',
                        'max-width: calc(100vw - 32px);',
                    '}',
                    
                    '.welcome-modal-title {',
                        'font-size: 24px;',
                    '}',
                    
                    '.welcome-modal-description {',
                        'font-size: 15px;',
                    '}',
                    
                    '.welcome-modal-start-btn {',
                        'width: 100%;',
                        'font-size: 16px;',
                    '}',
                    
                    '.welcome-modal-feature-content {',
                        'font-size: 14px;',
                    '}',
                '}',
                
                // iOS安全区域适配
                '@supports (padding: max(0px)) {',
                    '.welcome-modal-content {',
                        'padding-top: max(40px, env(safe-area-inset-top) + 40px);',
                        'padding-bottom: max(40px, env(safe-area-inset-bottom) + 40px);',
                    '}',
                '}'
            ].join('\n');
        }
        
        function applyTheme() {
            if (!modalElement) return;
            
            // 移除旧主题类
            modalElement.className = modalElement.className.replace(/welcome-modal-theme-\w+/g, '');
            
            // 添加新主题类
            modalElement.classList.add('welcome-modal-theme-' + config.theme);
            
            // 应用主题样式
            addThemeStyles();
        }
        
        function addThemeStyles() {
            var themeStyleId = 'welcome-modal-theme-' + config.theme;
            if (document.getElementById(themeStyleId)) return;
            
            var style = document.createElement('style');
            style.id = themeStyleId;
            style.textContent = getThemeCSS(config.theme);
            document.head.appendChild(style);
        }
        
        function getThemeCSS(theme) {
            var themes = {
                'dark': [
                    '.welcome-modal-theme-dark .welcome-modal-content {',
                        'background: #1a1a1a;',
                        'color: white;',
                    '}',
                    '.welcome-modal-theme-dark .welcome-modal-title {',
                        'color: #64d2ff;',
                    '}',
                    '.welcome-modal-theme-dark .welcome-modal-feature {',
                        'background: #2a2a2a;',
                    '}',
                    '.welcome-modal-theme-dark .welcome-modal-feature-content {',
                        'color: #e0e0e0;',
                    '}',
                    '.welcome-modal-theme-dark .welcome-modal-close {',
                        'color: #ccc;',
                    '}',
                    '.welcome-modal-theme-dark .welcome-modal-close:hover {',
                        'background: #333;',
                        'color: white;',
                    '}'
                ].join('\n'),
                
                'minimal': [
                    '.welcome-modal-theme-minimal .welcome-modal-content {',
                        'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);',
                        'border: 1px solid #e1e5e9;',
                    '}',
                    '.welcome-modal-theme-minimal .welcome-modal-feature {',
                        'background: white;',
                        'border: 1px solid #e1e5e9;',
                    '}',
                    '.welcome-modal-theme-minimal .welcome-modal-start-btn {',
                        'background: #007AFF;',
                        'box-shadow: none;',
                    '}'
                ].join('\n'),
                
                'gradient': [
                    '.welcome-modal-theme-gradient .welcome-modal-content {',
                        'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
                        'color: white;',
                    '}',
                    '.welcome-modal-theme-gradient .welcome-modal-title {',
                        'color: white;',
                    '}',
                    '.welcome-modal-theme-gradient .welcome-modal-feature {',
                        'background: rgba(255, 255, 255, 0.1);',
                    '}',
                    '.welcome-modal-theme-gradient .welcome-modal-feature-content {',
                        'color: rgba(255, 255, 255, 0.9);',
                    '}',
                    '.welcome-modal-theme-gradient .welcome-modal-start-btn {',
                        'background: white;',
                        'color: #667eea;',
                    '}'
                ].join('\n')
            };
            
            return themes[theme] || '';
        }
        
        function addCustomStyles() {
            var customStyleId = 'welcome-modal-custom';
            var existingStyle = document.getElementById(customStyleId);
            
            if (existingStyle) {
                existingStyle.textContent = config.customCSS;
            } else {
                var style = document.createElement('style');
                style.id = customStyleId;
                style.textContent = config.customCSS;
                document.head.appendChild(style);
            }
        }
        
        // 🎭 显示隐藏逻辑
        
        function shouldShow() {
            if (!config.showOnce) {
                return true;
            }
            
            return !hasSeenBefore();
        }
        
        function hasSeenBefore() {
            try {
                if (stateManager) {
                    return stateManager.getState('user.' + config.storageKey) === true;
                } else {
                    return localStorage.getItem(config.storageKey) === 'true';
                }
            } catch (error) {
                return false;
            }
        }
        
        function markAsSeen() {
            try {
                if (stateManager) {
                    stateManager.setState('user.' + config.storageKey, true, true);
                } else {
                    localStorage.setItem(config.storageKey, 'true');
                }
            } catch (error) {
                handleError('markAsSeen', error);
            }
        }
        
        function clearSeenFlag() {
            try {
                if (stateManager) {
                    stateManager.setState('user.' + config.storageKey, false, true);
                } else {
                    localStorage.removeItem(config.storageKey);
                }
            } catch (error) {
                handleError('clearSeenFlag', error);
            }
        }
        
        function showModal() {
            if (!modalElement) return;
            
            isAnimating = true;
            
            // 显示元素
            modalElement.style.display = 'flex';
            
            // 强制重绘后添加显示类
            setTimeout(function() {
                modalElement.classList.add('show');
                
                setTimeout(function() {
                    isVisible = true;
                    isAnimating = false;
                    
                    // 设置自动隐藏
                    if (config.autoHide && config.autoHideDelay > 0) {
                        setTimeout(function() {
                            if (isVisible) {
                                self.hide();
                            }
                        }, config.autoHideDelay);
                    }
                    
                    // 触发显示回调
                    if (typeof config.onShow === 'function') {
                        config.onShow();
                    }
                    
                    // 触发显示事件
                    emitEvent('welcomeModal:shown');
                    
                }, config.animationDuration);
            }, 10);
        }
        
        function hideModal() {
            if (!modalElement) return;
            
            isAnimating = true;
            
            // 移除显示类
            modalElement.classList.remove('show');
            
            setTimeout(function() {
                modalElement.style.display = 'none';
                isVisible = false;
                isAnimating = false;
                
                // 标记为已见过
                if (config.showOnce) {
                    markAsSeen();
                }
                
                // 触发隐藏回调
                if (typeof config.onHide === 'function') {
                    config.onHide();
                }
                
                // 触发隐藏事件
                emitEvent('welcomeModal:hidden');
                
            }, config.animationDuration);
        }
        
        // 🎪 事件处理
        
        function bindEvents() {
            if (!modalElement) return;
            
            var startBtn = modalElement.querySelector('.welcome-modal-start-btn');
            var closeBtn = modalElement.querySelector('.welcome-modal-close');
            var backdrop = modalElement.querySelector('.welcome-modal-backdrop');
            
            // 开始按钮
            if (startBtn) {
                eventHandlers.startClick = handleStartClick;
                startBtn.addEventListener('click', eventHandlers.startClick);
            }
            
            // 关闭按钮
            if (closeBtn) {
                eventHandlers.closeClick = handleCloseClick;
                closeBtn.addEventListener('click', eventHandlers.closeClick);
            }
            
            // 背景点击
            if (backdrop && config.closeOnBackdropClick) {
                eventHandlers.backdropClick = handleBackdropClick;
                backdrop.addEventListener('click', eventHandlers.backdropClick);
            }
            
            // 键盘事件
            if (config.enableKeyboard) {
                eventHandlers.keydown = handleKeydown;
                document.addEventListener('keydown', eventHandlers.keydown);
            }
        }
        
        function unbindEvents() {
            // 移除所有事件监听器
            for (var event in eventHandlers) {
                if (eventHandlers.hasOwnProperty(event)) {
                    document.removeEventListener('keydown', eventHandlers[event]);
                }
            }
            eventHandlers = {};
        }
        
        function handleStartClick(e) {
            e.preventDefault();
            
            // 触发开始回调
            if (typeof config.onStart === 'function') {
                config.onStart();
            }
            
            // 触发开始事件
            emitEvent('welcomeModal:started');
            
            // 隐藏弹窗
            self.hide();
        }
        
        function handleCloseClick(e) {
            e.preventDefault();
            self.hide();
        }
        
        function handleBackdropClick(e) {
            if (e.target === e.currentTarget) {
                self.hide();
            }
        }
        
        function handleKeydown(e) {
            if (!isVisible) return;
            
            switch (e.keyCode) {
                case 27: // ESC键
                    if (config.closeOnEscape) {
                        e.preventDefault();
                        self.hide();
                    }
                    break;
                case 13: // Enter键
                    e.preventDefault();
                    handleStartClick(e);
                    break;
            }
        }
        
        // 🔧 工具方法
        
        function getDefaultContent() {
            return {
                icon: '🎯',
                title: '欢迎来到 LearnerEn!',
                description: '开始您的智能英语学习之旅',
                features: [
                    {
                        icon: '🎵',
                        title: '智能音频同步',
                        description: '实时字幕高亮，跟读更轻松'
                    },
                    {
                        icon: '📚',
                        title: '一键词汇查询',
                        description: '点击任意单词即可查看释义'
                    },
                    {
                        icon: '🧠',
                        title: '个性化学习',
                        description: 'AI分析词频，定制学习计划'
                    },
                    {
                        icon: '📱',
                        title: '移动端优化',
                        description: '专为手机学习设计'
                    }
                ],
                startButtonText: 'Reading Start 🚀',
                closeIcon: '×',
                hint: '点击任意地方或按ESC键也可关闭'
            };
        }
        
        function emitEvent(eventName, data) {
            try {
                if (eventHub) {
                    eventHub.emit(eventName, data);
                }
            } catch (error) {
                console.error('[WelcomeModal] Event emission failed:', error);
            }
        }
        
        function handleError(context, error) {
            var errorInfo = {
                context: 'WelcomeModal:' + context,
                message: error.message || String(error),
                timestamp: Date.now()
            };
            
            console.error('[WelcomeModal:' + context + ']', error);
            
            if (errorBoundary) {
                errorBoundary.handle(error, errorInfo);
            }
            
            emitEvent('welcomeModal:error', errorInfo);
        }
        
        // 自动初始化（可选）
        if (options.autoInit !== false) {
            setTimeout(initialize, 0);
        }
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WelcomeModal;
    } else if (typeof global !== 'undefined') {
        global.WelcomeModal = WelcomeModal;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.WelcomeModal = WelcomeModal;
        }
    }
    
})(typeof window !== 'undefined' ? window : this);