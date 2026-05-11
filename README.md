# Fence Cost Calculator

A client-side web application for estimating brick fence costs. The project is built with React, TypeScript, and Vite.

**Live demo:** [capstone-g-id113-t3-cs-24.vercel.app](https://capstone-g-id113-t3-cs-24.vercel.app/)

For contribution workflow and bond-pattern development guidance, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## English

### Prerequisites

- Node.js v22
- npm

If you use `nvm`:

```bash
nvm install 22
nvm use 22
node -v
```

### Getting Started

```bash
git clone git@github.com:CosimoZi/COMP5703-Project.git
cd COMP5703-Project/fence-calculator
npm install
npm run dev
```

Open the local URL shown in the terminal, usually `http://localhost:5173/`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Start Vitest in watch mode |
| `npm run test:run` | Run the full automated test suite once |
| `npm run deploy` | Build and deploy to GitHub Pages |

### Running Tests

Install dependencies first:

```bash
npm install
```

Run all tests once:

```bash
npm run test:run
```

Run tests in watch mode during development:

```bash
npm run test
```

### Current Test Coverage

The current automated test suite covers:

- `brickDimensions.ts`
- `stack.ts`
- `FormContext.tsx`
- `DimensionsPage.tsx`
- `BondPage.tsx`

Detailed test cases are documented in [TEST_CASES.md](./TEST_CASES.md).

### Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- react-router-dom
- react-konva
- react-i18next
- Vitest
- Testing Library

### Troubleshooting

If the app shows a blank screen locally:

- Make sure the dev server is running with `npm run dev`
- Check browser developer tools for console errors
- Clear browser cache and reload
- Try another browser if the issue is browser-specific

## 中文

### 环境要求

- Node.js v22
- npm

如果你使用 `nvm`，可以执行：

```bash
nvm install 22
nvm use 22
node -v
```

### 快速开始

```bash
git clone git@github.com:CosimoZi/COMP5703-Project.git
cd COMP5703-Project/fence-calculator
npm install
npm run dev
```

然后在浏览器打开终端中显示的本地地址，一般是 `http://localhost:5173/`。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览生产版本 |
| `npm run lint` | 运行 ESLint |
| `npm run test` | 以监听模式运行 Vitest |
| `npm run test:run` | 一次性运行全部自动化测试 |
| `npm run deploy` | 构建并部署到 GitHub Pages |

### 如何运行测试

先安装依赖：

```bash
npm install
```

一次性执行全部测试：

```bash
npm run test:run
```

开发过程中持续监听测试：

```bash
npm run test
```

### 当前测试覆盖范围

当前自动化测试已经覆盖：

- `brickDimensions.ts`
- `stack.ts`
- `FormContext.tsx`
- `DimensionsPage.tsx`
- `BondPage.tsx`

更详细的 test case 记录见 [TEST_CASES.md](./TEST_CASES.md)。
