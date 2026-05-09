import JSZip from 'jszip';
import * as cheerio from 'cheerio';

export interface ExcerptOptions {
  maxWords?: number;
  maxSentences?: number;
}

export interface EpubData {
  title: string;
  fullText: string;
}

export function splitIntoSentences(text: string): string[] {
  const regex = /(?<!\b[A-Z])(?<!\b(?:Mr|Ms|Dr|Sr|Jr|St|vs))(?<!\b(?:Mrs|Rev|etc|e\.g|i\.e))(?<!\bProf)([.!?]+)(?=\s+["'A-Z]|\s*$)/;
  const parts = text.split(regex);
  const sentences: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const sentenceText = parts[i] || '';
    const punctuation = parts[i + 1] || '';
    const fullSentence = (sentenceText + punctuation).trim();
    if (fullSentence.length > 3) sentences.push(fullSentence);
  }
  return sentences;
}

/**
 * Loads the EPUB, parses the title from metadata, and extracts all readable text.
 */
export async function loadEpub(epubData: Buffer | ArrayBuffer | Blob): Promise<EpubData> {
  const zip = await JSZip.loadAsync(epubData);
  let title = 'Unknown Title';
  let fullText = '';

  // 1. Extract Title (Parse META-INF/container.xml -> .opf file -> <dc:title>)
  try {
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (containerXml) {
      const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
      if (rootfileMatch) {
        const opfXml = await zip.file(rootfileMatch[1])?.async('string');
        if (opfXml) {
          const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
          if (titleMatch) title = titleMatch[1].trim();
        }
      }
    }
  } catch (e) {
    console.warn('Could not parse EPUB title metadata.');
  }

  // 2. Extract Text
  const files = Object.keys(zip.files).filter(name => 
    name.toLowerCase().endsWith('.xhtml') || 
    name.toLowerCase().endsWith('.html') || 
    name.toLowerCase().endsWith('.htm')
  );
  files.sort();

  for (const filename of files) {
    const content = await zip.files[filename].async('string');
    const $ = cheerio.load(content);
    $('script, style, nav, header, footer').remove();
    fullText += ($('body').text() || $.text()) + '\n\n';
  }

  fullText = fullText.replace(/\s+/g, ' ').trim();
  if (!fullText) throw new Error('No readable text found in the EPUB.');

  return { title, fullText };
}

/**
 * Generates an excerpt synchronously from pre-loaded EPUB text.
 */
export function extractExcerpt(fullText: string, options: ExcerptOptions = {}): string {
  const { maxWords, maxSentences } = options;

  if (maxSentences && maxSentences > 0) {
    const sentences = splitIntoSentences(fullText);
    if (sentences.length <= maxSentences) return sentences.join(' ');
    
    const start = Math.floor(Math.random() * (sentences.length - maxSentences));
    let excerpt = sentences.slice(start, start + maxSentences).join(' ');
    
    if (maxWords && maxWords > 0) {
      const words = excerpt.split(' ');
      if (words.length > maxWords * 1.5) {
        excerpt = words.slice(0, maxWords).join(' ') + '...';
      }
    }
    return excerpt;
  }

  const fallbackMaxWords = maxWords || 250;
  const words = fullText.split(' ');
  if (words.length <= fallbackMaxWords) return words.join(' ');

  const startIdx = Math.floor(Math.random() * (words.length - fallbackMaxWords));
  return words.slice(startIdx, startIdx + fallbackMaxWords).join(' ');
}

/**
 * Legacy support for CLI: Loads and extracts in one go.
 */
export async function createRandomExcerpt(
  epubData: Buffer | ArrayBuffer | Blob,
  options: ExcerptOptions = {}
): Promise<string> {
  const { fullText } = await loadEpub(epubData);
  return extractExcerpt(fullText, options);
}