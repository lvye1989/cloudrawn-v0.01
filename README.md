# Cloudrawn - 极简AI 图片生成工作台 / Minimalist AI Image Generation Workbench

> 一个基于 Chrome 扩展的 AI 图片生成与编辑工具，支持阿里云百炼 Qwen 和 Replicate FLUX 2 Pro 多模型切换，提供风格迁移、线稿转图片、局部蒙版编辑等高级功能。
>
> A Chrome extension-based AI image generation and editing tool, supporting multi-model switching between Alibaba Cloud Bailian Qwen and Replicate FLUX 2 Pro, with advanced features like style transfer, sketch-to-image, and local mask editing.

---
<img width="1423" height="694" alt="截屏2026-04-08 22 08 08" src="https://github.com/user-attachments/assets/4cc7b63f-7f20-4bea-ae65-a8cd1cd7bb3a" />
<img width="1425" height="699" alt="截屏2026-04-08 22 09 57" src="https://github.com/user-attachments/assets/d62e961f-7ad1-420d-9049-9e4410659afb" />
<img width="1427" height="688" alt="截屏2026-04-08 22 10 33" src="https://github.com/user-attachments/assets/dd562207-4cf9-4240-847e-960166543917" />
<img width="1422" height="688" alt="截屏2026-04-08 22 11 00" src="https://github.com/user-attachments/assets/a606696e-273a-48e1-a33e-8a0f4e4ac686" />
## 这个项目解决了什么问题？ / What Problems Does This Project Solve?

在日常使用 AI 生成图片时，用户经常面临以下痛点：

When using AI for image generation, users often face these pain points:

1. **风格难以描述 / Hard to Describe Styles** - 想要某种特定风格（如梵高油画、赛博朋克），但用文字难以准确表达 / Want a specific style (e.g., Van Gogh oil painting, cyberpunk) but hard to describe accurately in words
2. **线稿转化繁琐 / Tedious Sketch Conversion** - 手绘草图需要手动上传到 AI 平台，流程割裂 / Hand-drawn sketches require manual upload to AI platforms, breaking the workflow
3. **局部修改困难 / Difficult Local Editing** - 生成图片后想修改某个细节（如换件衣服、改个表情），只能重新生成整张图 / Want to modify a detail (e.g., change clothes, alter expression) but have to regenerate the entire image
4. **多平台切换麻烦 / Inconvenient Multi-Platform Switching** - 不同 AI 模型各有优势，但需要在不同网站间反复切换 / Different AI models have their strengths, but switching between websites is cumbersome

**Cloudrawn** 将这些问题整合到一个统一的工作台中，让用户可以在一个界面内完成：

**Cloudrawn** integrates these solutions into a unified workbench, allowing users to complete tasks in one interface:

- 🎨 **风格迁移 / Style Transfer** - 上传参考图，让 AI 学习并应用该风格 / Upload reference images and let AI learn and apply the style
- ✏️ **线稿转图 / Sketch-to-Image** - 手绘草图直接转化为高清成品图 / Convert hand-drawn sketches directly into high-quality finished images
- 🖌️ **局部编辑 / Local Editing** - 涂抹蒙版，精准修改图片局部区域 / Paint masks to precisely modify local areas of images
- 🔄 **多模型切换 / Multi-Model Switching** - 一键切换 Qwen 和 FLUX 2 Pro 模型 / One-click switching between Qwen and FLUX 2 Pro models

---

## 如何安装和运行？ / How to Install and Run?

### 环境要求 / Requirements

- Chrome 浏览器（版本 88+）/ Chrome browser (version 88+)
- 阿里云百炼 API Key 或 Replicate API Token / Alibaba Cloud Bailian API Key or Replicate API Token

### 安装步骤 / Installation Steps

1. **克隆或下载项目 / Clone or Download the Project**

   ```bash
   git clone <repository-url>
   cd clouder
   ```

2. **打开 Chrome 扩展管理页面 / Open Chrome Extension Management Page**

   - 在 Chrome 地址栏输入：/ Enter in Chrome address bar: `chrome://extensions/`
   - 开启右上角的「开发者模式」/ Enable "Developer mode" in the top right corner

3. **加载扩展 / Load the Extension**

   - 点击「加载已解压的扩展程序」/ Click "Load unpacked"
   - 选择项目根目录（包含 `manifest.json` 的文件夹）/ Select the project root directory (folder containing `manifest.json`)

4. **配置 API Key / Configure API Key**

   - 点击浏览器工具栏的 Cloudrawn 图标 / Click the Cloudrawn icon in the browser toolbar
   - 在设置面板中输入你的 API Key：/ Enter your API Key in the settings panel:
     - **阿里云百炼 / Alibaba Cloud Bailian**：从 [阿里云百炼控制台](https://bailian.console.aliyun.com/) 获取 / Get from [Bailian Console](https://bailian.console.aliyun.com/)
     - **Replicate**：从 [Replicate 账户设置](https://replicate.com/account/api-tokens) 获取 / Get from [Replicate Account Settings](https://replicate.com/account/api-tokens)

5. **开始使用 / Start Using**

   - 点击扩展图标打开全屏工作台 / Click the extension icon to open the fullscreen workbench
   - 或右键点击页面选择「打开侧边栏」/ Or right-click on the page and select "Open Side Panel"

---

## 简单的使用示例 / Simple Usage Examples

### 示例 1：风格迁移 / Example 1: Style Transfer

1. 在工作台左侧上传一张风格参考图（如梵高的《星空》）/ Upload a style reference image on the left side of the workbench (e.g., Van Gogh's "Starry Night")
2. 在提示词框输入：「一只猫坐在窗台上」/ Enter in the prompt box: "A cat sitting on a windowsill"
3. 勾选「使用参考图风格」选项 / Check the "Use reference image style" option
4. 点击生成，获得梵高风格的猫咪图片 / Click generate to get a Van Gogh-style cat image

### 示例 2：线稿转图片 / Example 2: Sketch-to-Image

1. 切换到「线稿绘制」模式 / Switch to "Sketch Drawing" mode
2. 在画布上简单勾勒一个火柴人 / Simply sketch a stick figure on the canvas
3. 输入提示词：「一个穿着宇航服的宇航员，高清写实风格」/ Enter prompt: "An astronaut in a spacesuit, high-definition realistic style"
4. 点击生成，线稿转化为逼真的宇航员图片 / Click generate to convert the sketch into a realistic astronaut image

### 示例 3：局部修改（蒙版编辑）/ Example 3: Local Editing (Mask Editing)

1. 生成一张人物照片 / Generate a portrait photo
2. 切换到「局部编辑」模式 / Switch to "Local Editing" mode
3. 用画笔涂抹想要修改的区域（如把墨镜涂成紫色）/ Paint the area you want to modify with the brush (e.g., paint sunglasses purple)
4. 输入提示词：「把墨镜换成金色边框」/ Enter prompt: "Change the sunglasses to gold frames"
5. 点击生成，仅修改涂抹区域，其他部分保持不变 / Click generate to modify only the painted area while keeping other parts unchanged

---

## 项目结构 / Project Structure

```
clouder/
├── manifest.json          # Chrome 扩展配置 / Chrome extension config
├── background.js          # 后台服务脚本 / Background service worker
├── content.js             # 页面内容脚本 / Content script for page interaction
├── popup.html             # 弹窗界面 / Popup interface
├── sidepanel.html         # 侧边栏/全屏工作台界面 / Side panel / fullscreen workbench interface
├── scripts/
│   ├── api.js            # API 调用核心（支持 Qwen & FLUX）/ API core (supports Qwen & FLUX)
│   └── popup.js          # 弹窗逻辑 / Popup logic
├── styles/
│   └── popup.css         # 样式文件 / Stylesheet
├── icons/                # 扩展图标 / Extension icons
└── docs/                 # 文档 / Documentation
    ├── ali.md            # 阿里云百炼 API 文档 / Alibaba Cloud Bailian API docs
    └── flux.md           # FLUX 模型文档 / FLUX model docs
```

---

## 技术栈 / Tech Stack

- **前端 / Frontend**：原生 HTML5 + CSS3 + JavaScript（ES6+）/ Vanilla HTML5 + CSS3 + JavaScript (ES6+)
- **API 集成 / API Integration**：阿里云百炼 Qwen Image 2.0 Pro、Replicate FLUX 2 Pro / Alibaba Cloud Bailian Qwen Image 2.0 Pro, Replicate FLUX 2 Pro
- **Chrome API**：Manifest V3、Storage、Side Panel、Windows

---

## 许可证 / License

MIT License

---

## 反馈与支持 / Feedback & Support

如有问题或建议，欢迎提交 Issue 或联系开发者。

For questions or suggestions, feel free to submit an Issue or contact the developer.
