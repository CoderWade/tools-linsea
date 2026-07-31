# Linsea Tools — GitHub Pages + Cloudflare 部署教程

## 项目现状

已完成的修改：

- **移除了 Node.js 后端**（server.js、package.json、users.json）
- **移除了登录/注册功能**，因为 GitHub Pages 是纯静态托管，无法运行后端
- **设置面板简化**：Alchemy/Infura API Key、默认链、Privacy First Mode 全部保存在浏览器 `localStorage` 中
- **项目现在是纯静态站点**：`index.html` + `app.js` + `styles.css`

最终文件结构：

```
tools-linsea/
├── index.html      # 入口页面
├── app.js          # 所有应用逻辑
├── styles.css      # 样式
├── CNAME           # 自定义域名 (tools.timeminer.cc)
├── .nojekyll       # 告诉 GitHub Pages 跳过 Jekyll 处理
├── Products.md     # 产品需求文档 (不影响部署)
├── SKILL.md        # 技能定义
└── README.md       # 项目说明
```

---

## 第一步：推送到 GitHub

在项目目录中执行：

```bash
cd /path/to/tools-linsea

# 如果还没有 git remote，先添加
git remote add origin git@github.com:你的用户名/你的仓库名.git
# 或者用 HTTPS
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 提交所有改动
git add -A
git commit -m "Remove Node backend, simplify to static site for GitHub Pages"

# 推送到 main 分支
git push origin main
```

> 如果 `git push` 报错说历史不匹配，执行 `git pull --rebase origin main` 先拉取，解决冲突后再推送。

---

## 第二步：启用 GitHub Pages

1. 打开你的 GitHub 仓库页面
2. 点击 **Settings** → 左侧菜单 **Pages**
3. 在 **Build and deployment** 区域：
   - **Source**：选择 `Deploy from a branch`
   - **Branch**：选择 `main`，目录选 `/ (root)`
   - 点击 **Save**
4. GitHub 自动开始构建。等待 1-2 分钟，页面顶部会显示 `Your site is live at https://你的用户名.github.io/仓库名/`

> 如果你的仓库名为 `tools-linsea`，默认地址是 `https://你的用户名.github.io/tools-linsea/`。这个地址之后会被自定义域名替换，不必纠结。

---

## 第三步：Cloudflare 配置自定义域名

### 前提条件

- 域名 `timeminer.cc` 已在 Cloudflare 管理（NS 指向 Cloudflare）
- 子域名为：`tools.timeminer.cc`

### 3.1 添加 DNS CNAME 记录

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择 `timeminer.cc` 域名
3. 左侧菜单 → **DNS** → **Records**
4. 点击 **Add record**，填写：

| 字段 | 值 |
|------|-----|
| Type | `CNAME` |
| Name | `tools` |
| Target | `你的用户名.github.io` |
| Proxy status | **开启**（橙色云朵） |

例如 GitHub 用户名是 `sylva`，Target 填 `sylva.github.io`。

5. 点击 **Save**

> **为什么开启 Proxy**：Cloudflare 的橙色云朵代理可以隐藏源站 IP、提供免费 CDN 加速、自动 SSL 证书。

### 3.2 配置 SSL/TLS

1. 左侧菜单 → **SSL/TLS** → **Overview**
2. 加密模式选择 **Full** 或 **Full (strict)**
   - Full：Cloudflare ↔ GitHub Pages 走 HTTP，访客看到 HTTPS
   - Full (strict)：两端都是 HTTPS（推荐）

### 3.3 确认 GitHub Pages 自定义域名

1. 回到 GitHub 仓库 → **Settings** → **Pages**
2. 在 **Custom domain** 输入框填写 `tools.timeminer.cc`
3. 点击 **Save**
4. GitHub 自动验证 DNS。第一次可能需要等几分钟到几十分钟。

> CNAME 文件已在项目中，GitHub 会自动识别。

---

## 第四步：验证部署

等待 DNS 生效（一般 1-5 分钟，最多 24 小时），然后：

1. 访问 `https://tools.timeminer.cc`
2. 确认页面正常加载
3. 确认地址栏显示 🔒 锁图标（HTTPS 正常）
4. 点击右上角 **Settings** 按钮，测试 API Key 保存功能
5. 随意切换几个工具，确认功能正常

---

## 第五步：后续更新流程

每次修改代码后：

```bash
cd /path/to/tools-linsea
git add -A
git commit -m "描述你的改动"
git push origin main
```

GitHub Pages 自动重新部署，1-2 分钟生效。无需额外操作。

---

## 重要提醒

1. **API Key 安全性**：Alchemy/Infura Key 保存在浏览器 `localStorage` 中，仅存在于你当前的浏览器。换浏览器或清除浏览器数据后需重新填写。Key 不会上传到任何服务器。

2. **无需后端**：所有工具逻辑都在浏览器端运行（密码哈希、Keccak256、AES 加解密等），不依赖任何服务器。GitHub Pages 纯静态托管完全满足。

3. **Privacy First Mode**：开启后，所有外部网络请求（RPC、4byte 查询）都会被阻止，确保数据完全本地化。
