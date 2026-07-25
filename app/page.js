"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { library, searchableWorks } from "./data";

const paths = {
  library: <><path d="M4 4.5h6.5v15H4zM13.5 4.5H20v15h-6.5z"/><path d="M7.25 8h0M16.75 8h0"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
  panel: <><rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M9 4v16"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.82 2.82-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.82-2.82.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.04A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2.82-2.82.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.82 2.82-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.04A1.7 1.7 0 0 0 19.4 15Z"/></>,
  moon: <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
  chevronDown: <path d="m7 10 5 5 5-5"/>,
  chevronRight: <path d="m10 7 5 5-5 5"/>,
  arrowLeft: <path d="m15 18-6-6 6-6"/>,
  arrowRight: <path d="m9 18 6-6-6-6"/>,
  spark: <><path d="m12 3 1.2 4.1a5 5 0 0 0 3.7 3.7L21 12l-4.1 1.2a5 5 0 0 0-3.7 3.7L12 21l-1.2-4.1a5 5 0 0 0-3.7-3.7L3 12l4.1-1.2a5 5 0 0 0 3.7-3.7L12 3Z"/></>,
  translate: <><path d="M5 5h8M9 3v2M7 5c0 4 3 7 6 8M11 5c0 3-3 7-7 9"/><path d="m14 20 3-8 3 8M15 17h4"/></>,
  rows: <><path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6M14 9v6M10 15v6"/></>,
  type: <><path d="M5 6V4h14v2M12 4v16M8 20h8"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  bookmark: <path d="M6 3.5h12v17L12 17l-6 3.5z"/>,
  note: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></>,
};

function Icon({ name, size = 18, strokeWidth = 1.7 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function Toggle({ active, onClick, icon, label }) {
  return (
    <button className={`tool-toggle ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}

export default function ReaderPage() {
  const [languageId, setLanguageId] = useState("greek");
  const [selectedTokenId, setSelectedTokenId] = useState("g1");
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [segmented, setSegmented] = useState(true);
  const [translation, setTranslation] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [tab, setTab] = useState("word");
  const [theme, setTheme] = useState("light");
  const [fontSize, setFontSize] = useState(25);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState([]);
  const searchRef = useRef(null);

  const work = library[languageId];
  const allTokens = useMemo(() => work.lines.flatMap((line, lineIndex) => line.tokens.map((token) => ({ ...token, lineIndex }))), [work]);
  const selectedToken = allTokens.find((token) => token.id === selectedTokenId) || allTokens[0];
  const currentLine = work.lines[selectedToken?.lineIndex ?? selectedLineIndex];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobilePanel(null);
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const index = allTokens.findIndex((token) => token.id === selectedTokenId);
      const next = event.key === "ArrowRight" ? Math.min(index + 1, allTokens.length - 1) : Math.max(index - 1, 0);
      if (allTokens[next]) {
        setSelectedTokenId(allTokens[next].id);
        setSelectedLineIndex(allTokens[next].lineIndex);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [allTokens, selectedTokenId]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 30);
  }, [searchOpen]);

  const chooseLanguage = (id) => {
    const next = library[id];
    setLanguageId(id);
    setSelectedTokenId(next.lines[0].tokens[0].id);
    setSelectedLineIndex(0);
    setSearchOpen(false);
    setTab("word");
    showToast(`已切换至${next.language}`);
  };

  const chooseToken = (token, lineIndex) => {
    setSelectedTokenId(token.id);
    setSelectedLineIndex(lineIndex);
    setTab("word");
    if (window.innerWidth <= 900) setMobilePanel("right");
  };

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(window.__linguaToast);
    window.__linguaToast = window.setTimeout(() => setToast(""), 2200);
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes([{ id: Date.now(), text: noteText.trim(), token: selectedToken.form }, ...notes]);
    setNoteText("");
    showToast("笔记已保存到当前阅读会话");
  };

  const filteredWorks = searchableWorks.filter((item) => {
    const haystack = `${item.title} ${item.titleZh} ${item.author} ${item.language}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-zone">
          <button className="mobile-icon" onClick={() => setMobilePanel("left")} aria-label="打开目录"><Icon name="menu" /></button>
          <button className="brand" onClick={() => showToast("欢迎回到 Lingua Reader")}>
            <span className="brand-mark">L</span>
            <span className="brand-name">Lingua</span>
            <span className="brand-product">Reader</span>
          </button>
        </div>
        <nav className="topnav" aria-label="主导航">
          <button className="nav-link active"><Icon name="library" size={17} />阅读器</button>
          <button className="nav-link" onClick={() => showToast("书库模块将在下一阶段开放")}>书库</button>
          <button className="nav-link" onClick={() => showToast("分析实验室将在接入大模型后开放")}>分析实验室<span className="beta-label">BETA</span></button>
        </nav>
        <div className="top-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={16} />
            <span>搜索作品、作者或段落</span>
            <kbd>⌘ K</kbd>
          </button>
          <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="切换主题">
            <Icon name={theme === "light" ? "moon" : "sun"} />
          </button>
          <button className="avatar" onClick={() => showToast("当前为原型访客会话")}>游</button>
        </div>
      </header>

      <main className={`reader-layout ${leftOpen ? "" : "left-collapsed"} ${rightOpen ? "" : "right-collapsed"}`}>
        <aside className="left-sidebar">
          <div className="work-card">
            <div className="book-mark">{work.coverMark}</div>
            <div className="work-summary">
              <div className="eyebrow">{work.language}</div>
              <h2 lang={work.lang}>{work.title}</h2>
              <p>{work.titleZh} · {work.author.split(" · ").slice(-1)}</p>
            </div>
          </div>
          <div className="progress-row">
            <span>阅读进度</span>
            <span>{work.progress}%</span>
            <div className="progress-track"><i style={{ width: `${work.progress}%` }} /></div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">目录</div>
            <div className="chapter-list">
              {work.chapters.map((chapter, index) => (
                <button key={chapter.label} className={`chapter-row ${chapter.active ? "active" : ""}`} onClick={() => index === 0 ? showToast("已在当前章节") : showToast(`${chapter.label}示例内容尚未载入`)}>
                  <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="chapter-copy"><strong>{chapter.label}</strong><small>{chapter.detail}</small></span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
          </div>
          <div className="sidebar-footer">
            <div><Icon name="info" size={15} /><span>版本</span></div>
            <button onClick={() => showToast(work.edition)}>{work.edition}</button>
          </div>
        </aside>

        <button className="rail-toggle rail-left" onClick={() => setLeftOpen(!leftOpen)} aria-label="收起或展开目录">
          <Icon name={leftOpen ? "arrowLeft" : "arrowRight"} size={15} />
        </button>

        <section className="reader-main">
          <div className="reader-toolbar">
            <div className="breadcrumbs">
              <span>{work.author.split(" · ")[0]}</span><Icon name="chevronRight" size={13} /><strong>{work.title}</strong><Icon name="chevronRight" size={13} /><span>{work.passage.split(" · ")[0]}</span>
            </div>
            <div className="reader-controls">
              <div className="language-select-wrap">
                <select value={languageId} onChange={(event) => chooseLanguage(event.target.value)} aria-label="切换文本语言">
                  {Object.values(library).map((item) => <option value={item.id} key={item.id}>{item.language}</option>)}
                </select>
                <Icon name="chevronDown" size={14} />
              </div>
              <span className="toolbar-divider" />
              <Toggle active={segmented} onClick={() => setSegmented(!segmented)} icon="rows" label="分词" />
              <Toggle active={translation} onClick={() => setTranslation(!translation)} icon="translate" label="译文" />
              <span className="toolbar-divider" />
              <div className="font-controls" aria-label="字号调整">
                <button onClick={() => setFontSize(Math.max(19, fontSize - 2))}>A−</button>
                <button onClick={() => setFontSize(Math.min(35, fontSize + 2))}>A+</button>
              </div>
              <button className="icon-button compact" onClick={() => showToast("阅读偏好已自动保存")} aria-label="阅读设置"><Icon name="settings" size={17} /></button>
            </div>
          </div>

          <div className="passage-nav">
            <button onClick={() => showToast("已经是当前示例的起始段落")}><Icon name="arrowLeft" size={16} />上一段</button>
            <button className="passage-picker" onClick={() => showToast(`当前定位：${work.passage}`)}>
              <span>{work.passage}</span><Icon name="chevronDown" size={14} />
            </button>
            <button onClick={() => showToast("下一段内容将在语料 API 接入后载入")}>下一段<Icon name="arrowRight" size={16} /></button>
          </div>

          <article className="text-stage" style={{ "--reader-font-size": `${fontSize}px` }}>
            <header className="text-heading">
              <div className="edition-kicker">{work.edition}</div>
              <h1 lang={work.lang}>{work.title} <span>{work.titleZh}</span></h1>
              <p>{work.passage}</p>
            </header>
            <div className={`original-text ${segmented ? "is-segmented" : ""}`} lang={work.lang} dir={work.direction}>
              {work.lines.map((line, lineIndex) => (
                <div className={`text-line ${selectedLineIndex === lineIndex ? "current-line" : ""}`} key={line.n}>
                  <button className="line-number" onClick={() => showToast(`已复制段落定位 ${work.title} ${line.n}`)} aria-label={`第 ${line.n} 行`}>{line.n}</button>
                  <div className="line-content">
                    <div className="token-row">
                      {line.tokens.map((token) => (
                        <button
                          key={token.id}
                          className={`token ${selectedTokenId === token.id ? "selected" : ""}`}
                          onClick={() => chooseToken(token, lineIndex)}
                          title={`${token.lemma} · ${token.pos}`}
                        >
                          <span>{token.form}</span>
                          {segmented && <small>{token.pos}</small>}
                        </button>
                      ))}
                    </div>
                    {translation && <p className="translation-line">{line.translation}</p>}
                  </div>
                </div>
              ))}
            </div>
            <footer className="text-footer">
              <div><span className="status-dot" />已载入 {allTokens.length} 个词项</div>
              <p>提示：点击词语查看词形信息，使用 ← → 快速切换</p>
            </footer>
          </article>
        </section>

        <button className="rail-toggle rail-right" onClick={() => setRightOpen(!rightOpen)} aria-label="收起或展开分析面板">
          <Icon name={rightOpen ? "arrowRight" : "arrowLeft"} size={15} />
        </button>

        <aside className="analysis-panel">
          <div className="analysis-tabs" role="tablist">
            <button className={tab === "word" ? "active" : ""} onClick={() => setTab("word")}>词语</button>
            <button className={tab === "syntax" ? "active" : ""} onClick={() => setTab("syntax")}>句法</button>
            <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>笔记{notes.length > 0 && <i>{notes.length}</i>}</button>
            <button className="close-mobile" onClick={() => setMobilePanel(null)} aria-label="关闭"><Icon name="close" size={18} /></button>
          </div>

          {tab === "word" && selectedToken && (
            <div className="analysis-scroll">
              <div className="word-hero">
                <div>
                  <span className="analysis-label">已选择 · 第 {work.lines[selectedToken.lineIndex].n} 行</span>
                  <h2 lang={work.lang}>{selectedToken.form}</h2>
                  <p>{selectedToken.reading}</p>
                </div>
                <button className="bookmark-button" onClick={() => showToast(`已收藏“${selectedToken.form}”`)} aria-label="收藏词语"><Icon name="bookmark" /></button>
              </div>

              <div className="lemma-row">
                <span>词元</span>
                <strong lang={work.lang}>{selectedToken.lemma}</strong>
                <button onClick={() => { navigator.clipboard?.writeText(selectedToken.lemma); showToast("词元已复制"); }} aria-label="复制词元"><Icon name="copy" size={15} /></button>
              </div>

              <section className="analysis-section">
                <div className="analysis-section-title"><span>词法分析</span><em>演示数据</em></div>
                <div className="pos-line">
                  <span className="pos-badge">{selectedToken.pos}</span>
                  <span>{selectedToken.role}</span>
                </div>
                <div className="morph-grid">
                  {selectedToken.morphology.map((item, index) => (
                    <div key={`${item}-${index}`}><small>{["属性", "数/体", "格/态", "人称"][index] || "特征"}</small><strong>{item}</strong></div>
                  ))}
                </div>
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title"><span>语境释义</span><button onClick={() => showToast("已载入演示分析结果")}><Icon name="spark" size={14} />AI 分析</button></div>
                <p className="definition">{selectedToken.gloss}</p>
                <div className="context-note"><Icon name="spark" size={16} /><p>在本句中充当<strong>{selectedToken.role}</strong>，{selectedToken.relation}。</p></div>
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title"><span>分析可信度</span><strong>{selectedToken.confidence}%</strong></div>
                <div className="confidence-track"><i style={{ width: `${selectedToken.confidence}%` }} /></div>
                <p className="muted-note">当前为人工编制的界面演示数据；后续可替换为模型与词典服务的联合结果。</p>
              </section>
            </div>
          )}

          {tab === "syntax" && (
            <div className="analysis-scroll">
              <div className="syntax-head">
                <span className="analysis-label">当前句 · 第 {currentLine.n} 行</span>
                <h2>依存关系</h2>
                <p>{currentLine.translation}</p>
              </div>
              <div className="syntax-canvas">
                <div className="syntax-root">
                  <small>句子核心</small>
                  <strong lang={work.lang}>{currentLine.tokens.find((token) => token.role === "谓语")?.form || currentLine.tokens[0].form}</strong>
                </div>
                <div className="syntax-branches">
                  {currentLine.tokens.slice(0, 5).map((token) => (
                    <button key={token.id} className={token.id === selectedTokenId ? "active" : ""} onClick={() => chooseToken(token, selectedToken.lineIndex)}>
                      <span>{token.role}</span>
                      <strong lang={work.lang}>{token.form}</strong>
                      <small>{token.relation}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ai-callout">
                <Icon name="spark" />
                <div><strong>大模型分析接口</strong><p>这里将展示模型生成的句法解释、歧义提示与逐步推理。当前以规则化演示数据呈现。</p></div>
                <button onClick={() => showToast("接口占位已就绪，等待配置模型服务")}>试运行</button>
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="analysis-scroll notes-pane">
              <div className="notes-head">
                <span className="analysis-label">阅读随记</span>
                <h2>我的笔记</h2>
                <p>笔记会关联到当前词语与段落。</p>
              </div>
              <div className="note-editor">
                <div className="note-context">关联词语：<strong lang={work.lang}>{selectedToken.form}</strong></div>
                <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="写下释义、疑问或阅读心得…" />
                <button onClick={addNote}><Icon name="note" size={16} />保存笔记</button>
              </div>
              <div className="notes-list">
                {notes.length === 0 ? (
                  <div className="empty-notes"><Icon name="note" size={24} /><p>还没有笔记</p><span>选中正文中的词语，然后在这里记录。</span></div>
                ) : notes.map((note) => (
                  <div className="saved-note" key={note.id}><span>{note.token}</span><p>{note.text}</p></div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <div className="mobile-bar">
        <button onClick={() => setMobilePanel("left")}><Icon name="library" /><span>目录</span></button>
        <button className="active"><Icon name="type" /><span>正文</span></button>
        <button onClick={() => setMobilePanel("right")}><Icon name="spark" /><span>分析</span></button>
      </div>

      {mobilePanel && <div className="mobile-backdrop" onClick={() => setMobilePanel(null)} />}
      {mobilePanel === "left" && (
        <div className="mobile-drawer show-left">
          <div className="drawer-inner drawer-toc">
            <div className="drawer-title"><strong>目录</strong><button onClick={() => setMobilePanel(null)}><Icon name="close" /></button></div>
            <div className="work-card"><div className="book-mark">{work.coverMark}</div><div className="work-summary"><div className="eyebrow">{work.language}</div><h2>{work.title}</h2><p>{work.titleZh}</p></div></div>
            <div className="chapter-list">{work.chapters.map((chapter, index) => <button key={chapter.label} className={`chapter-row ${chapter.active ? "active" : ""}`} onClick={() => { showToast(index === 0 ? "已在当前章节" : `${chapter.label}示例内容尚未载入`); setMobilePanel(null); }}><span className="chapter-index">{String(index + 1).padStart(2, "0")}</span><span className="chapter-copy"><strong>{chapter.label}</strong><small>{chapter.detail}</small></span><Icon name="chevronRight" size={15} /></button>)}</div>
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <div className="command-dialog" role="dialog" aria-modal="true" aria-label="搜索书库">
            <div className="command-input">
              <Icon name="search" />
              <input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索作品、作者或语言…" />
              <button onClick={() => setSearchOpen(false)}>ESC</button>
            </div>
            <div className="command-label">可阅读作品</div>
            <div className="search-results">
              {filteredWorks.map((item) => (
                <button key={item.id} onClick={() => chooseLanguage(item.id)}>
                  <span className="result-mark">{library[item.id].coverMark}</span>
                  <span><strong>{item.title} <i>《{item.titleZh}》</i></strong><small>{item.author} · {item.meta}</small></span>
                  <em>{item.language}</em>
                </button>
              ))}
              {filteredWorks.length === 0 && <div className="empty-search">没有找到匹配的作品</div>}
            </div>
            <div className="command-footer"><span>↑↓ 选择</span><span>↵ 打开</span><span>ESC 关闭</span></div>
          </div>
        </div>
      )}

      {mobilePanel === "right" && <div className="analysis-mobile-clone" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-analysis-head"><strong>语言学分析</strong><button onClick={() => setMobilePanel(null)}><Icon name="close" /></button></div>
        <div className="mobile-word-card">
          <span>第 {work.lines[selectedToken.lineIndex].n} 行 · {selectedToken.pos}</span>
          <h2 lang={work.lang}>{selectedToken.form}</h2>
          <p className="mobile-lemma">{selectedToken.lemma} · {selectedToken.reading}</p>
          <div className="mobile-tags">{selectedToken.morphology.map((item) => <i key={item}>{item}</i>)}</div>
          <h3>语境释义</h3><p>{selectedToken.gloss}</p>
          <div className="context-note"><Icon name="spark" size={16} /><p>在本句中充当<strong>{selectedToken.role}</strong>，{selectedToken.relation}。</p></div>
          <button className="mobile-full-analysis" onClick={() => { setMobilePanel(null); showToast("桌面端可查看完整句法分析"); }}>查看完整分析</button>
        </div>
      </div>}

      <div className={`toast ${toast ? "show" : ""}`} role="status"><Icon name="check" size={16} />{toast}</div>
    </div>
  );
}
