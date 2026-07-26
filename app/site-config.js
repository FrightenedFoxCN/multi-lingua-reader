export const PRODUCT_NAME = "Lingua Reader";

export const primaryNavigation = [
  { id: "reader", label: "阅读器", href: "/", view: "reader" },
  { id: "library", label: "书库", href: "/?view=library", view: "library" },
  { id: "lab", label: "分析实验室", href: "/?view=lab", view: "lab" },
  { id: "languages", label: "语言工作台", href: "/?view=languages", view: "languages" },
  { id: "docs", label: "使用文档", href: "/docs" },
  { id: "sources", label: "数据来源", href: "/sources", secondary: true },
];

export const languageWorkspaceTabs = [
  { id: "initialize", label: "语言初始化" },
  { id: "dictionaries", label: "词典导入" },
  { id: "analysis", label: "分析管线" },
  { id: "pdf", label: "PDF 导入" },
  { id: "grammar", label: "语法参考" },
  { id: "database", label: "本地数据库" },
];

export const documentationSections = [
  { id: "start", label: "开始使用" },
  { id: "reader", label: "阅读器" },
  { id: "language", label: "语言初始化" },
  { id: "pipeline", label: "分析管线" },
  { id: "corpus", label: "语料库" },
  { id: "dsl", label: "分析 DSL" },
  { id: "dictionary", label: "词典与 PDF" },
  { id: "model", label: "模型配置" },
  { id: "exchange", label: "标注与备份" },
  { id: "troubleshooting", label: "排错与边界" },
];
