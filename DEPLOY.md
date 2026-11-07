# Timeminer Tools 部署指南

[English](#english) · [中文](#中文)

GitHub Pages + Cloudflare 自定义域名，纯静态部署，无后端。

---

## 中文

### 项目现状

当前是一个**纯静态单页应用**：

- 源码在 `src/`，由 Vite + React + TypeScript 构建。
- 生产产物由 `npm run build` 输出到 `dist/`。
- 没有后端、没有 API 路由、没有数据库、没有登录功能。
- API Key 与偏好设置只存在访客自己的浏览器 `localStorage` 里。
- 构建前先跑 `tsc -b`，类型错误会让构建失败。

文件结构：

```
timeminer-tools/
├── src/                    # React + TypeScript 源码
│   ├── App.tsx             # 工具注册表、外壳、14 个工作台
│   ├── components/ui.tsx   # 基础组件
│   ├── lib/i18n.ts         # 双语字符串表
│   ├── lib/chains.ts       # 链注册表
│   ├── lib/rpc.ts          # 只读 RPC 传输
│   ├── lib/evm.ts          # 存储槽与 ABI 工具
│   └── index.css           # 设计 token
├── index.html              # Vite 入口，含首帧主题脚本
├── package.json            # npm 脚本与依赖
├── tailwind.config.ts      # Tailwind 主题映射
├── vite.config.ts
├── .github/workflows/      # GitHub Pages 自动构建部署
├── CNAME                   # 自定义域名 tools.timeminer.cc
├── .nojekyll               # 跳过 Jekyll 处理
├── Products.md             # 产品文档（中英双语）
├── README.md               # 项目说明（中英双语）
└── DEPLOY.md               # 本文件
```

### 第一步：推送到 GitHub

```bash
cd /path/to/timeminer-tools

# 如果还没有 git remote，先添加
git remote add origin git@github.com:你的用户名/你的仓库名.git
# 或者用 HTTPS
git remote add origin https://github.com/你的用户名/你的仓库名.git

git add -A
git commit -m "描述你的改动"
git push origin main
```

> 如果 `git push` 报历史不匹配，先执行 `git pull --rebase origin main`，解决冲突后再推送。

### 第二步：启用 GitHub Pages

1. 打开 GitHub 仓库页面。
2. **Settings** → 左侧 **Pages**。
3. **Build and deployment** 区域：
   - **Source** 选择 `GitHub Actions`。
   - 不要选 `Deploy from a branch / root`。
4. 推送到 `main` 后，`.github/workflows/` 里的工作流会自动执行：
   - `npm ci`
   - `npm run build`
   - 校验 `dist/index.html` 存在、`dist/assets` 存在，且产物中不含 `/src/main.tsx`
   - 上传 `dist/` 到 GitHub Pages
5. 等 1–2 分钟，页面顶部会显示 `Your site is live at https://你的用户名.github.io/仓库名/`。

> 这个默认地址之后会被自定义域名替换，不必纠结。

### 第三步：Cloudflare 配置自定义域名

前提：域名已在 Cloudflare 管理，子域名使用 `tools.timeminer.cc`。

#### 3.1 添加 DNS 记录

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 选择域名 → 左侧 **DNS** → **Records**。
3. **Add record**：

| 字段 | 值 |
|---|---|
| Type | `CNAME` |
| Name | `tools` |
| Target | `你的用户名.github.io` |
| Proxy status | **开启**（橙色云朵） |

4. **Save**。

> 开启 Proxy 可以隐藏源站、提供 CDN 加速、自动签发 SSL。

#### 3.2 配置 SSL/TLS

**SSL/TLS** → **Overview**，加密模式选 **Full** 或 **Full (strict)**。推荐 **Full (strict)**。

#### 3.3 确认 GitHub Pages 自定义域名

1. 仓库 → **Settings** → **Pages**。
2. **Custom domain** 填 `tools.timeminer.cc`。
3. **Save**。
4. GitHub 会自动验证 DNS，首次可能需要几分钟到几十分钟。

> `CNAME` 文件已在项目里，GitHub 会自动识别。

#### 3.4 关于缓存

Cloudflare 开启橙色云朵后，HTML 与静态资源都会被缓存。本项目已做两件事降低版本错乱风险：

- 资源文件名带内容哈希（Vite 默认行为），内容变化必然换名。
- `index.html` 中的内联脚本在首帧前读取主题，不依赖外部资源。

如果发版后访客仍看到旧版本，优先检查 Cloudflare 的 **Caching → Purge Cache**，而不是改代码。

### 第四步：验证部署

DNS 生效后（一般 1–5 分钟）：

1. 访问 `https://tools.timeminer.cc`。
2. 确认页面正常加载、地址栏有锁图标。
3. 切换几个工具，确认工作台正常渲染。
4. 点击右上角设置，确认弹窗可打开、可保存。
5. 切换明暗主题与中英语言，刷新页面，确认两个偏好都被记住且**没有白屏闪烁**。
6. 如有 Alchemy / Infura Key，填入后用一个链上工具做一次真实读取，确认结果里出现 chainId 与区块号。

### 第五步：后续更新

```bash
git add -A
git commit -m "描述你的改动"
git push origin main
```

GitHub Pages 自动重新部署，1–2 分钟生效。

### 重要提醒

1. **API Key 只存在浏览器里**：Alchemy / Infura Key 保存在访客自己的 `localStorage`，不会上传到任何服务器。换浏览器或清除数据后需重新填写。
2. **无需后端**：哈希、AES 加解密、存储槽计算、时间换算全部在浏览器执行。GitHub Pages 纯静态托管完全够用。
3. **隐私优先模式**：开启后阻断所有外部请求（RPC、广告、远程查询）。此时链上工具会**拒绝执行并提示**，不会静默返回空结果。
4. **只读**：应用没有任何签名或发交易路径，部署时无需担心密钥托管问题。

---

## English

GitHub Pages plus a Cloudflare custom domain. Static deployment, no backend.

### Current state

A **fully static single-page application**:

- Source in `src/`, built with Vite + React + TypeScript.
- Production output from `npm run build` lands in `dist/`.
- No backend, no API routes, no database, no sign-in.
- API keys and preferences live only in the visitor's own `localStorage`.
- `tsc -b` runs before the build, so a type error fails it.

Layout:

```
timeminer-tools/
├── src/                    # React + TypeScript source
│   ├── App.tsx             # tool registry, shell, 14 workbenches
│   ├── components/ui.tsx   # UI primitives
│   ├── lib/i18n.ts         # bilingual string table
│   ├── lib/chains.ts       # chain registry
│   ├── lib/rpc.ts          # read-only RPC transport
│   ├── lib/evm.ts          # storage slot and ABI helpers
│   └── index.css           # design tokens
├── index.html              # Vite entry, includes the first-paint theme script
├── package.json            # npm scripts and dependencies
├── tailwind.config.ts      # Tailwind theme mapping
├── vite.config.ts
├── .github/workflows/      # automated GitHub Pages deploy
├── CNAME                   # custom domain tools.timeminer.cc
├── .nojekyll               # skip Jekyll processing
├── Products.md             # product doc (bilingual)
├── README.md               # project doc (bilingual)
└── DEPLOY.md               # this file
```

### Step 1 — Push to GitHub

```bash
cd /path/to/timeminer-tools

git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
# or over HTTPS
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git

git add -A
git commit -m "describe your change"
git push origin main
```

> If `git push` reports unrelated histories, run `git pull --rebase origin main` first, resolve conflicts, then push.

### Step 2 — Enable GitHub Pages

1. Open the repository on GitHub.
2. **Settings** → **Pages**.
3. Under **Build and deployment**:
   - Set **Source** to `GitHub Actions`.
   - Do not choose `Deploy from a branch / root`.
4. Once you push to `main`, the workflow under `.github/workflows/` runs automatically:
   - `npm ci`
   - `npm run build`
   - verify `dist/index.html` and `dist/assets` exist and that the output no longer references `/src/main.tsx`
   - upload `dist/` to GitHub Pages
5. After a minute or two the page shows `Your site is live at https://YOUR_USER.github.io/REPO/`.

> That default address is temporary; the custom domain replaces it.

### Step 3 — Cloudflare custom domain

Assumes the domain is already on Cloudflare and the subdomain is `tools.timeminer.cc`.

#### 3.1 Add the DNS record

1. Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Pick the domain → **DNS** → **Records**.
3. **Add record**:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `tools` |
| Target | `YOUR_USER.github.io` |
| Proxy status | **Proxied** (orange cloud) |

4. **Save**.

> Proxying hides the origin, adds CDN caching, and issues SSL automatically.

#### 3.2 SSL/TLS

**SSL/TLS** → **Overview** → encryption mode **Full** or **Full (strict)**. Full (strict) is recommended.

#### 3.3 Confirm the Pages custom domain

1. Repository → **Settings** → **Pages**.
2. Enter `tools.timeminer.cc` in **Custom domain**.
3. **Save**.
4. GitHub verifies DNS, which can take minutes to tens of minutes the first time.

> The `CNAME` file is already committed, so GitHub picks it up.

#### 3.4 About caching

With the orange cloud on, both HTML and assets get cached. Two things already reduce version-mismatch risk:

- Asset filenames carry a content hash (Vite's default), so changed content always changes the name.
- The theme is resolved by an inline script in `index.html`, with no external dependency.

If visitors still see a stale build after a release, check **Caching → Purge Cache** in Cloudflare before touching code.

### Step 4 — Verify

Once DNS resolves (usually 1–5 minutes):

1. Open `https://tools.timeminer.cc`.
2. Confirm the page loads and the address bar shows a lock icon.
3. Switch between a few tools and confirm the workbench renders.
4. Open Settings and confirm the modal opens and saves.
5. Toggle theme and language, reload, and confirm both preferences persist **without a white flash**.
6. If you have an Alchemy or Infura key, fill it in and run one real chain read; confirm the result reports a chainId and block number.

### Step 5 — Ongoing updates

```bash
git add -A
git commit -m "describe your change"
git push origin main
```

GitHub Pages redeploys automatically within a minute or two.

### Important notes

1. **API keys stay in the browser.** Alchemy / Infura keys are stored in the visitor's own `localStorage` and are never uploaded. Switching browsers or clearing data requires re-entering them.
2. **No backend needed.** Hashing, AES, storage slot maths, and time conversion all run in the browser. Static hosting is sufficient.
3. **Privacy First Mode** blocks all outbound requests (RPC, ads, remote lookups). Chain tools then **refuse to run and say so** rather than silently returning empty results.
4. **Read-only.** The app has no signing or transaction path, so there is no key custody to worry about at deploy time.
