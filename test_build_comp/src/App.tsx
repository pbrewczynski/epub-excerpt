import { useState, useRef } from 'react';
import { EpubExcerpt } from 'epub-excerpt';
import type { EpubExcerptHandle } from 'epub-excerpt';

function App() {
  const [connectedExcerpt, setConnectedExcerpt] = useState('');
  const excerptRef = useRef<EpubExcerptHandle>(null);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Epub Excerpt Playground</h1>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>Standard Usage</h2>
        <p>This is the standard component with its own built-in preview and controls.</p>
        <EpubExcerpt 
          src="0to1.epub" 
          defaultMode="sentences"
          defaultAmount={3}
        />
      </section>

      <hr />

      <section style={{ marginTop: '40px' }}>
        <h2>Connected Field (Custom UI)</h2>
        <p>
          This example uses <code>showPreview={false}</code> and the <code>onExcerptGenerated</code> callback 
          to populate an external textarea.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Excerpt component without its own preview */}
          <EpubExcerpt 
            ref={excerptRef}
            src="test.epub" 
            defaultMode="words"
            defaultAmount={50}
            showPreview={false}
            onExcerptGenerated={(text) => setConnectedExcerpt(text)}
          />

          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              External Field (populated via callback):
            </label>
            <textarea 
              value={connectedExcerpt}
              onChange={(e) => setConnectedExcerpt(e.target.value)}
              placeholder="Excerpt will appear here..."
              style={{
                width: '100%',
                height: '150px',
                padding: '12px',
                borderRadius: '4px',
                border: '2px solid #007bff',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => excerptRef.current?.generate()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Regenerate
              </button>
              <button 
                onClick={() => excerptRef.current?.copyLLMPrompt()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Copy LLM Prompt
              </button>
              <button 
                onClick={() => excerptRef.current?.downloadTTF()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Download .ttf
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
