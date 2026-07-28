import { analysisEngineCatalog } from "../analysis-engines.js";
import {
  ANALYSIS_DSL_SCHEMA,
  analysisDslExamples,
} from "../analysis-dsl-reference.js";
import {
  documentationSections,
  languageWorkspaceTabs,
} from "../site-config.js";
import { StaticTopbar } from "../static-topbar.js";

export const metadata = {
  title: "使用文档 · Lingua Reader",
  description: "Lingua Reader 阅读、语言初始化、词典、语料库、分析管线、DSL、模型与数据交换的完整使用文档。",
};

function CommandTable({ items, label }) {
  return (
    <div className="docs-command-table" role="table" aria-label={label}>
      {items.map((item) => (
        <div role="row" key={item.syntax}>
          <code role="cell">{item.syntax}</code>
          <strong role="cell">{item.name}</strong>
          <p role="cell">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function InlineList({ label, values }) {
  return (
    <div className="docs-inline-list">
      <strong>{label}</strong>
      <span>{values.map((value) => <code key={value}>{value}</code>)}</span>
    </div>
  );
}

export default function DocumentationPage() {
  return (
    <div className="app-shell docs-shell">
      <StaticTopbar current="docs" />

      <main className="workspace-page docs-page">
        <header className="workspace-heading docs-heading">
          <div>
            <span className="eyebrow">Product manual · DSL reference</span>
            <h1>使用文档</h1>
            <p>阅读、初始化、分析、校订和数据迁移集中在这一页；DSL 表格与实际解析器共用同一份版本化配置。</p>
          </div>
        </header>

        <div className="docs-layout">
          <aside className="docs-toc">
            <strong>目录</strong>
            <nav aria-label="文档目录">
              {documentationSections.map((section, index) => (
                <a href={`#${section.id}`} key={section.id}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {section.label}
                </a>
              ))}
            </nav>
            <p>涉及第三方资源的版本、授权与署名，请同时查看<a href="/sources">数据来源与致谢</a>。</p>
          </aside>

          <article className="docs-content">
            <section id="start">
              <header><span>01</span><h2>开始使用</h2></header>
              <p>阅读器适合直接阅读已有作品；语言工作台用于建立新语言、词典和分析能力；分析实验室用于检查、校订与导出单段结果。</p>
              <ol>
                <li>在“语言初始化”中输入 BCP 47 代码，确认数据源、分词策略和样例。</li>
                <li>在“分析管线”中排列引擎；按从上到下的顺序尝试，首个有证据的结果会停止后续句法引擎。</li>
                <li>在分析实验室输入文本，检查语法树、词法、释义、来源和 DSL 变更，再导出 CTS JSON 或 CEX。</li>
              </ol>
              <div className="docs-route-strip">
                {languageWorkspaceTabs.map((item) => (
                  <span key={item.id}>{item.label}</span>
                ))}
              </div>
            </section>

            <section id="reader">
              <header><span>02</span><h2>阅读器</h2></header>
              <p>点击正文词项可打开词形、词元、词性、Leipzig 标签、释义、发音和词典来源。右侧“句法”显示当前行的依存关系，“语法”把选中词项与语法参考对应。</p>
              <dl className="docs-definition-list">
                <div><dt>逐行复制</dt><dd>行号旁的复制按钮只复制原文，不混入词法标签或译文。</dd></div>
                <div><dt>CTS 定位</dt><dd>分享链接包含段落 URN 与词位，例如 <code>urn:cts:…:1.1@form[1]</code>。</dd></div>
                <div><dt>分析本段</dt><dd>把可见段落、CTS URN 与现有标注带入分析实验室，校订后可返回阅读器。</dd></div>
                <div><dt>在线词典与发音</dt><dd>在右上角设置中添加查询地址、适用语言与密钥方式，并用测试词确认结果。多个来源按顺序合并；IPA、录音播放器和来源入口直接显示在词项详情中。</dd></div>
              </dl>
              <p className="docs-note">查询地址支持 <code>{"{term}"}</code>、<code>{"{lemma}"}</code>、<code>{"{language}"}</code> 与 <code>{"{code}"}</code>。常见的 <code>definitions</code>、<code>gloss</code>、<code>ipa</code>、<code>phonetics</code>、<code>audio</code> 字段会自动整理；地址与顺序随本地数据库导出，接口密钥只保留在当前浏览器会话。</p>

              <h3>配置一个在线词典</h3>
              <ol>
                <li>打开右上角设置，进入“在线词典与发音”，点击“添加在线词典”。</li>
                <li>填写词典名称、适用语言和 GET 查询地址。适用语言可写 <code>*</code>，也可用逗号列出 BCP 47 代码，例如 <code>en, la, grc</code>。</li>
                <li>如接口需要授权，选择 Bearer、自定义请求头或查询参数；密钥名称与密钥分别填写。</li>
                <li>输入测试词和语言代码并点击“测试接口”。确认释义与发音数量后保存；上下箭头决定查询和合并顺序。</li>
              </ol>

              <h3>兼容的返回格式</h3>
              <p>接口可以直接返回下列通用结构，也可以使用常见的 <code>definition</code>、<code>gloss</code>、<code>meanings</code>、<code>phonetic</code> 或 <code>audioUrl</code> 别名。数组形式的公共词典响应同样可以识别。</p>
              <pre><code>{`{
  "term": "amō",
  "lemma": "amō",
  "sourceUrl": "https://dictionary.example/amo",
  "license": "CC BY-SA",
  "ipa": ["/ˈa.moː/"],
  "pronunciations": [{
    "url": "https://media.example/amo.mp3",
    "type": "audio/mpeg",
    "provider": "Example Dictionary",
    "sourceUrl": "https://dictionary.example/amo"
  }],
  "entries": [{
    "partOfSpeech": "verb",
    "definitions": ["to love"]
  }]
}`}</code></pre>
              <p className="docs-note">多个来源同时成功时，词义按设置顺序合并，IPA 与录音按地址去重；一个来源超时或报错不会阻断其他词典。单次批量分析最多向每个来源发送 24 个词项，响应上限为 2 MB。</p>
            </section>

            <section id="language">
              <header><span>03</span><h2>语言初始化</h2></header>
              <p>标准语言代码会自动匹配身份、文字系统、分词候选、词法、句法和描述语法资源；私用代码仍可建立完全本地的分词和词表。</p>
              <div className="docs-flow">
                <span><b>1</b>身份与代码</span>
                <span><b>2</b>资源与许可</span>
                <span><b>3</b>分词与词表</span>
                <span><b>4</b>样例验证</span>
              </div>
              <p className="docs-note">自动发现只生成候选清单。只有勾选的数据源才进入语言配置；实际分析结果继续记录命中的树库、模型或词典。</p>
            </section>

            <section id="pipeline">
              <header><span>04</span><h2>分析管线</h2></header>
              <p>每种语言都有独立的引擎顺序。可关闭任意外部引擎；本地规则始终作为最后回退，并在没有句法证据时只显示分词和词法。</p>
              <div className="docs-engine-table" role="table" aria-label="分析引擎">
                {analysisEngineCatalog.map((engine, index) => (
                  <div role="row" key={engine.id}>
                    <span role="cell">{index + 1}</span>
                    <div role="cell"><strong>{engine.name}</strong><small>{engine.execution}</small></div>
                    <p role="cell">{engine.description}</p>
                    <em role="cell">{engine.capabilities.join(" · ")}</em>
                  </div>
                ))}
              </div>
              <p className="docs-note">DSL 的 <code>replace</code> 先整理录入转写，<code>segment</code> 再处理分词边界；规则块在引擎返回词项之后执行。每次词项校订都会追加 <code>DSL · rule_id</code> 来源。</p>
            </section>

            <section id="corpus">
              <header><span>05</span><h2>CoNLL-U 语料库</h2></header>
              <p>在“分析管线”中选择语言后导入 <code>.conllu</code>、<code>.conll</code> 或文本文件。文件按批次写入 IndexedDB，不会整体塞入页面状态；单文件上限 1 GB。</p>
              <pre><code>{`# sent_id = demo-1
# text = Я читаю книгу.
1\tЯ\tя\tPRON\t_\tCase=Nom|Number=Sing|Person=1\t2\tnsubj\t_\t_
2\tчитаю\tчитать\tVERB\t_\tTense=Pres\t0\troot\t_\t_
3\tкнигу\tкнига\tNOUN\t_\tCase=Acc\t2\tobj\t_\tSpaceAfter=No
4\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_`}</code></pre>
              <ul>
                <li><code># text</code> 先经过启用的 <code>replace text/all</code>，再用于 NFC、大小写和空白标准化后的整句精确匹配。</li>
                <li>词项的 <code>FORM</code> 与 <code>LEMMA</code> 分别应用 <code>replace form/all</code> 和 <code>replace lemma/all</code>；发生变化时保留 <code>originalText</code>、<code>originalForm</code>、<code>originalLemma</code>。</li>
                <li>语料库保存导入时的替换规则快照；之后停用或修改规则，也不会导致原始转写查询失配。</li>
                <li>数字 ID 行进入分析；多词范围与空节点保留在原文件但不生成可点击词项。</li>
                <li>填写许可、来源链接与 acknowledgement 后，它们会随命中结果和本地备份保留。</li>
              </ul>
            </section>

            <section id="dsl" className="docs-dsl-section">
              <header><span>06</span><h2>分析 DSL</h2></header>
              <p>DSL 是逐行、无脚本执行能力的校订语言。它只允许声明式匹配和有限动作，不访问网络、文件、浏览器 API 或任意 JavaScript。</p>

              <h3>最小结构</h3>
              <pre><code>{analysisDslExamples[0].source}</code></pre>

              <h3>全局指令</h3>
              <CommandTable items={ANALYSIS_DSL_SCHEMA.globalDirectives} label="DSL 全局指令" />

              <h3>规则指令</h3>
              <CommandTable items={ANALYSIS_DSL_SCHEMA.ruleDirectives} label="DSL 规则指令" />

              <h3>字段与操作符</h3>
              <InlineList label="when 字段" values={ANALYSIS_DSL_SCHEMA.conditionFields} />
              <InlineList label="when 操作符" values={ANALYSIS_DSL_SCHEMA.conditionOperators} />
              <InlineList label="set 字段" values={ANALYSIS_DSL_SCHEMA.setFields} />
              <InlineList label="head 模式" values={ANALYSIS_DSL_SCHEMA.headModes} />

              <h3>匹配语义</h3>
              <dl className="docs-definition-list">
                <div><dt><code>=</code> / <code>is</code></dt><dd>NFC 标准化后的精确匹配；区分大小写。</dd></div>
                <div><dt><code>starts</code> / <code>ends</code></dt><dd>匹配字段的开头或结尾，适合前缀、后缀与词形变化。</dd></div>
                <div><dt><code>contains</code></dt><dd>字段包含给定文本。</dd></div>
                <div><dt><code>matches</code></dt><dd>使用受限正则字面量；不接受反向引用、嵌套重复或超过 {ANALYSIS_DSL_SCHEMA.limits.regexLength} 字符的表达式。</dd></div>
                <div><dt><code>has</code></dt><dd>用于 <code>tag</code> 数组，按大写规范化后判断 Leipzig 标签。</dd></div>
                <div><dt><code>index</code></dt><dd>从 1 开始的词项位置，只进行数值相等比较。</dd></div>
              </dl>
              <p className="docs-note"><code>replace</code> 的字段可为 <code>text</code>、<code>form</code>、<code>lemma</code> 或 <code>all</code>，省略时默认 <code>all</code>。不同转写体系可能复用同一 ASCII 字母表示不同字符（例如大写 S）；应按数据源分别建立规则包，避免把 SLP1、Harvard–Kyoto 等体系混在同一包中。</p>

              <h3>执行顺序</h3>
              <ol>
                <li>验证版本、语言范围、规则 ID、字段、正则与数量上限；存在错误时整个规则包不执行。</li>
                <li>按书写顺序执行适用于当前字段的全部 <code>replace</code>，然后对分析文本执行 <code>segment</code>。</li>
                <li>分析引擎生成词项后，规则按 priority 降序执行，同优先级保持原顺序。</li>
                <li>一条规则中的全部 <code>when</code> 同时满足才执行；<code>stop</code> 只停止当前词项的后续规则。</li>
                <li>界面记录规则匹配数、修改词项数和来源；用户仍可继续人工校订。</li>
              </ol>

              <h3>完整示例</h3>
              <div className="docs-example-list">
                {analysisDslExamples.map((example) => (
                  <article key={example.id}>
                    <div><strong>{example.title}</strong><p>{example.description}</p></div>
                    <pre><code>{example.source}</code></pre>
                  </article>
                ))}
              </div>

              <h3>边界与压力上限</h3>
              <div className="docs-limit-strip">
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.rules}</b>规则 / 包</span>
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.replacements}</b>替换 / 包</span>
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.segments}</b>预处理 / 包</span>
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.conditionsPerRule}</b>条件 / 规则</span>
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.actionsPerRule}</b>动作 / 规则</span>
                <span><b>{ANALYSIS_DSL_SCHEMA.limits.sourceLength.toLocaleString()}</b>字符 / 包</span>
              </div>
            </section>

            <section id="dictionary">
              <header><span>07</span><h2>词典、书库与 PDF</h2></header>
              <p>词典工作台可导入 MDX/MDD、StarDict、JSON、CSV/TSV、DSL、TEI、LIFT 与 XDXF。MDX 也可按索引词拆成书库段落；脚本和样式不会执行。</p>
              <dl className="docs-definition-list">
                <div><dt>扫描词典</dt><dd>先保存 PDF，再把模型识别结果以 JSON 导入词库；词条保留原始页码。</dd></div>
                <div><dt>词典转写</dt><dd>词典文件与扫描识别结果会对词形、词元执行启用的 <code>replace</code>；规范值用于检索，原值和规则来源随词条保留。</dd></div>
                <div><dt>双语材料</dt><dd>PDF 任务保存语言方向、页码范围和模型配置；没有已验证模型时不会生成虚构内容。</dd></div>
                <div><dt>语法参考</dt><dd>可依据 PDF 或模型生成任务，结构为章节、规则、例句、逐词标注和来源页码。</dd></div>
              </dl>
            </section>

            <section id="model">
              <header><span>08</span><h2>模型配置</h2></header>
              <p>右上角设置支持 OpenAI-compatible 终点、模型 ID 与连接测试。终点和模型保存在本设备，API 密钥只保留在当前浏览器会话。</p>
              <ul>
                <li>连接测试读取兼容的 <code>/models</code>；语法分析使用 <code>/chat/completions</code>。</li>
                <li>模型引擎返回结构化 UD 词项并标记“模型生成分析 · 需要人工校订”。</li>
                <li>未配置、认证失败、超时或 JSON 无效时继续尝试管线中的下一个引擎。</li>
              </ul>
            </section>

            <section id="exchange">
              <header><span>09</span><h2>标注交换与本地备份</h2></header>
              <p>分析实验室可导出 CTS JSON 与 CEX。JSON 保留词形、词元、读音、词法、Leipzig 标签、句法、置信度、词典和来源；CEX 适合 CITE 工具交换。</p>
              <p><code>.linguadb</code> 备份包含偏好、语言配置、DSL、词典、书库段落、PDF、UD 语料和逐句标注，不包含会话 API 密钥。恢复时同 ID 记录覆盖。</p>
            </section>

            <section id="troubleshooting">
              <header><span>10</span><h2>排错与边界</h2></header>
              <dl className="docs-definition-list">
                <div><dt>只有“未定”</dt><dd>检查语言代码、管线中是否启用可用引擎、CoNLL-U 的 <code># text</code> 是否与输入整句一致，以及模型连接状态。</dd></div>
                <div><dt>DSL 不执行</dt><dd>先看编辑器的行号诊断，再检查 <code>language</code>、<code>replace</code> 字段范围、字段内容、优先级和较早规则的 <code>stop</code>。</dd></div>
                <div><dt>转写被错误替换</dt><dd>停用对应规则包并为该数据源单建一包；不要仅凭语言混用多个转写体系。已导入语料仍保留当时快照和原值，可审计后重新导入。</dd></div>
                <div><dt>不显示语法树</dt><dd>这是没有可验证句法证据时的预期行为；导入 UD/CTS、启用 UDPipe 或模型后再分析。</dd></div>
                <div><dt>大型数据</dt><dd>申请浏览器持久存储并定期导出 <code>.linguadb</code>；大语料按批写入，但备份仍需要足够的本地磁盘空间。</dd></div>
              </dl>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
