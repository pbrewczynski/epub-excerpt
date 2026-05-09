import { EpubExcerpt } from 'epub-excerpt';

function App() {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h1>Epub Excerpt Playground</h1>
      
      {/* Uses the test.epub file located in the public directory */}
      <EpubExcerpt 
        src="0to1.epub" 
        defaultMode="sentences"
        defaultAmount={3}
      />
    </div>
  );
}

export default App;