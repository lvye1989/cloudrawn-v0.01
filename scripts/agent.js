/**
 * 智能增强Agent工作流引擎
 * 三节点协作架构：意图解析 → 参数映射 → 提示词融合
 */

const AgentWorkflow = (function() {
    'use strict';

    // 知识库缓存
    let knowledgeBase = null;

    /**
     * 加载参数知识库
     */
    async function loadKnowledgeBase() {
        if (knowledgeBase) return knowledgeBase;

        try {
            const response = await fetch(chrome.runtime.getURL('data/agent-knowledge.json'));
            knowledgeBase = await response.json();
            return knowledgeBase;
        } catch (error) {
            console.error('Failed to load knowledge base:', error);
            // 返回默认知识库
            return getDefaultKnowledgeBase();
        }
    }

    /**
     * 默认知识库（降级方案）
     */
    function getDefaultKnowledgeBase() {
        return {
            lens_params: {
                architecture: { lens: "24mm tilt-shift lens", aperture: "f/11" },
                cityscape: { lens: "14mm ultra-wide angle", aperture: "f/11" }
            },
            lighting_params: {
                golden_hour: { lighting: "Golden Hour" },
                blue_hour: { lighting: "Blue Hour" }
            },
            film_params: {
                realistic: { film: "Kodak Portra 400", quality: "8k resolution" }
            }
        };
    }

    /**
     * 节点A：意图解析
     * @param {string} userInput - 用户原始输入
     * @param {string} apiKey - API密钥
     * @returns {Promise<Object>} 结构化标签
     */
    async function analyzeIntent(userInput, apiKey) {
        const prompt = `你是一个意图分析引擎。请分析用户的输入，提取以下四个维度：

1. subject - 核心主体（建筑/人物/风景/产品等）
2. time_lighting - 时间/光照（黄昏/夜晚/阴天/黄金时刻等）
3. mood_style - 氛围/风格（赛博朋克/极简/电影感/真实感等）
4. scale - 视角大小（宏大场景/建筑/特写等）

请严格按照以下JSON格式输出，不要包含任何其他文字：
{
  "subject": "描述主体",
  "time_lighting": "时间光照",
  "mood_style": "氛围风格",
  "scale": "视角大小"
}

用户输入: "${userInput}"`;

        try {
            const response = await callAgentAPI(prompt, apiKey);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // 解析失败，返回默认结构
            return parseIntentFallback(userInput);
        } catch (error) {
            console.error('Intent analysis failed:', error);
            return parseIntentFallback(userInput);
        }
    }

    /**
     * 意图解析降级方案
     */
    function parseIntentFallback(userInput) {
        const input = userInput.toLowerCase();
        const result = {
            subject: extractSubject(input),
            time_lighting: extractTimeLighting(input),
            mood_style: extractMoodStyle(input),
            scale: extractScale(input)
        };
        return result;
    }

    function extractSubject(input) {
        if (input.includes('建筑') || input.includes('楼') || input.includes('房')) return '建筑';
        if (input.includes('人') || input.includes('肖像')) return '人物';
        if (input.includes('风景') || input.includes('自然')) return '风景';
        return '场景';
    }

    function extractTimeLighting(input) {
        if (input.includes('黄昏') || input.includes('傍晚')) return '黄昏';
        if (input.includes('夜晚') || input.includes('夜景')) return '夜晚';
        if (input.includes('阴天') || input.includes('雨天')) return '阴天';
        if (input.includes('早晨') || input.includes('日出')) return '黄金时刻';
        return '白天';
    }

    function extractMoodStyle(input) {
        if (input.includes('极简') || input.includes('简约')) return '极简风格';
        if (input.includes('赛博') || input.includes('朋克')) return '赛博朋克';
        if (input.includes('电影')) return '电影感';
        return '真实感';
    }

    function extractScale(input) {
        if (input.includes('宏大') || input.includes('全景') || input.includes('鸟瞰')) return '宏大场景';
        if (input.includes('特写') || input.includes('细节')) return '特写';
        return '建筑';
    }

    /**
     * 节点B：参数映射（增强版 - 支持智能补充默认参数）
     * @param {Object} structuredTags - 结构化标签
     * @returns {Promise<Object>} 匹配的专业参数
     */
    async function mapParameters(structuredTags) {
        const kb = await loadKnowledgeBase();
        const params = {
            lens: [],
            lighting: [],
            film: [],
            style: [],
            quality: []
        };

        const input = JSON.stringify(structuredTags).toLowerCase();
        const subject = (structuredTags.subject || '').toLowerCase();
        const scale = (structuredTags.scale || '').toLowerCase();
        const timeLighting = (structuredTags.time_lighting || '').toLowerCase();
        const moodStyle = (structuredTags.mood_style || '').toLowerCase();

        // ========== 1. 镜头参数映射（智能推断+默认补充） ==========
        let hasLensMatched = false;

        // 根据scale匹配
        if (scale.includes('宏大') || scale.includes('全景') || scale.includes('鸟瞰') ||
            input.includes('城市') || input.includes('天际线')) {
            const lens = kb.lens_params.cityscape;
            if (lens) {
                params.lens.push(lens.lens, lens.aperture);
                if (lens.view) params.lens.push(lens.view);
                hasLensMatched = true;
            }
        } else if (scale.includes('特写') || scale.includes('人像') || scale.includes('人物') ||
                   subject.includes('人') || subject.includes('肖像')) {
            const lens = kb.lens_params.portrait;
            if (lens) {
                params.lens.push(lens.lens, lens.aperture);
                if (lens.effect) params.lens.push(lens.effect);
                hasLensMatched = true;
            }
        } else if (scale.includes('建筑') || subject.includes('建筑') ||
                   subject.includes('室内') || subject.includes('空间') ||
                   subject.includes('楼') || subject.includes('房') ||
                   subject.includes('博物馆') || subject.includes('美术馆')) {
            const lens = kb.lens_params.architecture;
            if (lens) {
                params.lens.push(lens.lens, lens.aperture);
                hasLensMatched = true;
            }
        }

        // 如果没有匹配到镜头参数，根据主体智能推断默认值
        if (!hasLensMatched) {
            if (subject.includes('风景') || subject.includes('自然') || subject.includes('山水')) {
                // 风景默认用广角
                const lens = kb.lens_params.cityscape; // 复用cityscape的广角
                if (lens) {
                    params.lens.push('14mm ultra-wide angle', 'f/11');
                    hasLensMatched = true;
                }
            } else if (subject.includes('产品') || subject.includes('物品') || subject.includes('静物')) {
                // 产品摄影默认用标准镜头
                const lens = kb.lens_params.standard;
                if (lens) {
                    params.lens.push(lens.lens, lens.aperture);
                    hasLensMatched = true;
                }
            } else {
                // 其他场景默认用建筑/标准镜头
                const lens = kb.lens_params.architecture;
                if (lens) {
                    params.lens.push(lens.lens, lens.aperture);
                    hasLensMatched = true;
                }
            }
        }

        // ========== 2. 光影参数映射（智能推断+默认补充） ==========
        let hasLightingMatched = false;

        if (timeLighting.includes('黄昏') || timeLighting.includes('傍晚') || timeLighting.includes('蓝调')) {
            const lighting = kb.lighting_params.blue_hour;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.quality) params.lighting.push(lighting.quality);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('日出') || timeLighting.includes('早晨') || timeLighting.includes('黄金')) {
            const lighting = kb.lighting_params.golden_hour;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.quality) params.lighting.push(lighting.quality);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('阴天') || timeLighting.includes('雨天') || timeLighting.includes('多云')) {
            const lighting = kb.lighting_params.overcast;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('夜晚') || timeLighting.includes('夜景') || timeLighting.includes('夜间')) {
            const lighting = kb.lighting_params.night;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.effect) params.lighting.push(lighting.effect);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('电影') || timeLighting.includes('戏剧') || moodStyle.includes('电影')) {
            const lighting = kb.lighting_params.cinematic;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.effect) params.lighting.push(lighting.effect);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('日落') || timeLighting.includes('夕阳')) {
            const lighting = kb.lighting_params.sunset;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.quality) params.lighting.push(lighting.quality);
                hasLightingMatched = true;
            }
        } else if (timeLighting.includes('黎明') || timeLighting.includes('清晨')) {
            const lighting = kb.lighting_params.dawn;
            if (lighting) {
                params.lighting.push(lighting.lighting);
                if (lighting.quality) params.lighting.push(lighting.quality);
                hasLightingMatched = true;
            }
        }

        // 如果没有匹配到光影参数，根据场景智能添加默认值
        if (!hasLightingMatched) {
            if (moodStyle.includes('赛博') || moodStyle.includes('朋克')) {
                // 赛博朋克默认夜景灯光
                params.lighting.push('night scene', 'neon lights', 'glowing atmosphere');
            } else if (subject.includes('室内') || subject.includes('建筑')) {
                // 室内/建筑默认柔和日光
                params.lighting.push('natural daylight', 'soft window light');
            } else if (subject.includes('人像') || subject.includes('人物')) {
                // 人像默认柔和光影
                params.lighting.push('soft diffused light', 'flattering illumination');
            } else {
                // 其他场景默认晴天自然光
                params.lighting.push('natural sunlight', 'clear sky lighting');
            }
            hasLightingMatched = true;
        }

        // ========== 3. 胶片/渲染参数映射（智能推断+默认补充） ==========
        let hasFilmMatched = false;

        if (moodStyle.includes('赛博') || moodStyle.includes('朋克')) {
            const film = kb.film_params.cyberpunk;
            if (film) {
                params.film.push(film.film);
                if (film.effect) params.film.push(film.effect);
                hasFilmMatched = true;
            }
        } else if (moodStyle.includes('电影') || moodStyle.includes('cinematic')) {
            const film = kb.film_params.cinematic;
            if (film) {
                params.film.push(film.film);
                if (film.quality) params.film.push(film.quality);
                hasFilmMatched = true;
            }
        } else if (moodStyle.includes('鲜艳') || moodStyle.includes('饱和') || moodStyle.includes('色彩')) {
            const film = kb.film_params.vibrant;
            if (film) {
                params.film.push(film.film);
                if (film.quality) params.film.push(film.quality);
                hasFilmMatched = true;
            }
        } else if (moodStyle.includes('渲染') || moodStyle.includes('3d') || moodStyle.includes('cg')) {
            const film = kb.film_params.render;
            if (film) {
                params.film.push(film.engine);
                if (film.quality) params.film.push(film.quality);
                hasFilmMatched = true;
            }
        }

        // 如果没有匹配到胶片参数，默认使用真实胶片
        if (!hasFilmMatched) {
            const film = kb.film_params.realistic;
            if (film) {
                params.film.push(film.film);
                if (film.quality) params.film.push(film.quality);
                hasFilmMatched = true;
            }
        }

        // ========== 4. 风格参数映射（智能推断+默认补充） ==========
        let hasStyleMatched = false;

        // 根据mood_style匹配
        const styleKeywords = kb.mapping_rules?.style_keywords || {};
        for (const [keyword, styleKey] of Object.entries(styleKeywords)) {
            if (input.includes(keyword) || moodStyle.includes(keyword)) {
                const style = kb.style_params[styleKey];
                if (style) {
                    params.style.push(style.style);
                    if (style.elements) params.style.push(style.elements);
                    hasStyleMatched = true;
                }
            }
        }

        // 如果没有匹配到风格参数，根据主体智能推断默认风格
        if (!hasStyleMatched) {
            if (subject.includes('建筑') || subject.includes('博物馆') || subject.includes('美术馆')) {
                // 建筑类默认现代风格
                const style = kb.style_params.modern;
                if (style) {
                    params.style.push(style.style);
                    if (style.elements) params.style.push(style.elements);
                    hasStyleMatched = true;
                }
            } else if (subject.includes('室内') || subject.includes('空间')) {
                // 室内默认极简风格
                const style = kb.style_params.minimalist;
                if (style) {
                    params.style.push(style.style);
                    if (style.elements) params.style.push(style.elements);
                    hasStyleMatched = true;
                }
            } else if (subject.includes('风景') || subject.includes('自然')) {
                // 风景默认有机/自然风格
                params.style.push('natural landscape', 'organic composition');
                hasStyleMatched = true;
            } else if (subject.includes('人像') || subject.includes('人物')) {
                // 人像默认真实感风格
                params.style.push('portrait photography', 'natural pose');
                hasStyleMatched = true;
            } else {
                // 其他场景默认现代风格
                const style = kb.style_params.modern;
                if (style) {
                    params.style.push(style.style);
                    hasStyleMatched = true;
                }
            }
        }

        // ========== 5. 质量修饰词（始终添加） ==========
        params.quality = kb.quality_modifiers || ['masterpiece', 'best quality', 'highly detailed'];

        // 记录智能补充的参数数量
        const supplementedCount = [!hasLensMatched, !hasLightingMatched, !hasFilmMatched, !hasStyleMatched]
            .filter(x => x === false).length;
        console.log(`[AgentWorkflow] Parameters mapped. Auto-supplemented defaults for ${4 - supplementedCount} categories.`);

        return params;
    }

    /**
     * 节点C：提示词融合
     * @param {string} userInput - 原始输入
     * @param {Object} parameters - 匹配的参数
     * @returns {Promise<string>} 英文提示词
     */
    async function synthesizePrompt(userInput, parameters, apiKey) {
        const prompt = `你是一个AI绘图提示词专家。请将用户的中文描述转换为专业的英文提示词。

格式要求：
[核心主体细节], [环境背景], [光影与天气], [匹配的摄影镜头参数], [匹配的胶片/渲染引擎参数], [画质修饰词]

用户原始需求："${userInput}"

已匹配的参数：
- 镜头: ${parameters.lens.join(', ')}
- 光影: ${parameters.lighting.join(', ')}
- 胶片: ${parameters.film.join(', ')}
- 风格: ${parameters.style.join(', ')}
- 质量: ${parameters.quality.join(', ')}

请直接输出英文提示词（纯英文，不含中文解释），要求：
1. 语法正确，专业术语准确
2. 按指定格式组织
3. 参数自然融入描述中`;

        try {
            const response = await callAgentAPI(prompt, apiKey);
            // 清理输出
            return response.replace(/["""']/g, '').trim();
        } catch (error) {
            console.error('Prompt synthesis failed:', error);
            return buildPromptFallback(userInput, parameters);
        }
    }

    /**
     * 提示词融合降级方案
     */
    function buildPromptFallback(userInput, parameters) {
        const parts = [
            userInput,
            parameters.lens.join(', '),
            parameters.lighting.join(', '),
            parameters.film.join(', '),
            parameters.style.join(', '),
            parameters.quality.join(', ')
        ];
        return parts.filter(p => p).join(', ');
    }

    /**
     * 调用Agent API
     */
    async function callAgentAPI(prompt, apiKey) {
        // 复用 api.js 中的 callQwenApi 或 optimizePrompt
        if (typeof optimizePrompt === 'function') {
            const result = await optimizePrompt({
                prompt: prompt,
                apiKey: apiKey,
                scene: 'general'
            });
            return result.optimizedPrompt || result;
        }

        // 降级：直接返回提示词
        return prompt;
    }

    /**
     * 主工作流执行
     * @param {string} userInput - 用户输入
     * @param {string} apiKey - API密钥
     * @returns {Promise<Object>} 工作流结果
     */
    async function execute(userInput, apiKey) {
        if (!userInput || !userInput.trim()) {
            throw new Error('请输入描述内容');
        }
        if (!apiKey) {
            throw new Error('请先设置API Key');
        }

        console.log('[AgentWorkflow] Starting execution...');

        // 节点A: 意图解析
        console.log('[AgentWorkflow] Node A: Analyzing intent...');
        const structuredTags = await analyzeIntent(userInput, apiKey);
        console.log('[AgentWorkflow] Intent analysis:', structuredTags);

        // 节点B: 参数映射
        console.log('[AgentWorkflow] Node B: Mapping parameters...');
        const parameters = await mapParameters(structuredTags);
        console.log('[AgentWorkflow] Mapped parameters:', parameters);

        // 节点C: 提示词融合
        console.log('[AgentWorkflow] Node C: Synthesizing prompt...');
        const finalPrompt = await synthesizePrompt(userInput, parameters, apiKey);
        console.log('[AgentWorkflow] Final prompt:', finalPrompt);

        return {
            originalInput: userInput,
            structuredTags: structuredTags,
            parameters: parameters,
            prompt: finalPrompt,
            tags: buildTagList(parameters)
        };
    }

    /**
     * 构建Tag列表用于UI展示
     */
    function buildTagList(parameters) {
        const tags = [];

        parameters.lens.forEach(t => tags.push({ category: '镜头', value: t }));
        parameters.lighting.forEach(t => tags.push({ category: '光影', value: t }));
        parameters.film.forEach(t => tags.push({ category: '胶片', value: t }));
        parameters.style.forEach(t => tags.push({ category: '风格', value: t }));
        parameters.quality.slice(0, 3).forEach(t => tags.push({ category: '质量', value: t }));

        return tags;
    }

    // 公开API
    return {
        execute: execute,
        analyzeIntent: analyzeIntent,
        mapParameters: mapParameters,
        synthesizePrompt: synthesizePrompt
    };
})();

// 导出（兼容Chrome扩展和普通JS）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentWorkflow;
}
