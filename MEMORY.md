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
