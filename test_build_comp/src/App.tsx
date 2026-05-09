import { EpubExcerpt } from 'epub-excerpt';

function App() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h1>Epub Excerpt Playground</h1>
      
      {/* Make sure to place a test.epub file in your example/public directory */}
      <EpubExcerpt 
        src="/test.epub" 
        maxSentences={3} 
        label="Random 3 Sentences"
      />
    </div>
  );
}

export default App;