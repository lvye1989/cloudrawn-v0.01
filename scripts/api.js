/**
 * Multi-Model Image API Client
 * 支持多模型切换：阿里云百炼 Qwen 和 Replicate (Nano Banana 2)
 */

// 模型配置
const MODEL_CONFIGS = {
    qwen: {
        name: 'Qwen Image 2.0 Pro',
        provider: '阿里云百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        model: 'qwen-image-2.0-pro',
        endpoint: '/services/aigc/multimodal-generation/generation',
        timeout: 60000,
        maxPromptLength: 4000,
        maxRetries: 3,
        retryDelay: 1000,
        validSizes: ['512*512', '1024*1024', '1024*768', '768*1024'],
        requiresApiKey: true,
        apiKeyPlaceholder: '输入阿里云百炼 API Key'
    },
    nanobanana: {
        name: 'Nano Banana 2',
        provider: 'Replicate',
        baseUrl: 'https://api.replicate.com/v1',
        model: 'google/nano-banana-2',
        endpoint: '/predictions',
        timeout: 120000,
        maxPromptLength: 4000,
        maxRetries: 3,
        retryDelay: 2000,
        validSizes: ['512*512', '1024*1024', '1024*768', '768*1024'],
        requiresApiKey: true,
        apiKeyPlaceholder: '输入 Replicate API Token',
        // Nano Banana 特有参数
        defaultParameters: {
            aspect_ratio: '1:1',
            output_format: 'jpg',
            resolution: '2K'
        }
    }
};

// 当前使用的模型（默认 Qwen）
let currentModel = 'qwen';

// 获取当前模型配置
function getCurrentConfig() {
    return MODEL_CONFIGS[currentModel] || MODEL_CONFIGS.qwen;
}

// 切换模型
function switchModel(modelKey) {
    if (!MODEL_CONFIGS[modelKey]) {
        console.warn(`Unknown model: ${modelKey}, falling back to qwen`);
        modelKey = 'qwen';
    }
    currentModel = modelKey;
    return getCurrentConfig();
}

// 获取所有可用模型列表
function getAvailableModels() {
    return Object.entries(MODEL_CONFIGS).map(([key, config]) => ({
        key,
        name: config.name,
        provider: config.provider
    }));
}

// 有效的图片尺寸列表（根据当前模型）
function getValidSizes() {
    return getCurrentConfig().validSizes;
}

// 有效的图片 MIME 类型
const VALID_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

/**
 * 带超时的 fetch 请求
 * @param {string} url - 请求 URL
 * @param {Object} options - fetch 选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeout) {
    const actualTimeout = timeout || getCurrentConfig().timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const timeoutError = new Error('请求超时，请稍后重试');
            timeoutError.cause = error;
            throw timeoutError;
        }
        throw error;
    }
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证 API 请求参数
 * @param {Object} params - 参数对象
 * @param {boolean} requireImage - 是否需要图片参数
 * @returns {string} 验证后的尺寸
 */
function validateParams(params, requireImage = false) {
    const config = getCurrentConfig();
    const { prompt, apiKey, size, promptExtend, referenceImage, baseImage, maskImage } = params;

    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error(`API Key 不能为空且必须为字符串，请从 ${config.provider} 控制台获取`);
    }

    if (!prompt || typeof prompt !== 'string') {
        throw new Error('提示词不能为空且必须为字符串');
    }

    if (prompt.length > config.maxPromptLength) {
        throw new Error(`提示词长度不能超过 ${config.maxPromptLength} 字符`);
    }

    // 验证 promptExtend 类型
    if (promptExtend !== undefined && typeof promptExtend !== 'boolean') {
        throw new Error('promptExtend 参数必须为布尔值（true 或 false）');
    }

    // 验证并规范化 size 参数
    let validatedSize = config.validSizes[0]; // 使用模型默认尺寸
    if (size) {
        if (config.validSizes.includes(size)) {
            validatedSize = size;
        } else {
            console.warn(`size 参数 "${size}" 不合法，有效值为: ${config.validSizes.join(', ')}，将使用默认值 ${validatedSize}`);
        }
    }

    if (requireImage) {
        if (referenceImage && !isValidBase64Image(referenceImage)) {
            throw new Error('参考图格式不正确，必须是有效的 Base64 图片格式');
        }
        if (baseImage && !isValidBase64Image(baseImage)) {
            throw new Error('原图格式不正确，必须是有效的 Base64 图片格式');
        }
        if (maskImage && !isValidBase64Image(maskImage)) {
            throw new Error('蒙版图格式不正确，必须是有效的 Base64 图片格式');
        }
    }

    return validatedSize;
}

/**
 * 验证 Base64 图片格式
 * @param {string} base64String - Base64 字符串
 * @returns {boolean}
 */
function isValidBase64Image(base64String) {
    if (typeof base64String !== 'string') return false;

    // 检查是否包含 data:image 前缀
    if (!base64String.startsWith('data:image/')) return false;

    // 提取 MIME 类型
    const mimeMatch = base64String.match(/^data:([^;]+);base64,/);
    if (!mimeMatch) return false;

    const mimeType = mimeMatch[1];
    // 验证 MIME 类型是否在白名单中
    if (!VALID_IMAGE_MIME_TYPES.includes(mimeType)) {
        console.warn(`不支持的图片格式: ${mimeType}，支持的格式: ${VALID_IMAGE_MIME_TYPES.join(', ')}`);
        return false;
    }

    // 提取 base64 数据部分
    const parts = base64String.split(',');
    if (parts.length !== 2) return false;

    const base64Data = parts[1];
    if (!base64Data) return false;

    // 检查基本 base64 字符集（允许空字符串，但长度应为4的倍数）
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) return false;

    // 检查长度是否为4的倍数（base64编码规则）
    if (base64Data.length % 4 !== 0) return false;

    return true;
}

/**
 * 处理蒙版图片 - 将紫色涂抹区域转换为白色（表示需要修改的区域）
 * 阿里云 API 要求蒙版中白色区域表示需要重绘/修改的部分
 * @param {string} maskBase64 - 原始蒙版图片的 Base64
 * @returns {Promise<string>} 处理后的蒙版图片 Base64
 */
async function processMaskImage(maskBase64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // 绘制原始蒙版
                ctx.drawImage(img, 0, 0);

                // 获取像素数据
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // 处理像素：将非透明区域转换为纯白色
                // 紫色 (139, 92, 246) 或其他颜色的涂抹区域 -> 白色 (255, 255, 255)
                // 透明区域保持黑色 (0, 0, 0)
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha > 10) { // 如果像素有一定透明度（不是完全透明）
                        // 将该像素设为白色（表示需要修改的区域）
                        data[i] = 255;     // R
                        data[i + 1] = 255; // G
                        data[i + 2] = 255; // B
                        data[i + 3] = 255; // A (完全不透明)
                    } else {
                        // 透明区域设为黑色（表示不需要修改的区域）
                        data[i] = 0;       // R
                        data[i + 1] = 0;   // G
                        data[i + 2] = 0;   // B
                        data[i + 3] = 255; // A (完全不透明)
                    }
                }

                // 将处理后的像素数据写回 canvas
                ctx.putImageData(imageData, 0, 0);

                // 转换为 Base64
                const processedMaskBase64 = canvas.toDataURL('image/png');
                resolve(processedMaskBase64);
            } catch (error) {
                reject(new Error('蒙版处理失败: ' + error.message));
            }
        };
        img.onerror = () => {
            reject(new Error('蒙版图片加载失败'));
        };
        img.src = maskBase64;
    });
}

/**
 * 处理 API 错误响应
 * @param {Response} response - fetch Response 对象
 * @returns {Promise<Error>} 返回错误对象（用于重试判断）
 */
async function handleApiError(response) {
    let errorMessage = `API 请求失败: ${response.status}`;
    let isRetryable = false;
    let retryAfter = null;

    // 处理限流错误（可重试）
    if (response.status === 429) {
        retryAfter = response.headers.get('Retry-After');
        errorMessage = `请求过于频繁，请${retryAfter ? `等待 ${retryAfter} 秒后` : '稍后'}重试`;
        isRetryable = true;
    }

    // 服务器错误（可重试）
    if (response.status >= 500 && response.status < 600) {
        errorMessage = `服务器错误: ${response.status}`;
        isRetryable = true;
    }

    try {
        const errorData = await response.json();
        if (errorData.message) {
            errorMessage = errorData.message;
        } else if (errorData.error?.message) {
            errorMessage = errorData.error.message;
        }
    } catch (e) {
        // 解析失败，使用默认错误信息
    }

    const error = new Error(errorMessage);
    error.isRetryable = isRetryable;
    error.retryAfter = retryAfter;
    error.statusCode = response.status;
    throw error;
}

/**
 * 调用 Qwen Image API（带重试机制）
 * @param {Object} requestBody - 请求体
 * @param {string} apiKey - API Key
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function callQwenApi(requestBody, apiKey, retryCount = 0) {
    const config = MODEL_CONFIGS.qwen;

    try {
        const response = await fetchWithTimeout(
            `${config.baseUrl}${config.endpoint}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            },
            config.timeout
        );

        if (!response.ok) {
            await handleApiError(response);
        }

        const data = await response.json();
        return parseQwenResponse(data);

    } catch (error) {
        // 判断是否需要重试
        const shouldRetry = retryCount < config.maxRetries &&
            (error.isRetryable ||
                error.message?.includes('超时') ||
                error.message?.includes('network') ||
                error.name === 'TypeError'); // fetch 网络错误

        if (shouldRetry) {
            // 计算延迟时间（指数退避 + 随机抖动）
            const baseDelay = config.retryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            let delayMs = Math.min(baseDelay + jitter, 30000);

            // 如果有 Retry-After 头，优先使用（带安全校验）
            if (error.retryAfter) {
                const retrySeconds = parseInt(error.retryAfter, 10);
                if (!isNaN(retrySeconds) && retrySeconds > 0) {
                    delayMs = retrySeconds * 1000;
                }
            }

            console.warn(`Qwen API 调用失败，${Math.round(delayMs)}ms 后进行第 ${retryCount + 1} 次重试...`);
            await delay(delayMs);
            return callQwenApi(requestBody, apiKey, retryCount + 1);
        }

        throw error;
    }
}

/**
 * 解析 Qwen API 响应
 * @param {Object} data - API 响应数据
 * @returns {string} 图片 URL
 * @throws {Error}
 */
function parseQwenResponse(data) {
    // 检查 output 是否存在
    if (!data.output) {
        throw new Error('API 响应中未找到 output 字段');
    }

    // 检查 choices 是否存在且为数组
    const choices = data.output.choices;
    if (!choices || !Array.isArray(choices) || choices.length === 0) {
        throw new Error('API 响应中未找到有效的 choices');
    }

    // 检查 message 是否存在
    const message = choices[0]?.message;
    if (!message) {
        throw new Error('API 响应中未找到 message');
    }

    // 检查 content 是否存在且为数组
    const content = message.content;
    if (!content || !Array.isArray(content) || content.length === 0) {
        throw new Error('API 响应中未找到有效的 content');
    }

    // 遍历 content 数组查找图片
    for (const item of content) {
        if (item && typeof item === 'object') {
            // 检查 image 字段
            if (item.image && typeof item.image === 'string') {
                return item.image;
            }
            // 检查 text 字段（可能是错误或状态信息）
            if (item.text && typeof item.text === 'string') {
                throw new Error(`API 返回文本消息: ${item.text}`);
            }
        }
    }

    throw new Error('API 返回中未找到图片 URL');
}


/**
 * 调用 Nano Banana 2 API 生成图片
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} params.apiKey - Replicate API Token
 * @param {string} [params.size] - 图片尺寸
 * @param {string} [params.aspectRatio] - 宽高比 (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
 * @param {string} [params.resolution] - 分辨率 (512px, 1K, 2K, 4K)
 * @param {string} [params.outputFormat] - 输出格式 (jpg, png)
 * @param {boolean} [params.googleSearch] - 是否使用 Google Web Search
 * @param {boolean} [params.imageSearch] - 是否使用 Google Image Search
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function generateImageNanoBanana(params) {
    const {
        prompt,
        apiKey,
        size,
        aspectRatio = '1:1',
        resolution = '1K',
        outputFormat = 'jpg',
        googleSearch = false,
        imageSearch = false
    } = params;

    // 获取当前模型配置
    const config = getCurrentConfig();

    // 参数验证
    validateParams(params);

    // 将 size 转换为 aspect_ratio（如果传入了 size 且 aspectRatio 不是冒号格式）
    let finalAspectRatio = aspectRatio;
    if (size && !aspectRatio.includes(':')) {
        // 完整的尺寸映射表，根据 banana.md 文档
        const sizeMap = {
            '1024*1024': '1:1',
            '1024*768': '4:3',
            '768*1024': '3:4',
            '512*512': '1:1',
            '1024*512': '2:1',
            '512*1024': '1:2',
            '1440*1024': '16:9',
            '1024*1440': '9:16'
        };
        finalAspectRatio = sizeMap[size] || '1:1';
    }

    // 构建请求体（Replicate API 格式 - Nano Banana 2）
    // 根据 banana.md 文档，请求体只包含 input 字段
    const requestBody = {
        input: {
            prompt: String(prompt),
            aspect_ratio: String(finalAspectRatio),
            resolution: String(resolution),
            output_format: String(outputFormat)
        }
    };

    // 添加可选参数（根据文档）
    if (googleSearch) {
        requestBody.input.google_search = true;
    }
    if (imageSearch) {
        requestBody.input.image_search = true;
    }

    console.log('Nano Banana 2 - Sending request body:', JSON.stringify(requestBody, null, 2));

    // 调用 Replicate API
    return callNanoBananaApi(requestBody, apiKey);
}

/**
 * 调用 Nano Banana 2 API（根据文档使用 /v1/models/.../predictions 端点）
 * @param {Object} requestBody - 请求体（只包含 input 字段）
 * @param {string} apiKey - API Token
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function callNanoBananaApi(requestBody, apiKey, retryCount = 0) {
    // 简单验证 apiKey
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
        throw new Error('Invalid API Key: API Key 格式不正确或长度不足');
    }

    const config = MODEL_CONFIGS.nanobanana;
    // 使用模型特定端点: /v1/models/{owner}/{model}/predictions
    const url = `${config.baseUrl}/models/${config.model}/predictions`;

    console.log(`${config.name} API Request URL:`, url);
    console.log(`${config.name} API Request Body:`, JSON.stringify(requestBody, null, 2));
    console.log(`${config.name} API Key (first 10 chars):`, apiKey ? apiKey.substring(0, 10) + '...' : 'EMPTY');

    try {
        // 使用 background.js 代理请求，绕过 CORS 限制
        const response = await chrome.runtime.sendMessage({
            action: 'proxyApiRequest',
            url: url,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait'  // 同步等待结果
            },
            body: requestBody
        });

        console.log(`${config.name} Proxy Response:`, response);

        if (!response.success) {
            // 显示详细的错误信息
            let errorDetail = response.error || 'Proxy request failed';
            // 检查 detail 字段
            if (response.detail) {
                errorDetail = typeof response.detail === 'string'
                    ? response.detail
                    : JSON.stringify(response.detail);
            }
            // 检查 data.detail
            else if (response.data && response.data.detail) {
                errorDetail = typeof response.data.detail === 'string'
                    ? response.data.detail
                    : JSON.stringify(response.data.detail);
            }
            // 检查 data.error
            else if (response.data && response.data.error) {
                errorDetail = typeof response.data.error === 'string'
                    ? response.data.error
                    : JSON.stringify(response.data.error);
            }
            // 如果是对象，转换为字符串
            else if (response.data && typeof response.data === 'object') {
                errorDetail = JSON.stringify(response.data);
            }
            console.error(`${config.name} API Error Detail:`, errorDetail);
            throw new Error(errorDetail);
        }

        // 检查 API 返回的错误
        if (response.data && response.data.error) {
            throw new Error(`API Error: ${JSON.stringify(response.data.error)}`);
        }

        const prediction = response.data;

        // 如果使用 Prefer: wait，结果可能已经就绪
        if (prediction.status === 'succeeded') {
            return parseReplicateResponse(prediction);
        }

        // 否则需要轮询
        return await pollNanoBananaPrediction(prediction.id, apiKey, config);

    } catch (error) {
        console.error(`${config.name} API Error:`, error);

        const shouldRetry = retryCount < config.maxRetries &&
            (error.isRetryable ||
                error.message?.includes('超时') ||
                error.message?.includes('network') ||
                error.name === 'TypeError');

        if (shouldRetry) {
            const baseDelay = config.retryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            const delayMs = Math.min(baseDelay + jitter, 30000);

            console.warn(`${config.name} API 调用失败，${Math.round(delayMs)}ms 后进行第 ${retryCount + 1} 次重试...`);
            await delay(delayMs);
            return callNanoBananaApi(requestBody, apiKey, retryCount + 1);
        }

        throw error;
    }
}

/**
 * 轮询 Nano Banana 2 预测结果
 * @param {string} predictionId - 预测 ID
 * @param {string} apiKey - API Token
 * @param {Object} config - 模型配置
 * @returns {Promise<string>} 图片 URL
 */
async function pollNanoBananaPrediction(predictionId, apiKey, config) {
    const maxPollTime = config.timeout;
    const pollInterval = 2000;
    const startTime = Date.now();

    console.log(`${config.name} Starting polling for prediction:`, predictionId);

    while (Date.now() - startTime < maxPollTime) {
        await delay(pollInterval);

        // 轮询时使用标准端点 /v1/predictions/{id}，而不是模型特定端点
        const pollUrl = `${config.baseUrl}/predictions/${predictionId}`;
        console.log(`${config.name} Polling URL:`, pollUrl);

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'proxyApiRequest',
                url: pollUrl,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            console.log(`${config.name} Poll Response:`, response);

            if (!response.success) {
                throw new Error(response.error || 'Poll request failed');
            }

            const prediction = response.data;
            console.log(`${config.name} Poll Status:`, prediction.status);

            if (prediction.status === 'succeeded') {
                console.log(`${config.name} Prediction succeeded:`, prediction);
                return parseReplicateResponse(prediction);
            }

            if (prediction.status === 'failed') {
                console.error(`${config.name} Prediction failed:`, prediction.error);
                throw new Error(`${config.name} 预测失败: ${prediction.error || '未知错误'}`);
            }

            if (prediction.status === 'canceled') {
                throw new Error(`${config.name} 预测被取消`);
            }
        } catch (error) {
            console.error(`${config.name} Poll Error:`, error);
            throw error;
        }
    }

    throw new Error(`${config.name} 预测超时`);
}

/**
 * 调用 Replicate API（通用函数）
 * @param {Object} requestBody - 请求体
 * @param {string} apiKey - API Token
 * @param {Object} config - 模型配置
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function callReplicateApi(requestBody, apiKey, config, retryCount = 0) {
    // 使用 /v1/predictions 端点
    const url = `${config.baseUrl}/predictions`;
    console.log(`${config.name} API Request URL:`, url);
    console.log(`${config.name} API Request Body:`, JSON.stringify(requestBody, null, 2));

    try {
        // 使用 background.js 代理请求，绕过 CORS 限制
        const response = await chrome.runtime.sendMessage({
            action: 'proxyApiRequest',
            url: url,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: requestBody
        });

        console.log(`${config.name} Proxy Response:`, response);

        if (!response.success) {
            throw new Error(response.error || 'Proxy request failed');
        }

        const prediction = response.data;

        // Replicate API 是异步的，需要轮询获取结果
        if (prediction.status === 'succeeded') {
            return parseReplicateResponse(prediction);
        }

        // 等待预测完成
        return await pollReplicatePrediction(prediction.id, apiKey, config);

    } catch (error) {
        console.error(`${config.name} API Error:`, error);

        const shouldRetry = retryCount < config.maxRetries &&
            (error.isRetryable ||
                error.message?.includes('超时') ||
                error.message?.includes('network') ||
                error.name === 'TypeError');

        if (shouldRetry) {
            const baseDelay = config.retryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            const delayMs = Math.min(baseDelay + jitter, 30000);

            console.warn(`${config.name} API 调用失败，${Math.round(delayMs)}ms 后进行第 ${retryCount + 1} 次重试...`);
            await delay(delayMs);
            return callReplicateApi(requestBody, apiKey, config, retryCount + 1);
        }

        throw error;
    }
}

/**
 * 轮询 Replicate 预测结果
 * @param {string} predictionId - 预测 ID
 * @param {string} apiKey - API Token
 * @param {Object} config - 模型配置
 * @returns {Promise<string>} 图片 URL
 */
async function pollReplicatePrediction(predictionId, apiKey, config) {
    const maxPollTime = config.timeout;
    const pollInterval = 2000;
    const startTime = Date.now();

    console.log(`${config.name} Starting polling for prediction:`, predictionId);

    while (Date.now() - startTime < maxPollTime) {
        await delay(pollInterval);

        const pollUrl = `${config.baseUrl}/predictions/${predictionId}`;
        console.log(`${config.name} Polling URL:`, pollUrl);

        try {
            // 使用 background.js 代理请求
            const response = await chrome.runtime.sendMessage({
                action: 'proxyApiRequest',
                url: pollUrl,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            console.log(`${config.name} Poll Response:`, response);

            if (!response.success) {
                throw new Error(response.error || 'Poll request failed');
            }

            const prediction = response.data;
            console.log(`${config.name} Poll Status:`, prediction.status);

            if (prediction.status === 'succeeded') {
                console.log(`${config.name} Prediction succeeded:`, prediction);
                return parseReplicateResponse(prediction);
            }

            if (prediction.status === 'failed') {
                console.error(`${config.name} Prediction failed:`, prediction.error);
                throw new Error(`${config.name} 预测失败: ${prediction.error || '未知错误'}`);
            }

            if (prediction.status === 'canceled') {
                throw new Error(`${config.name} 预测被取消`);
            }
        } catch (error) {
            console.error(`${config.name} Poll Error:`, error);
            throw error;
        }
    }

    throw new Error(`${config.name} 预测超时`);
}

/**
 * 解析 Replicate API 响应
 * @param {Object} prediction - 预测结果
 * @returns {string} 图片 URL
 */
function parseReplicateResponse(prediction) {
    if (!prediction.output) {
        throw new Error('Replicate 响应中未找到 output 字段');
    }

    // Nano Banana 返回的是字符串 URL
    if (typeof prediction.output === 'string') {
        return prediction.output;
    }

    // 其他情况可能是数组
    if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        return prediction.output[0];
    }

    throw new Error('Replicate 返回中未找到有效的图片 URL');
}


/**
 * 构建 Qwen 请求体
 * @param {string} prompt - 提示词
 * @param {string} negativePrompt - 负面提示词
 * @param {string} size - 图片尺寸
 * @param {Object} options - 额外选项
 * @returns {Object}
 */
function buildQwenRequestBody(prompt, negativePrompt = '', size = '1024*1024', options = {}) {
    const config = MODEL_CONFIGS.qwen;
    const { promptExtend = true, watermark = false } = options;
    const validSize = config.validSizes.includes(size) ? size : config.validSizes[0];

    return {
        model: config.model,
        input: {
            messages: []
        },
        parameters: {
            n: 1,
            negative_prompt: negativePrompt || '',
            prompt_extend: Boolean(promptExtend),
            watermark: Boolean(watermark),
            size: validSize
        }
    };
}

/**
 * 调用 Qwen Image API 生成图片
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} params.apiKey - API Key
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {string} [params.size] - 图片尺寸，默认 1024*1024
 * @param {boolean} [params.promptExtend] - 是否开启提示词扩写，默认 true
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function generateImage(params) {
    const { prompt, apiKey, negativePrompt = '', size, promptExtend = true } = params;

    // 参数验证
    const validatedSize = validateParams(params);

    // 构建请求体
    const requestBody = buildQwenRequestBody(prompt, negativePrompt, validatedSize, { promptExtend });
    requestBody.input.messages = [
        {
            role: 'user',
            content: [{ text: prompt }]
        }
    ];

    return callQwenApi(requestBody, apiKey);
}

/**
 * 使用参考图生成图片（风格迁移/线稿转图）- Qwen
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} params.apiKey - API Key
 * @param {string} params.referenceImage - 参考图 Base64 (data:image/xxx;base64,...)
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {string} [params.size] - 图片尺寸
 * @param {boolean} [params.promptExtend] - 是否开启提示词扩写，默认 true
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function generateWithReference(params) {
    const { prompt, apiKey, referenceImage, negativePrompt = '', size, promptExtend = true } = params;

    // 参数验证
    const validatedSize = validateParams(params, true);

    if (!referenceImage) {
        throw new Error('参考图不能为空');
    }

    // 构建请求体
    const requestBody = buildQwenRequestBody(prompt, negativePrompt, validatedSize, { promptExtend });
    requestBody.input.messages = [
        {
            role: 'user',
            content: [
                { image: referenceImage },
                { text: prompt }
            ]
        }
    ];

    return callQwenApi(requestBody, apiKey);
}

/**
 * 局部重绘（使用蒙版）- Qwen
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} params.apiKey - API Key
 * @param {string} params.baseImage - 原图 Base64
 * @param {string} params.maskImage - 蒙版图 Base64 (白色区域为需要重绘的部分)
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {string} [params.size] - 图片尺寸
 * @param {boolean} [params.promptExtend] - 是否开启提示词扩写，默认 true
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function inpaintImage(params) {
    const { prompt, apiKey, baseImage, maskImage, negativePrompt = '', size, promptExtend = true } = params;

    // 参数验证
    const validatedSize = validateParams(params, true);

    if (!baseImage || !maskImage) {
        throw new Error('原图和蒙版图都不能为空');
    }

    // 处理蒙版图 - 将紫色涂抹区域转换为白色
    const processedMask = await processMaskImage(maskImage);

    // 构建请求体，包含原图、蒙版图和提示词
    // 注意：蒙版图白色区域表示需要重绘的部分
    const requestBody = buildQwenRequestBody(prompt, negativePrompt, validatedSize, { promptExtend });
    requestBody.input.messages = [
        {
            role: 'user',
            content: [
                { image: baseImage },
                { image: processedMask },
                { text: `请根据蒙版白色区域修改图片: ${prompt}。注意：只修改蒙版白色标记的区域，保持其他部分完全不变。` }
            ]
        }
    ];

    return callQwenApi(requestBody, apiKey);
}

/**
 * 多图融合编辑 - Qwen
 * 将参考素材图的内容融合到原图的指定区域（通过蒙版标记）
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词，描述如何融合参考素材
 * @param {string} params.apiKey - API Key
 * @param {string} params.baseImage - 底图（图片1）Base64
 * @param {string} params.refImage - 参考素材图（图片2）Base64
 * @param {string} params.maskImage - 蒙版图 Base64 (涂抹区域为需要修改的部分)
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {string} [params.size] - 图片尺寸
 * @param {boolean} [params.promptExtend] - 是否开启提示词扩写，默认 true
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function multiImageEdit(params) {
    const { prompt, apiKey, baseImage, refImage, maskImage, negativePrompt = '', size, promptExtend = true } = params;

    // 参数验证
    const validatedSize = validateParams(params, true);

    if (!baseImage) {
        throw new Error('底图不能为空');
    }

    if (!refImage) {
        throw new Error('参考素材图不能为空');
    }

    // 验证图片格式
    if (!isValidBase64Image(baseImage)) {
        throw new Error('底图格式不正确，必须是有效的 Base64 图片格式');
    }
    if (!isValidBase64Image(refImage)) {
        throw new Error('参考素材图格式不正确，必须是有效的 Base64 图片格式');
    }

    // 构建请求体
    // 按照阿里云文档：多图输入时，按照数组顺序定义图像顺序，输出图像的比例以最后一张为准
    const requestBody = buildQwenRequestBody(prompt, negativePrompt, validatedSize, { promptExtend });

    // 构建消息内容：底图 + 参考素材图 + 蒙版图（如果有）+ 提示词
    const content = [];

    // 图片1：底图
    content.push({ image: baseImage });

    // 图片2：参考素材图
    content.push({ image: refImage });

    // 图片3：蒙版图（可选）- 需要转换为白色表示需要修改的区域
    if (maskImage && isValidBase64Image(maskImage)) {
        const processedMask = await processMaskImage(maskImage);
        content.push({ image: processedMask });
    }

    // 提示词：描述如何将参考素材融合到涂抹区域
    // 优化提示词，更明确地指导模型如何融合参考图
    const fusionPrompt = maskImage
        ? `请将图二的参考素材内容精确融合到图三蒙版标记的白色区域中，保持与图一底图其他区域的风格一致。融合要求：${prompt}。注意：只修改蒙版白色区域，保持底图其他部分完全不变。`
        : `请将图二的参考素材内容融合到图一中。融合要求：${prompt}。保持底图其他区域完全不变，只添加参考素材的内容。`;
    content.push({ text: fusionPrompt });

    requestBody.input.messages = [
        {
            role: 'user',
            content: content
        }
    ];

    return callQwenApi(requestBody, apiKey);
}

/**
 * 统一生成图片入口（根据当前模型选择 API）
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function generateImageUnified(params) {
    if (currentModel === 'nanobanana') {
        return generateImageNanoBanana(params);
    }
    return generateImage(params);
}

/**
 * 统一参考图生成入口（根据当前模型选择 API）
 * Nano Banana 2 支持参考图
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function generateWithReferenceUnified(params) {
    if (currentModel === 'nanobanana') {
        // Nano Banana 2 支持参考图，使用 image_input 参数
        const {
            baseImage, refImage, prompt, apiKey,
            aspectRatio = 'match_input_image',
            resolution = '1K',
            outputFormat = 'jpg',
            googleSearch = false,
            imageSearch = false
        } = params;
        validateParams(params);

        // 构建 image_input 数组：底图在前，风格参考图在后
        const imageInputs = [];
        if (baseImage) imageInputs.push(baseImage);
        if (refImage) imageInputs.push(refImage);

        // 构建符合文档格式的请求体（只包含 input）
        const requestBody = {
            input: {
                prompt: prompt,
                image_input: imageInputs,
                aspect_ratio: aspectRatio,
                output_format: outputFormat,
                resolution: resolution
            }
        };

        // 添加可选搜索参数
        if (googleSearch) {
            requestBody.input.google_search = true;
        }
        if (imageSearch) {
            requestBody.input.image_search = true;
        }

        return callNanoBananaApi(requestBody, apiKey);
    }

    return generateWithReference(params);
}

/**
 * 统一局部重绘入口（根据当前模型选择 API）
 * 注意：Nano Banana 2 不支持蒙版编辑，会回退到 Qwen
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function inpaintImageUnified(params) {
    if (currentModel === 'nanobanana') {
        console.warn(`${MODEL_CONFIGS[currentModel]?.name || currentModel} 不支持蒙版编辑功能，使用 Qwen API`);
    }
    return inpaintImage(params);
}

/**
 * 优化提示词 - 使用 Qwen3.5 模型将中文提示词优化并翻译成英文
 * @param {Object} params - 参数
 * @param {string} params.prompt - 需要优化的中文提示词
 * @param {string} params.apiKey - 阿里云百炼 API Key
 * @param {string} [params.negativePrompt] - 负面提示词（可选）
 * @param {string} [params.scene] - 场景描述，用于更好地优化提示词
 * @returns {Promise<Object>} 优化后的提示词对象 { optimizedPrompt, optimizedNegative }
 */
async function optimizePrompt(params) {
    const { prompt, apiKey, negativePrompt = '', scene = '' } = params;

    if (!prompt || typeof prompt !== 'string') {
        throw new Error('提示词不能为空');
    }

    if (!apiKey) {
        throw new Error('API Key 不能为空');
    }

    // 构建系统提示词
    const systemPrompt = `你是一个专业的AI图像提示词优化专家。你的任务是将用户的中文描述优化成高质量的英文提示词，用于AI图像生成。

优化要求：
1. 将中文描述翻译成准确、流畅的英文
2. 补充和丰富细节描述，使提示词更加具体和生动
3. 添加合适的艺术风格描述（如：photorealistic, anime, oil painting, digital art等）
4. 添加光线、氛围、构图等描述（如：soft lighting, dramatic shadows, wide angle, close-up等）
5. 保持提示词简洁但富有表现力，通常50-150个单词
6. 如果用户没有明确指定风格，默认使用写实风格（photorealistic）

请按以下JSON格式返回结果：
{
  "optimized_prompt": "优化后的英文提示词",
  "optimized_negative": "优化的负面提示词（可选，用于避免常见的质量问题）"
}`;

    // 构建用户提示词
    let userContent = `请优化以下提示词：\n\n${prompt}`;
    if (negativePrompt) {
        userContent += `\n\n当前负面提示词：${negativePrompt}`;
    }
    if (scene) {
        userContent += `\n\n场景：${scene}`;
    }

    const requestBody = {
        model: 'qwen-plus',
        input: {
            messages: [
                {
                    role: 'system',
                    content: [{ text: systemPrompt }]
                },
                {
                    role: 'user',
                    content: [{ text: userContent }]
                }
            ]
        },
        parameters: {
            result_format: 'message'
        }
    };

    // 验证 API Key 格式
    if (apiKey && /[^\x20-\x7E]/.test(apiKey)) {
        console.error('API Key 包含非 ASCII 字符，无法用于 HTTP headers');
        return {
            optimizedPrompt: prompt,
            optimizedNegative: negativePrompt,
            error: 'API Key 格式不正确，请重新设置'
        };
    }

    try {
        const response = await fetchWithTimeout(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            },
            30000 // 30秒超时
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API请求失败: ${response.status}`);
        }

        const data = await response.json();

        // 解析响应
        const content = data.output?.choices?.[0]?.message?.content;
        if (!content || !Array.isArray(content) || !content[0]?.text) {
            throw new Error('API响应格式不正确');
        }

        // 解析JSON结果
        const jsonText = content[0].text;
        const result = JSON.parse(jsonText);

        return {
            optimizedPrompt: result.optimized_prompt || prompt,
            optimizedNegative: result.optimized_negative || negativePrompt
        };
    } catch (error) {
        console.error('提示词优化失败:', error);
        // 如果优化失败，返回原始提示词
        // 确保返回的是干净的对象，不包含错误信息
        return {
            optimizedPrompt: prompt,
            optimizedNegative: negativePrompt,
            error: error.message || '优化失败'
        };
    }
}

// 导出 API 函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 模型管理
        getCurrentConfig,
        switchModel,
        getAvailableModels,
        getValidSizes,
        // Qwen API
        generateImage,
        generateWithReference,
        inpaintImage,
        multiImageEdit,
        // Qwen 文字优化
        optimizePrompt,
        // Nano Banana API
        generateImageNanoBanana,
        callNanoBananaApi,
        // 统一入口
        generateImageUnified,
        generateWithReferenceUnified,
        inpaintImageUnified
    };
} else {
    // 浏览器环境：将函数暴露到全局作用域
    window.getCurrentConfig = getCurrentConfig;
    window.switchModel = switchModel;
    window.getAvailableModels = getAvailableModels;
    window.getValidSizes = getValidSizes;
    window.generateImage = generateImage;
    window.generateWithReference = generateWithReference;
    window.inpaintImage = inpaintImage;
    window.multiImageEdit = multiImageEdit;
    window.optimizePrompt = optimizePrompt;
    window.generateImageNanoBanana = generateImageNanoBanana;
    window.callNanoBananaApi = callNanoBananaApi;
    window.generateImageUnified = generateImageUnified;
    window.generateWithReferenceUnified = generateWithReferenceUnified;
    window.inpaintImageUnified = inpaintImageUnified;
}
