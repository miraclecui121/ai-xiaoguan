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
