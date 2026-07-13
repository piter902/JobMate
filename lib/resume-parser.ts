export interface ParseResult {
  text: string;
  fileName: string;
}

export async function parsePDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = (workerModule as { default: string }).default;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return { text: pages.join('\n\n').trim(), fileName: file.name };
}

export async function parseDocx(file: File): Promise<ParseResult> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return { text: result.value.trim(), fileName: file.name };
}

export async function parseResume(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return parsePDF(file);
    case 'docx': return parseDocx(file);
    default: throw new Error(`不支持的文件格式: .${ext}，请上传 PDF 或 DOCX 文件`);
  }
}
