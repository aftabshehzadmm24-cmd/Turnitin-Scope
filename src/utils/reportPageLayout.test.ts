import test from 'node:test';
import assert from 'node:assert/strict';

import { getReportPdfFileName } from './reportPageLayout';

test('uses only the uploaded file base name for downloaded AI reports', () => {
  assert.equal(
    getReportPdfFileName({ fileName: 'kunal.docx', title: 'Different title' }),
    'kunal.pdf'
  );
});

test('uses only the uploaded file base name for downloaded similarity reports', () => {
  assert.equal(
    getReportPdfFileName({ fileName: 'aftab.pdf', title: 'Different title' }),
    'aftab.pdf'
  );
});

test('handles Windows paths and removes filename-unsafe characters', () => {
  assert.equal(
    getReportPdfFileName({ fileName: 'C:\\uploads\\my: report?.docx', title: '' }),
    'my report.pdf'
  );
});
