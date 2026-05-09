import JSZip from 'jszip';
import * as cheerio from 'cheerio';

export interface ExcerptOptions {
  maxWords?: number;
  maxSentences?: number;
}

export function splitIntoSentences(text: string): string[] {
  // Simple sentence splitter (good enough for most books).
  // Split on . ! ? followed by whitespace, keep the delimiter
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map(s => s.trim()).filter(s => s.length > 3);
}

export async function createRandomExcerpt(
  epubData: Buffer | ArrayBuffer | Blob,
  options: ExcerptOptions = {}
): Promise<string> {
  const { maxWords = 250, maxSentences } = options;
  const zip = await JSZip.loadAsync(epubData);
  let fullText = '';

  const files = Object.keys(zip.files).filter(name => 
    name.toLowerCase().endsWith('.xhtml') || 
    name.toLowerCase().endsWith('.html') || 
    name.toLowerCase().endsWith('.htm')
  );

  // Sort files to maintain some order, though we pick randomly anyway
  files.sort();

  for (const filename of files) {
    const content = await zip.files[filename].async('string');
    const $ = cheerio.load(content);
    
    // Remove unwanted tags
    $('script, style, nav, header, footer').remove();
    
    // Get text with separator
    const text = $('body').text() || $.text();
    fullText += text + '\n\n';
  }

  fullText = fullText.replace(/\s+/g, ' ').trim();
  if (!fullText) {
    throw new Error('No readable text found in the EPUB.');
  }

  // --- SENTENCE MODE ---
  if (maxSentences && maxSentences > 0) {
    const sentences = splitIntoSentences(fullText);
    if (sentences.length === 0) {
      throw new Error('Could not split text into sentences.');
    }

    if (sentences.length <= maxSentences) {
      return sentences.join(' ');
    } else {
      const start = Math.floor(Math.random() * (sentences.length - maxSentences));
      let excerpt = sentences.slice(start, start + maxSentences).join(' ');
      
      // Optional: if the sentence chunk is way over maxWords, trim it
      const words = excerpt.split(' ');
      if (words.length > maxWords * 1.5) {
        excerpt = words.slice(0, maxWords).join(' ');
      }
      return excerpt;
    }
  }

  // --- WORD MODE (default) ---
  const words = fullText.split(' ');
  if (words.length <= maxWords) {
    return words.join(' ');
  }

  const startIdx = Math.floor(Math.random() * (words.length - maxWords));
  return words.slice(startIdx, startIdx + maxWords).join(' ');
}
