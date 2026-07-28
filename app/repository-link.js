const REPOSITORY_URL = "https://github.com/FrightenedFoxCN/multi-lingua-reader";

export function RepositoryLink() {
  return (
    <a
      className="top-repository-link"
      href={REPOSITORY_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="在 GitHub 打开项目仓库"
      title="在 GitHub 打开项目仓库"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" />
        <path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M9 8h6" />
      </svg>
      <span>GitHub</span>
    </a>
  );
}
