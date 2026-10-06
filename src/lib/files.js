export const MAX_RESUME_LENGTH = 18000;
export async function extractResume(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('请上传 5 MB 以内的文件。');
  const ext = file.name.split('.').pop().toLowerCase();
  let text = '';
  if (ext === 'txt') text = await file.text();
  else if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser.js');
    const result = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 12) throw new Error('请上传 12 页以内的简历，或直接粘贴相关经历。');
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
      }
      text = pages.join('\n\n');
    } finally { await task.destroy(); }
  } else throw new Error('支持 PDF、DOCX 和 TXT；其他格式请直接粘贴文字。');
  text = text.replace(/\u0000/g, '').trim();
  if (text.length < 40) throw new Error('未读取到足够文字。扫描版 PDF 请先转成文字，或直接粘贴经历。');
  if (text.length > MAX_RESUME_LENGTH) throw new Error('简历文字较长，请粘贴最相关的经历（18,000 字符以内）。');
  return text;
}
