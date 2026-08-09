# AI销冠

AI销冠个人版/体验版线上发布工程。当前主发布路径为 Render Node Web Service，用于承载前端、平台模型代理、豆包搜索代理和微信 OAuth 回调。

## 本地运行

```bash
npm install
npm run dev
```

## 构建与验证

```bash
npm run build
```

## 部署说明

当前版本是轻量 Node 服务，客户/商机等业务数据仍保存在浏览器本地；后端负责敏感能力：

- 微信 OAuth 授权开始、回调、会话 Cookie
- 平台托管 DeepSeek API 代理
- 豆包搜索代理
- GLM-4.5V 视觉识别代理；本机 Mac 调试可回退到 macOS Vision OCR
- 服务端注入 11 个专家 SOUL
- 审计日志与敏感路径拦截

Render 必填环境变量：

```text
PUBLIC_BASE_URL=https://aisales.zhixingmap.com
SESSION_SECRET=一段随机强密钥
DEEPSEEK_API_KEY=DeepSeek平台Key
DOUBAO_SEARCH_API_KEY=豆包搜索Key
GLM_VISION_API_KEY=GLM/Z.AI视觉模型Key（可选；不配置时只有Mac本机可用系统OCR调试）
GLM_VISION_MODEL=glm-4.5v
WECHAT_APP_ID=微信公众号或开放平台AppID
WECHAT_APP_SECRET=对应AppSecret
WECHAT_OAUTH_MODE=official
WECHAT_OAUTH_SCOPE=snsapi_userinfo
```

微信后台需要把网页授权域名配置为：

```text
aisales.zhixingmap.com
```

回调地址由服务端生成：

```text
https://aisales.zhixingmap.com/api/auth/wechat/callback
```

### Render 切换要求

旧服务是 Static Site，只能托管静态文件，无法处理 `/api/auth/wechat/callback`。真实微信 OAuth 必须满足以下任一条件：

1. 在 Render 用本仓库新建 Web Service，配置：

```text
Repository: miraclecui121/ai-xiaoguan
Branch: main
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
```

2. 或使用 `render.yaml` 作为 Blueprint 重新同步服务，让服务类型变成 `web + runtime: node`。

线上验证命令：

```bash
curl https://ai-xiaoguan.onrender.com/api/auth/wechat/status
curl https://aisales.zhixingmap.com/api/auth/wechat/status
```

能返回 JSON 才说明后端已上线；如果返回 `404 Not Found`，说明仍在旧 Static Site。

## 当前线上地址

- Render 临时地址：<https://ai-xiaoguan.onrender.com>
- 目标域名：<https://aisales.zhixingmap.com>

## DNS 配置

在 `zhixingmap.com` 的 DNS 面板里，只需要修改 `aisales` 这一条记录：

```text
主机记录: aisales
记录类型: CNAME
记录值: ai-xiaoguan.onrender.com.
```

如果当前存在旧记录 `aisales CNAME custom-domains.chatgpt.site.`，把它替换为上面的 Render 记录。不要修改 `coach`、邮箱、根域名 `@`、`www` 等其它记录。

DNS 生效后，回到 Render 服务 `ai-xiaoguan` 的 Custom Domains 区域点击 `Verify`，或等待 Render 自动验证；证书状态从 `Waiting for Verification` 变成可用后，`https://aisales.zhixingmap.com` 就能访问。
