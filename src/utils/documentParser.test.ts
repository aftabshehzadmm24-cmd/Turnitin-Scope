import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

import { extractTextFromDocxArrayBuffer } from './docxTextExtractor.ts';

async function createSimpleDocx(): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello from the DOCX fallback parser.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

test('extractDocumentDataFromFile reads a DOCX without a LibreOffice conversion endpoint', async () => {
  const file = new File([await createSimpleDocx()], 'fallback.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('LibreOffice conversion endpoint unavailable');
  }) as typeof fetch;

  try {
    const buffer = await file.arrayBuffer();
    const text = await extractTextFromDocxArrayBuffer(buffer);
    assert.match(text, /Hello from the DOCX fallback parser/);
    assert.ok(text.split(/\s+/).length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
