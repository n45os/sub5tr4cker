import Link from "next/link";

export default function DocsNotFound() {
  return (
    <div className="docs-body">
      <main className="docs-main">
        <div className="docs-main-inner">
          <h1 className="docs-title">Page not found</h1>
          <p className="docs-description">
            The doc page you’re looking for doesn’t exist or was moved.
          </p>
          <p>
            <Link href="/docs">Back to Documentation</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
