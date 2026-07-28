# GitHub Pages 部署

生产地址：

<https://frightenedfoxcn.github.io/multi-lingua-reader/>

## 发布流程

`.github/workflows/pages.yml` 在以下情况运行：

- `main` 分支收到推送；
- 在 GitHub Actions 页面手动选择 `Deploy GitHub Pages` 并运行。

流程依次完成依赖安装、单元测试、静态构建、产物上传和 Pages 部署。部署作业只读取仓库内容，并使用 GitHub 提供的短期身份令牌发布到 `github-pages` 环境，不需要长期部署密钥。

静态产物位于 `dist/client`。构建脚本会：

- 为资源和站内链接加入 `/multi-lingua-reader` 前缀；
- 生成 `/docs/` 与 `/sources/` 的目录入口；
- 在产物根目录放置 `index.html`、`404.html` 和 `.nojekyll`；
- 校验关键页面和资源路径，缺失时直接让工作流失败。

## 本地验证

```bash
npm ci
npm run test:unit
npm run build:pages
```

构建成功后，`dist/client` 应包含：

```text
index.html
404.html
.nojekyll
_next/
docs/index.html
sources/index.html
```

## 静态站边界

GitHub Pages 不运行 Node.js 或 Vinext 路由处理器。因此在线演示不会调用 `/api/*`：

- 可用：阅读器、内置文本、导航、本地分词、本地材料与词典导入、IndexedDB 持久化、CTS 导入导出；
- 需要本地完整版本：语言资源自动发现、Wiktionary、Grambank、UDPipe、自定义词典代理和模型代理。

静态站遇到这些服务端能力时会给出明确提示并保留本地回退结果。

## 排错与回滚

1. 在 GitHub 仓库的 `Actions` 页面打开失败的 `Deploy GitHub Pages` 运行。
2. 如果测试失败，先在本地运行 `npm run test:unit`。
3. 如果构建失败，运行 `npm run build:pages` 并检查 `dist/client`。
4. 如果页面能打开但资源为 404，检查页面中的资源路径是否以 `/multi-lingua-reader/_next/` 开头，同时确认产物根目录存在 `_next/`。
5. 需要回滚时，在 GitHub 上重新运行最后一个正常提交对应的工作流，或提交一次恢复变更；部署并发组会取消旧的未完成发布，保留最新运行。
