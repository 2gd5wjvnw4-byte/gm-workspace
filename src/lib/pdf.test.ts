import { describe, expect, it } from 'vitest';
import { pdfToPrintedPage, printedToPdfPage } from './pdf';

describe('PDF printed-page offset helpers', () => {
  it('converts printed page to PDF page using meta.page_offset and clamps to numPages', () => {
    expect(printedToPdfPage(6, 2, 40)).toBe(8);
    expect(printedToPdfPage(1, -3, 40)).toBe(1);
    expect(printedToPdfPage(45, 2, 40)).toBe(40);
    expect(printedToPdfPage(12, 0)).toBe(12);
  });

  it('converts PDF page back to printed page', () => {
    expect(pdfToPrintedPage(8, 2)).toBe(6);
    expect(pdfToPrintedPage(10, 0)).toBe(10);
  });
});
