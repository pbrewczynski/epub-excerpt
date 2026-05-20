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

export function detectLanguage(text: string): string {
  // Simple detection for Russian based on Cyrillic characters
  const cyrillicRegex = /[\u0400-\u04FF]/;
  return cyrillicRegex.test(text) ? 'RU' : 'EN';
}

export function splitIntoSentences(text: string): string[] {
  // Improved unicode-aware regex to support Russian/English characters and common abbreviations
  // Handles initials (A. Pushkin), common abbreviations (т.д., ул., Mr.), and quotes (including Russian «»).
  const regex = /(?<!(?<!\p{L})(?:\p{Lu}|Mr|Ms|Dr|Sr|Jr|St|vs|Mrs|Rev|etc|e\.g|i\.e|Prof|т\.е|т\.д|т\.п|т\.к|г|ул|стр|проф|акад|доц|см|напр|руб|коп))(?<!(?<!\p{L})и (?:др|пр))([.!?]+)(?=\s+["'«\p{Lu}]|\s*$)/gu;
  const parts = text.split(regex);
  const sentences: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const sentenceText = parts[i] || '';
    const punctuation = parts[i + 1] || '';
    const fullSentence = (sentenceText + punctuation).trim();
    if (fullSentence.length > 2) sentences.push(fullSentence);
  }
  return sentences;
}

/**
 * Generates TTF (Twigit Text Format) content from text.
 * Improved to preserve all characters including whitespaces and punctuation.
 */
export function generateTTF(text: string, title?: string, sourceLang?: string, targetLang?: string): string {
  // Regex to split into words, whitespace, and punctuation using unicode properties
  const chunks = text.split(/(\s+|[^\p{L}\p{N}_])/gu).filter(c => c.length > 0);
  const phrases: { p: string; t: string }[] = [];
  
  for (const chunk of chunks) {
    phrases.push({
      p: chunk,
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
 * Generates a link to import the TTF into the Twigit app or web interface.
 */
export function generateTwigitLink(ttf: string, sourceLang: string = 'EN', targetLang: string = 'PL'): string {
  const encodedTTF = encodeURIComponent(ttf).replace(/%20/g, '+');
  
  // Map target language to potential app schemes
  const schemeMap: Record<string, string> = {
    'PL': 'twigitpl',
    'RU': 'twigitru',
    'UK': 'twigituk',
    'HE': 'twigithe',
    'EN': 'twigitruen' // Fallback or specific combo
  };

  const scheme = schemeMap[targetLang.toUpperCase()] || 'twigit';
  const langCombo = `${sourceLang.toLowerCase()}-${targetLang.toLowerCase()}`;
  
  return {
    app: `${scheme}://${encodedTTF}?import_mode=full`,
    web: `https://twigit.app/${langCombo}/?import_json=${encodedTTF}&import_mode=full`
  } as any;
}

/**
 * Generates an LLM prompt that includes the TTF JSON and instructions for 
 * improving phrase splitting and translation, following Twigit standards.
 */
export function generateTTFPrompt(text: string, title?: string, sourceLang?: string, targetLang?: string): string {
  const ttfJson = generateTTF(text, title, sourceLang, targetLang);
  
  return `You are a supreme language expert. You produce top-tier wording and translations. You only output JSON.

Below is a text excerpt from "${title || 'Unknown'}" in ${sourceLang || 'the source language'}, naively chunked into Twigit Text Format (TTF).

Your task:
1. Split the ${sourceLang || 'source language'} text into chunks of at most three words each.
2. Improve the phrase splitting ('p' field) so phrases are meaningful and natural for a language learner.
3. Translate each chunk independently into ${targetLang || 'the target language'} ('t' field).
4. Example: if the chunk is 'teeth,' the translation must only be 'teeth,' not 'his teeth' or 'white teeth.'
5. Output non-whitespace punctuation and whitespaces as separate objects with empty translation. Ensure no characters from the original text are lost.
6. Preserve the 'title', 'language', and 'target_language' fields.
7. Output ONLY the final valid JSON TTF.

ORIGINAL TEXT FOR REFERENCE:
"""
${text}
"""

TTF Input (Improve this):
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