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

export interface TTFSimple {
  title?: string;
  language?: string;
  target_language?: string;
  phrases: { p: string; t: string }[];
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
 * Generates TTF (Twigit Text Format) content from text.
 */
export function generateTTF(text: string, title?: string, sourceLang?: string, targetLang?: string): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const phrases: { p: string; t: string }[] = [];
  
  for (let i = 0; i < words.length; i += 3) {
    phrases.push({
      p: words.slice(i, i + 3).join(' '),
      t: ""
    });
  }

  const ttf: TTFSimple = {
    title,
    language: sourceLang,
    target_language: targetLang,
    phrases
  };

  return JSON.stringify(ttf, null, 2);
}

/**
 * Generates an LLM prompt that includes the TTF JSON and instructions for 
 * improving phrase splitting and translation.
 */
export function generateTTFPrompt(text: string, title?: string, sourceLang?: string, targetLang?: string): string {
  const ttfJson = generateTTF(text, title, sourceLang, targetLang);
  
  return `You are a translation assistant. Below is a text excerpt from "${title || 'Unknown'}" in ${sourceLang || 'the source language'}, naively chunked into Twigit Text Format (TTF).

Your task:
1. Improve the phrase splitting ('p' field) so phrases are meaningful and natural for a language learner (max 3 words recommended).
2. Translate each phrase into ${targetLang || 'the target language'} ('t' field).
3. Preserve the 'title', 'language', and 'target_language' fields.
4. Output ONLY the final valid JSON TTF.

TTF Input:
${ttfJson}`;
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
    
    // Remove unwanted tags: scripts, styles, navigation, headers, footers, and all headings
    $('script, style, nav, header, footer, h1, h2, h3, h4, h5, h6').remove();
    
    // Remove common class names for headers, footers, page numbers, and titles
    $('.header, .footer, .page-header, .page-footer, .pagenum, .pagebreak, .chapter-title, .book-title, .author-name').remove();
    
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