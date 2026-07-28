# Multi-Lingua Reader

Multi-Lingua Reader 是一个延续 [Scaife Viewer](https://scaife.perseus.org) 简洁古典风格的多语言阅读与语言学分析环境。它把分词、词法、Leipzig 行间标注、依存句法、CTS 标注交换、词典与语法材料导入集中在同一界面。

在线静态演示：

<https://frightenedfoxcn.github.io/multi-lingua-reader/>

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
npm run start
```

本地完整版本包含语言资源发现、Wiktionary、UDPipe、自定义词典代理和模型代理等服务端接口。GitHub Pages 只承载静态演示；阅读、内置文本、本地分词、材料导入和浏览器数据库仍可使用。

## 检查与部署

```bash
npm run test:unit
npm run build:pages
```

推送到 `main` 后，[GitHub Pages 工作流](.github/workflows/pages.yml)会执行单元测试、生成静态页面并发布。具体的目录结构、权限、失败排查与回滚步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

第三方语言资源、版本、授权与署名显示在应用的“数据来源”页面。
