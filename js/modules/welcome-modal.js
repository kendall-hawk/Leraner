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
            showDelay: options.showDelay || 1500,
            showOnce: options.showOnce !== false,
            autoHide: options.autoHide || false,
            autoHideDelay: options.autoHideDelay || 0,
            
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
                
                console.log('[WelcomeModal] 模块初始化完成');
                return true;
                
            } catch (error) {
                console.error('[WelcomeModal] 初始化失败:', error);
                return false;
            }
        }
        
        // 🔑 公开API
        
        this.show = function() {
            try {
                if (!isInitialized) {
                    initialize();
                }
                
                if (isVisible || isAnimating) {
                    return false;
                }
                
                if (!shouldShow()) {
                    return false;
                }
                
                showModal();
                return true;
                
            } catch (error) {
                console.error('[WelcomeModal] 显示失败:', error);
                return false;
            }
        };
        
        this.hide = function() {
            try {
                if (!isVisible || isAnimating) {
                    return false;
                }
                
                hideModal();
                return true;
                
            } catch (error) {
                console.error('[WelcomeModal] 隐藏失败:', error);
                return false;
            }
        };
        
        this.reset = function() {
            try {
                clearSeenFlag();
                console.log('[WelcomeModal] 状态已重置');
                return true;
            } catch (error) {
                console.error('[WelcomeModal] 重置失败:', error);
                return false;
            }
        };
        
        this.getState = function() {
            return {
                isVisible: isVisible,
                isAnimating: isAnimating,
                isInitialized: isInitialized,
                hasSeen: hasSeenBefore(),
                config: config
            };
        };
        
        this.destroy = function() {
            try {
                if (isVisible) {
                    this.hide();
                }
                
                if (modalElement && modalElement.parentNode) {
                    modalElement.parentNode.removeChild(modalElement);
                    modalElement = null;
                }
                
                unbindEvents();
                isInitialized = false;
                
                console.log('[WelcomeModal] 模块已销毁');
                return true;
                
            } catch (error) {
                console.error('[WelcomeModal] 销毁失败:', error);
                return false;
            }
        };
        
        // 🔧 内部方法
        
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
                        '<button class="welcome-modal-close" aria-label="关闭">×</button>',
                        content.icon ? '<div class="welcome-modal-icon">' + content.icon + '</div>' : '',
                        '<h2 class="welcome-modal-title" id="welcome-modal-title">' + (content.title || '欢迎！') + '</h2>',
                        content.description ? '<div class="welcome-modal-description">' + content.description + '</div>' : '',
                        content.features ? buildFeaturesHTML(content.features) : '',
                        '<div class="welcome-modal-actions">',
                            '<button class="welcome-modal-start-btn">' + (content.startButtonText || 'Reading Start 🚀') + '</button>',
                        '</div>',
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
            })
            
            html.push('</div>');
            return html.join('');
        }
        
        function applyStyles() {
            if (!modalElement) return;
            
            var styleId = 'welcome-modal-styles';
            if (document.getElementById(styleId)) return;
            
            var style = document.createElement('style');
            style.id = styleId;
            style.textContent = getBaseCSS();
            document.head.appendChild(style);
        }
        
        function getBaseCSS() {
            return [
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
                    'font-family: -apple-system, BlinkMacSystemFont, sans-serif;',
                    'opacity: 0;',
                    'transition: opacity 300ms ease-out;',
                '}',
                
                '.welcome-modal-backdrop {',
                    'position: absolute;',
                    'top: 0;',
                    'left: 0;',
                    'right: 0;',
                    'bottom: 0;',
                    'background: rgba(0, 0, 0, 0.6);',
                '}',
                
                '.welcome-modal-container {',
                    'position: relative;',
                    'z-index: 1;',
                    'margin: 20px;',
                    'transform: scale(0.9);',
                    'transition: transform 300ms ease-out;',
                '}',
                
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
                
                '.welcome-modal-icon {',
                    'font-size: 64px;',
                    'margin-bottom: 24px;',
                    'line-height: 1;',
                '}',
                
                '.welcome-modal-title {',
                    'color: #007AFF;',
                    'margin: 0 0 16px 0;',
                    'font-size: 28px;',
                    'font-weight: 600;',
                    'line-height: 1.2;',
                '}',
                
                '.welcome-modal-description {',
                    'color: #333;',
                    'font-size: 16px;',
                    'line-height: 1.6;',
                    'margin-bottom: 24px;',
                '}',
                
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
                
                '.welcome-modal-hint {',
                    'color: #999;',
                    'font-size: 14px;',
                    'margin: 0;',
                    'line-height: 1.4;',
                '}',
                
                '.welcome-modal-overlay.show {',
                    'opacity: 1;',
                '}',
                
                '.welcome-modal-overlay.show .welcome-modal-container {',
                    'transform: scale(1);',
                '}',
                
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
                '}'
            ].join('\n');
        }
        
        function shouldShow() {
            if (!config.showOnce) {
                return true;
            }
            return !hasSeenBefore();
        }
        
        function hasSeenBefore() {
            try {
                return localStorage.getItem(config.storageKey) === 'true';
            } catch (error) {
                return false;
            }
        }
        
        function markAsSeen() {
            try {
                localStorage.setItem(config.storageKey, 'true');
            } catch (error) {
                console.warn('[WelcomeModal] 无法保存状态:', error);
            }
        }
        
        function clearSeenFlag() {
            try {
                localStorage.removeItem(config.storageKey);
            } catch (error) {
                console.warn('[WelcomeModal] 无法清除状态:', error);
            }
        }
        
        function showModal() {
            if (!modalElement) return;
            
            isAnimating = true;
            modalElement.style.display = 'flex';
            
            setTimeout(function() {
                modalElement.classList.add('show');
                
                setTimeout(function() {
                    isVisible = true;
                    isAnimating = false;
                    
                    if (typeof config.onShow === 'function') {
                        config.onShow();
                    }
                    
                }, config.animationDuration);
            }, 10);
        }
        
        function hideModal() {
            if (!modalElement) return;
            
            isAnimating = true;
            modalElement.classList.remove('show');
            
            setTimeout(function() {
                modalElement.style.display = 'none';
                isVisible = false;
                isAnimating = false;
                
                if (config.showOnce) {
                    markAsSeen();
                }
                
                if (typeof config.onHide === 'function') {
                    config.onHide();
                }
                
            }, config.animationDuration);
        }
        
        function bindEvents() {
            if (!modalElement) return;
            
            var startBtn = modalElement.querySelector('.welcome-modal-start-btn');
            var closeBtn = modalElement.querySelector('.welcome-modal-close');
            var backdrop = modalElement.querySelector('.welcome-modal-backdrop');
            
            if (startBtn) {
                startBtn.addEventListener('click', function() {
                    if (typeof config.onStart === 'function') {
                        config.onStart();
                    }
                    self.hide();
                });
            }
            
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    self.hide();
                });
            }
            
            if (backdrop && config.closeOnBackdropClick) {
                backdrop.addEventListener('click', function() {
                    self.hide();
                });
            }
            
            if (config.enableKeyboard) {
                eventHandlers.keydown = function(e) {
                    if (!isVisible) return;
                    if (e.keyCode === 27) { // ESC键
                        self.hide();
                    }
                };
                document.addEventListener('keydown', eventHandlers.keydown);
            }
        }
        
        function unbindEvents() {
            if (eventHandlers.keydown) {
                document.removeEventListener('keydown', eventHandlers.keydown);
            }
            eventHandlers = {};
        }
        
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
                hint: '点击任意地方或按ESC键也可关闭'
            };
        }
        
        // 自动初始化
        if (options.autoInit !== false) {
            setTimeout(initialize, 0);
        }
    }
    
    // 🔗 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WelcomeModal;
    } else if (typeof global !== 'undefined') {
        // 创建命名空间
        if (!global.EnglishSite) {
            global.EnglishSite = {};
        }
        global.EnglishSite.WelcomeModal = WelcomeModal;
        
        console.log('[WelcomeModal] 模块已注册到 window.EnglishSite.WelcomeModal');
    }
    
})(typeof window !== 'undefined' ? window : this);