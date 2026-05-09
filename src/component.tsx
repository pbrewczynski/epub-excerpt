import React, { useState, useEffect } from 'react';
import { createRandomExcerpt, ExcerptOptions } from './core.js';

export interface EpubExcerptProps extends ExcerptOptions {
  /**
   * URL to the .epub file or a Blob/File object.
   */
  src: string | Blob | File;
  /**
   * Custom className for the container.
   */
  className?: string;
  /**
   * Custom style for the container.
   */
  style?: React.CSSProperties;
  /**
   * Callback when the excerpt is generated.
   */
  onExcerptGenerated?: (excerpt: string) => void;
  /**
   * Label for the text field.
   */
  label?: string;
}

export const EpubExcerpt: React.FC<EpubExcerptProps> = ({
  src,
  maxWords = 250,
  maxSentences,
  className,
  style,
  onExcerptGenerated,
  label = 'Random Excerpt',
}) => {
  const [excerpt, setExcerpt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAndExcerpt() {
      setLoading(true);
      setError(null);
      try {
        let data: ArrayBuffer;
        if (typeof src === 'string') {
          const response = await fetch(src);
          if (!response.ok) throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
          data = await response.arrayBuffer();
        } else {
          data = await src.arrayBuffer();
        }

        const generatedExcerpt = await createRandomExcerpt(data, {
          maxWords,
          maxSentences,
        });
        setExcerpt(generatedExcerpt);
        if (onExcerptGenerated) onExcerptGenerated(generatedExcerpt);
      } catch (err: any) {
        setError(err.message || 'An error occurred while processing the EPUB');
      } finally {
        setLoading(false);
      }
    }

    fetchAndExcerpt();
  }, [src, maxWords, maxSentences]);

  return (
    <div 
      className={`epub-excerpt-container ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        fontFamily: 'sans-serif',
        ...style
      }}
    >
      {label && <label style={{ fontWeight: 'bold' }}>{label}</label>}
      {loading && <div className="epub-excerpt-loading">Loading excerpt...</div>}
      {error && <div className="epub-excerpt-error" style={{ color: 'red' }}>Error: {error}</div>}
      {!loading && !error && (
        <textarea
          readOnly
          value={excerpt}
          style={{
            minHeight: '200px',
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
            lineHeight: '1.5',
            backgroundColor: '#f9f9f9',
            resize: 'vertical'
          }}
        />
      )}
    </div>
  );
};
