/**
 * Qwen Canvas Workbench - Background Script
 * 负责侧边栏管理和消息处理
 * @version 2.0.0
 */

// ==================== 全屏窗口管理 ====================
/**
 * 点击插件图标时打开全屏窗口
 * 使用 chrome.windows.create 创建最大化窗口
 */
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // 获取当前屏幕尺寸
        const screenInfo = await chrome.windows.getCurrent();

        // 创建最大化窗口，加载 sidepanel.html
        const window = await chrome.windows.create({
            url: 'sidepanel.html',
            type: 'normal',
            width: Math.floor(screenInfo.width * 0.9),  // 90% 屏幕宽度
            height: Math.floor(screenInfo.height * 0.9), // 90% 屏幕高度
            left: Math.floor(screenInfo.left + (screenInfo.width * 0.05)),
            top: Math.floor(screenInfo.top + (screenInfo.height * 0.05)),
            focused: true,
            // 注意：Chrome MV3 不支持 maximized 状态直接设置，
            // 可以通过设置 width/height 为屏幕尺寸来实现类似效果
        });

        console.log('Fullscreen window created:', window.id);
    } catch (error) {
        console.error('Failed to create window:', error);
        // 如果创建窗口失败，回退到侧边栏模式
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
            console.error('Failed to set panel behavior:', err);
        });
    }
});

// 保留侧边栏作为备用方案（当窗口创建失败时）
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    // 静默处理，因为主要使用窗口模式
});

// ==================== 类型定义 ====================
/**
 * @typedef {Object} MessageRequest
 * @property {string} action - 操作类型
 * @property {string} [type] - 数据类型 (sketch|style|mask)
 * @property {string} [imageData] - Base64 图片数据
 * @property {string} [maskData] - Base64 蒙版数据
 * @property {string} [prompt] - 提示词
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} success - 是否成功
 * @property {string} [error] - 错误信息
 * @property {Object} [data] - 返回数据
 */

/**
 * @typedef {(response: MessageResponse) => void} SendResponseCallback
 */

// ==================== 常量配置 (统一 SNAKE_CASE) ====================
const ALLOWED_ACTIONS = ['sendToGemini', 'getActiveTab', 'ping'];
const GEMINI_DOMAINS = ['gemini.google.com', 'aistudio.google.com'];
const MAX_CONTENT_SCRIPT_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 100;
const MESSAGE_TIMEOUT_MS = 30000; // 增加到30秒
const PING_TIMEOUT_MS = 2000; // 增加到2秒

// ==================== 消息路由 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        // 验证消息来源
        if (!isValidSender(sender)) {
            console.warn('Blocked message from untrusted source:', sender.url);
            sendResponse({ success: false, error: 'Untrusted source' });
            return false;
        }

        // 验证请求格式
        if (!isValidRequest(request)) {
            sendResponse({ success: false, error: 'Invalid request format' });
            return false;
        }

        console.log('Background received message:', request.action);

        switch (request.action) {
            case 'sendToGemini':
                handleSendToGemini(request, sendResponse);
                return true; // 异步处理，保持通道开放

            case 'getActiveTab':
                handleGetActiveTab(sendResponse);
                return true; // 异步处理，保持通道开放

            case 'ping':
                sendResponse({ success: true, message: 'Background script active' });
                return false; // 同步响应，关闭通道

            default:
                sendResponse({ success: false, error: 'Unknown action' });
                return false;
        }
    } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
        return false;
    }
});

// ==================== 验证函数 ====================
/**
 * 验证消息来源是否可信
 * @param {Object} sender - Chrome 扩展消息发送者对象
 * @returns {boolean}
 */
function isValidSender(sender) {
    try {
        const extensionId = chrome.runtime.id;

        // 验证 sender.id（最可靠）
        if (sender.id && sender.id === extensionId) {
            return true;
        }

        // 允许来自扩展内部的消息
        if (!sender.url) {
            return true;
        }

        // 检查是否来自扩展本身
        if (sender.url.startsWith(`chrome-extension://${extensionId}`)) {
            return true;
        }

        // 检查是否来自 Gemini 页面
        return isGeminiUrl(sender.url);
    } catch (e) {
        console.error('Sender validation error:', e);
        return false;
    }
}

/**
 * 检查 URL 是否是 Gemini 页面
 * @param {string} url
 * @returns {boolean}
 */
function isGeminiUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    try {
        const urlObj = new URL(url);
        return GEMINI_DOMAINS.includes(urlObj.hostname);
    } catch {
        return false;
    }
}

/**
 * 验证请求格式是否有效
 * @param {Object} request - 请求对象
 * @returns {boolean}
 */
function isValidRequest(request) {
    if (!request || typeof request !== 'object') {
        return false;
    }

    if (!request.action || typeof request.action !== 'string') {
        return false;
    }

    return ALLOWED_ACTIONS.includes(request.action);
}

/**
 * 验证 sendToGemini 请求的具体内容
 * @param {Object} request
 * @returns {{valid: boolean, error?: string}}
 */
function validateSendToGeminiRequest(request) {
    const validTypes = ['sketch', 'style', 'mask'];

    if (!request.type || !validTypes.includes(request.type)) {
        return { valid: false, error: 'Invalid or missing type' };
    }

    if (!request.imageData || typeof request.imageData !== 'string') {
        return { valid: false, error: 'Invalid or missing imageData' };
    }

    if (request.type === 'mask' && (!request.maskData || typeof request.maskData !== 'string')) {
        return { valid: false, error: 'Invalid or missing maskData for mask type' };
    }

    return { valid: true };
}

// ==================== 核心功能：发送到 Gemini ====================
/**
 * 处理发送到 Gemini 的请求
 * @param {MessageRequest} request
 * @param {SendResponseCallback} sendResponse
 */
async function handleSendToGemini(request, sendResponse) {
    try {
        // 验证请求内容
        const validation = validateSendToGeminiRequest(request);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // 获取当前活动的 Gemini 标签页
        const geminiTab = await findGeminiTab();

        if (!geminiTab) {
            throw new Error('Please open Gemini webpage (gemini.google.com) first');
        }

        // 发送消息到 content script
        await sendToContentScript(geminiTab.id, request);

        sendResponse({ success: true });
    } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 查找 Gemini 标签页
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function findGeminiTab() {
    try {
        // 使用正确的 Match Pattern 格式查询
        const matchPatterns = GEMINI_DOMAINS.map(domain => `*://${domain}/*`);

        const geminiTabs = await chrome.tabs.query({
            url: matchPatterns
        });

        if (geminiTabs.length > 0) {
            return geminiTabs[0];
        }

        // 查找当前活动标签页
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length === 0) {
            return null;
        }

        const activeTab = activeTabs[0];
        if (isGeminiUrl(activeTab.url)) {
            return activeTab;
        }

        return null;
    } catch (error) {
        console.error('Failed to query tabs:', error);
        return null;
    }
}

/**
 * 发送消息到 Content Script
 * @param {number} tabId
 * @param {MessageRequest} request
 * @returns {Promise<void>}
 */
async function sendToContentScript(tabId, request) {
    // 等待 content script 加载
    await waitForContentScript(tabId);

    // 发送消息（带超时）
    const response = await withTimeout(
        chrome.tabs.sendMessage(tabId, request),
        MESSAGE_TIMEOUT_MS,
        'Content script response timeout'
    );

    // 验证响应结构
    if (!response || typeof response !== 'object') {
        throw new Error('Invalid response structure from content script');
    }

    // 处理失败响应
    if (!response.success) {
        const errorMsg = response.error || 'Content script processing failed';
        throw new Error(errorMsg);
    }
}

/**
 * 带超时的 Promise 包装器
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} timeoutMessage
 * @returns {Promise<T>}
 */
function withTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}

/**
 * 等待 Content Script 加载完成（指数退避）
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function waitForContentScript(tabId) {
    for (let attempt = 0; attempt < MAX_CONTENT_SCRIPT_RETRIES; attempt++) {
        try {
            const response = await withTimeout(
                chrome.tabs.sendMessage(tabId, { action: 'ping' }),
                PING_TIMEOUT_MS,
                'Ping timeout'
            );

            if (response?.success) {
                return; // Content script 已加载
            }
        } catch (e) {
            // 最后一次尝试：注入脚本
            if (attempt === MAX_CONTENT_SCRIPT_RETRIES - 1) {
                console.log('Injecting content script...');
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    });
                    // 等待脚本初始化
                    await delay(BASE_RETRY_DELAY_MS * 4);
                } catch (injectError) {
                    throw new Error(`Failed to inject content script: ${injectError.message}`);
                }
            } else {
                // 指数退避（上限 2 秒）
                const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(1.5, attempt), 2000);
                await delay(delayMs);
            }
        }
    }
}

// ==================== 获取活动标签页 ====================
/**
 * 获取当前活动标签页
 * @param {SendResponseCallback} sendResponse
 */
async function handleGetActiveTab(sendResponse) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            throw new Error('No active tab found');
        }
        sendResponse({ success: true, tab: tabs[0] });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// ==================== 工具函数 ====================
/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 安装/更新处理 ====================
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Qwen Canvas Workbench installed/updated:', details.reason);

    try {
        chrome.contextMenus.create({
            id: 'sendToQwen',
            title: 'Send to Qwen Canvas Workbench',
            contexts: ['image']
        }, () => {
            if (chrome.runtime.lastError) {
                console.log('Context menu already exists:', chrome.runtime.lastError.message);
            }
        });
    } catch (error) {
        console.error('Failed to create context menu:', error);
    }
});

// ==================== 右键菜单处理 ====================
chrome.contextMenus.onClicked.addListener((info, tab) => {
    try {
        if (info.menuItemId === 'sendToQwen' && info.srcUrl) {
            console.log('Context menu clicked for image:', info.srcUrl);
        }
    } catch (error) {
        console.error('Context menu handler error:', error);
    }
});

// ==================== 错误处理 ====================
globalThis.addEventListener('error', (event) => {
    console.error('Background script error:', event.error);
});

globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
