# Epub Excerpt Test Playground

This is a standalone React application built with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/) used to test and demonstrate the `EpubExcerpt` component.

## Getting Started

### Prerequisites

Ensure you have built the main package first, as this test application depends on the local build of `epub-excerpt`.

```bash
# From the project root
npm run build
```

### Installation

Navigate to this directory and install the dependencies:

```bash
cd test_build_comp
npm install
```

### Running Locally

To start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Alternatively, you can run it from the **project root** using the convenience script:

```bash
# From the project root
npm run test:comp
```

The application will be available at `http://localhost:5173`. It uses the sample EPUB files located in the `public/` directory for demonstration.

## Production Build

To build the application for production:

```bash
# From this directory
npm run build

# OR from the project root
npm run build:comp
```

The production-ready files will be generated in the `dist/` directory.

### Previewing the Build

To preview the production build locally:

```bash
npm run preview
```

## Hosting

Since this is a static site, you can host it on any static hosting provider.

### GitHub Pages

1. Build the project.
2. Push the contents of the `dist/` directory to a `gh-pages` branch or configure GitHub Actions to deploy from the `dist/` folder.
3. Note: If hosting on a subpath (e.g., `https://username.github.io/repo-name/`), you may need to update the `base` configuration in `vite.config.ts`.

### Vercel / Netlify

1. Connect your repository to the platform.
2. Set the **Build Command** to: `npm run build && npm run build --prefix test_build_comp`
3. Set the **Output Directory** to: `test_build_comp/dist`
4. Set the **Root Directory** to the project root (not this directory).

## Project Structure

- `src/App.tsx`: The main entry point where the `EpubExcerpt` component is imported and configured.
- `public/`: Contains sample EPUB files (`0to1.epub`, `test.epub`) used by the component during testing.
- `vite.config.ts`: Vite configuration for the project.
