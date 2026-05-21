import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { loadEpub, extractExcerpt, generateTTF, generateTTFPrompt, EpubData, generateTwigitLink, detectLanguage } from './core.js';

const LANGUAGES = ['EN', 'PL', 'RU', 'UK', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'CS', 'HU', 'RO', 'HE', 'AR', 'ZH', 'JA', 'KO'];

export interface EpubExcerptProps {
  src?: string | Blob | File;
  defaultMode?: 'sentences' | 'words';
  defaultAmount?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Callback triggered whenever a new excerpt is generated */
  onExcerptGenerated?: (excerpt: string) => void;
  /** Callback triggered when a new book is successfully loaded */
  onBookLoaded?: (data: EpubData, src: string | Blob | File) => void;
  /** Whether to show the built-in preview textarea. Defaults to true. */
  showPreview?: boolean;
  /** Whether to allow users to upload their own EPUB files. Defaults to true. */
  allowUpload?: boolean;
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
  /** Trigger the file upload dialog */
  openFileUpload: () => void;
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
  onBookLoaded,
  showPreview = true,
  allowUpload = true,
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
  const [currentSrc, setCurrentSrc] = useState<string | Blob | File | undefined>(src);
  const [bookData, setBookData] = useState<EpubData | null>(null);
  const [excerpt, setExcerpt] = useState<string>(() => getPersisted('excerpt', ''));
  
  // UI States
  const [loading, setLoading] = useState<boolean>(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stabilize callbacks using refs
  const onExcerptGeneratedRef = useRef(onExcerptGenerated);
  const onBookLoadedRef = useRef(onBookLoaded);
  useEffect(() => { onExcerptGeneratedRef.current = onExcerptGenerated; }, [onExcerptGenerated]);
  useEffect(() => { onBookLoadedRef.current = onBookLoaded; }, [onBookLoaded]);

  // Sync internal src with prop if it changes
  useEffect(() => {
    if (src !== undefined) {
      setCurrentSrc(src);
    }
  }, [src]);

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
    openFileUpload: () => fileInputRef.current?.click(),
    excerpt,
    bookData
  }), [handleGenerate, excerpt, bookData, sourceLang, targetLang]);

  // Load the EPUB when `currentSrc` changes
  useEffect(() => {
    async function fetchBook() {
      if (!currentSrc) return;

      setLoading(true);
      setError(null);
      
      if (!isInitialMount.current) {
        setExcerpt('');
      }
      isInitialMount.current = false;

      try {
        let data: ArrayBuffer;
        if (typeof currentSrc === 'string') {
          const response = await fetch(currentSrc);
          if (!response.ok) {
            throw new Error(`Failed to fetch EPUB: ${response.status} ${response.statusText}`);
          }
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error('Received HTML instead of an EPUB file. Check if the file exists and the path is correct.');
          }
          data = await response.arrayBuffer();
        } else {
          data = await (currentSrc as any).arrayBuffer();
        }

        if (data.byteLength === 0) {
          throw new Error('The EPUB file is empty.');
        }

        const parsedData = await loadEpub(data);
        setBookData(parsedData);
        if (onBookLoadedRef.current) onBookLoadedRef.current(parsedData, currentSrc);
      } catch (err: any) {
        setError(err.message || 'An error occurred while parsing the EPUB');
        setBookData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchBook();
  }, [currentSrc]);

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
      
      if (onExcerptGeneratedRef.current) onExcerptGeneratedRef.current(newExcerpt);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrentSrc(file);
    }
  };

  if (loading && !bookData) {
    return <div style={{ padding: '20px', ...style }}>Loading book data...</div>;
  }

  return (
    <div 
      className={`epub-excerpt-container ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '800px',
        backgroundColor: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        ...style
      }}
    >
      {/* Header & Upload */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1a1a1a', fontWeight: 700 }}>
          {bookData?.title || (error ? 'Error Loading Book' : 'No Book Loaded')}
        </h2>
        
        {allowUpload && (
          <div>
            <input 
              type="file" 
              accept=".epub" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f0f0f0',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📂</span> {bookData ? 'Change Book' : 'Upload EPUB'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#fff5f5', 
          color: '#c53030', 
          borderRadius: '6px', 
          border: '1px solid #feb2b2',
          fontSize: '0.9rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!bookData && !loading && !error && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', border: '2px dashed #eee', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 16px 0' }}>Please upload an EPUB file to start extracting excerpts.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Select EPUB File
          </button>
        </div>
      )}

      {bookData && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Extract By</label>
              <select 
                value={mode} 
                onChange={(e) => setMode(e.target.value as 'sentences' | 'words')}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: '#fff', fontSize: '0.95rem' }}
              >
                <option value="sentences">Sentences</option>
                <option value="words">Words</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Amount</label>
              <input 
                type="number" 
                min="1" 
                value={amount} 
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ced4da', width: '70px', fontSize: '0.95rem' }}
              />
            </div>

            <button 
              onClick={handleGenerate}
              disabled={loading}
              style={{
                padding: '9px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                flexGrow: 1,
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processing...' : 'Generate New Excerpt'}
            </button>
          </div>

          {/* TTF Export Controls */}
          <div 
            style={{ 
              display: 'flex', 
              gap: '12px', 
              flexWrap: 'wrap', 
              alignItems: 'flex-end',
              paddingTop: '16px',
              borderTop: '1px solid #eee'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Source</label>
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
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: '#fff', fontSize: '0.9rem' }}
              >
                {LANGUAGES.filter(l => l !== targetLang).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Target</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: '#fff', fontSize: '0.9rem' }}
              >
                {LANGUAGES.filter(l => l !== sourceLang).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexGrow: 1, flexWrap: 'wrap' }}>
              <button 
                onClick={handleDownloadTTF}
                disabled={!excerpt}
                title="Download as .ttf file"
                style={{
                  padding: '9px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: excerpt ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  opacity: excerpt ? 1 : 0.6,
                  flexGrow: 1
                }}
              >
                💾 .ttf
              </button>

              <button 
                onClick={handleOpenInTwigit}
                disabled={!excerpt}
                title="Open in Twigit Web App"
                style={{
                  padding: '9px 12px',
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: excerpt ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  opacity: excerpt ? 1 : 0.6,
                  flexGrow: 1
                }}
              >
                🚀 Twigit
              </button>

              <button 
                onClick={handleCopyPrompt}
                disabled={!excerpt}
                title="Copy LLM Prompt for translation"
                style={{
                  padding: '9px 12px',
                  backgroundColor: promptCopied ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: excerpt ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  opacity: excerpt ? 1 : 0.6,
                  transition: 'background-color 0.2s',
                  flexGrow: 2
                }}
              >
                {promptCopied ? '✓ Prompt Copied' : '📝 LLM Prompt'}
              </button>
            </div>
          </div>

          {/* Output Area */}
          {showPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>
                    Excerpt Preview
                  </label>
                  {excerpt && (
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                      {excerpt.split(/\s+/).filter(Boolean).length} words
                    </span>
                  )}
                </div>
                <textarea
                  readOnly
                  value={excerpt || (loading ? 'Generating...' : '')}
                  placeholder="Generate an excerpt to see it here..."
                  style={{
                    width: '100%',
                    minHeight: '180px',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #ced4da',
                    fontSize: '1rem',
                    lineHeight: '1.6',
                    backgroundColor: '#fff',
                    color: '#333',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                />
                {excerpt && (
                  <button
                    onClick={handleCopy}
                    style={{
                      position: 'absolute',
                      top: '40px',
                      right: '12px',
                      padding: '6px 12px',
                      backgroundColor: copied ? '#28a745' : 'rgba(255,255,255,0.9)',
                      color: copied ? '#fff' : '#007bff',
                      border: copied ? 'none' : '1px solid #007bff',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>

              {currentPrompt && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Full LLM Prompt
                  </label>
                  <textarea
                    readOnly
                    value={currentPrompt}
                    style={{
                      width: '100%',
                      minHeight: '150px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      backgroundColor: '#f1f3f5',
                      color: '#495057',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

EpubExcerpt.displayName = 'EpubExcerpt';
