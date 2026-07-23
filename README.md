# AI销冠

AI销冠个人版/体验版线上发布工程。

## 本地运行

```bash
npm install
npm run dev
```

## 构建与验证

```bash
npm run build
npm run test:sites
```

## 部署说明

当前版本是静态体验版，客户数据与模型配置保存在浏览器本地。正式产品版需要新增后端能力：

- 账号、邀请码、订阅状态持久化
- 客户/联系人/商机数据云端存储
- 平台托管 LLM API 代理
- 企业自带 API Key 的隔离与审计
