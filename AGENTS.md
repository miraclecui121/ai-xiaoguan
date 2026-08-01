# AI销冠发布工程规则

## 项目信息

- 项目名：AI销冠发布工程
- 初始化日期：2026-07-23
- 技术栈：Node.js 原生 HTTP 服务 + Render Web Service

## 工作约束

- 默认中文沟通，代码、命令、变量名使用英文。
- 做技术决策时说明为什么，以及对用户的影响。
- 改动文件或部署前，先读取本工程 `AGENTS.md` 和 `MEMORY.md`。
- 凭据只记录位置，不记录值；一次性部署 token 不写入文件。

## 构建约定

- 产品源码来自根目录 `index.html`、`css/`、`js/`、`server.mjs` 和服务端 `skillhub-packages/*/SOUL.md`。
- `.openai/`、`worker/`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs` 仅作为历史 Sites 发布材料保留，不是当前主发布路径。
- 部署前运行 `npm run build`，该命令执行 Node/前端脚本语法检查。
- 当前云端由 `server.mjs` 托管前端静态资源、DeepSeek/豆包搜索代理、微信 OAuth callback；API Key 与 AppSecret 只放 Render 环境变量。
