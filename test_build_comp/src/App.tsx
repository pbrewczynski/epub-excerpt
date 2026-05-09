import { EpubExcerpt } from 'epub-excerpt';

function App() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h1>Epub Excerpt Playground</h1>
      
      {/* Make sure to place a test.epub file in your example/public directory */}
      <EpubExcerpt 
        src="/Users/pawel/Documents/0to1.epub" 
        defaultMode="sentences"
        defaultAmount={3}
      />
    </div>
  );
}

export default App;