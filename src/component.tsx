import React, { useState, useEffect } from 'react';
import { loadEpub, extractExcerpt, EpubData } from './core.js';

export interface EpubExcerptProps {
  src: string | Blob | File;
  defaultMode?: 'sentences' | 'words';
  defaultAmount?: number;
  className?: string;
  style?: React.CSSProperties;
  onExcerptGenerated?: (excerpt: string) => void;
}

export const EpubExcerpt: React.FC<EpubExcerptProps> = ({
  src,
  defaultMode = 'sentences',
  defaultAmount = 5,
  className,
  style,
  onExcerptGenerated,
}) => {
  // Data States
  const [bookData, setBookData] = useState<EpubData | null>(null);
  const [excerpt, setExcerpt] = useState<string>('');
  
  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Option States
  const [mode, setMode] = useState<'sentences' | 'words'>(defaultMode);
  const [amount, setAmount] = useState<number>(defaultAmount);

  // Load the EPUB only once when `src` changes
  useEffect(() => {
    async function fetchBook() {
      setLoading(true);
      setError(null);
      setBookData(null);
      setExcerpt('');
      try {
        let data: ArrayBuffer;
        if (typeof src === 'string') {
          const response = await fetch(src);
          if (!response.ok) {
            throw new Error(`Failed to fetch EPUB: ${response.status} ${response.statusText}`);
          }
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error('Received HTML instead of an EPUB file. Check if the file exists and the path is correct.');
          }
          data = await response.arrayBuffer();
        } else {
          data = await src.arrayBuffer();
        }

        if (data.byteLength === 0) {
          throw new Error('The fetched EPUB file is empty.');
        }

        const parsedData = await loadEpub(data);
        setBookData(parsedData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while parsing the EPUB');
      } finally {
        setLoading(false);
      }
    }

    fetchBook();
  }, [src]);

  // Generate excerpt handler
  const handleGenerate = () => {
    if (!bookData) return;
    
    // Briefly clear to show something is happening
    setExcerpt('');
    
    setTimeout(() => {
      const options = mode === 'sentences' 
        ? { maxSentences: amount } 
        : { maxWords: amount };
        
      const newExcerpt = extractExcerpt(bookData.fullText, options);
      setExcerpt(newExcerpt);
      setCopied(false);
      
      if (onExcerptGenerated) onExcerptGenerated(newExcerpt);
    }, 50);
  };

  // Auto-generate first excerpt when book loads
  useEffect(() => {
    if (bookData && !excerpt) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(excerpt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', ...style }}>Loading book data...</div>;
  }

  if (error) {
    return <div style={{ color: 'red', padding: '20px', ...style }}>Error: {error}</div>;
  }

  return (
    <div 
      className={`epub-excerpt-container ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
        maxWidth: '800px',
        backgroundColor: '#fff',
        ...style
      }}
    >
      {/* Header */}
      <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#333' }}>
        {bookData?.title || 'Unknown Book'}
      </h2>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Extract By</label>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value as 'sentences' | 'words')}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="sentences">Sentences</option>
            <option value="words">Words</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Amount</label>
          <input 
            type="number" 
            min="1" 
            value={amount} 
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '80px' }}
          />
        </div>

        <button 
          onClick={handleGenerate}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            height: '35px'
          }}
        >
          Generate Random Excerpt
        </button>
      </div>

      {/* Output Area */}
      <div style={{ position: 'relative' }}>
        <textarea
          readOnly
          value={excerpt}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '15px',
            lineHeight: '1.6',
            backgroundColor: '#f9f9f9',
            color: '#333', // Explicitly set dark text color
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        {excerpt && (
          <button
            onClick={handleCopy}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '6px 12px',
              backgroundColor: copied ? '#28a745' : '#e0e0e0',
              color: copied ? '#fff' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
};