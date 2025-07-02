// js/utils/debug-integration.js - 调试平台集成脚本
// 🚀 无缝集成移动端调试平台到主应用

(function(global) {
    'use strict';

    /**
     * 🎯 DebugIntegration - 调试平台集成器
     * 功能：浮动调试按钮、快速访问、性能监控集成
     * 使用：在主应用中一行代码启用调试功能
     */
    function DebugIntegration() {
        var isDebugMode = false;
        var debugButton = null;
        var debugPanel = null;
        var isDebugPanelVisible = false;
        var performanceMonitor = null;
        
        // 配置
        var config = {
            enableInProduction: false,
            autoStart: false,
            hotKeys: true,
            floatingButton: true,
            miniPanel: true,
            performanceThreshold: {
                memory: 100, // MB
                fps: 30,
                loadTime: 3000 // ms
            }
        };
        
        // 性能数据收集
        var performanceData = {
            errors: [],
            warnings: [],
            metrics: {
                memory: 0,
                fps: 60,
                loadTime: 0,
                responseTime: 0
            },
            startTime: Date.now()
        };
        
        var self = this;
        
        // 🎯 初始化
        function initialize(options) {
            options = options || {};
            Object.assign(config, options);
            
            // 检查是否应该启用调试模式
            if (shouldEnableDebug()) {
                enableDebugMode();
            }
        }
        
        function shouldEnableDebug() {
            // URL参数检查
            var urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('debug') === 'true') {
                return true;
            }
            
            // localStorage检查
            try {
                if (localStorage.getItem('learner_debug_mode') === 'true') {
                    return true;
                }
            } catch (e) {}
            
            // 开发环境检查
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('dev.')) {
                return true;
            }
            
            // 生产环境配置
            if (config.enableInProduction) {
                return true;
            }
            
            return false;
        }
        
        function enableDebugMode() {
            isDebugMode = true;
            
            // 创建浮动调试按钮
            if (config.floatingButton) {
                createFloatingButton();
            }
            
            // 创建迷你调试面板
            if (config.miniPanel) {
                createMiniPanel();
            }
            
            // 绑定热键
            if (config.hotKeys) {
                bindHotKeys();
            }
            
            // 启动性能监控
            startPerformanceMonitoring();
            
            // 劫持console进行日志收集
            interceptConsole();
            
            console.log('[DebugIntegration] 调试模式已启用');
        }
        
        function createFloatingButton() {
            debugButton = document.createElement('div');
            debugButton.id = 'debug-floating-button';
            debugButton.innerHTML = '🐛';
            debugButton.style.cssText = [
                'position: fixed',
                'bottom: 20px',
                'left: 20px',
                'width: 50px',
                'height: 50px',
                'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'border: none',
                'border-radius: 50%',
                'color: white',
                'font-size: 20px',
                'cursor: pointer',
                'z-index: 10000',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)',
                'transition: all 0.3s ease',
                'user-select: none',
                '-webkit-tap-highlight-color: transparent'
            ].join(';');
            
            // 点击事件
            debugButton.addEventListener('click', function() {
                toggleDebugPanel();
            });
            
            // 长按事件
            var longPressTimer;
            debugButton.addEventListener('touchstart', function(e) {
                longPressTimer = setTimeout(function() {
                    openFullDebugPage();
                }, 1000);
            });
            
            debugButton.addEventListener('touchend', function() {
                clearTimeout(longPressTimer);
            });
            
            debugButton.addEventListener('touchmove', function() {
                clearTimeout(longPressTimer);
            });
            
            document.body.appendChild(debugButton);
        }
        
        function createMiniPanel() {
            debugPanel = document.createElement('div');
            debugPanel.id = 'debug-mini-panel';
            debugPanel.style.cssText = [
                'position: fixed',
                'bottom: 80px',
                'left: 20px',
                'width: 200px',
                'background: rgba(0, 0, 0, 0.9)',
                'color: white',
                'border-radius: 8px',
                'padding: 12px',
                'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
                'font-size: 12px',
                'z-index: 9999',
                'display: none',
                'backdrop-filter: blur(10px)',
                'border: 1px solid rgba(255, 255, 255, 0.2)'
            ].join(';');
            
            debugPanel.innerHTML = [
                '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">',
                    '<span style="font-weight: 600; color: #00ff88;">调试面板</span>',
                    '<button onclick="closeDebugPanel()" style="background: none; border: none; color: white; cursor: pointer;">×</button>',
                '</div>',
                '<div id="debug-metrics">',
                    '<div>内存: <span id="debug-memory">-- MB</span></div>',
                    '<div>FPS: <span id="debug-fps">60</span></div>',
                    '<div>错误: <span id="debug-errors">0</span></div>',
                '</div>',
                '<div style="margin-top: 8px; display: flex; gap: 4px;">',
                    '<button onclick="openFullDebugPage()" style="background: #007AFF; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">详细</button>',
                    '<button onclick="clearDebugData()" style="background: #ff3b30; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">清除</button>',
                '</div>'
            ].join('');
            
            document.body.appendChild(debugPanel);
        }
        
        function bindHotKeys() {
            document.addEventListener('keydown', function(e) {
                // Ctrl+Shift+D 切换调试面板
                if (e.ctrlKey && e.shiftKey && e.keyCode === 68) {
                    e.preventDefault();
                    toggleDebugPanel();
                }
                
                // Ctrl+Shift+F 打开完整调试页面
                if (e.ctrlKey && e.shiftKey && e.keyCode === 70) {
                    e.preventDefault();
                    openFullDebugPage();
                }
                
                // Ctrl+Shift+C 清除调试数据
                if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
                    e.preventDefault();
                    clearDebugData();
                }
            });
        }
        
        function startPerformanceMonitoring() {
            performanceMonitor = setInterval(function() {
                updatePerformanceMetrics();
            }, 1000);
            
            // 监听页面加载时间
            window.addEventListener('load', function() {
                if (performance && performance.timing) {
                    performanceData.metrics.loadTime = 
                        performance.timing.loadEventEnd - performance.timing.navigationStart;
                }
            });
        }
        
        function updatePerformanceMetrics() {
            // 内存使用
            if (performance && performance.memory) {
                performanceData.metrics.memory = 
                    Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                
                if (debugPanel && isDebugPanelVisible) {
                    document.getElementById('debug-memory').textContent = 
                        performanceData.metrics.memory + ' MB';
                }
                
                // 内存警告
                if (performanceData.metrics.memory > config.performanceThreshold.memory) {
                    addWarning('内存使用过高: ' + performanceData.metrics.memory + 'MB');
                }
            }
            
            // FPS监控
            measureFPS();
            
            // 更新调试面板
            if (debugPanel && isDebugPanelVisible) {
                updateMiniPanelMetrics();
            }
        }
        
        function measureFPS() {
            var now = performance.now();
            if (this.lastFrame) {
                var fps = Math.round(1000 / (now - this.lastFrame));
                performanceData.metrics.fps = fps;
                
                if (debugPanel && isDebugPanelVisible) {
                    document.getElementById('debug-fps').textContent = fps;
                }
                
                // FPS警告
                if (fps < config.performanceThreshold.fps) {
                    addWarning('FPS过低: ' + fps);
                }
            }
            this.lastFrame = now;
            
            requestAnimationFrame(measureFPS.bind(this));
        }
        
        function updateMiniPanelMetrics() {
            document.getElementById('debug-errors').textContent = performanceData.errors.length;
        }
        
        function interceptConsole() {
            var originalError = console.error;
            var originalWarn = console.warn;
            
            console.error = function() {
                addError(Array.prototype.slice.call(arguments).join(' '));
                return originalError.apply(console, arguments);
            };
            
            console.warn = function() {
                addWarning(Array.prototype.slice.call(arguments).join(' '));
                return originalWarn.apply(console, arguments);
            };
        }
        
        function addError(message) {
            performanceData.errors.push({
                type: 'error',
                message: message,
                timestamp: Date.now()
            });
            
            // 限制错误数量
            if (performanceData.errors.length > 50) {
                performanceData.errors.shift();
            }
        }
        
        function addWarning(message) {
            // 避免重复警告
            var recentWarnings = performanceData.warnings.filter(function(w) {
                return Date.now() - w.timestamp < 5000; // 5秒内
            });
            
            var isDuplicate = recentWarnings.some(function(w) {
                return w.message === message;
            });
            
            if (!isDuplicate) {
                performanceData.warnings.push({
                    type: 'warning',
                    message: message,
                    timestamp: Date.now()
                });
                
                // 限制警告数量
                if (performanceData.warnings.length > 20) {
                    performanceData.warnings.shift();
                }
            }
        }
        
        // 公开API
        this.enable = function(options) {
            initialize(options);
        };
        
        this.disable = function() {
            isDebugMode = false;
            
            if (debugButton && debugButton.parentNode) {
                debugButton.parentNode.removeChild(debugButton);
            }
            
            if (debugPanel && debugPanel.parentNode) {
                debugPanel.parentNode.removeChild(debugPanel);
            }
            
            if (performanceMonitor) {
                clearInterval(performanceMonitor);
            }
        };
        
        this.getMetrics = function() {
            return {
                metrics: performanceData.metrics,
                errors: performanceData.errors,
                warnings: performanceData.warnings,
                uptime: Date.now() - performanceData.startTime
            };
        };
        
        this.openDebugPage = function() {
            openFullDebugPage();
        };
        
        this.isEnabled = function() {
            return isDebugMode;
        };
        
        // 全局函数（供HTML调用）
        global.toggleDebugPanel = function() {
            if (!debugPanel) return;
            
            isDebugPanelVisible = !isDebugPanelVisible;
            debugPanel.style.display = isDebugPanelVisible ? 'block' : 'none';
            
            if (isDebugPanelVisible) {
                updateMiniPanelMetrics();
            }
        };
        
        global.closeDebugPanel = function() {
            if (debugPanel) {
                debugPanel.style.display = 'none';
                isDebugPanelVisible = false;
            }
        };
        
        global.openFullDebugPage = function() {
            // 在新窗口中打开完整调试页面
            var debugWindow = window.open('debug.html', 'LearnerDebug', 
                'width=375,height=667,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
                
            if (!debugWindow) {
                // 如果弹窗被阻止，则在当前页面打开
                window.location.href = 'debug.html';
            }
        };
        
        global.clearDebugData = function() {
            performanceData.errors = [];
            performanceData.warnings = [];
            
            if (isDebugPanelVisible) {
                updateMiniPanelMetrics();
            }
            
            console.log('[DebugIntegration] 调试数据已清除');
        };
        
        // 自动初始化
        if (config.autoStart) {
            initialize();
        }
    }
    
    // 创建全局实例
    var debugIntegration = new DebugIntegration();
    
    // 导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = debugIntegration;
    } else if (typeof global !== 'undefined') {
        global.DebugIntegration = debugIntegration;
        
        // 添加到EnglishSite命名空间
        if (global.EnglishSite) {
            global.EnglishSite.DebugIntegration = debugIntegration;
        }
        
        // 快捷访问
        global.enableDebug = function(options) {
            debugIntegration.enable(options);
        };
        
        global.disableDebug = function() {
            debugIntegration.disable();
        };
    }
    
})(typeof window !== 'undefined' ? window : this);