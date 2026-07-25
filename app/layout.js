import "./globals.css";

export const metadata = {
  title: "Lingua Reader · 多语言智能阅读器",
  description: "面向古典与现代文本的沉浸式阅读、分词与语言学分析环境。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
