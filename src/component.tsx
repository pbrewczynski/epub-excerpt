import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { loadEpub, extractExcerpt, generateTTF, generateTTFPrompt, EpubData, generateTwigitLink, detectLanguage } from './core.js';

const LANGUAGES = ['EN', 'PL', 'RU', 'UK', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'CS', 'HU', 'RO', 'HE', 'AR', 'ZH', 'JA', 'KO'];

export interface EpubExcerptProps {
  src: string | Blob | File;
  defaultMode?: 'sentences' | 'words';
  defaultAmount?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Callback triggered whenever a new excerpt is generated */
  onExcerptGenerated?: (excerpt: string) => void;
  /** Whether to show the built-in preview textarea. Defaults to true. */
  showPreview?: boolean;
  /** Default source language for TTF export (e.g. 'EN') */
  defaultSourceLang?: string;
  /** Default target language for TTF export (e.g. 'PL') */
  defaultTargetLang?: string;
  /** Optional key to persist component state (mode, amount, languages, excerpt) in localStorage */
  persistenceKey?: string;
}

/**
 * Handle type for accessing component methods via ref
 */
export interface EpubExcerptHandle {
  /** Manually trigger a new random excerpt generation */
  generate: () => void;
  /** Trigger download of the current excerpt in Twigit Text Format (.ttf) */
  downloadTTF: () => void;
  /** Open the current excerpt in the Twigit Web app */
  openInTwigit: () => void;
  /** Copy an LLM prompt containing the TTF to clipboard */
  copyLLMPrompt: () => void;
  /** Current excerpt text */
  excerpt: string;
  /** Current book metadata */
  bookData: EpubData | null;
}

export const EpubExcerpt = forwardRef<EpubExcerptHandle, EpubExcerptProps>(({
  src,
  defaultMode = 'sentences',
  defaultAmount = 5,
  className,
  style,
  onExcerptGenerated,
  showPreview = true,
  defaultSourceLang = 'EN',
  defaultTargetLang = 'PL',
  persistenceKey,
}, ref) => {
  // Helper to get persisted value
  const getPersisted = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined' || !persistenceKey) return defaultValue;
    const saved = localStorage.getItem(`${persistenceKey}_${key}`);
    if (saved === null) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch {
      return saved;
    }
  };

  // Data States
  const [bookData, setBookData] = useState<EpubData | null>(null);
  const [excerpt, setExcerpt] = useState<string>(() => getPersisted('excerpt', ''));
  
  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  
  // Option States
  const [mode, setMode] = useState<'sentences' | 'words'>(() => getPersisted('mode', defaultMode));
  const [amount, setAmount] = useState<number>(() => getPersisted('amount', defaultAmount));
  const [sourceLang, setSourceLang] = useState<string>(() => getPersisted('sourceLang', defaultSourceLang));
  const [targetLang, setTargetLang] = useState<string>(() => getPersisted('targetLang', defaultTargetLang));

  const isInitialMount = useRef(true);

  // Persistence effect
  useEffect(() => {
    if (typeof window === 'undefined' || !persistenceKey) return;
    localStorage.setItem(`${persistenceKey}_mode`, JSON.stringify(mode));
    localStorage.setItem(`${persistenceKey}_amount`, JSON.stringify(amount));
    localStorage.setItem(`${persistenceKey}_sourceLang`, JSON.stringify(sourceLang));
    localStorage.setItem(`${persistenceKey}_targetLang`, JSON.stringify(targetLang));
    localStorage.setItem(`${persistenceKey}_excerpt`, JSON.stringify(excerpt));
  }, [persistenceKey, mode, amount, sourceLang, targetLang, excerpt]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    generate: handleGenerate,
    downloadTTF: handleDownloadTTF,
    openInTwigit: handleOpenInTwigit,
    copyLLMPrompt: handleCopyPrompt,
    excerpt,
    bookData
  }), [handleGenerate, excerpt, bookData, sourceLang, targetLang]);

  // Load the EPUB only once when `src` changes
  useEffect(() => {
    async function fetchBook() {
      setLoading(true);
      setError(null);
      setBookData(null);
      if (!isInitialMount.current) {
        setExcerpt('');
      }
      isInitialMount.current = false;
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
          data = await (src as any).arrayBuffer();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleGenerate() {
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

      const detected = detectLanguage(newExcerpt);
      setSourceLang(detected);
      if (targetLang === detected) {
        const langs = LANGUAGES;
        setTargetLang(langs.find(l => l !== detected) || 'PL');
      }
      
      if (onExcerptGenerated) onExcerptGenerated(newExcerpt);
    }, 50);
  }

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

  const handleDownloadTTF = () => {
    const ttfContent = generateTTF(excerpt, bookData?.title, sourceLang, targetLang);
    const blob = new Blob([ttfContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = (bookData?.title || 'excerpt').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${fileName}.ttf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInTwigit = () => {
    const ttfContent = generateTTF(excerpt, bookData?.title, sourceLang, targetLang);
    const links: any = generateTwigitLink(ttfContent, sourceLang, targetLang);
    window.open(links.web, '_blank');
  };

  const handleCopyPrompt = async () => {
    try {
      const prompt = generateTTFPrompt(excerpt, bookData?.title, sourceLang, targetLang);
      setCurrentPrompt(prompt);
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt: ', err);
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

      {/* TTF Export Controls */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '16px', 
          flexWrap: 'wrap', 
          alignItems: 'flex-end',
          paddingTop: '8px',
          borderTop: '1px solid #eee'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Source Lang</label>
          <select
            value={sourceLang}
            onChange={(e) => {
              const val = e.target.value;
              setSourceLang(val);
              if (targetLang === val) {
                const langs = LANGUAGES;
                setTargetLang(langs.find(l => l !== val) || 'PL');
              }
            }}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {LANGUAGES.filter(l => l !== targetLang).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>Target Lang</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {LANGUAGES.filter(l => l !== sourceLang).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleDownloadTTF}
          disabled={!excerpt}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: excerpt ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            height: '35px',
            opacity: excerpt ? 1 : 0.6
          }}
        >
          Download .ttf
        </button>

        <button 
          onClick={handleOpenInTwigit}
          disabled={!excerpt}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffc107',
            color: '#212529',
            border: 'none',
            borderRadius: '4px',
            cursor: excerpt ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            height: '35px',
            opacity: excerpt ? 1 : 0.6
          }}
        >
          Open in Twigit
        </button>

        <button 
          onClick={handleCopyPrompt}
          disabled={!excerpt}
          style={{
            padding: '8px 16px',
            backgroundColor: promptCopied ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: excerpt ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            height: '35px',
            opacity: excerpt ? 1 : 0.6,
            transition: 'background-color 0.2s'
          }}
        >
          {promptCopied ? 'Prompt Copied!' : 'Copy LLM Prompt'}
        </button>
      </div>

      {/* Output Area (Optional) */}
      {showPreview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
              Text Excerpt
            </label>
            <textarea
              readOnly
              value={excerpt}
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '16px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                fontSize: '15px',
                lineHeight: '1.6',
                backgroundColor: '#f9f9f9',
                color: '#333',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            {excerpt && (
              <button
                onClick={handleCopy}
                style={{
                  position: 'absolute',
                  top: '32px',
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

          {currentPrompt && (
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                Full LLM Prompt
              </label>
              <textarea
                readOnly
                value={currentPrompt}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #6c757d',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  backgroundColor: '#f8f9fa',
                  color: '#495057',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

EpubExcerpt.displayName = 'EpubExcerpt';
