/**
 * Multi-Model Image API Client
 * 支持多模型切换：阿里云百炼 Qwen 和 Replicate FLUX 2 Pro
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
        maxPromptLength: 1000,
        maxRetries: 3,
        retryDelay: 1000,
        validSizes: ['512*512', '1024*1024', '1024*768', '768*1024'],
        requiresApiKey: true,
        apiKeyPlaceholder: '输入阿里云百炼 API Key'
    },
    flux: {
        name: 'FLUX 2 Pro',
        provider: 'Replicate',
        baseUrl: 'https://api.replicate.com/v1',
        model: 'black-forest-labs/flux-2-pro',
        endpoint: '/predictions',
        timeout: 120000, // FLUX 需要更长时间
        maxPromptLength: 2000,
        maxRetries: 3,
        retryDelay: 2000,
        validSizes: ['1024x1024', '1024x768', '768x1024', '512x512', '1440x1440', '1440x1024', '1024x1440'],
        requiresApiKey: true,
        apiKeyPlaceholder: '输入 Replicate API Token',
        // FLUX 特有参数
        defaultParameters: {
            aspect_ratio: '1:1',
            output_format: 'webp',
            output_quality: 90,
            safety_tolerance: 2
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
 * 调用 FLUX 2 Pro API（带重试机制）
 * @param {Object} requestBody - 请求体
 * @param {string} apiKey - Replicate API Token
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function callFluxApi(requestBody, apiKey, retryCount = 0) {
    const config = MODEL_CONFIGS.flux;

    try {
        // 创建预测请求
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

        const prediction = await response.json();

        // FLUX API 是异步的，需要轮询获取结果
        if (prediction.status === 'succeeded') {
            return parseFluxResponse(prediction);
        }

        // 等待预测完成
        return await pollFluxPrediction(prediction.id, apiKey, config);

    } catch (error) {
        // 判断是否需要重试
        const shouldRetry = retryCount < config.maxRetries &&
            (error.isRetryable ||
                error.message?.includes('超时') ||
                error.message?.includes('network') ||
                error.name === 'TypeError');

        if (shouldRetry) {
            const baseDelay = config.retryDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            let delayMs = Math.min(baseDelay + jitter, 30000);

            console.warn(`FLUX API 调用失败，${Math.round(delayMs)}ms 后进行第 ${retryCount + 1} 次重试...`);
            await delay(delayMs);
            return callFluxApi(requestBody, apiKey, retryCount + 1);
        }

        throw error;
    }
}

/**
 * 轮询 FLUX 预测结果
 * @param {string} predictionId - 预测 ID
 * @param {string} apiKey - API Token
 * @param {Object} config - FLUX 配置
 * @returns {Promise<string>} 图片 URL
 */
async function pollFluxPrediction(predictionId, apiKey, config) {
    const maxPollTime = config.timeout;
    const pollInterval = 2000; // 2秒轮询间隔
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
        await delay(pollInterval);

        const response = await fetchWithTimeout(
            `${config.baseUrl}/predictions/${predictionId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            },
            10000 // 单次轮询超时
        );

        if (!response.ok) {
            await handleApiError(response);
        }

        const prediction = await response.json();

        if (prediction.status === 'succeeded') {
            return parseFluxResponse(prediction);
        }

        if (prediction.status === 'failed') {
            throw new Error(`FLUX 预测失败: ${prediction.error || '未知错误'}`);
        }

        if (prediction.status === 'canceled') {
            throw new Error('FLUX 预测被取消');
        }

        // 继续等待 (status: 'starting', 'processing')
    }

    throw new Error('FLUX 预测超时');
}

/**
 * 解析 FLUX API 响应
 * @param {Object} prediction - 预测结果
 * @returns {string} 图片 URL
 */
function parseFluxResponse(prediction) {
    if (!prediction.output) {
        throw new Error('FLUX 响应中未找到 output 字段');
    }

    // FLUX output 可能是字符串 URL 或数组
    if (typeof prediction.output === 'string') {
        return prediction.output;
    }

    if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        return prediction.output[0];
    }

    throw new Error('FLUX 返回中未找到有效的图片 URL');
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
 * 构建 FLUX 请求体
 * @param {string} prompt - 提示词
 * @param {string} size - 图片尺寸
 * @param {Object} options - 额外选项
 * @returns {Object}
 */
function buildFluxRequestBody(prompt, size = '1024x1024', options = {}) {
    const config = MODEL_CONFIGS.flux;
    const { aspectRatio = '1:1', outputFormat = 'webp', outputQuality = 90, safetyTolerance = 2 } = options;

    // 将尺寸转换为 aspect_ratio
    let finalAspectRatio = aspectRatio;
    if (size && !size.includes('x')) {
        // Qwen 格式尺寸，转换为 FLUX 格式
        const sizeMap = {
            '1024*1024': '1:1',
            '1024*768': '4:3',
            '768*1024': '3:4',
            '512*512': '1:1',
            '1440*1440': '1:1',
            '1440*1024': '4:3',
            '1024*1440': '3:4'
        };
        finalAspectRatio = sizeMap[size] || '1:1';
    } else if (size && size.includes('x')) {
        // FLUX 格式尺寸
        const [w, h] = size.split('x').map(Number);
        if (w && h) {
            const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
            const divisor = gcd(w, h);
            finalAspectRatio = `${w / divisor}:${h / divisor}`;
        }
    }

    return {
        model: config.model,
        input: {
            prompt: prompt,
            aspect_ratio: finalAspectRatio,
            output_format: outputFormat,
            output_quality: outputQuality,
            safety_tolerance: safetyTolerance
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
 * 使用 FLUX 2 Pro 生成图片
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} params.apiKey - Replicate API Token
 * @param {string} [params.size] - 图片尺寸
 * @param {string} [params.aspectRatio] - 宽高比 (1:1, 4:3, 3:4, 16:9, 9:16)
 * @param {string} [params.outputFormat] - 输出格式 (webp, jpg, png)
 * @param {number} [params.outputQuality] - 输出质量 (1-100)
 * @param {number} [params.safetyTolerance] - 安全容忍度 (1-6)
 * @returns {Promise<string>} 生成的图片 URL
 * @throws {Error} 当参数无效或 API 调用失败时抛出
 */
async function generateImageFlux(params) {
    const {
        prompt,
        apiKey,
        size,
        aspectRatio = '1:1',
        outputFormat = 'webp',
        outputQuality = 90,
        safetyTolerance = 2
    } = params;

    // 参数验证
    validateParams(params);

    // 构建 FLUX 请求体
    const requestBody = buildFluxRequestBody(prompt, size, {
        aspectRatio,
        outputFormat,
        outputQuality,
        safetyTolerance
    });

    return callFluxApi(requestBody, apiKey);
}

/**
 * 统一生成图片入口（根据当前模型选择 API）
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function generateImageUnified(params) {
    if (currentModel === 'flux') {
        return generateImageFlux(params);
    }
    return generateImage(params);
}

/**
 * 统一参考图生成入口（根据当前模型选择 API）
 * 注意：FLUX 2 Pro 不支持参考图，会回退到 Qwen
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function generateWithReferenceUnified(params) {
    if (currentModel === 'flux') {
        console.warn('FLUX 2 Pro 不支持参考图功能，使用 Qwen API');
    }
    return generateWithReference(params);
}

/**
 * 统一局部重绘入口（根据当前模型选择 API）
 * 注意：FLUX 2 Pro 不支持蒙版编辑，会回退到 Qwen
 * @param {Object} params - 生成参数
 * @returns {Promise<string>} 生成的图片 URL
 */
async function inpaintImageUnified(params) {
    if (currentModel === 'flux') {
        console.warn('FLUX 2 Pro 不支持蒙版编辑功能，使用 Qwen API');
    }
    return inpaintImage(params);
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
        // FLUX API
        generateImageFlux,
        // 统一入口
        generateImageUnified,
        generateWithReferenceUnified,
        inpaintImageUnified
    };
}
