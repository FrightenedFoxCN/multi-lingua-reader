import { languageDataSources } from "../language-resources.js";
import { StaticTopbar } from "../static-topbar.js";

export const dynamic = "force-static";

const groupedSources = languageDataSources.reduce((groups, source) => {
  const values = groups.get(source.category) || [];
  values.push(source);
  groups.set(source.category, values);
  return groups;
}, new Map());

export const metadata = {
  title: "数据来源与致谢 · Lingua Reader",
  description: "Lingua Reader 语言初始化、词法、句法、双语语料和语法参考所使用的开放数据来源。",
};

export default function SourcesPage() {
  return (
    <div className="app-shell sources-shell">
      <StaticTopbar current="sources" />

      <main className="workspace-page sources-page">
        <header className="workspace-heading sources-heading">
          <div>
            <span className="eyebrow">Data sources &amp; acknowledgements</span>
            <h1>数据来源与致谢</h1>
            <p>语言初始化只建立可追溯的数据清单；实际启用时继续遵循每个数据集的版本、署名与授权要求。</p>
          </div>
        </header>

        <section className="sources-method">
          <span>初始化用途</span>
          <p>Glottolog 身份解析 → CLDR 文字与排版 → Kaikki/UniMorph 词法 → Wiktionary/Commons/Lingua Libre 发音 → UD 分词与句法 → PanLex/OPUS 双语资源 → Grambank/WALS/PHOIBLE 语法与音系参考。</p>
        </section>

        <div className="source-groups">
          {[...groupedSources.entries()].map(([category, sources]) => (
            <section className="source-group" key={category}>
              <header>
                <h2>{category}</h2>
              </header>
              <div className="source-table" role="table" aria-label={`${category}数据来源`}>
                {sources.map((source) => (
                  <article className="source-row" role="row" key={source.id}>
                    <div className="source-name" role="cell">
                      <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
                      <small>{source.version} · {source.access}</small>
                    </div>
                    <p role="cell">{source.automation}</p>
                    <div className="source-license" role="cell">
                      <span>{source.license}</span>
                      <small>{source.acknowledgement}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="acknowledgement-copy" aria-labelledby="acknowledgement-title">
          <header>
            <span className="eyebrow">Acknowledgement</span>
            <h2 id="acknowledgement-title">致谢说明</h2>
          </header>
          <p>
            Lingua Reader 的语言身份、书写系统、词法、句法、双语词汇、类型学和音系初始化，
            得益于 Glottolog、Unicode CLDR、Wiktionary/Wiktextract、Universal Dependencies、
            UniMorph、PanLex、Open Multilingual Wordnet、FreeDict、OPUS、Grambank、WALS、
            PHOIBLE、CLTS、Concepticon、Lexibank、CLICS、DoReCo、Wikimedia Commons、
            Lingua Libre、Forvo 与 Mozilla Common Voice 的数据及其贡献者。
            具体分析结果会记录实际使用的数据集、版本、词条或树库来源；第三方词典文件的版权与使用权限由导入者负责确认。
          </p>
        </section>
      </main>
    </div>
  );
}
