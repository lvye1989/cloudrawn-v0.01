# Cloudrawn - 极简AI 图片生成工作台 全球第一个带有建筑大师skill的图片生成平台 / Minimalist AI Image Generation Workbench
<img width="920" height="616" alt="截屏2026-04-17 00 10 59" src="https://github.com/user-attachments/assets/73e236c2-1ee9-481d-b739-7cf89503b756" />

> 一个基于 Chrome 扩展的 AI 图片生成与编辑工具，支持阿里云百炼 Qwen 和 nanobanana_2 多模型切换，提供风格迁移、线稿转图片、局部蒙版编辑等高级功能。
>
> A Chrome extension-based AI image generation and editing tool, supporting multi-model switching between Alibaba Cloud Bailian Qwen and Replicate FLUX 2 Pro, with advanced features like style transfer, sketch-to-image, and local mask editing.

<p align="center">
  <strong>基于 Chrome 扩展的极简 AI 图片生成与编辑工具</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装指南">安装指南</a> •
  <a href="#使用教程">使用教程</a> •
  <a href="#项目结构">项目结构</a> •
  <a href="#技术栈">技术栈</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## 📸 界面预览

<img width="1423" height="694" alt="主界面" src="https://github.com/user-attachments/assets/4cc7b63f-7f20-4bea-ae65-a8cd1cd7bb3a" />
<img width="1425" height="699" alt="线稿模式" src="https://github.com/user-attachments/assets/d62e961f-7ad1-420d-9049-9e4410659afb" />
<img width="1427" height="688" alt="风格迁移" src="https://github.com/user-attachments/assets/dd562207-4cf9-4240-847e-960166543917" />
<img width="1422" height="688" alt="建筑大师" src="https://github.com/user-attachments/assets/a606696e-273a-48e1-a33e-8a0f4e4ac686" />

---

## ✨ 功能特性

### 🏠 主页模式 - AI 文生图
- **智能文本生成**：输入描述即可生成高质量图片
- **多模型支持**：一键切换 Qwen Image 2.0 Pro 和 Nano Banana 2
- **提示词优化**：自动将中文提示词翻译并优化为高质量英文提示词
- **参考图上传**：支持上传参考图片辅助生成
- **高级参数设置**：
  - 图片尺寸：512×512 至 1024×1024 多种比例
  - 图片质量：高清/标准/快速
  - 生成数量：1-4 张批量生成
  - 负面提示词：排除不想要的内容
  - 提示词扩写：自动优化描述

### ✏️ 线稿绘制模式 - Sketch to Image
- **手绘线稿转图**：在画布上自由绘制草图，AI 转化为完整图像
- **画笔工具**：支持画笔和橡皮擦，可调节粗细和颜色
- **参考图融合**：上传参考图片，让 AI 结合线稿和参考图生成
- **多图上传**：支持上传多张参考图片辅助创作

### 🎨 风格迁移模式 - Style Transfer
- **双图融合**：上传底图（保持构图）+ 风格参考图（应用风格）
- **风格强度调节**：弱/中/强三档风格强度
- **批量生成**：一次生成多张不同风格的图片
- **智能融合**：AI 智能提取风格特征并应用到目标图像

### 🖌️ 局部修改模式 - Inpainting
- **蒙版编辑**：涂抹需要修改的区域，精准控制修改范围
- **双图融合编辑**：上传底图 + 参考素材图，将素材融合到指定区域
- **实时预览**：涂抹区域实时预览，支持笔刷大小调节
- **精准替换**：只修改涂抹区域，保持其他部分完全不变

### 🏛️ 建筑大师模式 - Architectural Design
专为建筑设计优化的专业模式，支持三位建筑大师风格：

| 大师 | 风格特点 |
|------|----------|
| **勒·柯布西耶** | 粗野主义、模度比例、混凝土雕塑感、建筑多色性 |
| **路易斯·康** | 柏拉图几何、服务与被服务空间、自然光运用、砖石与混凝土 |
| **丹下健三** | 新陈代谢派、结构表现主义、日本传统与现代融合、悬索屋顶 |

**建筑参数设置**：
- 建筑风格：现代/古典/极简/未来/中式/欧式/工业/绿色
- 视角选择：鸟瞰/人视/虫视/特写
- 时间氛围：白天/黄昏/夜晚/黎明

---

## 🚀 安装指南

### 环境要求
- Chrome 浏览器（版本 88+）
- 阿里云百炼 API Key 或 Replicate API Token

### 安装步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd clouder
```

#### 2. 加载扩展
1. 打开 Chrome 浏览器，输入地址：`chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录（包含 `manifest.json` 的文件夹）

#### 3. 配置 API Key
1. 点击浏览器工具栏的 Cloudrawn 图标
2. 在设置面板中选择 AI 模型：
   - **Qwen Image 2.0 Pro**（阿里云百炼）
   - **Nano Banana 2**（Replicate）
3. 输入对应的 API Key：
   - 阿里云百炼 API Key：[获取地址](https://bailian.console.aliyun.com/)
   - Replicate API Token：[获取地址](https://replicate.com/account/api-tokens)

#### 4. 开始使用
- 点击扩展图标打开全屏工作台
- 或右键点击页面选择「打开侧边栏」

---

## 📖 使用教程

### 示例 1：文生图
1. 在主页输入框描述你想要的图片，如：「一只橘猫在樱花树下」
2. 选择图片尺寸和质量
3. 点击生成按钮
4. 在右侧结果栏查看生成的图片

### 示例 2：线稿转图
1. 切换到「线稿绘制」模式
2. 在画布上简单勾勒轮廓（如人物、建筑）
3. 输入提示词：「高清写实风格，细节丰富」
4. 点击生成，线稿转化为逼真图像

### 示例 3：风格迁移
1. 切换到「风格迁移」模式
2. 上传底图（如一张风景照片）
3. 上传风格参考图（如梵高《星空》）
4. 输入提示词描述目标内容
5. 点击生成，获得梵高风格的风景图

### 示例 4：局部修改
1. 切换到「局部修改」模式
2. 上传底图
3. 用画笔涂抹想要修改的区域
4. 输入描述如何修改的提示词
5. 点击生成，仅修改涂抹区域

### 示例 5：建筑效果图
1. 切换到「建筑大师」模式
2. 选择建筑风格和视角
3. 选择建筑大师（可选）
4. 输入建筑设计描述
5. 点击生成专业建筑效果图

---

## 🏗️ 项目结构

```
clouder/
├── manifest.json              # Chrome 扩展配置（Manifest V3）
├── background.js              # 后台服务脚本（代理 API 请求）
├── content.js                 # 页面内容脚本
├── popup.html                 # 弹窗界面
├── sidepanel.html             # 侧边栏/全屏工作台界面
├── prd.md                     # 产品需求文档
├── README.md                  # 项目说明文档
│
├── scripts/
│   ├── api.js                 # API 调用核心（支持 Qwen & Nano Banana）
│   └── popup.js               # 弹窗逻辑与交互控制
│
├── styles/
│   └── popup.css              # 样式文件
│
├── icons/                     # 扩展图标
│   ├── icon.svg
│   ├── icon001.png
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── docs/                      # 技术文档
│   ├── ali.md                 # 阿里云百炼 API 文档
│   ├── banana参数.md          # Nano Banana 参数说明
│   └── flux.md                # FLUX 模型文档
│
└── skill/                     # 建筑大师技能文件
    ├── 柯布西耶.md            # 勒·柯布西耶风格提示词
    ├── 路易斯康.md            # 路易斯·康风格提示词
    ├── 丹下健三.md            # 丹下健三风格提示词
    └── public/                # 大师头像资源
        ├── le-corbusier.jpg
        ├── louis-kahn.jpg
        └── 丹下健三.png
```

---

## 🛠️ 技术栈

### 前端技术
- **HTML5** - 语义化结构
- **CSS3** - 现代样式与动画
- **JavaScript (ES6+)** - 模块化开发

### Chrome 扩展 API
- **Manifest V3** - 最新扩展标准
- **Storage API** - 本地数据存储
- **Side Panel API** - 侧边栏界面
- **Windows API** - 窗口管理
- **Context Menus** - 右键菜单

### AI 模型 API
- **阿里云百炼 Qwen Image 2.0 Pro** - 中文优化图像生成
- **Replicate Nano Banana 2** - 高质量图像生成

### 核心功能实现
- **Canvas API** - 线稿绘制与蒙版编辑
- **File API** - 图片上传与处理
- **Fetch API** - 网络请求（配合 Background 代理）

---

## 🔧 开发说明

### API 配置
在 [`scripts/api.js`](scripts/api.js) 中配置模型参数：

```javascript
const MODEL_CONFIGS = {
    qwen: {
        name: 'Qwen Image 2.0 Pro',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        model: 'qwen-image-2.0-pro',
        // ...
    },
    nanobanana: {
        name: 'Nano Banana 2',
        baseUrl: 'https://api.replicate.com/v1',
        model: 'google/nano-banana-2',
        // ...
    }
};
```

### 添加新的建筑大师
1. 在 `skill/` 目录创建新的 `.md` 文件
2. 编写大师风格提示词
3. 在 `skill/public/` 添加大师头像
4. 在 [`sidepanel.html`](sidepanel.html) 添加大师选择 UI
5. 在 [`scripts/popup.js`](scripts/popup.js) 添加大师选择逻辑

---

## 📝 更新日志

### v2.0.0 (2026-04)
- ✨ 新增建筑大师模式，支持三位建筑大师风格
- ✨ 新增 Nano Banana 2 模型支持
- ✨ 新增提示词自动优化功能
- ✨ 新增多图上传和批量生成
- 🎨 全新 UI 设计，支持拖拽调整面板宽度
- 🔧 优化蒙版编辑体验，新增实时预览

### v1.0.0
- 🎉 初始版本发布
- ✨ 支持文生图、线稿转图、风格迁移、局部修改
- ✨ 支持 Qwen Image API

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 💬 反馈与支持

如有问题或建议，欢迎：
- 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 联系开发者

---

<p align="center">
  Made with ❤️ by Cloudrawn Team
</p>
