import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { EpubExcerpt } from 'epub-excerpt';
import type { EpubExcerptHandle, EpubData } from 'epub-excerpt';

// Simple IndexedDB wrapper for persisting EPUB files
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('EpubExcerptTestDB', 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('books')) {
      request.result.createObjectStore('books', { keyPath: 'name' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function saveBookToDB(name: string, file: File | Blob) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('books', 'readwrite');
    transaction.objectStore('books').put({ name, file });
    transaction.oncomplete = resolve;
    transaction.onerror = reject;
  });
}

async function getAllBooksFromDB() {
  const db = await dbPromise;
  return new Promise<{name: string, file: File | Blob}[]>((resolve, reject) => {
    const transaction = db.transaction('books', 'readonly');
    const request = transaction.objectStore('books').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}

interface BookOption {
  name: string;
  src: string | File | Blob;
  isPersistent?: boolean;
}

const DEFAULT_BOOKS: BookOption[] = [
  { name: 'Zero to One (EN)', src: '0to1.epub' },
  { name: 'Zero to One (RU)', src: '0to1_ru.epub' }
];

function App() {
  const [persistentBooks, setPersistentBooks] = useState<BookOption[]>([]);
  const [activeBookName, setActiveBookName] = useState(() => {
    return localStorage.getItem('epub_excerpt_test_source_name') || DEFAULT_BOOKS[0].name;
  });

  const [connectedExcerpt, setConnectedExcerpt] = useState(() => {
    return localStorage.getItem('epub_excerpt_test_connected') || '';
  });
  
  const excerptRef = useRef<EpubExcerptHandle>(null);

  // Combine default and persistent books
  const availableBooks = useMemo(() => {
    return [...DEFAULT_BOOKS, ...persistentBooks];
  }, [persistentBooks]);

  // Find the source for the active book
  const currentSource = useMemo(() => {
    const found = availableBooks.find(b => b.name === activeBookName);
    return found ? found.src : DEFAULT_BOOKS[0].src;
  }, [availableBooks, activeBookName]);

  // Load persistent books on mount
  useEffect(() => {
    async function loadStored() {
      try {
        const stored = await getAllBooksFromDB();
        if (stored.length > 0) {
          setPersistentBooks(stored.map(s => ({ 
            name: s.name, 
            src: s.file, 
            isPersistent: true 
          })));
        }
      } catch (err) {
        console.error('Failed to load stored books:', err);
      }
    }
    loadStored();
  }, []);

  useEffect(() => {
    localStorage.setItem('epub_excerpt_test_connected', connectedExcerpt);
  }, [connectedExcerpt]);

  // Handle new book loaded (from URL or Upload)
  const handleBookLoaded = useCallback(async (data: EpubData, src: string | File | Blob) => {
    const bookName = data.title || (src instanceof File ? src.name : String(src));
    
    // Check if we already have this book in persistent list
    setPersistentBooks(prev => {
      const existsInDefaults = DEFAULT_BOOKS.some(b => b.name === bookName);
      const existsInPersistent = prev.some(b => b.name === bookName);
      
      if (existsInDefaults || existsInPersistent) return prev;
      
      // If it's a file/blob, save it
      if (src instanceof File || src instanceof Blob) {
        saveBookToDB(bookName, src).catch(console.error);
      }
      
      return [...prev, { name: bookName, src, isPersistent: true }];
    });

    // Update active book name if it's different
    setActiveBookName(prev => {
      if (prev !== bookName) {
        localStorage.setItem('epub_excerpt_test_source_name', bookName);
        return bookName;
      }
      return prev;
    });
  }, []);

  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setActiveBookName(name);
    localStorage.setItem('epub_excerpt_test_source_name', name);
  }, []);

  const handleExcerptGenerated = useCallback((text: string) => {
    setConnectedExcerpt(text);
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#333' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Epub Excerpt Playground</h1>
      
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Library & Excerpt</h2>
        <p style={{ color: '#666' }}>Standard usage. All loaded books are remembered in the list below.</p>
        
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600 }}>Select From Library:</label>
          <select 
            value={activeBookName} 
            onChange={handleSelectChange}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '200px' }}
          >
            {availableBooks.map(book => (
              <option key={book.name} value={book.name}>
                {book.name} {book.isPersistent ? '(Saved)' : ''}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.8rem', color: '#888' }}>
            Tip: Upload a new book within the component to add it to this list.
          </span>
        </div>

        <EpubExcerpt 
          src={currentSource} 
          defaultMode="sentences"
          defaultAmount={3}
          persistenceKey="test_standard"
          onBookLoaded={handleBookLoaded}
        />
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '60px 0' }} />

      <section>
        <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Connected Field (Custom UI)</h2>
        <p style={{ color: '#666' }}>
          Uses <code>showPreview={false}</code> to integrate with your own text fields.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <EpubExcerpt 
            ref={excerptRef}
            src={currentSource} 
            defaultMode="words"
            defaultAmount={50}
            showPreview={false}
            onExcerptGenerated={handleExcerptGenerated}
            onBookLoaded={handleBookLoaded}
            persistenceKey="test_connected"
          />

          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
              EXTERNAL TEXTAREA (populated via callback):
            </label>
            <textarea 
              value={connectedExcerpt}
              onChange={(e) => setConnectedExcerpt(e.target.value)}
              placeholder="Excerpt will appear here..."
              style={{
                width: '100%',
                height: '180px',
                padding: '16px',
                borderRadius: '8px',
                border: '2px solid #007bff',
                fontSize: '15px',
                lineHeight: '1.5',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => excerptRef.current?.generate()}
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Regenerate
            </button>
            <button 
              onClick={() => excerptRef.current?.copyLLMPrompt()}
              style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Copy LLM Prompt
            </button>
            <button 
              onClick={() => excerptRef.current?.downloadTTF()}
              style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Download .ttf
            </button>
            <button 
              onClick={() => excerptRef.current?.openFileUpload()}
              style={{ padding: '10px 20px', backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Upload via Ref
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;


