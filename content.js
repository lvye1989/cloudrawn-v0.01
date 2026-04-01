/**
 * Gemini Canvas Workbench - Content Script
 * 负责与 Gemini 网页进行 DOM 交互，自动上传图片和填写 Prompt
 * @version 1.0.1
 */

(function () {
    'use strict';

    // ==================== 常量配置 ====================
    const MAX_RETRIES = {
        PAGE_READY: 50,
        UPLOAD_WAIT: 30
    };

    const DELAYS = {
        ELEMENT_CHECK: 100,
        UPLOAD_WAIT: 500,
        SUBMIT_WAIT: 300
    };

    const SELECTORS = {
        promptInput: [
            'textarea[placeholder*="消息"]',
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="输入"]',
            'textarea[placeholder*="Type"]',
            '[contenteditable="true"]',
            'textarea',
            'div[role="textbox"]'
        ],
        uploadInput: [
            'input[type="file"]',
            'input[accept*="image"]',
            'button[aria-label*="上传"]',
            'button[aria-label*="Upload"]',
            'button[aria-label*="附件"]',
            'button[aria-label*="Attachment"]'
        ],
        imagePreview: 'img[src^="blob:"], img[src^="data:"]',
        submitButton: 'button[type="submit"], button[aria-label*="发送"], button[aria-label*="Send"]'
    };

    // ==================== 消息监听 ====================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script received:', request.action);

        switch (request.action) {
            case 'ping':
                sendResponse({ success: true, message: 'Content script active' });
                return false;

            case 'sendToGemini':
                handleSendToGemini(request, sendResponse);
                return true; // 异步处理

            default:
                sendResponse({ success: false, error: 'Unknown action' });
                return false;
        }
    });

    // ==================== 核心处理函数 ====================
    /**
     * 处理发送到 Gemini 的请求
     * @param {Object} request
     * @param {function} sendResponse
     */
    async function handleSendToGemini(request, sendResponse) {
        try {
            const { type, imageData, maskData, prompt } = request;

            console.log(`Processing ${type} request...`);

            // 验证必要参数
            if (!type || !imageData) {
                throw new Error('Missing required parameters: type or imageData');
            }

            // 等待页面加载完成
            await waitForPageReady();

            // 根据类型处理
            switch (type) {
                case 'sketch':
                    await processSketch(imageData, prompt || '');
                    break;

                case 'style':
                    await processStyleTransfer(imageData, prompt || '');
                    break;

                case 'mask':
                    if (!maskData) {
                        throw new Error('Missing maskData for mask type');
                    }
                    await processMaskEdit(imageData, maskData, prompt || '');
                    break;

                default:
                    throw new Error(`Unknown type: ${type}`);
            }

            sendResponse({ success: true });
        } catch (error) {
            console.error('Content script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    // ==================== 功能1: 处理线稿 ====================
    /**
     * 处理线稿上传
     * @param {string} imageData - Base64 图片数据
     * @param {string} prompt - 用户提示词
     */
    async function processSketch(imageData, prompt) {
        console.log('Processing sketch...');

        // 上传线稿图片
        await uploadImageToGemini(imageData);

        // 填写 Prompt
        const fullPrompt = `${prompt}\n\n这是一张手绘线稿，请将其转化为高清、精美的图片。保持线稿的结构和构图，添加细节、纹理和光影效果。`;
        await fillPrompt(fullPrompt);
    }

    // ==================== 功能2: 处理风格迁移 ====================
    /**
     * 处理风格迁移
     * @param {string} imageData - Base64 图片数据
     * @param {string} prompt - 用户提示词
     */
    async function processStyleTransfer(imageData, prompt) {
        console.log('Processing style transfer...');

        // 上传风格参考图
        await uploadImageToGemini(imageData);

        // 填写 Prompt
        const fullPrompt = `${prompt}\n\n请参考上传图片的艺术风格（包括色彩、笔触、氛围等）来生成新图片。`;
        await fillPrompt(fullPrompt);
    }

    // ==================== 功能3: 处理蒙版编辑 ====================
    /**
     * 处理蒙版编辑
     * @param {string} baseImageData - 原图 Base64 数据
     * @param {string} maskImageData - 蒙版 Base64 数据
     * @param {string} prompt - 用户提示词
     */
    async function processMaskEdit(baseImageData, maskImageData, prompt) {
        console.log('Processing mask edit...');

        // 上传原图
        await uploadImageToGemini(baseImageData);

        // 等待第一张图上传完成
        await delay(DELAYS.UPLOAD_WAIT * 2);

        // 上传蒙版图
        await uploadImageToGemini(maskImageData);

        // 填写 Prompt
        const fullPrompt = `${prompt}\n\n白色区域是需要修改的部分，黑色区域保持不变。请根据我的描述修改白色区域的内容。`;
        await fillPrompt(fullPrompt);
    }

    // ==================== DOM 操作工具函数 ====================

    /**
     * 等待页面准备就绪
     */
    async function waitForPageReady() {
        let attempts = 0;

        while (attempts < MAX_RETRIES.PAGE_READY) {
            const input = findPromptInput();
            if (input) {
                console.log('Page is ready');
                return;
            }
            await delay(DELAYS.ELEMENT_CHECK);
            attempts++;
        }

        throw new Error('Page loading timeout, cannot find input field');
    }

    /**
     * 查找 Prompt 输入框
     * @returns {HTMLElement|null}
     */
    function findPromptInput() {
        console.log('Finding prompt input...');
        for (const selector of SELECTORS.promptInput) {
            const element = document.querySelector(selector);
            console.log(`Selector "${selector}":`, element ? 'found' : 'not found');
            if (element && isVisible(element)) {
                console.log('Prompt input found:', element.tagName);
                return element;
            }
        }
        console.warn('No prompt input found');
        return null;
    }

    /**
     * 查找上传按钮/输入框
     * @returns {HTMLElement|null}
     */
    function findUploadInput() {
        console.log('Finding upload input...');
        for (const selector of SELECTORS.uploadInput) {
            const element = document.querySelector(selector);
            console.log(`Selector "${selector}":`, element ? 'found' : 'not found');
            if (element) {
                console.log('Upload input found:', element.tagName);
                return element;
            }
        }
        console.warn('No upload input found');
        return null;
    }

    /**
     * 上传图片到 Gemini
     * @param {string} imageData - Base64 图片数据
     */
    async function uploadImageToGemini(imageData) {
        console.log('Uploading image...');

        // 验证并转换 base64
        const blob = await base64ToBlob(imageData);
        const file = new File([blob], 'canvas-image.png', { type: 'image/png' });

        // 找到上传输入框
        const uploadInput = findUploadInput();

        if (uploadInput && uploadInput.tagName === 'INPUT') {
            // 直接设置文件
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            uploadInput.files = dataTransfer.files;

            // 触发 change 事件
            uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (uploadInput && uploadInput.tagName === 'BUTTON') {
            // 点击上传按钮
            uploadInput.click();
            await delay(DELAYS.UPLOAD_WAIT);

            // 查找文件输入框
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            // 备用方案：使用 Clipboard API
            await uploadViaClipboard(blob);
        }

        // 等待上传完成
        await waitForUploadComplete();
    }

    /**
     * 通过剪贴板上传（备用方案）
     * @param {Blob} blob
     */
    async function uploadViaClipboard(blob) {
        // 检查安全上下文
        if (!navigator.clipboard || !window.isSecureContext) {
            throw new Error('Clipboard API requires HTTPS or secure context');
        }

        try {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);

            // 聚焦输入框并粘贴
            const input = findPromptInput();
            if (input) {
                input.focus();

                // 使用 execCommand 进行粘贴（更可靠）
                document.execCommand('paste');
            }
        } catch (err) {
            console.error('Clipboard upload failed:', err);
            throw new Error('Cannot upload image, please upload manually');
        }
    }

    /**
     * 等待上传完成
     */
    async function waitForUploadComplete() {
        let attempts = 0;
        const selector = SELECTORS.imagePreview;

        while (attempts < MAX_RETRIES.UPLOAD_WAIT) {
            const images = document.querySelectorAll(selector);
            if (images.length > 0) {
                console.log('Upload complete');
                return;
            }
            await delay(DELAYS.ELEMENT_CHECK);
            attempts++;
        }

        // 不抛出错误，继续处理
        console.warn('Upload status unknown, continuing...');
    }

    /**
     * 填写 Prompt
     * @param {string} text
     */
    async function fillPrompt(text) {
        console.log('Filling prompt...');

        const input = findPromptInput();
        if (!input) {
            throw new Error('Cannot find input field');
        }

        // 检查是否只读
        if (input.readOnly) {
            throw new Error('Input field is read-only');
        }

        // 根据元素类型设置值
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.isContentEditable) {
            // 对于 contenteditable，使用 execCommand 保持 DOM 结构
            input.focus();

            // 先清空内容
            document.execCommand('selectAll', false);
            document.execCommand('delete', false);

            // 插入新文本
            document.execCommand('insertText', false, text);
        }

        // 触发 input 事件
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText'
        });
        input.dispatchEvent(inputEvent);

        // 聚焦输入框
        input.focus();
    }

    /**
     * 提交表单
     */
    async function submitForm() {
        console.log('Submitting form...');

        await delay(DELAYS.SUBMIT_WAIT);

        // 尝试点击提交按钮
        const submitButton = document.querySelector(SELECTORS.submitButton);
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
            return;
        }

        // 使用 Enter 键提交
        const input = findPromptInput();
        if (input) {
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(enterEvent);
        }
    }

    // ==================== 工具函数 ====================

    /**
     * Base64 转 Blob（带验证）
     * @param {string} base64
     * @returns {Promise<Blob>}
     */
    async function base64ToBlob(base64) {
        // 验证格式
        if (!base64 || typeof base64 !== 'string') {
            throw new Error('Invalid base64 data: empty or not string');
        }

        // 构建数据 URL
        let dataUrl = base64;
        if (!base64.startsWith('data:')) {
            // 验证是否是有效的 base64
            const base64Regex = /^[A-Za-z0-9+/]+=*$/;
            if (!base64Regex.test(base64.replace(/\s/g, ''))) {
                throw new Error('Invalid base64 format');
            }
            dataUrl = `data:image/png;base64,${base64}`;
        }

        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new Error(`Fetch failed with status ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            throw new Error(`Failed to convert base64 to blob: ${error.message}`);
        }
    }

    /**
     * 延迟函数
     * @param {number} ms
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 检查元素是否可见（完整检查）
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    function isVisible(element) {
        if (!element) {
            return false;
        }

        const rect = element.getBoundingClientRect();

        // 检查尺寸
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        // 检查是否隐藏
        if (element.offsetParent === null) {
            return false;
        }

        // 检查是否禁用
        if (element.disabled) {
            return false;
        }

        // 检查 CSS 样式
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        return true;
    }

    // ==================== 初始化 ====================
    console.log('Gemini Canvas Workbench content script loaded');

    // 通知 background script 已加载（带错误处理）
    try {
        chrome.runtime.sendMessage(
            { action: 'contentScriptLoaded' },
            () => {
                // 忽略可能的错误（如 background 未准备好）
                if (chrome.runtime.lastError) {
                    console.log('Background not ready:', chrome.runtime.lastError.message);
                }
            }
        );
    } catch (e) {
        console.log('Failed to notify background:', e.message);
    }

})();
