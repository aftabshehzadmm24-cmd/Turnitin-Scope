import mammoth from 'mammoth';
import JSZip from 'jszip';

export function cleanText(input: string): string {
  if (!input) return '';

  return (
    input
      .replace(/PK[\s\S]*?(docProps|word|settings|styles|app\.xml)[\s\S]*?PK/gi, '')
      .replace(/PK[\x00-\x20].*?(\.xml|\.rels)/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F\u1E00-\u1EFF]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  );
}

export async function extractTextFromDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const mammothResult = await mammoth.extractRawText({ arrayBuffer });
    const extractedText = cleanText(mammothResult.value || '');
    if (extractedText.length >= 30) {
      return extractedText;
    }
  } catch (err) {
    console.warn('Mammoth DOCX fallback failed, trying raw XML extraction:', err);
  }

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '';

    const xml = await docXmlFile.async('string');
    const text = xml
      .replace(/<w:p\b[^>]*>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<w:tr\b[^>]*>/gi, '\n')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<w:br\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<w:tab\b[^>]*\/?\s*>/gi, '\t')
      .replace(/<w:(?:t|instrText|delText)(?:\s+[^>]*)?>([\s\S]*?)<\/w:(?:t|instrText|delText)>/gi, (_, value: string) => {
        return value
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"');
      })
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ');

    const cleanedText = cleanText(text);
    if (cleanedText.length >= 30) {
      return cleanedText;
    }
  } catch (err) {
    console.warn('XML DOCX fallback failed:', err);
  }

  return '';
}
