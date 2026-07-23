# AI销冠发布工程规则

## 项目信息

- 项目名：AI销冠发布工程
- 初始化日期：2026-07-23
- 技术栈：Vite + Sites Worker 静态托管

## 工作约束

- 默认中文沟通，代码、命令、变量名使用英文。
- 做技术决策时说明为什么，以及对用户的影响。
- 改动文件或部署前，先读取本工程 `AGENTS.md` 和 `MEMORY.md`。
- 凭据只记录位置，不记录值；一次性部署 token 不写入文件。

## 构建约定

- 产品源码来自根目录 `index.html` 和 `public/css`、`public/js`。
- 保留 `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs`，用于 Sites 发布。
- 部署前运行 `npm run build` 和 `npm run test:sites`。
- 当前是静态体验版，不在前端内置平台 API Key。
