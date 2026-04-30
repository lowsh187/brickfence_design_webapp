# Fence Cost Calculator

> [Click here for 中文版](#中文)

## English

A client-side web application for estimating brick fence costs. Built with React + TypeScript + Vite.

**Live demo:** https://capstone-g-id113-t3-cs-24.vercel.app/

> Contributing a new bond pattern or feature? See
> [CONTRIBUTING.md](CONTRIBUTING.md) for the branching workflow and the
> step-by-step guide to adding a bond pattern.

### Prerequisites

- **Node.js v22** (LTS)
- **npm** (comes with Node.js)

If you don't have Node.js installed, or have a different version:

1. Install [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
2. Restart your terminal, then run:
   ```bash
   nvm install 22
   nvm use 22
   ```
3. Verify:
   ```bash
   node -v
   # should print v22.x.x
   ```

### Getting Started

1. **Clone the repository**
   ```bash
   git clone git@github.com:CosimoZi/COMP5703-Project.git
   cd COMP5703-Project/fence-calculator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Open the URL shown in the terminal (usually http://localhost:5173/COMP5703-Project/).

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production (output in `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build and deploy to GitHub Pages |
| `npm run lint` | Run ESLint |

### Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v4
- react-konva (brick wall diagram)
- react-i18next (i18n: English / Chinese)
- react-router-dom (client-side routing)
- localStorage + cookies (client-side persistence)

### Known Issues / Troubleshooting

#### Firefox White Screen Issue

When running the project locally in Firefox, the page may display a white screen.

**Possible solutions:**
- Ensure the development server is running correctly (`npm run dev`)
- Check for errors in the browser Developer Tools (Console)
- Clear browser cache and reload the page
- Try using Chrome or another browser if the issue persists

This issue has been observed during local development and is documented here for future reference.

---

<a id="中文"></a>

## 中文

一个用于估算砖墙围栏成本的纯前端网页应用。基于 React + TypeScript + Vite 构建。

**在线演示：** https://cosimozi.github.io/COMP5703-Project/

> 想要新增一个砌筑样式或其它功能？请看
> [CONTRIBUTING.md](CONTRIBUTING.md)，里面有分支工作流和添加 bond
> pattern 的详细步骤。

### 环境要求

- **Node.js v22**（LTS 版本）
- **npm**（随 Node.js 一起安装）

如果你还没有安装 Node.js，或者版本不对：

1. 安装 [nvm](https://github.com/nvm-sh/nvm)（Node 版本管理器）：
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
2. 重启终端，然后运行：
   ```bash
   nvm install 22
   nvm use 22
   ```
3. 验证版本：
   ```bash
   node -v
   # 应该输出 v22.x.x
   ```

### 快速开始

1. **克隆仓库**
   ```bash
   git clone git@github.com:CosimoZi/COMP5703-Project.git
   cd COMP5703-Project/fence-calculator
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   在浏览器中打开终端显示的地址（通常是 http://localhost:5173/COMP5703-Project/）。

### 其他命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建生产版本（输出到 `dist/` 目录） |
| `npm run preview` | 本地预览生产版本 |
| `npm run deploy` | 构建并部署到 GitHub Pages |
| `npm run lint` | 运行 ESLint 代码检查 |

### 技术栈

- React 19 + TypeScript
- Vite（构建工具）
- Tailwind CSS v4
- react-konva（砖墙图形渲染）
- react-i18next（国际化：英文 / 中文）
- react-router-dom（前端路由）
- localStorage + cookies（客户端数据持久化）

### 常见问题 / 排错

#### Firefox 打开白屏问题

在 Firefox 浏览器中本地运行项目时，可能会出现白屏现象。

**可能的解决方法：**
- 确认开发服务器正常运行（`npm run dev`）
- 打开浏览器开发者工具（Console）查看是否有报错
- 清除浏览器缓存后重新加载页面
- 若问题仍然存在，建议使用 Chrome 或其他浏览器

该问题在本地开发过程中出现过，记录在此以供后续参考。

