# AI销冠发布工程记忆

- 初始化日期：2026-07-23
- 项目定位：AI销冠个人版/体验版的线上静态发布工程。
- 技术栈：Vite 静态构建 + Sites Worker 静态资源托管。
- 来源说明：当前发布包只包含 `index.html`、`public/css`、`public/js` 和 Sites 构建配置，不包含本地逆向分析材料、截图、测试脚本或凭据。
- 部署域名：计划绑定 `aisales.zhixingmap.com`。

## 决策记录

- 先发布静态体验闭环，再补后端 API 代理和账号数据持久化。原因是当前产品仍是浏览器本地数据模型，上线静态版可以最快验证外部访问和体验路径。
- 不把原 `/Users/cxn/Documents/销售AI/analysis`、`scripts`、`AGENTS.md`、`MEMORY.md` 原样发布，避免把开发过程和内部记录暴露到线上工程。
- 2026-07-23：首版提交 `70a175fcecd3aecdd8edd4a1bfb510125c0507fa` 已推送到 Sites 源码仓库；版本 1 已部署成功，生产 URL 为 `https://ai-xiaoguan.miraclecui.chatgpt.site`。
- 2026-07-23：站点访问模式已切为 public；`aisales.zhixingmap.com` 已添加为自定义域名，DNS 托管方为 `ns7.cnmsn.net/ns8.cnmsn.net`，SOA 为 `dns.bizcn.com`，需在该 DNS 面板增加 CNAME 和 TXT 验证记录。
- 2026-07-23：新增 `render.yaml`，改用 Render Static Site 作为正式上线链路；Render 配置为 `runtime: static`、`buildCommand: npm install && npm run build`、`staticPublishPath: ./dist/client`、所有路径 rewrite 到 `/index.html`。
- 2026-07-23：本地验证 `npm run build && npm run test:sites` 通过；GitHub 新仓库创建需浏览器登录，当前 Chrome 跳转到 `github.com/login?return_to=/new`。
- 2026-07-23：GitHub 仓库已创建并推送到 `https://github.com/miraclecui121/ai-xiaoguan`；本机使用仓库级 SSH deploy key 推送，私钥位置为 `~/.ssh/agent/ai-xiaoguan_deploy_key`，只记录位置不记录值。
- 2026-07-23：Render Static Site 已创建成功，服务名 `ai-xiaoguan`，服务 ID `srv-d9gspkjtqb8s73e4v4mg`，线上临时地址 `https://ai-xiaoguan.onrender.com` 返回 HTTP 200，页面标题为 `AI销冠`。
- 2026-07-23：Render 已添加自定义域名 `aisales.zhixingmap.com`，当前等待 DNS；需要在 DNS 面板把 `aisales` 的 CNAME 从 `custom-domains.chatgpt.site.` 替换为 `ai-xiaoguan.onrender.com.`。DNS 由用户自行配置。
- 2026-08-01：发布工程从 Render Static Site 转为 Node Web Service。`server.mjs` 托管前端、DeepSeek 平台代理、豆包搜索代理、微信 OAuth 路由和 SOUL 服务端注入；旧 `public/` 静态目录从 Git 移除，前端不再发布 `expert-prompts.js`。
- 2026-08-01：微信真实登录采用公众号网页授权优先方案：`/api/auth/wechat/start` 生成微信授权 URL，`/api/auth/wechat/callback` 用 code 换网页授权 access_token/userinfo，签名 HttpOnly Cookie 保存会话，前端启动时通过 `/api/auth/wechat/session` 恢复到演示空间。微信 AppSecret、DeepSeek Key、豆包搜索 Key、SESSION_SECRET 均只放 Render 环境变量。
- 2026-08-01：本地验证发布包：`npm run build` 通过；`/api/auth/wechat/status` 返回 JSON；`/public/js/expert-prompts.js`、`/js/expert-prompts.js`、`/.openai/hosting.json`、`/skillhub-packages/.../SOUL.md`、`/server.mjs` 均返回 404。
- 2026-08-01：Render 新建 Node Web Service `ai-xiaoguan-caqq`，服务 ID `srv-d9mult6417fc73c9bkk0`，Blueprint ID `exs-d9mugcjm8hqs73d6dm7g`，临时地址 `https://ai-xiaoguan-caqq.onrender.com`。创建时写入 `SESSION_SECRET`、`DEEPSEEK_API_KEY`、`DOUBAO_SEARCH_API_KEY` 三个 secret；微信 OAuth AppID/AppSecret 尚未配置。
- 2026-08-01：Render Web Service 上线踩坑：Node 服务必须监听 `0.0.0.0`，不能只监听 `127.0.0.1`；同源 Origin 校验必须允许当前请求 Host，否则 onrender 临时域名访问会被 `/api/platform/chat` 拦截为 `origin_forbidden`。修复后提交 `414d943` 已 live，`/api/platform/status`、DeepSeek Chat、豆包搜索代理均验证成功。
- 2026-08-01：`aisales.zhixingmap.com` 已从旧 Static Site `srv-d9gspkjtqb8s73e4v4mg` 解绑并添加到新 Web Service `srv-d9mult6417fc73c9bkk0`；Render 显示域名 Verified、证书 Pending。当前本机 DNS 仍解析到旧 CNAME `ai-xiaoguan.onrender.com`，需在 DNS 面板把 `aisales` CNAME 改为 `ai-xiaoguan-caqq.onrender.com` 后再等证书签发。
- 2026-08-01：Render Web Service 已在环境变量中配置微信公众账号 OAuth 所需 `WECHAT_APP_ID` 与 `WECHAT_APP_SECRET`，凭据只保存在 Render 环境变量，不写入代码或仓库；`/api/auth/wechat/start` 已能生成微信授权跳转。
- 2026-08-01：微信公众号网页授权域名校验文件 `MP_verify_ufp3MxxkS25gBKME.txt` 已放入发布工程根目录；Render 部署后应可通过站点根路径直接访问，用于公众号后台域名校验。
