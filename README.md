# Brick Fence Calculator | 砖墙围栏计算器

[中文](#中文) · [English](#english) · [在线演示](https://brickfencecalculator.vercel.app/)

一款用于设计砖墙围栏、预览砌筑效果并估算材料及施工成本的全栈 Web 应用。

A full-stack web application for designing brick fences, previewing bond layouts, and estimating material and construction costs.

---

## 中文

### 在线演示

访问：[https://brickfencecalculator.vercel.app/](https://brickfencecalculator.vercel.app/)

### 项目简介

Brick Fence Calculator 通过分步式操作帮助用户配置砖墙围栏。用户可以输入围栏尺寸、选择砖块规格和砌筑方式、配置砖柱及围栏填充，并查看实时结构预览和成本明细。

项目同时提供基于 Payload CMS 的管理后台，用于维护砖块、砂浆、人工和围栏材料价格，并支持从供应商页面更新价格。

### 核心功能

- 分步式围栏设计与报价流程
- 标准砖尺寸和自定义砖尺寸
- 实时砖墙结构预览，可展开和缩放
- 砖块数量、砂浆用量、人工费、填充材料费及总价计算
- 无砖柱、隐藏砖柱和外露砖柱配置
- Timber 木质围栏和 PVC 围栏填充
- 报价保存、载入和删除
- 中文和英文界面切换
- 响应式页面设计
- Cookie 同意与本地数据存储控制

### 支持的砌筑方式

- Stretcher Bond（顺砖砌法）
- Stack Bond（叠砌法）
- Header Bond（丁砖砌法）
- English Bond（英式砌法）
- English Garden Wall Bond（英式花园墙砌法）
- Flemish Bond（佛兰德式砌法）
- Flemish Garden Wall Bond（佛兰德式花园墙砌法）

### 前端支持

- 使用 Next.js、React 和 TypeScript 构建交互式界面
- 通过多步骤表单收集围栏尺寸和设计选项
- 使用 React Konva 绘制砖墙、切砖、砖柱和填充结构
- 根据选择实时更新预览与报价结果
- 支持标准或自定义砖块尺寸及砂浆缝尺寸
- 支持多种砖柱尺寸、高度和间距配置
- 使用浏览器本地存储保存当前表单和报价
- 使用 i18next 提供中英文国际化

> 当前报价和表单数据主要保存在用户浏览器中，并非基于用户账户的云端同步服务。

### 后端与管理后台支持

- 使用 Next.js App Router 提供页面和 API
- 使用 Payload CMS 提供内容及价格管理后台
- 使用 PostgreSQL 保存后台数据
- 管理砖块、砂浆、人工、Timber 和 PVC 围栏价格
- 支持手动价格、供应商平均价格和指定供应商价格
- 支持从供应商商品页面抓取和标准化价格
- 可选用 Gemini AI 辅助识别结构不统一的供应商价格信息
- 支持按块、批量、每袋、每米、立方米及自定义单位换算
- 为前台提供无缓存的最新价格 API
- 提供管理员创建、首位管理员注册和超级管理员恢复流程
- 包含供应商 URL 安全检查、同源校验和请求频率限制

### 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS |
| 可视化 | React Konva、Konva |
| 国际化 | i18next、react-i18next |
| 后端 / CMS | Next.js App Router、Payload CMS 3 |
| 数据库 | PostgreSQL |
| 可选 AI 能力 | Google Gemini |
| 部署 | Vercel |

### 本地运行

#### 环境要求

- Node.js 22
- npm
- PostgreSQL

#### 安装与启动

```bash
git clone https://github.com/lowsh187/brickfence_design_webapp.git
cd brickfence_design_webapp
npm install
```

复制 `.env.example` 为 `.env.local`，并配置：

```env
DATABASE_URL=postgres://payload:payload@127.0.0.1:5432/fence_calculator
PAYLOAD_SECRET=replace-with-a-long-random-secret
```

如需启用 Gemini 供应商价格解析，可另外设置：

```env
GEMINI_API_KEY=your-gemini-api-key
```

启动开发环境：

```bash
npm run dev
```

然后访问终端显示的本地地址，通常为 `http://localhost:3000/`。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 初始化 Payload 数据结构并构建生产版本 |
| `npm run preview` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run payload:bootstrap` | 初始化 Payload 数据结构 |

---

## English

[Back to Chinese](#中文)

### Live Demo

Visit: [https://brickfencecalculator.vercel.app/](https://brickfencecalculator.vercel.app/)

### Overview

Brick Fence Calculator guides users through a step-by-step brick fence configuration process. Users can enter fence dimensions, choose brick dimensions and bond patterns, configure piers and fence infill, and view a live structural preview with a detailed cost estimate.

The project also includes a Payload CMS admin panel for managing brick, mortar, labour, and fence-material pricing, with support for updating prices from supplier pages.

### Key Features

- Step-by-step fence design and quotation workflow
- Standard and custom brick dimensions
- Live brick layout preview with expanded and zoomable views
- Brick quantity, mortar, labour, infill, and total cost calculations
- No-pier, hidden-pier, and exposed-pier configurations
- Timber and PVC fence infill options
- Save, load, and delete quotations
- Chinese and English interface
- Responsive user interface
- Cookie consent and local data-storage controls

### Supported Bond Patterns

- Stretcher Bond
- Stack Bond
- Header Bond
- English Bond
- English Garden Wall Bond
- Flemish Bond
- Flemish Garden Wall Bond

### Frontend Capabilities

- Interactive interface built with Next.js, React, and TypeScript
- Multi-step form for fence dimensions and design selections
- Brick, cut-brick, pier, and infill rendering with React Konva
- Live preview and estimate updates as selections change
- Standard or custom brick and mortar-joint dimensions
- Multiple pier sizes, heights, and spacing options
- Browser-based persistence for the active form and saved quotes
- Chinese and English localisation with i18next

> Quote and form data is currently stored mainly in the user's browser. The application does not provide account-based cloud quote synchronisation.

### Backend and Admin Capabilities

- Pages and APIs powered by the Next.js App Router
- Content and pricing administration with Payload CMS
- PostgreSQL-backed admin data
- Brick, mortar, labour, timber, and PVC fence price management
- Manual, supplier-average, and selected-supplier pricing modes
- Supplier product-page price fetching and normalisation
- Optional Gemini AI fallback for supplier pages with inconsistent structures
- Support for per-item, bulk, per-bag, per-metre, cubic-metre, and custom-unit pricing
- A no-cache pricing API that provides current prices to the calculator
- Admin creation, first-admin registration, and super-admin recovery workflows
- Supplier URL validation, same-origin checks, and request rate limiting

### Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Visualisation | React Konva, Konva |
| Internationalisation | i18next, react-i18next |
| Backend / CMS | Next.js App Router, Payload CMS 3 |
| Database | PostgreSQL |
| Optional AI | Google Gemini |
| Deployment | Vercel |

### Local Development

#### Prerequisites

- Node.js 22
- npm
- PostgreSQL

#### Installation and Startup

```bash
git clone https://github.com/lowsh187/brickfence_design_webapp.git
cd brickfence_design_webapp
npm install
```

Copy `.env.example` to `.env.local`, then configure:

```env
DATABASE_URL=postgres://payload:payload@127.0.0.1:5432/fence_calculator
PAYLOAD_SECRET=replace-with-a-long-random-secret
```

To enable Gemini-assisted supplier price parsing, also set:

```env
GEMINI_API_KEY=your-gemini-api-key
```

Start the development server:

```bash
npm run dev
```

Open the local address shown in the terminal, usually `http://localhost:3000/`.

### Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Bootstrap the Payload schema and create a production build |
| `npm run preview` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run payload:bootstrap` | Bootstrap the Payload schema |
