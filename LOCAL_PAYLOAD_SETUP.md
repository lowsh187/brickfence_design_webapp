# Local Setup Guide for Payload Pricing Admin

# Payload 价格管理后台本地部署指南

This guide explains how to run the new Next.js + Payload CMS pricing admin locally, including PostgreSQL setup, environment variables, admin login, supplier price sources, and common troubleshooting.

本文档说明如何在本地运行新的 Next.js + Payload CMS 价格管理后台，包括 PostgreSQL 建库、环境变量、管理员登录、供应商价格来源和常见问题。

---

## 1. Prerequisites

## 1. 前置要求

Install these tools first:

请先安装以下工具：

- Node.js 20 or newer
- npm
- PostgreSQL 16 or newer
- Git

Check versions:

检查版本：

```cmd
node -v
npm -v
git --version
```

If PostgreSQL is installed but `psql` is not available globally, use the full path to `psql.exe`.

如果 PostgreSQL 已安装但命令行找不到 `psql`，可以使用 `psql.exe` 的完整路径。

Example:

示例：

```cmd
"D:\vc\sql\PostgreSQL\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432
```

---

## 2. Clone and Install Dependencies

## 2. 克隆项目并安装依赖

```cmd
git clone https://github.com/swan0808/capstone_GId113_T3_CS_24.git
cd capstone_GId113_T3_CS_24
git checkout week11-nextjs
npm install
```

If the project already exists locally:

如果本地已经有项目：

```cmd
cd C:\Users\wangshihong\COMP5703-Project
git checkout week11-nextjs
git pull
npm install
```

---

## 3. Create Local PostgreSQL Database

## 3. 创建本地 PostgreSQL 数据库

Open CMD or PowerShell and connect to PostgreSQL.

打开 CMD 或 PowerShell，连接 PostgreSQL。

If `psql` is available globally:

如果系统可以直接运行 `psql`：

```cmd
psql -U postgres -h 127.0.0.1 -p 5432
```

If not, use the full path:

如果不行，使用完整路径：

```cmd
"D:\vc\sql\PostgreSQL\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432
```

After entering your PostgreSQL password, create the database:

输入 PostgreSQL 密码后，创建数据库：

```sql
CREATE DATABASE fence_calculator;
```

Check that it exists:

检查数据库是否创建成功：

```sql
\l
```

Exit PostgreSQL:

退出 PostgreSQL：

```sql
\q
```

Optional one-line command:

也可以使用一行命令：

```cmd
"D:\vc\sql\PostgreSQL\bin\createdb.exe" -U postgres -h 127.0.0.1 -p 5432 fence_calculator
```

---

## 4. Create `.env.local`

## 4. 创建 `.env.local`

Create a file named `.env.local` in the project root.

在项目根目录创建 `.env.local` 文件。

Example:

示例：

```env
DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/fence_calculator
PAYLOAD_SECRET=replace-this-with-a-long-random-secret
```

Replace:

替换以下内容：

- `YOUR_POSTGRES_PASSWORD` with your local PostgreSQL password
- `PAYLOAD_SECRET` with a long random string

- `YOUR_POSTGRES_PASSWORD` 替换为你的本地 PostgreSQL 密码
- `PAYLOAD_SECRET` 替换为一个较长的随机字符串

Important:

重要：

```text
.env.local must not be committed to Git.
.env.local 不要提交到 Git。
```

This project ignores `.env.local` through `.gitignore`.

本项目通过 `.gitignore` 忽略 `.env.local`。

You can verify:

可以检查：

```cmd
git check-ignore -v .env.local
```

---

## 5. Start the App

## 5. 启动项目

Run:

运行：

```cmd
npm run dev
```

Open:

打开：

```text
http://localhost:3000
```

Open the admin panel:

打开后台管理页面：

```text
http://localhost:3000/admin
```

---

## 6. Create the First Admin User

## 6. 创建第一个管理员账号

When opening `/admin` for the first time, Payload will show a welcome page asking you to create the first admin user.

第一次打开 `/admin` 时，Payload 会显示欢迎页面，让你创建第一个管理员账号。

Fill in:

填写：

- Email
- Password
- Confirm Password
- Name

Then click:

然后点击：

```text
Create
```

After this, use that email and password to log in to the admin panel.

之后使用该邮箱和密码登录后台。

---

## 7. Admin Collections

## 7. 后台数据模块说明

### Pricing Items

### 价格项目

Used to decide the final price used by the public calculator.

用于决定前台计算器最终使用的价格。

Main fields:

主要字段：

- `Price Source`
  - `Manual price`: use manually entered company price
  - `Supplier average price`: use average supplier price
  - `Specific supplier price`: use one selected supplier source
- `Final Price Display`: final price shown with unit, such as `1.6 each`
- `Final Price Source Display`: shows where the final price comes from

- `Price Source`
  - `Manual price`：使用公司手动设置价格
  - `Supplier average price`：使用供应商平均价格
  - `Specific supplier price`：使用指定供应商价格
- `Final Price Display`：带单位的最终价格，例如 `1.6 each`
- `Final Price Source Display`：显示最终价格来源

### Supplier Price Sources

### 供应商价格来源

Used to store supplier product URLs or manually entered supplier prices.

用于保存供应商商品 URL，或手动录入供应商价格。

There are two modes:

有两种模式：

#### URL Mode

#### URL 自动模式

Fill in:

填写：

- `Product URL`
- `Pricing Key`

The system will:

系统会：

- detect `Supplier Name` from the URL
- detect or default the unit
- fetch the price when clicking `Update this supplier price`
- update `Last Price Display`

- 从 URL 自动识别 `Supplier Name`
- 自动识别或默认设置单位
- 点击 `Update this supplier price` 时抓取价格
- 更新 `Last Price Display`

#### Manual Mode

#### 手动模式

Leave `Product URL` blank.

不填写 `Product URL`。

Then manually fill:

然后手动填写：

- `Supplier Name`
- `Pricing Key`
- `Unit`
- `Manual Price`

This source cannot be updated by the fetch button. To update it, edit and save manually.

这种来源不能通过抓取按钮更新。要更新价格，需要手动编辑并保存。

### Supplier Price Snapshots

### 供应商价格抓取历史

This is the historical log for each fetch.

这是每次抓取价格的历史记录。

It records:

它记录：

- supplier name
- pricing key
- unit price
- unit
- status
- raw URL
- error message if failed

- 供应商名称
- 价格项目 key
- 单价
- 单位
- 状态
- 原始 URL
- 如果失败，记录错误信息

---

## 8. Trigger Supplier Price Fetching

## 8. 触发供应商价格更新

### From the Admin UI

### 从后台页面操作

Go to:

进入：

```text
Admin -> Supplier Price Sources
```

Use:

使用：

```text
Update all supplier prices
```

Or open one source and use:

或者打开某一个来源，使用：

```text
Update this supplier price
```

### From Command Line

### 从命令行操作

If you are in PowerShell:

如果你在 PowerShell：

```powershell
Invoke-WebRequest -Method POST -Uri http://localhost:3000/admin/fetch-supplier-prices
```

If you are in CMD:

如果你在 CMD：

```cmd
powershell -Command "Invoke-WebRequest -Method POST -Uri http://localhost:3000/admin/fetch-supplier-prices"
```

Update one source by ID:

按 ID 更新单个来源：

```cmd
powershell -Command "Invoke-WebRequest -Method POST -Uri http://localhost:3000/admin/fetch-supplier-prices?sourceId=1"
```

---

## 9. Useful Verification Commands

## 9. 常用验证命令

Build:

构建：

```cmd
npm run build
```

Tests:

测试：

```cmd
npm run test:run
```

Lint:

代码检查：

```cmd
npm run lint
```

Check Git status:

检查 Git 状态：

```cmd
git status
```

---

## 10. Common Issues

## 10. 常见问题

### Cannot connect to Postgres

### 无法连接 Postgres

Check:

检查：

- PostgreSQL service is running
- database exists
- password in `.env.local` is correct
- `DATABASE_URL` uses `127.0.0.1`, not a wrong host

- PostgreSQL 服务是否正在运行
- 数据库是否存在
- `.env.local` 里的密码是否正确
- `DATABASE_URL` 是否使用了正确地址，例如 `127.0.0.1`

Test connection:

测试连接：

```cmd
"D:\vc\sql\PostgreSQL\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d fence_calculator
```

### `Invoke-WebRequest` is not recognized

### `Invoke-WebRequest` 无法识别

This means you are using CMD, not PowerShell.

这说明你当前使用的是 CMD，不是 PowerShell。

Use:

使用：

```cmd
powershell -Command "Invoke-WebRequest -Method POST -Uri http://localhost:3000/admin/fetch-supplier-prices"
```

### Admin page is slow on first open

### 第一次打开 Admin 很慢

Payload may be initializing the database schema.

Payload 可能正在初始化数据库表结构。

Wait for the terminal output. If it asks about schema changes, read the prompt carefully before confirming.

等待终端输出。如果它询问数据库 schema 变化，请先看清提示再确认。

### Supplier fetch failed

### 供应商抓取失败

Common reasons:

常见原因：

- URL is a homepage, not a product page
- page does not publicly show price
- price is loaded dynamically by JavaScript
- supplier blocks automated requests

- URL 是首页，不是具体商品页
- 页面没有公开显示价格
- 价格由 JavaScript 动态加载
- 供应商网站阻止自动请求

Use a public product detail page whenever possible.

尽量使用公开的具体商品页面。

---

## 11. Vercel Live Demo Notes

## 11. Vercel Live Demo 注意事项

For Vercel deployment, local PostgreSQL and `.env.local` are not available.

如果部署到 Vercel，线上无法使用本地 PostgreSQL 和 `.env.local`。

You need:

需要：

- an online PostgreSQL database, such as Supabase, Neon, Railway, or Vercel Postgres
- `DATABASE_URL` configured in Vercel environment variables
- `PAYLOAD_SECRET` configured in Vercel environment variables
- an admin user created on the live `/admin` page

- 一个线上 PostgreSQL 数据库，例如 Supabase、Neon、Railway 或 Vercel Postgres
- 在 Vercel 环境变量里配置 `DATABASE_URL`
- 在 Vercel 环境变量里配置 `PAYLOAD_SECRET`
- 在线上 `/admin` 页面创建 admin 用户

Do not use:

不要使用：

```env
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/fence_calculator
```

Because Vercel cannot access your local computer.

因为 Vercel 无法访问你的本地电脑数据库。

