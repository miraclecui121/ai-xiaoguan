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
