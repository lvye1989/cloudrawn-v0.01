/**
 * Qwen Canvas Workbench - Main Controller
 * 参考 Replicate FLUX 风格界面
 */

// 常量定义
const CONSTANTS = {
    CANVAS_SIZE: 512,
    MAX_PROMPT_LENGTH: 4000,
    DEBOUNCE_DELAY: 100,
    MIN_BRUSH_SIZE: 1,
    MAX_BRUSH_SIZE: 100,
    DEFAULT_SKETCH_SIZE: 3,
    DEFAULT_MASK_SIZE: 20,
    COLORS: {
        WHITE: 'white',
        GRAY: '#cccccc',
        MASK_BRUSH: 'rgba(139, 92, 246, 0.8)'
    },
    COMPOSITE: {
        SOURCE_OVER: 'source-over',
        DESTINATION_OUT: 'destination-out'
    }
};

// DOM 元素缓存
const elements = {};

// 状态管理
const state = {
    currentMode: 'home',
    apiKey: '',
    currentModel: 'qwen', // 当前选择的模型
    isDrawing: false,
    currentTool: 'brush',
    sketchColor: '#000000',
    sketchSize: CONSTANTS.DEFAULT_SKETCH_SIZE,
    maskSize: CONSTANTS.DEFAULT_MASK_SIZE,
    styleImage: null,         // 风格参考图（风格迁移模式）
    styleBaseImage: null,     // 底图（风格迁移模式）
    baseImage: null,
    maskImage: null,
    lastPoint: null,
    // 多图片编辑支持（局部修改模式）
    maskBaseImage: null,      // 底图（图片1）
    maskRefImage: null,       // 参考素材图（图片2）
    // 线稿模式参考图
    sketchRefImage: null,     // 线稿参考图
    // 主页选项
    homeSize: '1:1',
    homeQuality: 'high',
    // 建筑大师模式
    architectStyle: 'modern',  // 建筑风格
    architectView: 'aerial',   // 视角
    architectTime: 'day',      // 时间氛围
    architectRefImage: null,   // 建筑参考图
    architectStyleImage: null,  // 建筑风格参考图
    selectedMaster: 'none',    // 选中的建筑大师
    masterPrompts: {}          // 缓存的大师提示词
};

// Canvas contexts 缓存
const contexts = {};

// 事件监听器引用（用于清理）
const eventListeners = [];

// 图片对象引用（用于清理）
let currentMaskImage = null;

// 生成结果历史
const generatedResults = [];

// 多图片上传支持（风格迁移模式）
const uploadedImages = [];
let selectedImageIndex = -1;

// 线稿模式多图片上传支持
const sketchUploadedImages = [];
let sketchSelectedImageIndex = -1;

// 主页多图片上传支持
const homeUploadedImages = [];
let homeSelectedImageIndex = -1;

// 初始化
function init() {
    try {
        cacheElements();
        bindEvents();
        initializeApiKey();
        initializeCanvas();
        updateMode('home');

        // 初始化局部修改模式按钮状态
        updateMaskGenerateButtonState();

        // 初始化线稿模式图片画廊（渲染添加按钮）
        renderSketchImageGallery();

        // 初始化风格迁移模式图片画廊（渲染添加按钮）
        renderImageGallery();

        // 页面卸载时清理
        window.addEventListener('beforeunload', cleanup);

        // 初始化拖拽功能
        initResizeHandles();

        // 初始化建筑大师大师选择UI
        initMasterSelection();

        // 初始化 Nano Banana 参数可见性
        updateArchitectNanobananaParamsVisibility();
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('初始化失败: ' + error.message, 'error');
    }
}

// 初始化大师选择UI
function initMasterSelection() {
    // 设置默认选中"默认"
    const defaultAvatar = document.querySelector('.master-avatar[data-master="none"]');
    if (defaultAvatar) {
        defaultAvatar.classList.add('active');
    }
}

// 缓存 DOM 元素
function cacheElements() {
    // 模式切换
    elements.modeTabs = document.querySelectorAll('.mode-tab');
    elements.workspaceModes = document.querySelectorAll('.workspace-mode');

    // 控制面板
    elements.controlPanel = document.getElementById('control-panel');
    elements.controlModes = document.querySelectorAll('.control-mode');

    // 主页元素（现在主页是左侧栏）
    elements.homePrompt = document.getElementById('home-prompt');
    elements.homeGenerateBtn = document.getElementById('home-generate-btn');
    elements.homeStatus = document.getElementById('home-status');
    elements.homeSizeSelector = document.getElementById('home-size-selector');
    elements.homeQualitySelector = document.getElementById('home-quality-selector');
    elements.homeSizeBtns = document.querySelectorAll('.home-size-btn');
    elements.homeQualityBtns = document.querySelectorAll('.home-quality-btn');
    elements.homeQuickBtns = document.querySelectorAll('.home-quick-btn');

    // 主页设置面板（中间栏高级设置）
    elements.homeApiKey = document.getElementById('home-api-key');
    elements.homeSaveApiKeyBtn = document.getElementById('home-save-api-key');
    elements.homeMainPrompt = document.getElementById('home-main-prompt');
    elements.homeNegativePrompt = document.getElementById('home-negative-prompt');
    elements.homeImageSize = document.getElementById('home-image-size');
    elements.homeImageQuality = document.getElementById('home-image-quality');
    elements.homeImageCount = document.getElementById('home-image-count');
    elements.homePromptExtend = document.getElementById('home-prompt-extend');
    elements.homeImageGallery = document.getElementById('home-image-gallery');
    elements.homeAddImageBtn = document.getElementById('home-add-image-btn');
    elements.homeMultiImageInput = document.getElementById('home-multi-image-input');

    // Nano Banana 2 专属参数
    elements.nanobananaParams = document.getElementById('nanobanana-params');
    elements.nanobananaAspectRatio = document.getElementById('nanobanana-aspect-ratio');
    elements.nanobananaResolution = document.getElementById('nanobanana-resolution');
    elements.nanobananaOutputFormat = document.getElementById('nanobanana-output-format');
    elements.nanobananaGoogleSearch = document.getElementById('nanobanana-google-search');
    elements.nanobananaImageSearch = document.getElementById('nanobanana-image-search');

    // 可折叠区域
    elements.collapsibleHeaders = document.querySelectorAll('.collapsible-header');

    // 线稿模式
    elements.sketchCanvas = document.getElementById('sketch-canvas');
    elements.sketchColor = document.getElementById('sketch-color');
    elements.sketchSize = document.getElementById('sketch-size');
    elements.sketchClear = document.getElementById('sketch-clear');
    elements.sketchUploadArea = document.getElementById('sketch-upload-area');
    elements.sketchInput = document.getElementById('sketch-input');
    elements.sketchPreview = document.getElementById('sketch-preview');
    elements.sketchPlaceholder = document.getElementById('sketch-placeholder');
    elements.sketchRemove = document.getElementById('sketch-remove');

    // 风格迁移模式 - 双图上传
    elements.styleBaseUpload = document.getElementById('style-base-upload');
    elements.styleBaseInput = document.getElementById('style-base-input');
    elements.styleBasePreview = document.getElementById('style-base-preview');
    elements.styleBasePlaceholder = document.getElementById('style-base-placeholder');
    elements.styleBaseRemove = document.getElementById('style-base-remove');
    elements.styleRefUpload = document.getElementById('style-ref-upload');
    elements.styleRefInput = document.getElementById('style-ref-input');
    elements.styleRefPreview = document.getElementById('style-ref-preview');
    elements.styleRefPlaceholder = document.getElementById('style-ref-placeholder');
    elements.styleRefRemove = document.getElementById('style-ref-remove');

    // 线稿模式多图片上传
    elements.sketchImageGallery = document.getElementById('sketch-image-gallery-panel');
    elements.sketchAddImageBtn = document.getElementById('sketch-add-image-btn');
    elements.sketchMultiImageInput = document.getElementById('sketch-multi-image-input-panel');

    // 控制面板元素
    // 线稿模式控制面板
    elements.sketchColorPanel = document.getElementById('sketch-color-panel');
    elements.sketchSizePanel = document.getElementById('sketch-size-panel');
    elements.sketchPromptPanel = document.getElementById('sketch-prompt-panel');
    elements.sketchGeneratePanel = document.getElementById('sketch-generate-panel');
    elements.sketchImageGalleryPanel = document.getElementById('sketch-image-gallery-panel');
    elements.sketchAddImageBtnPanel = document.getElementById('sketch-add-image-btn-panel');
    elements.sketchMultiImageInputPanel = document.getElementById('sketch-multi-image-input-panel');
    elements.sketchOptimizeBtn = document.getElementById('sketch-optimize-btn');

    // 风格迁移模式控制面板
    elements.stylePromptPanel = document.getElementById('style-prompt-panel');
    elements.styleGeneratePanel = document.getElementById('style-generate-panel');
    elements.styleImageSizePanel = document.getElementById('style-image-size-panel');
    elements.styleStrengthPanel = document.getElementById('style-strength-panel');
    elements.styleOptimizeBtn = document.getElementById('style-optimize-btn');
    // 风格迁移模式 - 新增参数
    elements.styleNegativePromptPanel = document.getElementById('style-negative-prompt-panel');
    elements.styleImageQualityPanel = document.getElementById('style-image-quality-panel');
    elements.styleImageCountPanel = document.getElementById('style-image-count-panel');
    elements.stylePromptExtendPanel = document.getElementById('style-prompt-extend-panel');
    // 风格迁移模式 - 状态显示
    elements.styleStatus = document.getElementById('style-status');
    // Nano Banana 2 专属参数
    elements.styleNanobananaParams = document.getElementById('style-nanobanana-params');
    elements.styleNanobananaAspectRatio = document.getElementById('style-nanobanana-aspect-ratio');
    elements.styleNanobananaResolution = document.getElementById('style-nanobanana-resolution');
    elements.styleNanobananaOutputFormat = document.getElementById('style-nanobanana-output-format');
    elements.styleNanobananaGoogleSearch = document.getElementById('style-nanobanana-google-search');
    elements.styleNanobananaImageSearch = document.getElementById('style-nanobanana-image-search');

    // 局部修改模式控制面板
    elements.maskSizePanel = document.getElementById('mask-size-panel');
    elements.maskClearPanel = document.getElementById('mask-clear-panel');
    // 注意：mask-prompt-panel 已在控制面板中移除，提示词输入使用工作区的 mask-prompt
    elements.maskOptimizeBtnMain = document.getElementById('mask-optimize-btn-main');

    // 建筑大师模式控制面板
    elements.architectStylePanel = document.getElementById('architect-style-panel');
    elements.architectViewPanel = document.getElementById('architect-view-panel');
    elements.architectTimePanel = document.getElementById('architect-time-panel');
    elements.architectPromptPanel = document.getElementById('architect-prompt-panel');
    elements.architectNegativePromptPanel = document.getElementById('architect-negative-prompt-panel');
    elements.architectOptimizeBtn = document.getElementById('architect-optimize-btn');
    elements.architectGeneratePanel = document.getElementById('architect-generate-panel');
    elements.architectImageSizePanel = document.getElementById('architect-image-size-panel');
    elements.architectImageQualityPanel = document.getElementById('architect-image-quality-panel');
    elements.architectImageCountPanel = document.getElementById('architect-image-count-panel');
    elements.architectPromptExtendPanel = document.getElementById('architect-prompt-extend-panel');
    elements.architectStatus = document.getElementById('architect-status');

    // 建筑大师模式 - 参考图上传
    elements.architectRefUpload = document.getElementById('architect-ref-upload');
    elements.architectRefInput = document.getElementById('architect-ref-input');
    elements.architectRefPreview = document.getElementById('architect-ref-preview');
    elements.architectRefPlaceholder = document.getElementById('architect-ref-placeholder');
    elements.architectRefRemove = document.getElementById('architect-ref-remove');

    elements.architectStyleUpload = document.getElementById('architect-style-upload');
    elements.architectStyleInput = document.getElementById('architect-style-input');
    elements.architectStylePreview = document.getElementById('architect-style-preview');
    elements.architectStylePlaceholder = document.getElementById('architect-style-placeholder');
    elements.architectStyleRemove = document.getElementById('architect-style-remove');

    // 建筑大师 Skill 选择
    elements.architectSelectedMaster = document.getElementById('architect-selected-master');
    elements.architectMasterDesc = document.getElementById('architect-master-desc');
    elements.masterAvatars = document.querySelectorAll('.master-avatar');

    // 建筑大师 Nano Banana 2 专属参数
    elements.architectNanobananaParams = document.getElementById('architect-nanobanana-params');
    elements.architectNanobananaAspectRatio = document.getElementById('architect-nanobanana-aspect-ratio');
    elements.architectNanobananaResolution = document.getElementById('architect-nanobanana-resolution');
    elements.architectNanobananaOutputFormat = document.getElementById('architect-nanobanana-output-format');
    elements.architectNanobananaGoogleSearch = document.getElementById('architect-nanobanana-google-search');
    elements.architectNanobananaImageSearch = document.getElementById('architect-nanobanana-image-search');

    // 主页设置面板
    elements.homeMainPrompt = document.getElementById('home-main-prompt');
    elements.homeNegativePrompt = document.getElementById('home-negative-prompt');
    elements.homeOptimizeBtn = document.getElementById('home-optimize-btn');

    // 局部修改模式
    elements.maskBaseCanvas = document.getElementById('mask-base-canvas');
    elements.maskOverlayCanvas = document.getElementById('mask-overlay-canvas');
    elements.maskSize = document.getElementById('mask-size');
    elements.maskClear = document.getElementById('mask-clear');
    elements.maskCanvasOverlay = document.getElementById('mask-canvas-overlay');

    // 局部修改模式 - 多图片上传
    elements.maskBaseUpload = document.getElementById('mask-base-upload');
    elements.maskBaseInput = document.getElementById('mask-base-input');
    elements.maskBasePreview = document.getElementById('mask-base-preview');
    elements.maskBasePlaceholder = document.getElementById('mask-base-placeholder');
    elements.maskBaseRemove = document.getElementById('mask-base-remove');

    elements.maskRefUpload = document.getElementById('mask-ref-upload');
    elements.maskRefInput = document.getElementById('mask-ref-input');
    elements.maskRefPreview = document.getElementById('mask-ref-preview');
    elements.maskRefPlaceholder = document.getElementById('mask-ref-placeholder');
    elements.maskRefRemove = document.getElementById('mask-ref-remove');

    // 结果面板
    elements.resultList = document.getElementById('result-list');
    elements.clearResults = document.getElementById('clear-results');

    // 涂抹预览区
    elements.maskPreviewSection = document.getElementById('mask-preview-section');
    elements.maskPreviewCanvas = document.getElementById('mask-preview-canvas');

    // 验证关键元素
    validateElements();
}

// 验证关键元素存在
function validateElements() {
    // 主页元素是可选的（默认显示）
    const required = ['sketchCanvas', 'maskBaseCanvas', 'maskOverlayCanvas', 'homePrompt', 'homeGenerateBtn'];
    const missing = required.filter(id => !elements[id]);
    if (missing.length > 0) {
        throw new Error(`Missing required elements: ${missing.join(', ')}`);
    }
}

// 添加事件监听器（带清理追踪）
function addListener(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler });
}

// 清理函数
function cleanup() {
    // 移除所有事件监听器
    eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListeners.length = 0;

    // 清理图片对象
    if (currentMaskImage) {
        currentMaskImage.onload = null;
        currentMaskImage.onerror = null;
        currentMaskImage.src = '';
        currentMaskImage = null;
    }

    // 清理 state 中的图片数据
    state.styleImage = null;
    state.styleBaseImage = null;
    state.baseImage = null;
    state.maskImage = null;
    state.maskBaseImage = null;
    state.maskRefImage = null;
    state.sketchRefImage = null;

    // 清理生成结果和多图片数据
    generatedResults.length = 0;
    uploadedImages.length = 0;
    selectedImageIndex = -1;
    sketchUploadedImages.length = 0;
    sketchSelectedImageIndex = -1;

    // 清理 DOM 中的图片资源（先释放 img.src 再清空 DOM）
    const cleanupImageGallery = (gallery) => {
        if (!gallery) return;
        const imgs = gallery.querySelectorAll('img');
        imgs.forEach(img => {
            img.src = '';
            img.onload = null;
            img.onerror = null;
        });
        gallery.innerHTML = '';
    };

    cleanupImageGallery(elements.imageGallery);
    cleanupImageGallery(elements.sketchImageGallery);

    if (elements.stylePreview) {
        elements.stylePreview.src = '';
        elements.stylePreview.hidden = true;
    }
    if (elements.resultList) elements.resultList.innerHTML = '';

    // 清理 Canvas 数据
    if (contexts.sketch) {
        contexts.sketch.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
        contexts.sketch.fillStyle = CONSTANTS.COLORS.WHITE;
        contexts.sketch.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }
    if (contexts.maskBase) {
        contexts.maskBase.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
        contexts.maskBase.fillStyle = CONSTANTS.COLORS.GRAY;
        contexts.maskBase.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }
    if (contexts.maskOverlay) {
        contexts.maskOverlay.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }

    // 清理 contexts
    Object.keys(contexts).forEach(key => {
        contexts[key] = null;
    });
}

// 绑定事件
function bindEvents() {
    // 模式切换
    elements.modeTabs.forEach(tab => {
        addListener(tab, 'click', () => {
            const mode = tab.dataset.mode;
            if (mode) updateMode(mode);
        });
    });

    // API Key（使用主页的设置面板）
    addListener(elements.homeSaveApiKeyBtn, 'click', saveHomeApiKey);
    addListener(elements.homeApiKey, 'keypress', (e) => {
        if (e.key === 'Enter') saveHomeApiKey();
    });

    // 可折叠区域
    elements.collapsibleHeaders.forEach(header => {
        addListener(header, 'click', () => toggleCollapsible(header));
    });

    // 线稿工具
    addListener(elements.sketchColor, 'change', (e) => {
        state.sketchColor = e.target.value;
    });
    addListener(elements.sketchSize, 'input', debounce((e) => {
        const size = parseInt(e.target.value);
        state.sketchSize = validateBrushSize(size, CONSTANTS.DEFAULT_SKETCH_SIZE);
        const valueDisplay = e.target.nextElementSibling;
        if (valueDisplay) valueDisplay.textContent = state.sketchSize;
    }, CONSTANTS.DEBOUNCE_DELAY));
    addListener(elements.sketchClear, 'click', clearSketchCanvas);

    // 线稿参考图上传
    if (elements.sketchUploadArea) {
        addListener(elements.sketchUploadArea, 'click', () => elements.sketchInput?.click());
        addListener(elements.sketchUploadArea, 'dragover', handleDragOver);
        addListener(elements.sketchUploadArea, 'dragleave', handleDragLeave);
        addListener(elements.sketchUploadArea, 'drop', handleSketchDrop);
    }
    addListener(elements.sketchInput, 'change', handleSketchSelect);
    addListener(elements.sketchRemove, 'click', (e) => {
        e.stopPropagation();
        removeSketchRefImage();
    });

    // 风格迁移模式 - 底图上传
    if (elements.styleBaseUpload) {
        addListener(elements.styleBaseUpload, 'click', () => elements.styleBaseInput?.click());
        addListener(elements.styleBaseUpload, 'dragover', handleDragOver);
        addListener(elements.styleBaseUpload, 'dragleave', handleDragLeave);
        addListener(elements.styleBaseUpload, 'drop', handleStyleBaseDrop);
    }
    addListener(elements.styleBaseInput, 'change', handleStyleBaseSelect);
    addListener(elements.styleBaseRemove, 'click', (e) => {
        e.stopPropagation();
        removeStyleBaseImage();
    });

    // 风格迁移模式 - 风格参考图上传
    if (elements.styleRefUpload) {
        addListener(elements.styleRefUpload, 'click', () => elements.styleRefInput?.click());
        addListener(elements.styleRefUpload, 'dragover', handleDragOver);
        addListener(elements.styleRefUpload, 'dragleave', handleDragLeave);
        addListener(elements.styleRefUpload, 'drop', handleStyleRefDrop);
    }
    addListener(elements.styleRefInput, 'change', handleStyleRefSelect);
    addListener(elements.styleRefRemove, 'click', (e) => {
        e.stopPropagation();
        removeStyleRefImage();
    });

    // 线稿模式多图片上传
    // 注意：sketchAddImageBtn 的事件在 renderSketchImageGallery 中动态绑定
    // 只需要绑定 input 的 change 事件
    if (elements.sketchMultiImageInput) {
        addListener(elements.sketchMultiImageInput, 'change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSketchMultipleImages(e.target.files);
                e.target.value = ''; // 清空以允许重复选择相同文件
            }
        });
    }

    // 蒙版工具
    addListener(elements.maskSize, 'input', debounce((e) => {
        const size = parseInt(e.target.value);
        state.maskSize = validateBrushSize(size, CONSTANTS.DEFAULT_MASK_SIZE);
        const valueDisplay = e.target.nextElementSibling;
        if (valueDisplay) valueDisplay.textContent = state.maskSize;
        // 实时更新预览区的笔刷大小
        updateMaskPreview();
    }, CONSTANTS.DEBOUNCE_DELAY));
    addListener(elements.maskClear, 'click', clearMaskCanvas);

    // 局部修改模式 - 多图片上传事件绑定
    // 底图上传
    if (elements.maskBaseUpload) {
        addListener(elements.maskBaseUpload, 'click', () => elements.maskBaseInput?.click());
        addListener(elements.maskBaseUpload, 'dragover', handleDragOver);
        addListener(elements.maskBaseUpload, 'dragleave', handleDragLeave);
        addListener(elements.maskBaseUpload, 'drop', handleMaskBaseDrop);
    }
    addListener(elements.maskBaseInput, 'change', handleMaskBaseSelect);
    addListener(elements.maskBaseRemove, 'click', (e) => {
        e.stopPropagation();
        removeMaskBaseImage();
    });

    // 参考素材图上传
    if (elements.maskRefUpload) {
        addListener(elements.maskRefUpload, 'click', () => elements.maskRefInput?.click());
        addListener(elements.maskRefUpload, 'dragover', handleDragOver);
        addListener(elements.maskRefUpload, 'dragleave', handleDragLeave);
        addListener(elements.maskRefUpload, 'drop', handleMaskRefDrop);
    }
    addListener(elements.maskRefInput, 'change', handleMaskRefSelect);
    addListener(elements.maskRefRemove, 'click', (e) => {
        e.stopPropagation();
        removeMaskRefImage();
    });

    // 工具按钮
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        addListener(btn, 'click', () => {
            const tool = btn.dataset.tool;
            if (tool) setTool(tool, btn);
        });
    });

    // 局部修改模式生成按钮
    const maskSendBtn = document.getElementById('mask-send');
    if (maskSendBtn) {
        addListener(maskSendBtn, 'click', handleMaskGenerate);
    }

    // 建筑大师模式事件绑定
    bindArchitectEvents();

    // 控制面板事件绑定
    bindControlPanelEvents();

    // 主页事件绑定
    bindHomeEvents();
}

// 建筑大师模式事件绑定
function bindArchitectEvents() {
    // 建筑风格选择
    if (elements.architectStylePanel) {
        addListener(elements.architectStylePanel, 'change', (e) => {
            state.architectStyle = e.target.value;
        });
    }

    // 视角选择
    if (elements.architectViewPanel) {
        addListener(elements.architectViewPanel, 'change', (e) => {
            state.architectView = e.target.value;
        });
    }

    // 时间氛围选择
    if (elements.architectTimePanel) {
        addListener(elements.architectTimePanel, 'change', (e) => {
            state.architectTime = e.target.value;
        });
    }

    // 参考图上传
    if (elements.architectRefUpload) {
        addListener(elements.architectRefUpload, 'click', () => elements.architectRefInput?.click());
        addListener(elements.architectRefUpload, 'dragover', handleDragOver);
        addListener(elements.architectRefUpload, 'dragleave', handleDragLeave);
        addListener(elements.architectRefUpload, 'drop', handleArchitectRefDrop);
    }
    if (elements.architectRefInput) {
        addListener(elements.architectRefInput, 'change', handleArchitectRefSelect);
    }
    if (elements.architectRefRemove) {
        addListener(elements.architectRefRemove, 'click', (e) => {
            e.stopPropagation();
            removeArchitectRefImage();
        });
    }

    // 风格参考图上传
    if (elements.architectStyleUpload) {
        addListener(elements.architectStyleUpload, 'click', () => elements.architectStyleInput?.click());
        addListener(elements.architectStyleUpload, 'dragover', handleDragOver);
        addListener(elements.architectStyleUpload, 'dragleave', handleDragLeave);
        addListener(elements.architectStyleUpload, 'drop', handleArchitectStyleDrop);
    }
    if (elements.architectStyleInput) {
        addListener(elements.architectStyleInput, 'change', handleArchitectStyleSelect);
    }
    if (elements.architectStyleRemove) {
        addListener(elements.architectStyleRemove, 'click', (e) => {
            e.stopPropagation();
            removeArchitectStyleImage();
        });
    }

    // 生成按钮
    if (elements.architectGeneratePanel) {
        addListener(elements.architectGeneratePanel, 'click', handleArchitectGenerate);
    }

    // 优化按钮
    if (elements.architectOptimizeBtn) {
        addListener(elements.architectOptimizeBtn, 'click', handleArchitectOptimizePrompt);
    }

    // 大师头像选择
    if (elements.masterAvatars) {
        elements.masterAvatars.forEach(avatar => {
            addListener(avatar, 'click', () => handleMasterSelect(avatar));
        });
    }

    // Nano Banana 参数监听（用于显示/隐藏）
    if (elements.modelSelector) {
        addListener(elements.modelSelector, 'change', updateArchitectNanobananaParamsVisibility);
    }
}

// 更新建筑大师 Nano Banana 参数显示/隐藏
function updateArchitectNanobananaParamsVisibility() {
    const currentModel = elements.modelSelector?.value || 'qwen';
    if (elements.architectNanobananaParams) {
        elements.architectNanobananaParams.style.display = currentModel === 'nanobanana' ? 'grid' : 'none';
    }
}

// 控制面板事件绑定
function bindControlPanelEvents() {
    // 线稿模式控制面板事件
    if (elements.sketchColorPanel) {
        addListener(elements.sketchColorPanel, 'change', (e) => {
            state.sketchColor = e.target.value;
            // 同步到主画布工具栏
            if (elements.sketchColor) {
                elements.sketchColor.value = e.target.value;
            }
        });
    }

    if (elements.sketchSizePanel) {
        addListener(elements.sketchSizePanel, 'input', debounce((e) => {
            const size = parseInt(e.target.value);
            state.sketchSize = validateBrushSize(size, CONSTANTS.DEFAULT_SKETCH_SIZE);
            const valueDisplay = e.target.nextElementSibling;
            if (valueDisplay) valueDisplay.textContent = state.sketchSize;
            // 同步到主画布工具栏
            if (elements.sketchSize) {
                elements.sketchSize.value = state.sketchSize;
                const toolbarValueDisplay = elements.sketchSize.nextElementSibling;
                if (toolbarValueDisplay) toolbarValueDisplay.textContent = state.sketchSize;
            }
        }, CONSTANTS.DEBOUNCE_DELAY));
    }

    if (elements.sketchGeneratePanel) {
        addListener(elements.sketchGeneratePanel, 'click', handleSketchGenerate);
    }

    // 注意：sketchAddImageBtnPanel 和 sketchMultiImageInputPanel 的事件
    // 在 renderSketchImageGallery 中动态绑定，因为按钮是动态创建的
    // 只需要绑定 input 的 change 事件
    if (elements.sketchMultiImageInputPanel) {
        addListener(elements.sketchMultiImageInputPanel, 'change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSketchMultipleImages(e.target.files);
                e.target.value = '';
            }
        });
    }

    // 风格迁移模式控制面板事件
    if (elements.styleGeneratePanel) {
        addListener(elements.styleGeneratePanel, 'click', handleStyleGenerate);
    }

    // 局部修改模式控制面板事件
    if (elements.maskSizePanel) {
        addListener(elements.maskSizePanel, 'input', debounce((e) => {
            const size = parseInt(e.target.value);
            state.maskSize = validateBrushSize(size, CONSTANTS.DEFAULT_MASK_SIZE);
            const valueDisplay = e.target.nextElementSibling;
            if (valueDisplay) valueDisplay.textContent = state.maskSize;
            // 同步到主画布工具栏
            if (elements.maskSize) {
                elements.maskSize.value = state.maskSize;
                const toolbarValueDisplay = elements.maskSize.nextElementSibling;
                if (toolbarValueDisplay) toolbarValueDisplay.textContent = state.maskSize;
            }
            // 实时更新预览区的笔刷大小
            updateMaskPreview();
        }, CONSTANTS.DEBOUNCE_DELAY));
    }

    if (elements.maskClearPanel) {
        addListener(elements.maskClearPanel, 'click', clearMaskCanvas);
    }

    if (elements.maskGeneratePanel) {
        addListener(elements.maskGeneratePanel, 'click', handleMaskGenerate);
    }

    // 优化按钮事件绑定
    if (elements.sketchOptimizeBtn) {
        addListener(elements.sketchOptimizeBtn, 'click', () => {
            handleOptimizeButton('sketch-prompt-panel', '线稿绘制模式');
        });
    }

    if (elements.styleOptimizeBtn) {
        addListener(elements.styleOptimizeBtn, 'click', () => {
            handleOptimizeButton('style-prompt-panel', '风格迁移模式');
        });
    }

    if (elements.maskOptimizeBtn) {
        addListener(elements.maskOptimizeBtn, 'click', () => {
            handleOptimizeButton('mask-prompt-panel', '局部修改模式');
        });
    }

    if (elements.maskOptimizeBtnMain) {
        addListener(elements.maskOptimizeBtnMain, 'click', () => {
            handleOptimizeButton('mask-prompt', '局部修改模式');
        });
    }

    if (elements.homeOptimizeBtn) {
        addListener(elements.homeOptimizeBtn, 'click', () => {
            handleOptimizeButton('home-main-prompt', '主页AI图片生成');
        });
    }
}

// 主页事件绑定
function bindHomeEvents() {
    // 主页生成按钮
    if (elements.homeGenerateBtn) {
        addListener(elements.homeGenerateBtn, 'click', handleHomeGenerate);
    }

    // 主页输入框 Enter 键提交
    if (elements.homePrompt) {
        addListener(elements.homePrompt, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleHomeGenerate();
            }
        });

        // 自动调整输入框高度
        addListener(elements.homePrompt, 'input', () => {
            autoResizeTextarea(elements.homePrompt);
        });
    }

    // 尺寸选择按钮
    elements.homeSizeBtns.forEach(btn => {
        addListener(btn, 'click', () => {
            const size = btn.dataset.size;
            if (size) {
                state.homeSize = size;
                elements.homeSizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });

    // 质量选择按钮
    elements.homeQualityBtns.forEach(btn => {
        addListener(btn, 'click', () => {
            const quality = btn.dataset.quality;
            if (quality) {
                state.homeQuality = quality;
                elements.homeQualityBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });

    // 快捷功能按钮
    elements.homeQuickBtns.forEach(btn => {
        addListener(btn, 'click', () => {
            const mode = btn.dataset.mode;
            if (mode) {
                updateMode(mode);
            }
        });
    });

    // 主页设置面板事件
    bindHomeSettingsEvents();
}

// 主页设置面板事件绑定（中间栏高级设置）
function bindHomeSettingsEvents() {
    // API Key 保存
    if (elements.homeSaveApiKeyBtn) {
        addListener(elements.homeSaveApiKeyBtn, 'click', saveHomeApiKey);
    }
    if (elements.homeApiKey) {
        addListener(elements.homeApiKey, 'keypress', (e) => {
            if (e.key === 'Enter') saveHomeApiKey();
        });
    }

    // 模型选择
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector) {
        // 加载保存的模型选择
        loadSavedModel();

        addListener(modelSelector, 'change', (e) => {
            const selectedModel = e.target.value;
            state.currentModel = selectedModel;

            // 保存选择到 storage
            chrome.storage.local.set({ currentModel: selectedModel });

            // 更新 API Key placeholder
            updateApiKeyPlaceholder(selectedModel);

            // 调用 api.js 的 switchModel 函数
            if (typeof switchModel === 'function') {
                switchModel(selectedModel);
            }

            // 显示/隐藏 Nano Banana 2 专属参数
            toggleNanoBananaParams(selectedModel);

            updateStatus(`已切换到: ${e.target.options[e.target.selectedIndex].text}`);
        });
    }

    // 参考图片上传
    if (elements.homeAddImageBtn) {
        addListener(elements.homeAddImageBtn, 'click', () => {
            elements.homeMultiImageInput?.click();
        });
    }
    if (elements.homeMultiImageInput) {
        addListener(elements.homeMultiImageInput, 'change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleHomeMultipleImages(e.target.files);
                e.target.value = '';
            }
        });
    }

    // 自动调整详细提示词输入框高度
    if (elements.homeMainPrompt) {
        addListener(elements.homeMainPrompt, 'input', () => {
            autoResizeTextarea(elements.homeMainPrompt);
        });
    }
}

// 加载保存的模型选择
async function loadSavedModel() {
    try {
        const result = await chrome.storage.local.get('currentModel');
        const savedModel = result.currentModel || 'qwen';
        state.currentModel = savedModel;

        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            modelSelector.value = savedModel;
        }

        // 更新 API Key placeholder
        updateApiKeyPlaceholder(savedModel);

        // 同步 api.js 中的模型
        if (typeof switchModel === 'function') {
            switchModel(savedModel);
        }

        // 显示/隐藏 Nano Banana 2 专属参数
        toggleNanoBananaParams(savedModel);
    } catch (error) {
        console.error('Failed to load model:', error);
    }
}

// 显示/隐藏 Nano Banana 2 专属参数
function toggleNanoBananaParams(model) {
    if (elements.nanobananaParams) {
        elements.nanobananaParams.style.display = model === 'nanobanana' ? 'grid' : 'none';
    }
    if (elements.styleNanobananaParams) {
        elements.styleNanobananaParams.style.display = model === 'nanobanana' ? 'grid' : 'none';
    }
}

// 根据选择的模型更新 API Key placeholder
function updateApiKeyPlaceholder(model) {
    const apiKeyInput = document.getElementById('home-api-key');
    if (!apiKeyInput) return;

    const placeholders = {
        qwen: '输入阿里云百炼 API Key',
        nanobanana: '输入 Replicate API Token'
    };

    apiKeyInput.placeholder = placeholders[model] || '输入 API Key';
}
async function saveHomeApiKey() {
    const key = elements.homeApiKey?.value?.trim();
    if (!key) {
        updateHomeStatus('请输入 API Key', 'error');
        return;
    }

    // 验证 API Key 格式（应该只包含 ASCII 可打印字符）
    if (/[^\x20-\x7E]/.test(key)) {
        updateHomeStatus('API Key 格式不正确，请检查是否包含中文字符', 'error');
        return;
    }

    try {
        await chrome.storage.local.set({ apiKey: key });
        state.apiKey = key;

        // 同步更新主页设置面板
        if (elements.homeApiKey) {
            elements.homeApiKey.value = maskApiKey(key);
        }

        updateHomeStatus('API Key 已保存');
    } catch (error) {
        updateHomeStatus('保存失败: ' + error.message, 'error');
    }
}

// 主页多图片上传处理
function handleHomeMultipleImages(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        updateHomeStatus('请上传有效的图片文件', 'error');
        return;
    }

    imageFiles.forEach(file => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                homeUploadedImages.push({
                    data: e.target.result,
                    name: file.name
                });
                renderHomeImageGallery();
            } catch (err) {
                console.error('Image processing error:', err);
            }
        };

        reader.onerror = () => {
            updateHomeStatus('图片读取失败', 'error');
        };

        try {
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('FileReader error:', err);
            updateHomeStatus('图片读取失败', 'error');
        }
    });
}

// 渲染主页图片画廊
function renderHomeImageGallery() {
    const gallery = elements.homeImageGallery;
    if (!gallery) return;

    // 清空现有内容
    gallery.innerHTML = '';

    // 渲染已上传的图片
    homeUploadedImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'home-gallery-item';
        if (homeSelectedImageIndex === index) {
            item.classList.add('selected');
        }
        item.dataset.index = index;

        const image = document.createElement('img');
        image.src = img.data;
        image.alt = img.name || `图片 ${index + 1}`;
        image.draggable = false;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.title = '删除';
        removeBtn.textContent = '×';

        const currentIndex = index;
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeHomeUploadedImage(currentIndex);
        });

        item.appendChild(image);
        item.appendChild(removeBtn);

        item.addEventListener('click', () => {
            selectHomeImage(currentIndex);
            renderHomeImageGallery();
        });

        gallery.appendChild(item);
    });

    // 创建添加按钮
    const newAddBtn = document.createElement('div');
    newAddBtn.className = 'home-gallery-item home-gallery-add';
    newAddBtn.id = 'home-add-image-btn';
    newAddBtn.title = '添加参考图片';
    newAddBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    `;

    newAddBtn.addEventListener('click', () => {
        if (elements.homeMultiImageInput) {
            elements.homeMultiImageInput.click();
        }
    });

    gallery.appendChild(newAddBtn);
    elements.homeAddImageBtn = newAddBtn;

    // 更新状态提示
    if (homeUploadedImages.length > 0) {
        updateHomeStatus(`已上传 ${homeUploadedImages.length} 张参考图，点击选择使用`);
    }
}

// 选择主页图片
function selectHomeImage(index) {
    homeSelectedImageIndex = index;
    if (homeUploadedImages[index]) {
        updateHomeStatus(`已选择参考图: ${homeUploadedImages[index].name}`);
    }
}

// 删除主页上传的图片
function removeHomeUploadedImage(index) {
    homeUploadedImages.splice(index, 1);
    if (homeSelectedImageIndex === index) {
        homeSelectedImageIndex = -1;
    } else if (homeSelectedImageIndex > index) {
        homeSelectedImageIndex--;
    }
    renderHomeImageGallery();
}

// 自动调整 textarea 高度
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// 优化提示词 - 使用 Qwen3.5 模型（返回原始结果，不自动更新输入框）
async function optimizePromptText(prompt, negativePrompt = '', scene = '') {
    // 保存原始值，确保不会被污染
    const originalPrompt = prompt;
    const originalNegativePrompt = negativePrompt;

    try {
        // 检查是否包含中文字符
        const hasChinese = /[\u4e00-\u9fa5]/.test(prompt);

        // 如果没有中文，不进行优化
        if (!hasChinese) {
            return { prompt: originalPrompt, negativePrompt: originalNegativePrompt, wasOptimized: false };
        }

        updateStatus('正在优化提示词...', 'loading');

        // 使用局部变量，避免污染外部 state
        const currentApiKey = state.apiKey;

        // 验证 API Key 格式
        if (!currentApiKey || /[^\x20-\x7E]/.test(currentApiKey)) {
            console.error('API Key 格式不正确，包含非 ASCII 字符');
            return { prompt: originalPrompt, negativePrompt: originalNegativePrompt, wasOptimized: false };
        }

        const result = await optimizePrompt({
            prompt: originalPrompt,
            apiKey: currentApiKey,
            negativePrompt: originalNegativePrompt,
            scene: scene
        });

        // 验证返回结果，确保没有被污染
        const safeOptimizedPrompt = result.optimizedPrompt && typeof result.optimizedPrompt === 'string'
            ? result.optimizedPrompt
            : originalPrompt;
        const safeOptimizedNegative = result.optimizedNegative && typeof result.optimizedNegative === 'string'
            ? result.optimizedNegative
            : originalNegativePrompt;

        return {
            prompt: safeOptimizedPrompt,
            negativePrompt: safeOptimizedNegative,
            wasOptimized: true
        };
    } catch (error) {
        console.error('提示词优化失败:', error);
        // 优化失败时返回原始提示词，确保使用保存的原始值
        return { prompt: originalPrompt, negativePrompt: originalNegativePrompt, wasOptimized: false };
    }
}

// 优化按钮点击处理 - 直接更新输入框内容
async function handleOptimizeButton(targetElementId, scene = '') {
    const textarea = document.getElementById(targetElementId);
    if (!textarea) {
        console.error('找不到输入框:', targetElementId);
        return;
    }

    const prompt = textarea.value?.trim();
    if (!prompt) {
        updateStatus('请先输入提示词', 'error');
        return;
    }

    // 检查是否有 API Key
    if (!state.apiKey) {
        updateStatus('请先设置 API Key', 'error');
        const apiKeyInput = document.getElementById('api-key') || document.getElementById('home-api-key');
        apiKeyInput?.focus();
        return;
    }

    // 获取对应的负面提示词（如果有）
    let negativePrompt = '';
    if (targetElementId === 'home-main-prompt') {
        const negTextarea = document.getElementById('home-negative-prompt');
        negativePrompt = negTextarea?.value?.trim() || '';
    }

    try {
        const result = await optimizePromptText(prompt, negativePrompt, scene);

        if (result.wasOptimized) {
            // 更新输入框内容
            textarea.value = result.prompt;

            // 如果有对应的负面提示词输入框，也更新
            if (targetElementId === 'home-main-prompt') {
                const negTextarea = document.getElementById('home-negative-prompt');
                if (negTextarea && result.negativePrompt) {
                    negTextarea.value = result.negativePrompt;
                }
            }

            // 调整输入框高度
            autoResizeTextarea(textarea);

            updateStatus('提示词已优化！', 'success');
        } else {
            updateStatus('提示词无需优化（已为英文）', 'success');
        }
    } catch (error) {
        console.error('优化失败:', error);
        updateStatus('提示词优化失败: ' + error.message, 'error');
    }
}

// 主页生成处理
async function handleHomeGenerate() {
    try {
        if (!state.apiKey) {
            updateHomeStatus('请先设置 API Key', 'error');
            elements.homeApiKey?.focus();
            return;
        }

        const prompt = elements.homePrompt?.value?.trim();
        if (!prompt) {
            updateHomeStatus('请输入提示词', 'error');
            elements.homePrompt?.focus();
            return;
        }

        if (prompt.length > CONSTANTS.MAX_PROMPT_LENGTH) {
            updateHomeStatus(`提示词不能超过 ${CONSTANTS.MAX_PROMPT_LENGTH} 字符`, 'error');
            return;
        }

        // 获取设置面板中的参数
        const mainPrompt = elements.homeMainPrompt?.value?.trim() || '';
        const negativePrompt = elements.homeNegativePrompt?.value?.trim() || '';
        const size = elements.homeImageSize?.value || '1024*1024';
        const quality = elements.homeImageQuality?.value || 'high';
        const promptExtend = elements.homePromptExtend?.checked ?? true;

        // 合并提示词（主输入框 + 详细提示词）
        const finalPrompt = mainPrompt ? `${prompt}，${mainPrompt}` : prompt;

        // 优化提示词（中译英+优化）
        const optimized = await optimizePromptText(finalPrompt, negativePrompt, '主页AI图片生成');
        if (optimized.wasOptimized) {
            updateHomeStatus('提示词已优化，正在生成...');
        }

        const params = {
            prompt: optimized.prompt,
            apiKey: state.apiKey,
            negativePrompt: optimized.negativePrompt,
            size,
            quality,
            promptExtend
        };

        // 添加 Nano Banana 2 专属参数
        if (state.currentModel === 'nanobanana') {
            params.aspectRatio = elements.nanobananaAspectRatio?.value || '1:1';
            params.resolution = elements.nanobananaResolution?.value || '1K';
            params.outputFormat = elements.nanobananaOutputFormat?.value || 'jpg';
            params.googleSearch = elements.nanobananaGoogleSearch?.checked ?? false;
            params.imageSearch = elements.nanobananaImageSearch?.checked ?? false;
        }

        updateHomeStatus('正在生成...', 'loading');
        if (elements.homeGenerateBtn) elements.homeGenerateBtn.disabled = true;

        let result;

        // 如果有选中的参考图片，使用带参考的生成
        if (homeSelectedImageIndex >= 0 && homeUploadedImages[homeSelectedImageIndex]) {
            const refImage = homeUploadedImages[homeSelectedImageIndex].data;
            result = await generateWithReferenceUnified({
                ...params,
                refImage: refImage
            });
        } else {
            result = await generateImageUnified(params);
        }

        // 添加到结果预览栏（使用优化后的提示词）
        addResult(result, optimized.prompt);
        updateHomeStatus(optimized.wasOptimized ? '提示词已优化，生成成功！' : '生成成功！', 'success');

    } catch (error) {
        console.error('Home generation error:', error);
        updateHomeStatus('生成失败: ' + error.message, 'error');
    } finally {
        if (elements.homeGenerateBtn) elements.homeGenerateBtn.disabled = false;
    }
}

// 线稿模式生成处理
async function handleSketchGenerate() {
    const generatingStatus = document.getElementById('sketch-generating-status');
    try {
        if (!state.apiKey) {
            updateStatus('请先设置 API Key', 'error');
            return;
        }

        // 获取画布数据
        if (!elements.sketchCanvas) {
            updateStatus('画布未初始化', 'error');
            return;
        }

        // 显示生成中状态
        if (generatingStatus) {
            generatingStatus.style.display = 'block';
        }

        const sketchData = elements.sketchCanvas.toDataURL('image/png');
        const promptInput = elements.sketchPromptPanel || document.getElementById('sketch-prompt');
        const prompt = promptInput?.value?.trim() || '将线稿转换为完整图像';

        // 优化提示词（中译英+优化）
        const optimized = await optimizePromptText(prompt, '', '线稿绘制模式');
        if (optimized.wasOptimized) {
            updateStatus('提示词已优化，正在生成...');
        }

        updateStatus('正在生成...', 'loading');

        let result;

        // 如果有上传的参考图，使用带参考的生成
        if (state.sketchRefImage) {
            result = await generateWithReferenceUnified({
                prompt: optimized.prompt,
                apiKey: state.apiKey,
                referenceImage: state.sketchRefImage,
                sketchImage: sketchData
            });
        } else {
            // 否则使用普通线稿生成
            result = await generateWithReferenceUnified({
                prompt: optimized.prompt,
                apiKey: state.apiKey,
                referenceImage: sketchData
            });
        }

        addResult(result, optimized.prompt);
        updateStatus(optimized.wasOptimized ? '提示词已优化，生成成功！' : '生成成功！', 'success');

    } catch (error) {
        console.error('Sketch generation error:', error);
        updateStatus('生成失败: ' + error.message, 'error');
    } finally {
        // 隐藏生成中状态
        if (generatingStatus) {
            generatingStatus.style.display = 'none';
        }
    }
}

// 风格迁移模式生成处理
async function handleStyleGenerate() {
    try {
        if (!state.apiKey) {
            updateStyleStatus('请先设置 API Key', 'error');
            return;
        }

        if (!state.styleBaseImage) {
            updateStyleStatus('请先上传底图', 'error');
            return;
        }

        if (!state.styleImage) {
            updateStyleStatus('请先上传风格参考图', 'error');
            return;
        }

        const promptInput = elements.stylePromptPanel || document.getElementById('style-prompt');
        const prompt = promptInput?.value?.trim() || '保持底图构图，应用参考图的风格';

        const sizeSelect = elements.styleImageSizePanel || document.getElementById('style-image-size');
        const size = sizeSelect?.value || '1024*1024';

        // 新增参数收集
        const negativePrompt = elements.styleNegativePromptPanel?.value?.trim() || '';
        const quality = elements.styleImageQualityPanel?.value || 'high';
        const count = parseInt(elements.styleImageCountPanel?.value || '1');
        const promptExtend = elements.stylePromptExtendPanel?.checked ?? true;

        // 优化提示词（传入负面提示词）
        const optimized = await optimizePromptText(prompt, negativePrompt, '风格迁移模式');
        if (optimized.wasOptimized) {
            updateStyleStatus('提示词已优化，正在生成...');
        }

        updateStyleStatus('图像正在生成...', 'loading');
        if (elements.styleGeneratePanel) elements.styleGeneratePanel.disabled = true;

        // 构建参数对象
        const params = {
            baseImage: state.styleBaseImage,    // 底图（保持构图）
            referenceImage: state.styleImage,   // 风格参考图
            prompt: optimized.prompt,
            size,
            apiKey: state.apiKey,
            negativePrompt: optimized.negativePrompt,
            quality,
            promptExtend
        };

        // 添加 Nano Banana 2 专属参数
        if (state.currentModel === 'nanobanana') {
            params.aspectRatio = elements.styleNanobananaAspectRatio?.value || 'match_input_image';
            params.resolution = elements.styleNanobananaResolution?.value || '1K';
            params.outputFormat = elements.styleNanobananaOutputFormat?.value || 'jpg';
            params.googleSearch = elements.styleNanobananaGoogleSearch?.checked ?? false;
            params.imageSearch = elements.styleNanobananaImageSearch?.checked ?? false;
        }

        // 批量生成支持
        const results = [];
        for (let i = 0; i < count; i++) {
            const result = await generateWithReferenceUnified(params);
            results.push(result);
            addResult(result, optimized.prompt);
        }

        updateStyleStatus(optimized.wasOptimized ? '提示词已优化，生成成功！' : '生成成功！', 'success');

    } catch (error) {
        console.error('Style generation error:', error);
        updateStyleStatus('生成失败: ' + error.message, 'error');
    } finally {
        if (elements.styleGeneratePanel) elements.styleGeneratePanel.disabled = false;
    }
}

// 更新风格迁移模式状态
function updateStyleStatus(message, type = '') {
    if (elements.styleStatus) {
        elements.styleStatus.textContent = message;
        elements.styleStatus.className = 'home-status' + (type ? ` ${type}` : '');
    }
}

// 更新主页状态
function updateHomeStatus(message, type = '') {
    if (elements.homeStatus) {
        elements.homeStatus.textContent = message;
        elements.homeStatus.className = 'home-status' + (type ? ` ${type}` : '');
    }
}

// 局部修改模式生成处理
async function handleMaskGenerate() {
    const generatingStatus = document.getElementById('mask-generating-status');
    try {
        if (!state.apiKey) {
            updateStatus('请先设置 API Key', 'error');
            const apiKeyInput = document.getElementById('api-key');
            apiKeyInput?.focus();
            return;
        }

        const promptInput = document.getElementById('mask-prompt');
        const prompt = promptInput?.value?.trim();
        if (!prompt) {
            updateStatus('请输入提示词', 'error');
            promptInput?.focus();
            return;
        }

        if (prompt.length > CONSTANTS.MAX_PROMPT_LENGTH) {
            updateStatus(`提示词不能超过 ${CONSTANTS.MAX_PROMPT_LENGTH} 字符`, 'error');
            return;
        }

        const maskSendBtn = document.getElementById('mask-send');
        const maskOverlayCanvas = document.getElementById('mask-overlay-canvas');
        const imageSize = document.getElementById('image-size');
        const promptExtend = document.getElementById('prompt-extend');
        const negativePrompt = document.getElementById('negative-prompt');

        if (!state.maskBaseImage && !state.baseImage) {
            updateStatus('请先上传底图', 'error');
            return;
        }

        if (!maskOverlayCanvas) {
            updateStatus('画布未初始化', 'error');
            return;
        }

        const params = {
            prompt,
            apiKey: state.apiKey,
            negativePrompt: negativePrompt?.value?.trim() || '',
            size: imageSize?.value || '1024*1024',
            promptExtend: promptExtend?.checked ?? true
        };

        // 显示生成中状态
        if (generatingStatus) {
            generatingStatus.style.display = 'block';
        }

        // 优化提示词（中译英+优化）
        const optimized = await optimizePromptText(prompt, params.negativePrompt, '局部修改模式');
        if (optimized.wasOptimized) {
            updateStatus('提示词已优化，正在生成...');
        }

        // 更新params中的提示词
        params.prompt = optimized.prompt;
        params.negativePrompt = optimized.negativePrompt;

        updateStatus('正在生成...', 'loading');
        if (maskSendBtn) maskSendBtn.disabled = true;

        const baseImageData = state.maskBaseImage || state.baseImage;
        const maskData = maskOverlayCanvas.toDataURL('image/png');

        let result;

        // 如果有参考素材图，使用多图融合编辑
        if (state.maskRefImage) {
            result = await multiImageEdit({
                ...params,
                baseImage: baseImageData,
                refImage: state.maskRefImage,
                maskImage: maskData
            });
        } else {
            // 否则使用普通的局部重绘
            result = await inpaintImageUnified({
                ...params,
                baseImage: baseImageData,
                maskImage: maskData
            });
        }

        // 添加到结果预览栏（使用优化后的提示词）
        addResult(result, optimized.prompt);
        updateStatus(optimized.wasOptimized ? '提示词已优化，生成成功！' : '生成成功！', 'success');

    } catch (error) {
        console.error('Generation error:', error);
        updateStatus('生成失败: ' + error.message, 'error');
    } finally {
        const maskSendBtn = document.getElementById('mask-send');
        if (maskSendBtn) maskSendBtn.disabled = false;
        // 隐藏生成中状态
        if (generatingStatus) {
            generatingStatus.style.display = 'none';
        }
    }
}

// 验证画笔大小
function validateBrushSize(size, defaultValue) {
    const parsed = parseInt(size);
    if (isNaN(parsed)) return defaultValue;
    return Math.min(Math.max(parsed, CONSTANTS.MIN_BRUSH_SIZE), CONSTANTS.MAX_BRUSH_SIZE);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 更新模式
function updateMode(mode) {
    if (!['home', 'sketch', 'style', 'mask', 'architect'].includes(mode)) {
        console.error('Invalid mode:', mode);
        return;
    }

    state.currentMode = mode;

    // 更新标签
    elements.modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // 更新工作区
    elements.workspaceModes.forEach(workspace => {
        workspace.classList.toggle('active', workspace.id === `mode-${mode}`);
    });

    // 更新控制面板显示
    if (mode === 'home') {
        // 首页：隐藏左侧控制面板，显示首页中间栏
        if (elements.controlPanel) {
            elements.controlPanel.style.display = 'none';
        }
        // 显示首页高级设置面板（中间栏）
        const controlHome = document.getElementById('control-home');
        if (controlHome) {
            controlHome.style.display = 'flex';
        }
    } else {
        // 其他模式：显示左侧控制面板，隐藏首页中间栏
        if (elements.controlPanel) {
            elements.controlPanel.style.display = 'flex';
            elements.controlModes.forEach(controlMode => {
                controlMode.classList.toggle('active', controlMode.id === `control-${mode}`);
            });
        }
        // 隐藏首页高级设置面板
        const controlHome = document.getElementById('control-home');
        if (controlHome) {
            controlHome.style.display = 'none';
        }
    }

    // 显示/隐藏涂抹预览区（仅在局部修改模式时显示）
    if (elements.maskPreviewSection) {
        elements.maskPreviewSection.style.display = mode === 'mask' ? 'block' : 'none';
    }

    // 更新提示词placeholder
    updatePromptPlaceholder(mode);

    // 切换模式时加载保存的宽度
    if (mode === 'home') {
        loadSavedWidths();
    } else {
        // 线稿绘制、风格迁移、局部修改、建筑大师模式都使用工作区宽度
        loadWorkspaceWidths();
    }
}

// 更新提示词占位符
function updatePromptPlaceholder(mode) {
    // 根据模式更新提示词输入框的placeholder
    const placeholders = {
        home: '描述你想要生成的图片...',
        sketch: '描述你想要的图像效果...',
        style: '描述你想要的图像内容...',
        mask: '描述如何修改涂抹区域...',
        architect: '描述你想要的建筑设计，例如：三层别墅，带泳池和花园...'
    };

    // 更新控制面板中的提示词输入框
    const panelPromptIds = ['sketch-prompt-panel', 'style-prompt-panel', 'mask-prompt-panel', 'architect-prompt-panel'];
    panelPromptIds.forEach(id => {
        const textarea = document.getElementById(id);
        if (textarea && placeholders[mode]) {
            textarea.placeholder = placeholders[mode];
        }
    });
}

// 切换可折叠区域
function toggleCollapsible(header) {
    header.classList.toggle('collapsed');
    const content = header.nextElementSibling;
    if (content) content.classList.toggle('collapsed');
}

// 设置工具
function setTool(tool, btn) {
    state.currentTool = tool;

    // 更新按钮状态
    const parent = btn.closest('.tool-group') || btn.closest('.canvas-toolbar');
    if (parent) {
        parent.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
}

// 初始化 Canvas
function initializeCanvas() {
    // 线稿 Canvas
    if (elements.sketchCanvas) {
        const ctx = elements.sketchCanvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get sketch canvas context');
        contexts.sketch = ctx;

        ctx.fillStyle = CONSTANTS.COLORS.WHITE;
        ctx.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);

        bindCanvasEvents(elements.sketchCanvas, handleSketchStart, handleSketchMove, handleSketchEnd);
    }

    // 蒙版 Canvas
    if (elements.maskBaseCanvas && elements.maskOverlayCanvas) {
        const baseCtx = elements.maskBaseCanvas.getContext('2d');
        const overlayCtx = elements.maskOverlayCanvas.getContext('2d');

        if (!baseCtx || !overlayCtx) throw new Error('Failed to get mask canvas contexts');
        contexts.maskBase = baseCtx;
        contexts.maskOverlay = overlayCtx;

        baseCtx.fillStyle = CONSTANTS.COLORS.GRAY;
        baseCtx.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);

        overlayCtx.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);

        bindCanvasEvents(elements.maskOverlayCanvas, handleMaskStart, handleMaskMove, handleMaskEnd);

        // 初始化时显示画布覆盖层，提示用户上传底图
        if (elements.maskCanvasOverlay) {
            elements.maskCanvasOverlay.classList.remove('hidden');
        }
    }

    // 涂抹预览 Canvas
    if (elements.maskPreviewCanvas) {
        const previewCtx = elements.maskPreviewCanvas.getContext('2d');
        if (previewCtx) {
            contexts.maskPreview = previewCtx;
            // 初始填充灰色背景
            previewCtx.fillStyle = CONSTANTS.COLORS.GRAY;
            previewCtx.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
        }

        // 为预览 Canvas 绑定涂抹事件，使用与主 Canvas 相同的事件处理函数
        bindCanvasEvents(elements.maskPreviewCanvas, handleMaskStart, handleMaskMove, handleMaskEnd);
    }
}

// 绑定 Canvas 事件
function bindCanvasEvents(canvas, onStart, onMove, onEnd) {
    // 鼠标事件
    addListener(canvas, 'mousedown', onStart);
    addListener(canvas, 'mousemove', onMove);
    addListener(canvas, 'mouseup', onEnd);
    addListener(canvas, 'mouseleave', onEnd);

    // 触摸事件
    addListener(canvas, 'touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            onStart(e.touches[0]);
        }
    }, { passive: false });

    addListener(canvas, 'touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            onMove(e.touches[0]);
        }
    }, { passive: false });

    addListener(canvas, 'touchend', (e) => {
        e.preventDefault();
        // touchend 使用 changedTouches 获取最后坐标
        if (e.changedTouches.length > 0) {
            onEnd(e.changedTouches[0]);
        } else {
            onEnd(null);
        }
    }, { passive: false });
}

// 获取 Canvas 坐标
function getCanvasCoords(canvas, event) {
    if (!canvas || !event) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;

    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

// 获取目标 Canvas（用于处理预览 Canvas 的事件）
function getTargetCanvas(sourceCanvas) {
    // 如果事件来自预览 Canvas，返回蒙版 Canvas 作为目标
    if (sourceCanvas === elements.maskPreviewCanvas) {
        return elements.maskOverlayCanvas;
    }
    return sourceCanvas;
}

// 线稿绘图事件
function handleSketchStart(e) {
    state.isDrawing = true;
    const coords = getCanvasCoords(elements.sketchCanvas, e);
    state.lastPoint = coords;

    const ctx = contexts.sketch;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = state.currentTool === 'eraser' ? CONSTANTS.COLORS.WHITE : state.sketchColor;
    ctx.lineWidth = state.sketchSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function handleSketchMove(e) {
    if (!state.isDrawing || !state.lastPoint) return;

    const coords = getCanvasCoords(elements.sketchCanvas, e);
    const ctx = contexts.sketch;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    state.lastPoint = coords;
}

function handleSketchEnd(e) {
    if (state.isDrawing) {
        const ctx = contexts.sketch;
        ctx.closePath();
    }
    state.isDrawing = false;
    state.lastPoint = null;
}

function clearSketchCanvas() {
    const ctx = contexts.sketch;
    if (!ctx) return;
    ctx.fillStyle = CONSTANTS.COLORS.WHITE;
    ctx.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    updateStatus('画布已清空');
}

// 获取 Canvas 坐标（考虑事件来源 Canvas 和目标 Canvas 的映射）
function getMaskCanvasCoords(sourceCanvas, targetCanvas, event) {
    if (!sourceCanvas || !targetCanvas || !event) return { x: 0, y: 0 };

    // 使用事件来源 Canvas 的位置信息计算相对坐标
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;

    // 计算相对于来源 Canvas 的坐标（标准化为 0-1 范围）
    const normalizedX = (clientX - sourceRect.left) / sourceRect.width;
    const normalizedY = (clientY - sourceRect.top) / sourceRect.height;

    // 映射到目标 Canvas 的尺寸
    return {
        x: normalizedX * targetCanvas.width,
        y: normalizedY * targetCanvas.height
    };
}

// 蒙版绘图事件
function handleMaskStart(e) {
    if (!state.maskBaseImage && !state.baseImage) {
        updateStatus('请先上传底图', 'error');
        return;
    }

    // 获取事件来源的 Canvas
    const sourceCanvas = e.target;
    const targetCanvas = getTargetCanvas(sourceCanvas);

    state.isDrawing = true;
    // 使用新的坐标计算函数，正确处理预览 Canvas 到主 Canvas 的坐标映射
    const coords = getMaskCanvasCoords(sourceCanvas, targetCanvas, e);
    state.lastPoint = coords;

    const ctx = contexts.maskOverlay;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.globalCompositeOperation = state.currentTool === 'eraser'
        ? CONSTANTS.COMPOSITE.DESTINATION_OUT
        : CONSTANTS.COMPOSITE.SOURCE_OVER;
    ctx.strokeStyle = CONSTANTS.COLORS.MASK_BRUSH;
    ctx.lineWidth = state.maskSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function handleMaskMove(e) {
    if (!state.isDrawing || !state.lastPoint) return;

    // 获取事件来源的 Canvas
    const sourceCanvas = e.target;
    const targetCanvas = getTargetCanvas(sourceCanvas);

    // 使用新的坐标计算函数，正确处理预览 Canvas 到主 Canvas 的坐标映射
    const coords = getMaskCanvasCoords(sourceCanvas, targetCanvas, e);
    const ctx = contexts.maskOverlay;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    state.lastPoint = coords;

    // 更新涂抹预览区
    updateMaskPreview(coords);
}

function handleMaskEnd(e) {
    if (state.isDrawing) {
        const ctx = contexts.maskOverlay;
        ctx.closePath();
    }
    state.isDrawing = false;
    state.lastPoint = null;
}

/**
 * 更新涂抹预览区
 * 实时显示当前涂抹区域的放大预览
 * @param {Object} currentPoint - 当前涂抹点坐标 {x, y}（可选）
 */
function updateMaskPreview(currentPoint) {
    if (!elements.maskPreviewCanvas || !elements.maskOverlayCanvas || !elements.maskBaseCanvas) return;

    const previewCtx = contexts.maskPreview;
    const overlayCtx = contexts.maskOverlay;
    const baseCtx = contexts.maskBase;

    if (!previewCtx || !overlayCtx || !baseCtx) return;

    // 清空预览 Canvas
    previewCtx.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);

    // 绘制底图作为背景（如果底图已加载）
    if (state.maskBaseImage || state.baseImage) {
        previewCtx.drawImage(elements.maskBaseCanvas, 0, 0);
    } else {
        // 如果没有底图，填充灰色背景
        previewCtx.fillStyle = CONSTANTS.COLORS.GRAY;
        previewCtx.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }

    // 叠加蒙版（使用半透明白色显示涂抹区域）
    previewCtx.globalAlpha = 0.5;
    previewCtx.drawImage(elements.maskOverlayCanvas, 0, 0);
    previewCtx.globalAlpha = 1.0;

    // 绘制圆形笔刷预览
    const brushSize = state.maskSize;
    const previewCenterX = CONSTANTS.CANVAS_SIZE / 2;
    const previewCenterY = CONSTANTS.CANVAS_SIZE / 2;

    if (currentPoint && state.isDrawing) {
        // 绘制当前涂抹位置的圆形笔刷
        // 绘制圆形笔刷轮廓
        previewCtx.strokeStyle = '#8B5CF6';
        previewCtx.lineWidth = 2;
        previewCtx.beginPath();
        previewCtx.arc(currentPoint.x, currentPoint.y, brushSize / 2, 0, Math.PI * 2);
        previewCtx.stroke();

        // 绘制半透明的圆形填充（显示笔刷实际覆盖区域）
        previewCtx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        previewCtx.beginPath();
        previewCtx.arc(currentPoint.x, currentPoint.y, brushSize / 2, 0, Math.PI * 2);
        previewCtx.fill();

        // 绘制十字准心
        previewCtx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
        previewCtx.lineWidth = 1;

        // 水平线
        previewCtx.beginPath();
        previewCtx.moveTo(0, currentPoint.y);
        previewCtx.lineTo(CONSTANTS.CANVAS_SIZE, currentPoint.y);
        previewCtx.stroke();

        // 垂直线
        previewCtx.beginPath();
        previewCtx.moveTo(currentPoint.x, 0);
        previewCtx.lineTo(currentPoint.x, CONSTANTS.CANVAS_SIZE);
        previewCtx.stroke();
    } else if (!currentPoint && !state.isDrawing) {
        // 没有涂抹时，在画布中心显示示例圆形笔刷
        previewCtx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
        previewCtx.lineWidth = 2;
        previewCtx.setLineDash([4, 4]);
        previewCtx.beginPath();
        previewCtx.arc(previewCenterX, previewCenterY, brushSize / 2, 0, Math.PI * 2);
        previewCtx.stroke();
        previewCtx.setLineDash([]);

        // 显示笔刷大小文字
        previewCtx.fillStyle = 'rgba(139, 92, 246, 0.8)';
        previewCtx.font = '12px sans-serif';
        previewCtx.textAlign = 'center';
        previewCtx.fillText(`${brushSize}px`, previewCenterX, previewCenterY + brushSize / 2 + 16);
    }

    // 显示预览区域（如果有内容）
    if (elements.maskPreviewSection) {
        elements.maskPreviewSection.style.display = 'block';
    }
}

function clearMaskCanvas() {
    const ctx = contexts.maskOverlay;
    if (!ctx) return;
    ctx.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    // 更新预览区以反映清除后的状态
    updateMaskPreview();
    updateStatus('蒙版已清除');
}

// 拖放处理
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleStyleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadStyleImage(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleStyleSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadStyleImage(file);
    }
}

// 线稿模式 - 参考图拖放处理
function handleSketchDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadSketchRefImage(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleSketchSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadSketchRefImage(file);
        e.target.value = ''; // 清空以允许重复选择
    }
}

function loadSketchRefImage(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.sketchRefImage = e.target.result;

            // 更新预览
            if (elements.sketchPreview) {
                elements.sketchPreview.src = state.sketchRefImage;
                elements.sketchPreview.hidden = false;
            }
            if (elements.sketchPlaceholder) {
                elements.sketchPlaceholder.hidden = true;
            }
            if (elements.sketchUploadArea) {
                elements.sketchUploadArea.classList.add('has-image');
            }
            if (elements.sketchRemove) {
                elements.sketchRemove.hidden = false;
            }

            updateStatus('参考图已加载');
        } catch (err) {
            console.error('Sketch ref image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

function removeSketchRefImage() {
    state.sketchRefImage = null;

    // 清理预览
    if (elements.sketchPreview) {
        elements.sketchPreview.src = '';
        elements.sketchPreview.hidden = true;
    }
    if (elements.sketchPlaceholder) {
        elements.sketchPlaceholder.hidden = false;
    }
    if (elements.sketchUploadArea) {
        elements.sketchUploadArea.classList.remove('has-image');
    }
    if (elements.sketchRemove) {
        elements.sketchRemove.hidden = true;
    }

    updateStatus('参考图已移除');
}

function loadStyleImage(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.styleImage = e.target.result;
            if (elements.stylePreview) {
                elements.stylePreview.src = state.styleImage;
                elements.stylePreview.hidden = false;
            }
            if (elements.styleUploadZone) {
                elements.styleUploadZone.classList.add('has-image');
            }
            updateStatus('参考图已加载');
        } catch (err) {
            console.error('Style image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

// 风格迁移模式 - 底图上传处理
function handleStyleBaseDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadStyleBaseImage(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleStyleBaseSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadStyleBaseImage(file);
        e.target.value = ''; // 清空以允许重复选择
    }
}

function loadStyleBaseImage(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.styleBaseImage = e.target.result;

            // 更新预览
            if (elements.styleBasePreview) {
                elements.styleBasePreview.src = state.styleBaseImage;
                elements.styleBasePreview.hidden = false;
            }
            if (elements.styleBasePlaceholder) {
                elements.styleBasePlaceholder.hidden = true;
            }
            if (elements.styleBaseUpload) {
                elements.styleBaseUpload.classList.add('has-image');
            }
            if (elements.styleBaseRemove) {
                elements.styleBaseRemove.hidden = false;
            }

            updateStatus('底图已加载');
        } catch (err) {
            console.error('Style base image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

function removeStyleBaseImage() {
    state.styleBaseImage = null;

    // 清理预览
    if (elements.styleBasePreview) {
        elements.styleBasePreview.src = '';
        elements.styleBasePreview.hidden = true;
    }
    if (elements.styleBasePlaceholder) {
        elements.styleBasePlaceholder.hidden = false;
    }
    if (elements.styleBaseUpload) {
        elements.styleBaseUpload.classList.remove('has-image');
    }
    if (elements.styleBaseRemove) {
        elements.styleBaseRemove.hidden = true;
    }

    updateStatus('底图已移除');
}

// 风格迁移模式 - 风格参考图上传处理
function handleStyleRefDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadStyleRefImage(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleStyleRefSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadStyleRefImage(file);
        e.target.value = ''; // 清空以允许重复选择
    }
}

function loadStyleRefImage(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.styleImage = e.target.result;

            // 更新预览
            if (elements.styleRefPreview) {
                elements.styleRefPreview.src = state.styleImage;
                elements.styleRefPreview.hidden = false;
            }
            if (elements.styleRefPlaceholder) {
                elements.styleRefPlaceholder.hidden = true;
            }
            if (elements.styleRefUpload) {
                elements.styleRefUpload.classList.add('has-image');
            }
            if (elements.styleRefRemove) {
                elements.styleRefRemove.hidden = false;
            }

            updateStatus('风格参考图已加载');
        } catch (err) {
            console.error('Style ref image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

function removeStyleRefImage() {
    state.styleImage = null;

    // 清理预览
    if (elements.styleRefPreview) {
        elements.styleRefPreview.src = '';
        elements.styleRefPreview.hidden = true;
    }
    if (elements.styleRefPlaceholder) {
        elements.styleRefPlaceholder.hidden = false;
    }
    if (elements.styleRefUpload) {
        elements.styleRefUpload.classList.remove('has-image');
    }
    if (elements.styleRefRemove) {
        elements.styleRefRemove.hidden = true;
    }

    updateStatus('风格参考图已移除');
}

// 局部修改模式 - 底图上传处理
function handleMaskBaseDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadMaskBaseImageNew(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleMaskBaseSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadMaskBaseImageNew(file);
        e.target.value = ''; // 清空以允许重复选择
    }
}

function loadMaskBaseImageNew(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.maskBaseImage = e.target.result;
            state.baseImage = e.target.result; // 同时更新 baseImage 以兼容现有逻辑

            // 更新预览
            if (elements.maskBasePreview) {
                elements.maskBasePreview.src = state.maskBaseImage;
                elements.maskBasePreview.hidden = false;
            }
            if (elements.maskBasePlaceholder) {
                elements.maskBasePlaceholder.hidden = true;
            }
            if (elements.maskBaseUpload) {
                elements.maskBaseUpload.classList.add('has-image');
            }
            if (elements.maskBaseRemove) {
                elements.maskBaseRemove.hidden = false;
            }

            // 绘制到 Canvas
            if (currentMaskImage) {
                currentMaskImage.onload = null;
                currentMaskImage.onerror = null;
                currentMaskImage.src = '';
            }

            currentMaskImage = new Image();

            currentMaskImage.onload = () => {
                try {
                    const ctx = contexts.maskBase;
                    if (ctx) {
                        ctx.drawImage(currentMaskImage, 0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
                    }
                    // 隐藏画布覆盖层
                    if (elements.maskCanvasOverlay) {
                        elements.maskCanvasOverlay.classList.add('hidden');
                    }
                    // 同步更新涂抹预览区
                    updateMaskPreview();
                    updateMaskGenerateButtonState();
                    updateStatus('底图已加载，请涂抹需要修改的区域');
                } catch (err) {
                    console.error('Draw image error:', err);
                    updateStatus('图片绘制失败: ' + err.message, 'error');
                }
            };

            currentMaskImage.onerror = () => {
                updateStatus('图片加载失败', 'error');
            };

            currentMaskImage.src = state.maskBaseImage;
        } catch (err) {
            console.error('Mask base image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

function removeMaskBaseImage() {
    state.maskBaseImage = null;
    state.baseImage = null;

    // 清理预览
    if (elements.maskBasePreview) {
        elements.maskBasePreview.src = '';
        elements.maskBasePreview.hidden = true;
    }
    if (elements.maskBasePlaceholder) {
        elements.maskBasePlaceholder.hidden = false;
    }
    if (elements.maskBaseUpload) {
        elements.maskBaseUpload.classList.remove('has-image');
    }
    if (elements.maskBaseRemove) {
        elements.maskBaseRemove.hidden = true;
    }

    // 清理 Canvas
    if (contexts.maskBase) {
        contexts.maskBase.fillStyle = CONSTANTS.COLORS.GRAY;
        contexts.maskBase.fillRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }
    if (contexts.maskOverlay) {
        contexts.maskOverlay.clearRect(0, 0, CONSTANTS.CANVAS_SIZE, CONSTANTS.CANVAS_SIZE);
    }

    // 显示画布覆盖层
    if (elements.maskCanvasOverlay) {
        elements.maskCanvasOverlay.classList.remove('hidden');
    }

    // 清理图片对象
    if (currentMaskImage) {
        currentMaskImage.onload = null;
        currentMaskImage.onerror = null;
        currentMaskImage.src = '';
        currentMaskImage = null;
    }

    updateMaskGenerateButtonState();
    updateStatus('底图已移除');
}

// 局部修改模式 - 参考素材图上传处理
function handleMaskRefDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadMaskRefImage(file);
    } else {
        updateStatus('请上传图片文件', 'error');
    }
}

function handleMaskRefSelect(e) {
    const file = e.target.files[0];
    if (file) {
        loadMaskRefImage(file);
        e.target.value = ''; // 清空以允许重复选择
    }
}

function loadMaskRefImage(file) {
    if (!file.type.startsWith('image/')) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            state.maskRefImage = e.target.result;

            // 更新预览
            if (elements.maskRefPreview) {
                elements.maskRefPreview.src = state.maskRefImage;
                elements.maskRefPreview.hidden = false;
            }
            if (elements.maskRefPlaceholder) {
                elements.maskRefPlaceholder.hidden = true;
            }
            if (elements.maskRefUpload) {
                elements.maskRefUpload.classList.add('has-image');
            }
            if (elements.maskRefRemove) {
                elements.maskRefRemove.hidden = false;
            }

            updateMaskGenerateButtonState();
            updateStatus('参考素材图已加载');
        } catch (err) {
            console.error('Mask ref image processing error:', err);
            updateStatus('图片处理失败: ' + err.message, 'error');
        }
    };

    reader.onerror = () => {
        updateStatus('图片读取失败', 'error');
    };

    try {
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('FileReader error:', err);
        updateStatus('图片读取失败', 'error');
    }
}

function removeMaskRefImage() {
    state.maskRefImage = null;

    // 清理预览
    if (elements.maskRefPreview) {
        elements.maskRefPreview.src = '';
        elements.maskRefPreview.hidden = true;
    }
    if (elements.maskRefPlaceholder) {
        elements.maskRefPlaceholder.hidden = false;
    }
    if (elements.maskRefUpload) {
        elements.maskRefUpload.classList.remove('has-image');
    }
    if (elements.maskRefRemove) {
        elements.maskRefRemove.hidden = true;
    }

    updateMaskGenerateButtonState();
    updateStatus('参考素材图已移除');
}

// 更新局部修改模式生成按钮状态
function updateMaskGenerateButtonState() {
    const generateBtn = document.getElementById('mask-send');
    if (!generateBtn) return;

    // 需要有底图才能生成
    const hasBaseImage = state.maskBaseImage !== null;
    generateBtn.disabled = !hasBaseImage;

    // 更新提示信息
    if (!hasBaseImage) {
        updateStatus('请先上传底图');
    } else if (state.maskRefImage) {
        updateStatus('已加载底图和参考素材图，可以开始编辑');
    } else {
        updateStatus('已加载底图，可以涂抹区域进行修改');
    }
}

// API Key 管理（使用主页设置面板）
async function initializeApiKey() {
    try {
        const result = await chrome.storage.local.get(['apiKey', 'currentModel']);
        if (result.apiKey) {
            state.apiKey = result.apiKey;
            if (elements.homeApiKey) {
                elements.homeApiKey.value = maskApiKey(state.apiKey);
            }
            updateStatus('API Key 已加载');
        }

        // 加载保存的模型选择
        if (result.currentModel) {
            state.currentModel = result.currentModel;
            const modelSelector = document.getElementById('model-selector');
            if (modelSelector) {
                modelSelector.value = result.currentModel;
            }
            // 同步 api.js 中的模型
            if (typeof switchModel === 'function') {
                switchModel(result.currentModel);
            }
            // 更新 placeholder
            updateApiKeyPlaceholder(result.currentModel);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// 已移除 - 使用 saveHomeApiKey 代替
async function saveApiKey() {
    // 中间栏已移除，此函数不再使用
    console.warn('saveApiKey is deprecated, use saveHomeApiKey instead');
}

function maskApiKey(key) {
    if (!key) return '';
    if (key.length <= 12) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

// 生成处理（使用主页设置面板的参数）
async function handleGenerate() {
    try {
        if (!state.apiKey) {
            updateStatus('请先设置 API Key', 'error');
            elements.homeApiKey?.focus();
            return;
        }

        // 获取提示词 - 使用主页输入框
        const prompt = elements.homePrompt?.value?.trim();
        if (!prompt) {
            updateStatus('请输入提示词', 'error');
            elements.homePrompt?.focus();
            return;
        }

        if (prompt.length > CONSTANTS.MAX_PROMPT_LENGTH) {
            updateStatus(`提示词不能超过 ${CONSTANTS.MAX_PROMPT_LENGTH} 字符`, 'error');
            return;
        }

        // 获取参数 - 使用主页设置面板
        const mainPrompt = elements.homeMainPrompt?.value?.trim() || '';
        const negativePrompt = elements.homeNegativePrompt?.value?.trim() || '';
        const size = elements.homeImageSize?.value || '1024*1024';
        const quality = elements.homeImageQuality?.value || 'high';
        const promptExtend = elements.homePromptExtend?.checked ?? true;

        // 合并提示词
        const finalPrompt = mainPrompt ? `${prompt}，${mainPrompt}` : prompt;

        // 优化提示词（中译英+优化）
        const optimized = await optimizePromptText(finalPrompt, negativePrompt, '通用生成模式');
        if (optimized.wasOptimized) {
            updateStatus('提示词已优化，正在生成...');
        }

        const params = {
            prompt: optimized.prompt,
            apiKey: state.apiKey,
            negativePrompt: optimized.negativePrompt,
            size,
            quality,
            promptExtend
        };

        updateStatus('正在生成...', 'loading');

        let result;

        // 根据当前模式选择生成方式
        if (state.currentMode === 'sketch') {
            // 线稿模式
            const sketchCanvas = elements.sketchCanvas;
            if (!sketchCanvas) {
                updateStatus('画布未初始化', 'error');
                return;
            }

            const sketchData = sketchCanvas.toDataURL('image/png');

            // 如果有参考图片，使用带参考的生成
            if (sketchUploadedImages.length > 0 && sketchSelectedImageIndex >= 0) {
                const refImage = sketchUploadedImages[sketchSelectedImageIndex].data;
                result = await generateWithReferenceUnified({
                    ...params,
                    sketchImage: sketchData,
                    refImage: refImage
                });
            } else {
                result = await generateImageUnified({
                    ...params,
                    sketchImage: sketchData
                });
            }
        } else if (state.currentMode === 'style') {
            // 风格迁移模式
            if (!state.styleImage && uploadedImages.length === 0) {
                updateStatus('请先上传风格参考图', 'error');
                return;
            }

            // 使用选中的参考图片或风格图
            const refImage = (selectedImageIndex >= 0 && uploadedImages[selectedImageIndex])
                ? uploadedImages[selectedImageIndex].data
                : state.styleImage;

            result = await generateWithReferenceUnified({
                ...params,
                refImage: refImage
            });
        } else {
            // 其他模式使用基础生成
            result = await generateImageUnified(params);
        }

        // 添加到结果预览栏（使用优化后的提示词）
        addResult(result, optimized.prompt);
        updateStatus(optimized.wasOptimized ? '提示词已优化，生成成功！' : '生成成功！', 'success');

    } catch (error) {
        console.error('Generation error:', error);
        updateStatus('生成失败: ' + error.message, 'error');
    }
}

// 状态更新（使用主页状态栏）
function updateStatus(message, type = '') {
    if (elements.homeStatus) {
        elements.homeStatus.textContent = message;
        elements.homeStatus.className = 'home-status' + (type ? ` ${type}` : '');
    }
}

// 添加生成结果到预览栏
function addResult(imageUrl, prompt) {
    console.log('Adding result to gallery:', { imageUrl, prompt });

    if (!imageUrl) {
        console.error('No image URL provided to addResult');
        updateStatus('生成失败: 未获取到图片 URL', 'error');
        return;
    }

    const result = {
        url: imageUrl,
        prompt: prompt,
        timestamp: new Date().toLocaleString('zh-CN')
    };
    generatedResults.unshift(result);

    // 限制历史记录数量
    if (generatedResults.length > 20) {
        generatedResults.pop();
    }

    renderResults();
}

// 渲染结果列表
function renderResults() {
    if (!elements.resultList) return;

    // 清空现有内容
    elements.resultList.innerHTML = '';

    if (generatedResults.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'result-empty';
        emptyDiv.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p>生成的图片将显示在这里</p>
        `;
        elements.resultList.appendChild(emptyDiv);
        return;
    }

    generatedResults.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.dataset.index = index;

        // 创建图片容器（用于悬停显示放大按钮）
        const imgContainer = document.createElement('div');
        imgContainer.className = 'result-img-container';

        // 安全创建图片元素
        const img = document.createElement('img');
        img.src = result.url;
        img.alt = '生成结果';
        img.loading = 'lazy';
        img.onerror = () => {
            console.error('Failed to load image:', result.url);
            img.alt = '图片加载失败';
        };
        img.onload = () => {
            console.log('Image loaded successfully:', result.url);
        };

        // 放大预览按钮
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.title = '放大预览';
        expandBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
        `;
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showImagePreview(result.url, result.prompt);
        });

        img.addEventListener('click', () => {
            // 验证 URL 安全性
            if (result.url && (result.url.startsWith('http://') || result.url.startsWith('https://') || result.url.startsWith('data:'))) {
                window.open(result.url, '_blank', 'noopener,noreferrer');
            } else {
                console.error('Invalid URL format:', result.url);
            }
        });

        imgContainer.appendChild(img);
        imgContainer.appendChild(expandBtn);

        // 创建操作按钮容器
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'result-actions';

        // 下载按钮
        const downloadBtn = document.createElement('button');
        downloadBtn.title = '下载';
        downloadBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
        `;
        downloadBtn.addEventListener('click', () => downloadImage(result.url, index));

        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.title = '删除';
        deleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', () => deleteResult(index));

        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(deleteBtn);

        // 创建信息区域
        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-info';

        const promptDiv = document.createElement('div');
        promptDiv.className = 'result-prompt';
        promptDiv.textContent = result.prompt; // 使用 textContent 防止 XSS

        const timeDiv = document.createElement('div');
        timeDiv.className = 'result-time';
        timeDiv.textContent = result.timestamp;

        infoDiv.appendChild(promptDiv);
        infoDiv.appendChild(timeDiv);

        item.appendChild(imgContainer);
        item.appendChild(actionsDiv);
        item.appendChild(infoDiv);

        elements.resultList.appendChild(item);
    });
}

// 显示图片预览模态框
function showImagePreview(imageUrl, prompt = '') {
    // 移除已存在的模态框
    const existingModal = document.getElementById('image-preview-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'image-preview-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" title="关闭">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <img src="${imageUrl}" alt="预览大图" class="preview-image-full">
            ${prompt ? `<div class="preview-prompt">${prompt}</div>` : ''}
        </div>
    `;

    // 添加到页面
    document.body.appendChild(modal);

    // 点击关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.modal-close')) {
            modal.remove();
        }
    });

    // ESC 键关闭
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// 下载图片
function downloadImage(url, index) {
    // 验证 URL 安全性
    if (!url || !(url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))) {
        updateStatus('无效的图片链接', 'error');
        return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `qwen-canvas-${Date.now()}-${index}.png`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
}

// 删除结果
function deleteResult(index) {
    generatedResults.splice(index, 1);
    renderResults();
}

// 清空所有结果
function clearAllResults() {
    if (generatedResults.length === 0) return;

    if (confirm('确定要清空所有生成结果吗？')) {
        generatedResults.length = 0;
        renderResults();
        updateStatus('已清空历史记录');
    }
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 多图片上传处理
function handleMultipleImages(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    imageFiles.forEach(file => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                uploadedImages.push({
                    data: e.target.result,
                    name: file.name
                });
                renderImageGallery();
            } catch (err) {
                console.error('Image processing error:', err);
            }
        };

        reader.onerror = () => {
            updateStatus('图片读取失败', 'error');
        };

        try {
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('FileReader error:', err);
            updateStatus('图片读取失败', 'error');
        }
    });
}

// 渲染图片画廊
function renderImageGallery() {
    const gallery = elements.imageGallery;
    if (!gallery) return;

    // 清空现有内容 - 浏览器会自动清理被移除元素上的事件监听器
    gallery.innerHTML = '';

    // 渲染已上传的图片
    uploadedImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        if (selectedImageIndex === index) {
            item.classList.add('selected');
        }
        item.dataset.index = index;

        const image = document.createElement('img');
        image.src = img.data;
        image.alt = img.name || `图片 ${index + 1}`;
        image.draggable = false;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.title = '删除';
        removeBtn.textContent = '×';

        const currentIndex = index;
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeUploadedImage(currentIndex);
        });

        item.appendChild(image);
        item.appendChild(removeBtn);

        item.addEventListener('click', () => {
            selectImage(currentIndex);
            renderImageGallery();
        });

        gallery.appendChild(item);
    });

    // 创建添加按钮
    const newAddBtn = document.createElement('div');
    newAddBtn.className = 'gallery-item gallery-add';
    newAddBtn.id = 'add-image-btn';
    newAddBtn.title = '添加更多图片';
    newAddBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    `;

    newAddBtn.addEventListener('click', () => {
        if (elements.multiImageInput) {
            elements.multiImageInput.click();
        }
    });

    gallery.appendChild(newAddBtn);
    elements.addImageBtn = newAddBtn;
}

// 选择图片
function selectImage(index) {
    selectedImageIndex = index;
    if (uploadedImages[index]) {
        // 同步更新 state.styleImage 以便生成时使用
        state.styleImage = uploadedImages[index].data;
        updateStatus(`已选择参考图: ${uploadedImages[index].name}`);
    }
}

// 删除上传的图片
function removeUploadedImage(index) {
    uploadedImages.splice(index, 1);
    if (selectedImageIndex === index) {
        selectedImageIndex = -1;
        // 如果取消选择，清除 state.styleImage
        state.styleImage = null;
    } else if (selectedImageIndex > index) {
        selectedImageIndex--;
    }
    renderImageGallery();
}

// 线稿模式多图片上传处理
function handleSketchMultipleImages(files) {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        updateStatus('请上传有效的图片文件', 'error');
        return;
    }

    imageFiles.forEach(file => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                sketchUploadedImages.push({
                    data: e.target.result,
                    name: file.name
                });
                renderSketchImageGallery();
            } catch (err) {
                console.error('Image processing error:', err);
            }
        };

        reader.onerror = () => {
            updateStatus('图片读取失败', 'error');
        };

        try {
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('FileReader error:', err);
            updateStatus('图片读取失败', 'error');
        }
    });
}

// 渲染线稿模式图片画廊
function renderSketchImageGallery() {
    // 同时更新主画廊和左侧面板画廊
    const galleries = [
        elements.sketchImageGallery,
        elements.sketchImageGalleryPanel
    ].filter(Boolean);

    if (galleries.length === 0) return;

    galleries.forEach((gallery) => {
        // 清空现有内容
        gallery.innerHTML = '';

        // 渲染已上传的图片
        sketchUploadedImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            if (sketchSelectedImageIndex === index) {
                item.classList.add('selected');
            }
            item.dataset.index = index;

            const image = document.createElement('img');
            image.src = img.data;
            image.alt = img.name || `图片 ${index + 1}`;
            image.draggable = false;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.title = '删除';
            removeBtn.textContent = '×';

            const currentIndex = index;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSketchUploadedImage(currentIndex);
            });

            item.appendChild(image);
            item.appendChild(removeBtn);

            item.addEventListener('click', () => {
                selectSketchImage(currentIndex);
                renderSketchImageGallery();
            });

            gallery.appendChild(item);
        });

        // 创建添加按钮
        const newAddBtn = document.createElement('div');
        newAddBtn.className = 'gallery-item gallery-add';
        newAddBtn.title = '添加参考图片';
        newAddBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        `;

        newAddBtn.addEventListener('click', () => {
            // 根据画廊类型选择对应的 input 元素
            const inputElement = gallery.id.includes('panel')
                ? elements.sketchMultiImageInputPanel
                : elements.sketchMultiImageInput;
            if (inputElement) {
                inputElement.click();
            }
        });

        gallery.appendChild(newAddBtn);
    });

    // 更新按钮引用
    if (elements.sketchImageGallery) {
        elements.sketchAddImageBtn = elements.sketchImageGallery.querySelector('.gallery-add');
    }
    if (elements.sketchImageGalleryPanel) {
        elements.sketchAddImageBtnPanel = elements.sketchImageGalleryPanel.querySelector('.gallery-add');
    }
}

// 选择线稿模式图片
function selectSketchImage(index) {
    sketchSelectedImageIndex = index;
    if (sketchUploadedImages[index]) {
        // 同步更新 state.styleImage 以便生成时使用
        state.styleImage = sketchUploadedImages[index].data;
        updateStatus(`已选择参考图: ${sketchUploadedImages[index].name}`);
    } else {
        // 如果取消选择，清除 state.styleImage
        state.styleImage = null;
    }
}

// 删除线稿模式上传的图片
function removeSketchUploadedImage(index) {
    sketchUploadedImages.splice(index, 1);
    if (sketchSelectedImageIndex === index) {
        sketchSelectedImageIndex = -1;
        // 同步清除 state.styleImage，避免使用已删除的图片数据
        state.styleImage = null;
    } else if (sketchSelectedImageIndex > index) {
        sketchSelectedImageIndex--;
    }
    renderSketchImageGallery();
}

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ==================== 三栏拖拽调整宽度功能 ====================

// 拖拽状态
const resizeState = {
    isResizing: false,
    currentHandle: null,
    startX: 0,
    startWidthLeft: 0,
    startWidthMiddle: 0,
    startWidthRight: 0
};

// 常量
const RESIZE_CONSTANTS = {
    MIN_WIDTH: 200,
    STORAGE_KEY: 'panel_widths'
};

// 初始化拖拽功能
function initResizeHandles() {
    const leftHandle = document.getElementById('resize-left');
    const rightHandle = document.getElementById('resize-right');
    const workspaceLeftHandle = document.getElementById('resize-workspace-left');
    const workspaceRightHandle = document.getElementById('resize-workspace-right');

    if (leftHandle) {
        leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
    }
    if (rightHandle) {
        rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
    }
    if (workspaceLeftHandle) {
        workspaceLeftHandle.addEventListener('mousedown', (e) => startResize(e, 'workspace-left'));
    }
    if (workspaceRightHandle) {
        workspaceRightHandle.addEventListener('mousedown', (e) => startResize(e, 'workspace-right'));
    }

    // 加载保存的宽度
    loadSavedWidths();
    loadWorkspaceWidths();
}

// 开始拖拽
function startResize(e, handle) {
    e.preventDefault();
    resizeState.isResizing = true;
    resizeState.currentHandle = handle;
    resizeState.startX = e.clientX;

    // 工作区模式下的左侧手柄（控制面板和工作区之间）
    if (handle === 'workspace-left') {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) resizeState.startWidthLeft = controlPanel.offsetWidth;

        // 添加拖拽样式
        document.body.classList.add('resizing');
        const handleEl = document.getElementById('resize-workspace-left');
        if (handleEl) handleEl.classList.add('resizing');

        // 绑定全局事件
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('mouseleave', stopResize);
        return;
    }

    // 工作区模式下的右侧手柄（工作区和结果面板之间）
    if (handle === 'workspace-right') {
        const resultPanel = document.querySelector('.result-panel');
        if (resultPanel) resizeState.startWidthRight = resultPanel.offsetWidth;

        // 添加拖拽样式
        document.body.classList.add('resizing');
        const handleEl = document.getElementById('resize-workspace-right');
        if (handleEl) handleEl.classList.add('resizing');

        // 绑定全局事件
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('mouseleave', stopResize);
        return;
    }

    const modeHome = document.getElementById('mode-home');
    const controlHome = document.getElementById('control-home');
    const resultPanel = document.querySelector('.result-panel');

    if (modeHome) resizeState.startWidthLeft = modeHome.offsetWidth;
    if (controlHome) resizeState.startWidthMiddle = controlHome.offsetWidth;
    if (resultPanel) resizeState.startWidthRight = resultPanel.offsetWidth;

    // 添加拖拽样式
    document.body.classList.add('resizing');
    const handleEl = document.getElementById(`resize-${handle}`);
    if (handleEl) handleEl.classList.add('resizing');

    // 绑定全局事件
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('mouseleave', stopResize);
}

// 处理拖拽
function handleResize(e) {
    if (!resizeState.isResizing) return;

    const delta = e.clientX - resizeState.startX;

    // 工作区模式下的左侧手柄：调整控制面板宽度，工作区自动适应
    if (resizeState.currentHandle === 'workspace-left') {
        const controlPanel = document.getElementById('control-panel');
        if (controlPanel) {
            // 向左拖动（delta为负）时，控制面板变窄，工作区变大
            // 向右拖动（delta为正）时，控制面板变宽，工作区变小
            const newLeftWidth = Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(500, resizeState.startWidthLeft + delta));
            controlPanel.style.width = `${newLeftWidth}px`;
        }
        return;
    }

    // 工作区模式下的右侧手柄：调整结果面板宽度，工作区自动适应
    if (resizeState.currentHandle === 'workspace-right') {
        const resultPanel = document.querySelector('.result-panel');
        if (resultPanel) {
            // 向左拖动（delta为负）时，结果面板变宽，工作区变小
            // 向右拖动（delta为正）时，结果面板变窄，工作区变大
            const newRightWidth = Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(600, resizeState.startWidthRight - delta));
            resultPanel.style.width = `${newRightWidth}px`;
        }
        return;
    }

    const modeHome = document.getElementById('mode-home');
    const controlHome = document.getElementById('control-home');
    const resultPanel = document.querySelector('.result-panel');

    if (resizeState.currentHandle === 'left') {
        // 左侧手柄：调整左栏宽度，中间栏自动适应剩余空间
        const newLeftWidth = Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(800, resizeState.startWidthLeft + delta));
        if (modeHome) modeHome.style.width = `${newLeftWidth}px`;
        // 中间栏使用 flex: 1，自动填充剩余空间，无需手动设置宽度
    } else if (resizeState.currentHandle === 'right') {
        // 右侧手柄：调整右栏宽度，中间栏自动适应剩余空间
        const newRightWidth = Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(600, resizeState.startWidthRight - delta));
        if (resultPanel) resultPanel.style.width = `${newRightWidth}px`;
        // 中间栏使用 flex: 1，自动填充剩余空间，无需手动设置宽度
    }
}

// 停止拖拽
function stopResize() {
    if (!resizeState.isResizing) return;

    resizeState.isResizing = false;
    document.body.classList.remove('resizing');

    // 处理工作区模式的手柄
    if (resizeState.currentHandle === 'workspace-left' || resizeState.currentHandle === 'workspace-right') {
        const leftHandleEl = document.getElementById('resize-workspace-left');
        const rightHandleEl = document.getElementById('resize-workspace-right');
        if (leftHandleEl) leftHandleEl.classList.remove('resizing');
        if (rightHandleEl) rightHandleEl.classList.remove('resizing');

        // 移除全局事件
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('mouseleave', stopResize);

        // 保存宽度
        saveWorkspaceWidths();
        return;
    }

    const handleEl = document.getElementById(`resize-${resizeState.currentHandle}`);
    if (handleEl) handleEl.classList.remove('resizing');

    // 移除全局事件
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('mouseleave', stopResize);

    // 保存宽度
    saveWidths();
}

// 保存宽度到 localStorage
function saveWidths() {
    try {
        const modeHome = document.getElementById('mode-home');
        const resultPanel = document.querySelector('.result-panel');

        const widths = {
            left: modeHome ? modeHome.offsetWidth : 480,
            right: resultPanel ? resultPanel.offsetWidth : 280
        };

        localStorage.setItem(RESIZE_CONSTANTS.STORAGE_KEY, JSON.stringify(widths));
    } catch (error) {
        console.error('Failed to save panel widths:', error);
    }
}

// 保存建筑大师模式宽度到 localStorage
function saveArchitectWidths() {
    try {
        const controlPanel = document.getElementById('control-panel');

        const widths = {
            architectLeft: controlPanel ? controlPanel.offsetWidth : 320
        };

        localStorage.setItem('architect_panel_widths', JSON.stringify(widths));
    } catch (error) {
        console.error('Failed to save architect panel widths:', error);
    }
}

// 保存工作区模式宽度到 localStorage
function saveWorkspaceWidths() {
    try {
        const controlPanel = document.getElementById('control-panel');
        const resultPanel = document.querySelector('.result-panel');

        const widths = {
            left: controlPanel ? controlPanel.offsetWidth : 320,
            right: resultPanel ? resultPanel.offsetWidth : 280
        };

        localStorage.setItem('workspace_panel_widths', JSON.stringify(widths));
    } catch (error) {
        console.error('Failed to save workspace panel widths:', error);
    }
}

// 从 localStorage 加载工作区模式宽度
function loadWorkspaceWidths() {
    try {
        const saved = localStorage.getItem('workspace_panel_widths');
        if (!saved) return;

        const widths = JSON.parse(saved);
        const controlPanel = document.getElementById('control-panel');
        const resultPanel = document.querySelector('.result-panel');

        // 在任意工作区模式下应用保存的宽度
        const isWorkspaceMode = document.getElementById('mode-sketch')?.classList.contains('active') ||
                               document.getElementById('mode-style')?.classList.contains('active') ||
                               document.getElementById('mode-mask')?.classList.contains('active') ||
                               document.getElementById('mode-architect')?.classList.contains('active');

        if (isWorkspaceMode) {
            if (controlPanel && widths.left) {
                controlPanel.style.width = `${Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(500, widths.left))}px`;
            }
            if (resultPanel && widths.right) {
                resultPanel.style.width = `${Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(600, widths.right))}px`;
            }
        }
    } catch (error) {
        console.error('Failed to load workspace panel widths:', error);
    }
}

// 从 localStorage 加载宽度
function loadSavedWidths() {
    try {
        const saved = localStorage.getItem(RESIZE_CONSTANTS.STORAGE_KEY);
        if (!saved) return;

        const widths = JSON.parse(saved);
        const modeHome = document.getElementById('mode-home');
        const resultPanel = document.querySelector('.result-panel');

        // 只在首页模式下应用保存的宽度
        if (document.getElementById('mode-home')?.classList.contains('active')) {
            if (modeHome && widths.left) {
                modeHome.style.width = `${Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(800, widths.left))}px`;
            }
            if (resultPanel && widths.right) {
                resultPanel.style.width = `${Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(600, widths.right))}px`;
            }
            // 中间栏使用 flex: 1，自动填充剩余空间，无需加载宽度
        }
    } catch (error) {
        console.error('Failed to load panel widths:', error);
    }
}

// 从 localStorage 加载建筑大师模式宽度
function loadArchitectWidths() {
    try {
        const saved = localStorage.getItem('architect_panel_widths');
        if (!saved) return;

        const widths = JSON.parse(saved);
        const controlPanel = document.getElementById('control-panel');

        // 只在建筑大师模式下应用保存的宽度
        if (document.getElementById('mode-architect')?.classList.contains('active')) {
            if (controlPanel && widths.architectLeft) {
                controlPanel.style.width = `${Math.max(RESIZE_CONSTANTS.MIN_WIDTH, Math.min(500, widths.architectLeft))}px`;
            }
        }
    } catch (error) {
        console.error('Failed to load architect panel widths:', error);
    }
}

// ==================== 建筑大师模式处理函数 ====================

// 建筑风格配置
const ARCHITECT_STYLES = {
    modern: { name: '现代风格', prompt: 'modern architecture, contemporary design, clean lines, glass and steel' },
    classical: { name: '古典风格', prompt: 'classical architecture, traditional design, columns, ornate details' },
    minimal: { name: '极简风格', prompt: 'minimalist architecture, simple geometric forms, white surfaces, zen aesthetic' },
    futurist: { name: '未来风格', prompt: 'futuristic architecture, innovative design, cutting-edge technology, sleek curves' },
    chinese: { name: '中式风格', prompt: 'traditional Chinese architecture, courtyard, curved roofs, wooden structures' },
    european: { name: '欧式风格', prompt: 'European architecture, classical elements, elegant facades, historic charm' },
    industrial: { name: '工业风格', prompt: 'industrial architecture, exposed beams, raw materials, loft style' },
    green: { name: '绿色建筑', prompt: 'green architecture, sustainable design, eco-friendly, vertical gardens' }
};

// 视角配置
const VIEW_ANGLES = {
    aerial: { name: '鸟瞰', prompt: 'aerial view, bird eye view, overview perspective' },
    eye: { name: '人视', prompt: 'eye level view, human perspective, street view' },
    worm: { name: '虫视', prompt: 'worm eye view, looking up, dramatic upward angle' },
    closeup: { name: '特写', prompt: 'close-up view, detail shot, architectural details' }
};

// 时间氛围配置
const TIME_ATMOSPHERES = {
    day: { name: '白天', prompt: 'daylight, bright and clear, natural sunlight' },
    sunset: { name: '黄昏', prompt: 'sunset, golden hour, warm lighting, orange sky' },
    night: { name: '夜晚', prompt: 'night scene, artificial lighting, illuminated building, city lights' },
    dawn: { name: '黎明', prompt: 'dawn, early morning, soft light, blue hour' }
};

// 构建建筑大师提示词
function buildArchitectPrompt(userPrompt, style, view, time) {
    const styleConfig = ARCHITECT_STYLES[style] || ARCHITECT_STYLES.modern;
    const viewConfig = VIEW_ANGLES[view] || VIEW_ANGLES.aerial;
    const timeConfig = TIME_ATMOSPHERES[time] || TIME_ATMOSPHERES.day;

    return `architectural visualization, professional architecture photography, ${styleConfig.prompt}, ${viewConfig.prompt}, ${timeConfig.prompt}, ${userPrompt}, photorealistic, high quality, detailed textures, realistic materials, professional lighting, 8k resolution`;
}

// 建筑大师参考图拖放处理
function handleArchitectRefDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadBox = e.currentTarget;
    uploadBox.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleArchitectRefFile(files[0]);
    }
}

// 建筑大师参考图选择处理
function handleArchitectRefSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        handleArchitectRefFile(files[0]);
    }
}

// 处理建筑大师参考图文件
function handleArchitectRefFile(file) {
    if (!file.type.startsWith('image/')) {
        updateArchitectStatus('请上传图片文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            state.architectRefImage = e.target.result;
            if (elements.architectRefPreview) {
                elements.architectRefPreview.src = e.target.result;
                elements.architectRefPreview.hidden = false;
            }
            if (elements.architectRefPlaceholder) {
                elements.architectRefPlaceholder.hidden = true;
            }
            if (elements.architectRefRemove) {
                elements.architectRefRemove.hidden = false;
            }
            updateArchitectStatus('参考图上传成功');
        } catch (err) {
            console.error('Image processing error:', err);
            updateArchitectStatus('图片处理失败', 'error');
        }
    };
    reader.onerror = () => {
        updateArchitectStatus('图片读取失败', 'error');
    };
    reader.readAsDataURL(file);
}

// 移除建筑大师参考图
function removeArchitectRefImage() {
    state.architectRefImage = null;
    if (elements.architectRefPreview) {
        elements.architectRefPreview.src = '';
        elements.architectRefPreview.hidden = true;
    }
    if (elements.architectRefPlaceholder) {
        elements.architectRefPlaceholder.hidden = false;
    }
    if (elements.architectRefRemove) {
        elements.architectRefRemove.hidden = true;
    }
    if (elements.architectRefInput) {
        elements.architectRefInput.value = '';
    }
    updateArchitectStatus('参考图已移除');
}

// 建筑风格参考图拖放处理
function handleArchitectStyleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadBox = e.currentTarget;
    uploadBox.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleArchitectStyleFile(files[0]);
    }
}

// 建筑风格参考图选择处理
function handleArchitectStyleSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        handleArchitectStyleFile(files[0]);
    }
}

// 处理建筑风格参考图文件
function handleArchitectStyleFile(file) {
    if (!file.type.startsWith('image/')) {
        updateArchitectStatus('请上传图片文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            state.architectStyleImage = e.target.result;
            if (elements.architectStylePreview) {
                elements.architectStylePreview.src = e.target.result;
                elements.architectStylePreview.hidden = false;
            }
            if (elements.architectStylePlaceholder) {
                elements.architectStylePlaceholder.hidden = true;
            }
            if (elements.architectStyleRemove) {
                elements.architectStyleRemove.hidden = false;
            }
            updateArchitectStatus('风格参考图上传成功');
        } catch (err) {
            console.error('Image processing error:', err);
            updateArchitectStatus('图片处理失败', 'error');
        }
    };
    reader.onerror = () => {
        updateArchitectStatus('图片读取失败', 'error');
    };
    reader.readAsDataURL(file);
}

// 移除建筑风格参考图
function removeArchitectStyleImage() {
    state.architectStyleImage = null;
    if (elements.architectStylePreview) {
        elements.architectStylePreview.src = '';
        elements.architectStylePreview.hidden = true;
    }
    if (elements.architectStylePlaceholder) {
        elements.architectStylePlaceholder.hidden = false;
    }
    if (elements.architectStyleRemove) {
        elements.architectStyleRemove.hidden = true;
    }
    if (elements.architectStyleInput) {
        elements.architectStyleInput.value = '';
    }
    updateArchitectStatus('风格参考图已移除');
}

// 更新建筑大师状态
function updateArchitectStatus(message, type = 'info') {
    if (elements.architectStatus) {
        elements.architectStatus.textContent = message;
        elements.architectStatus.className = 'home-status ' + type;
    }
}

// ==================== 建筑大师 Skill 功能 ====================

// 大师描述映射
const MASTER_DESCRIPTIONS = {
    none: '默认：不使用大师风格',
    路易斯康: '路易斯·康：美国现代主义建筑大师，以几何纯粹性和光影运用著称',
    柯布西耶: '勒·柯布西耶：现代建筑之父，提出"住宅是居住的机器"',
    丹下健三: '丹下健三：日本新陈代谢派创始人，以巨型结构和技术表现主义闻名'
};

// 处理大师头像选择
function handleMasterSelect(avatar) {
    const master = avatar.dataset.master;
    if (!master) return;

    // 更新状态
    state.selectedMaster = master;

    // 更新UI
    elements.masterAvatars.forEach(a => a.classList.remove('active'));
    avatar.classList.add('active');

    // 更新隐藏输入
    if (elements.architectSelectedMaster) {
        elements.architectSelectedMaster.value = master;
    }

    // 更新描述
    if (elements.architectMasterDesc) {
        elements.architectMasterDesc.textContent = MASTER_DESCRIPTIONS[master] || '';
    }

    // 预加载大师提示词
    if (master !== 'none') {
        loadMasterPrompt(master);
    }
}

// 加载大师提示词
async function loadMasterPrompt(masterName) {
    if (state.masterPrompts[masterName]) {
        return state.masterPrompts[masterName];
    }

    try {
        // 构建文件路径
        const fileName = encodeURIComponent(masterName);
        const filePath = `skill/${fileName}.md`;

        const response = await fetch(filePath);
        if (!response.ok) {
            console.warn(`无法加载大师提示词: ${filePath}`);
            return null;
        }

        const content = await response.text();
        state.masterPrompts[masterName] = content;
        return content;
    } catch (error) {
        console.error('加载大师提示词失败:', error);
        return null;
    }
}

// 构建建筑大师提示词（包含大师风格）
async function buildArchitectPromptWithMaster(userPrompt, style, view, time) {
    const styleConfig = ARCHITECT_STYLES[style] || ARCHITECT_STYLES.modern;
    const viewConfig = VIEW_ANGLES[view] || VIEW_ANGLES.aerial;
    const timeConfig = TIME_ATMOSPHERES[time] || TIME_ATMOSPHERES.day;

    // 基础提示词
    let fullPrompt = `architectural visualization, professional architecture photography, ${styleConfig.prompt}, ${viewConfig.prompt}, ${timeConfig.prompt}, ${userPrompt}, photorealistic, high quality, detailed textures, realistic materials, professional lighting, 8k resolution`;

    // 如果选择了大师，添加大师提示词
    if (state.selectedMaster && state.selectedMaster !== 'none') {
        const masterPrompt = await loadMasterPrompt(state.selectedMaster);
        if (masterPrompt) {
            fullPrompt = `${masterPrompt}\n\n${fullPrompt}`;
        }
    }

    return fullPrompt;
}

// 提示词优化
async function handleArchitectOptimizePrompt() {
    const promptTextarea = elements.architectPromptPanel;
    if (!promptTextarea) return;

    const originalPrompt = promptTextarea.value.trim();
    if (!originalPrompt) {
        updateArchitectStatus('请输入提示词后再优化', 'error');
        return;
    }

    if (!state.apiKey) {
        updateArchitectStatus('请先设置 API Key', 'error');
        return;
    }

    try {
        updateArchitectStatus('正在优化提示词...');
        const result = await optimizePrompt({
            prompt: originalPrompt,
            apiKey: state.apiKey,
            scene: 'architecture'
        });

        if (result.optimizedPrompt) {
            promptTextarea.value = result.optimizedPrompt;
            updateArchitectStatus('提示词优化成功');
        }

        if (result.optimizedNegative && elements.architectNegativePromptPanel) {
            const currentNeg = elements.architectNegativePromptPanel.value.trim();
            if (!currentNeg) {
                elements.architectNegativePromptPanel.value = result.optimizedNegative;
            }
        }
    } catch (error) {
        console.error('提示词优化失败:', error);
        updateArchitectStatus('提示词优化失败: ' + error.message, 'error');
    }
}

// 建筑大师生成处理
async function handleArchitectGenerate() {
    try {
        if (!state.apiKey) {
            updateArchitectStatus('请先设置 API Key', 'error');
            return;
        }

        const userPrompt = elements.architectPromptPanel?.value.trim();
        if (!userPrompt) {
            updateArchitectStatus('请输入建筑描述', 'error');
            return;
        }

        updateArchitectStatus('正在生成...');

        // 获取参数
        const style = state.architectStyle || 'modern';
        const view = state.architectView || 'aerial';
        const time = state.architectTime || 'day';
        const negativePrompt = elements.architectNegativePromptPanel?.value.trim() || '';
        const size = elements.architectImageSizePanel?.value || '1024*1024';
        const promptExtend = elements.architectPromptExtendPanel?.checked ?? true;

        // 获取当前模型
        const currentModel = elements.modelSelector?.value || 'qwen';

        // 构建专业建筑提示词（包含大师风格）
        const fullPrompt = await buildArchitectPromptWithMaster(userPrompt, style, view, time);

        // 准备生成参数
        const params = {
            prompt: fullPrompt,
            negativePrompt: negativePrompt,
            apiKey: state.apiKey,
            size: size,
            promptExtend: promptExtend
        };

        // 如果是 Nano Banana 2，添加专属参数
        if (currentModel === 'nanobanana') {
            params.aspectRatio = elements.architectNanobananaAspectRatio?.value || '1:1';
            params.resolution = elements.architectNanobananaResolution?.value || '1K';
            params.outputFormat = elements.architectNanobananaOutputFormat?.value || 'jpg';
            params.googleSearch = elements.architectNanobananaGoogleSearch?.checked ?? false;
            params.imageSearch = elements.architectNanobananaImageSearch?.checked ?? false;
        }

        let result;

        // 如果有参考图，使用参考图生成
        if (state.architectRefImage) {
            result = await generateWithReferenceUnified({
                ...params,
                referenceImage: state.architectRefImage,
                baseImage: state.architectRefImage
            });
        } else {
            result = await generateImageUnified(params);
        }

        // 添加到结果预览栏
        addResult(result, fullPrompt);
        updateArchitectStatus('生成成功');

    } catch (error) {
        console.error('建筑大师生成失败:', error);
        updateArchitectStatus('生成失败: ' + error.message, 'error');
    }
}
