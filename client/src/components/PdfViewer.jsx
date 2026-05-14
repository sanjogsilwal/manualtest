import { useEffect } from 'react';

const STYLES = `
  .pdf-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    animation: fadeIn 0.2s ease;
  }
  .pdf-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(92vw, 960px);
    height: 100dvh;
    background: #fff;
    z-index: 201;
    display: flex;
    flex-direction: column;
    box-shadow: -6px 0 32px rgba(0, 0, 0, 0.18);
    animation: slideInRight 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .pdf-panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-strong);
    background: var(--panel);
    flex-shrink: 0;
  }
  .pdf-panel-title {
    flex: 1;
    font-weight: 600;
    font-size: 14px;
    color: var(--panel-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pdf-panel-iframe {
    flex: 1;
    border: none;
    width: 100%;
    background: #525659;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @media (max-width: 600px) {
    .pdf-panel { width: 100vw; }
  }
`;

export default function PdfViewer({ manual, onClose }) {
  // Close on Escape key
  useEffect(() => {
    if (!manual) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [manual, onClose]);

  // Prevent body scroll while panel is open
  useEffect(() => {
    if (manual) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [manual]);

  if (!manual) return null;

  return (
    <>
      <style>{STYLES}</style>
      <div className="pdf-backdrop" onClick={onClose} />
      <div className="pdf-panel" role="dialog" aria-label={manual.title}>
        <div className="pdf-panel-header">
          <span className="pdf-panel-title" title={manual.title}>{manual.title}</span>
          <a
            href={`/api/manuals/${manual.id}/download`}
            className="btn btn-secondary btn-sm"
          >
            Download
          </a>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <iframe
          className="pdf-panel-iframe"
          src={`/api/manuals/${manual.id}/view`}
          title={manual.title}
        />
      </div>
    </>
  );
}
