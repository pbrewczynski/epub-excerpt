# epub-excerpt

A TypeScript package providing both a CLI tool and a React (TSX) component to extract random excerpts from EPUB files.

## Features

- **CLI Tool**: Extract random excerpts from the terminal.
- **React Component**: A ready-to-use component for displaying excerpts in web applications.
- **Sentence/Word Modes**: Pick excerpts based on word count or number of sentences.

## Installation

```bash
npm install epub-excerpt
```

## CLI Usage

Install globally or use via `npx`:

```bash
# Global install
npm install -g epub-excerpt
epub-excerpt mybook.epub --max-words 100

# Using npx
npx epub-excerpt mybook.epub --max-sentences 5
```

### Options

- `-w, --max-words <number>`: Maximum words in excerpt (default: 250).
- `-s, --max-sentences <number>`: Maximum sentences (overrides word mode if >0).
- `-j, --json`: Output as JSON.
- `-t, --ttf`: Output in Twigit Text Format (.ttf).
- `-p, --prompt`: Output an LLM prompt for TTF translation/improvement.
- `-c, --copy`: Copy the LLM prompt directly to clipboard.
- `--lang <string>`: Source language for TTF (default: EN).
- `--target-lang <string>`: Target language for TTF (default: PL).

## React Component Usage

```tsx
import { EpubExcerpt } from 'epub-excerpt';

function App() {
  return (
    <div style={{ maxWidth: '600px', margin: 'auto' }}>
      <h1>Random Book Excerpt</h1>
      <EpubExcerpt 
        src="/path/to/book.epub" 
        maxWords={150} 
        label="Excerpt from My Book"
      />
    </div>
  );
}
```

### Props

- `src`: URL to the `.epub` file or a `Blob`/`File` object.
- `maxWords`: Maximum words (default: 250).
- `maxSentences`: Maximum sentences.
- `label`: Label for the text field.
- `className`: Custom CSS class for the container.
- `style`: Custom React styles for the container.
- `onExcerptGenerated`: Callback function called when the excerpt is ready.

## License

ISC
