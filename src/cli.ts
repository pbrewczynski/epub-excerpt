#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import clipboardy from 'clipboardy';
import { loadEpub, extractExcerpt, generateTTF, generateTTFPrompt, ExcerptOptions, generateTwigitLink, detectLanguage } from './core.js';

const program = new Command();

program
  .name('epub-excerpt')
  .description('Extract a random excerpt from an EPUB file')
  .version('1.1.4');

program
  .argument('<path>', 'Path to the .epub file')
  .option('-w, --max-words <number>', 'Maximum words in excerpt', '250')
  .option('-s, --max-sentences <number>', 'Maximum sentences (overrides word mode if >0)', '0')
  .option('-j, --json', 'Output as JSON')
  .option('-t, --ttf', 'Output in Twigit Text Format (.ttf)')
  .option('-p, --prompt', 'Output an LLM prompt for TTF translation/improvement')
  .option('-c, --copy', 'Copy the LLM prompt directly to clipboard')
  .option('--lang <string>', 'Source language for TTF (defaults to EN or RU if detected)')
  .option('--target-lang <string>', 'Target language for TTF', 'PL')
  .action(async (epubPath, options) => {
    try {
      const fullPath = path.resolve(epubPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`Error: File not found at ${fullPath}`);
        process.exit(1);
      }

      const buffer = fs.readFileSync(fullPath);
      const maxWords = parseInt(options.maxWords, 10);
      const maxSentences = parseInt(options.maxSentences, 10);

      const excerptOptions: ExcerptOptions = {
        maxWords,
      };
      if (maxSentences > 0) {
        excerptOptions.maxSentences = maxSentences;
      }

      const { title, fullText } = await loadEpub(buffer);
      const excerpt = extractExcerpt(fullText, excerptOptions);

      // Auto-detect language if not explicitly provided
      const detectedLang = options.lang === 'EN' ? detectLanguage(excerpt) : options.lang;
      const detectedTargetLang = (options.targetLang === 'PL' && detectedLang === 'RU') ? 'RU' : options.targetLang;

      if (options.prompt || options.copy) {
        const prompt = generateTTFPrompt(excerpt, title, detectedLang, detectedTargetLang);
        
        if (options.copy) {
          try {
            await clipboardy.write(prompt);
            console.log('✓ LLM prompt copied to clipboard!');
          } catch (err) {
            console.error('Failed to copy to clipboard.');
            // Fallback to showing prompt if copy fails
            options.prompt = true;
          }
        }

        if (options.prompt || !options.copy) {
          console.log('\n' + '═'.repeat(60));
          console.log('LLM PROMPT (Copy the text below)');
          console.log('═'.repeat(60) + '\n');
          console.log(prompt);
          console.log('\n' + '═'.repeat(60) + '\n');
        }
      } else if (options.ttf) {
        const ttf = generateTTF(excerpt, title, detectedLang, detectedTargetLang);
        const links: any = generateTwigitLink(ttf, detectedLang, detectedTargetLang);
        console.log(ttf);
        console.log('\n' + '─'.repeat(60));
        console.log('IMPORT TO TWIGIT:');
        console.log(`Web: ${links.web}`);
        console.log(`App: ${links.app}`);
        console.log('─'.repeat(60));
      } else if (options.json) {
        console.log(JSON.stringify({
          source: epubPath,
          title,
          maxWords,
          maxSentences: maxSentences > 0 ? maxSentences : null,
          wordCount: excerpt.split(' ').length,
          excerpt
        }, null, 2));
      } else {
        console.log('\n' + '─'.repeat(60));
        console.log(`RANDOM EXCERPT from ${title || path.basename(epubPath)}`);
        console.log('─'.repeat(60));
        console.log(excerpt.split('\n').map((line: string) => '    ' + line).join('\n'));
        console.log('─'.repeat(60));
        console.log(`Word count: ${excerpt.split(' ').length}\n`);
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
