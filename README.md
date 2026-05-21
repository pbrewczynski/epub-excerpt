# Epub Excerpt

A well-defined, portable module and CLI for extracting random text excerpts from EPUB files and converting them into Twigit Text Format (TTF) for language learning.

## Features

- **CLI Tool**: Extract excerpts directly from the terminal.
- **React Component**: A polished, ready-to-use UI component for web applications.
- **Headless Mode**: Use the component logic with your own custom UI.
- **EPUB Upload**: Built-in support for users to upload and process their own books.
- **TTF Export**: Generate and download TTF JSON for Twigit integration.
- **LLM Ready**: Automatically generates prompts for high-quality translation and chunking.

---

## 📦 As a Module

Install the package in your project:

```bash
npm install epub-excerpt
```

### 🎨 React Component Usage

The `EpubExcerpt` component provides a full UI for loading books, generating excerpts, and exporting them.

#### Standard Usage
```tsx
import { EpubExcerpt } from 'epub-excerpt';

function MyPage() {
  return (
    <EpubExcerpt 
      src="/path/to/book.epub" 
      defaultMode="sentences"
      defaultAmount={3}
      onExcerptGenerated={(text) => console.log('New excerpt:', text)}
    />
  );
}
```

#### Headless / Custom UI Usage
You can hide the built-in preview and use the component purely for its logic and controls.

```tsx
import { useState, useRef } from 'react';
import { EpubExcerpt, EpubExcerptHandle } from 'epub-excerpt';

function CustomUI() {
  const [text, setText] = useState('');
  const excerptRef = useRef<EpubExcerptHandle>(null);

  return (
    <div>
      <EpubExcerpt 
        ref={excerptRef}
        src="/book.epub"
        showPreview={false}
        onExcerptGenerated={setText}
      />
      
      <textarea value={text} readOnly />
      
      <button onClick={() => excerptRef.current?.generate()}>
        Next Excerpt
      </button>
      <button onClick={() => excerptRef.current?.openFileUpload()}>
        Upload New Book
      </button>
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| Blob \| File` | `undefined` | Source EPUB file. Can be a URL or a file object. |
| `allowUpload` | `boolean` | `true` | Show a button to let users upload their own EPUB. |
| `showPreview` | `boolean` | `true` | Show the built-in textarea preview. |
| `defaultMode` | `'sentences' \| 'words'` | `'sentences'` | Default extraction unit. |
| `defaultAmount` | `number` | `5` | Default number of sentences/words. |
| `persistenceKey` | `string` | `undefined` | If provided, saves user preferences in localStorage. |
| `onExcerptGenerated`| `(text: string) => void` | `undefined` | Callback when a new excerpt is created. |
| `onBookLoaded` | `(data: EpubData) => void` | `undefined` | Callback when book metadata is parsed. |

### Component Methods (via Ref)

Access these by passing a `useRef<EpubExcerptHandle>(null)` to the `ref` prop:

- `generate()`: Triggers a new random excerpt.
- `openFileUpload()`: Opens the system file dialog.
- `downloadTTF()`: Triggers a download of the current excerpt in .ttf format.
- `copyLLMPrompt()`: Copies the translation prompt to clipboard.
- `excerpt`: (property) The current excerpt text.
- `bookData`: (property) The current book's title and full text.

---

## 💻 CLI Usage

If installed globally or via npx:

```bash
# Basic excerpt
npx epub-excerpt path/to/book.epub

# JSON output with word limit
npx epub-excerpt path/to/book.epub --max-words 100 --json

# Generate TTF and Twigit links
npx epub-excerpt path/to/book.epub --ttf

# Copy LLM prompt to clipboard
npx epub-excerpt path/to/book.epub --copy
```

---

## 🛠 Development

```bash
# Build the library and CLI
npm run build

# Run the test playground (Vite)
npm run test:comp
```

## License

ISC
