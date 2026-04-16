import test from 'node:test';
import assert from 'node:assert/strict';
import type { FileUIPart } from 'ai';
import {
  prepareAttachmentFilesForSubmit,
  shouldConvertAttachmentUrl,
} from './prompt-input-attachments';

test('shouldConvertAttachmentUrl converts blob PDFs before submit', () => {
  assert.equal(
    shouldConvertAttachmentUrl('blob:http://localhost:3000/example', 'application/pdf'),
    true,
  );
});

test('prepareAttachmentFilesForSubmit converts blob PDFs to data URLs', async () => {
  const files: FileUIPart[] = [
    {
      type: 'file',
      url: 'blob:http://localhost:3000/example',
      mediaType: 'application/pdf',
      filename: 'guide.pdf',
    },
  ];

  const converted = await prepareAttachmentFilesForSubmit(files, async (url) => {
    assert.equal(url, 'blob:http://localhost:3000/example');
    return 'data:application/pdf;base64,JVBERi0xLjQK';
  });

  assert.equal(converted[0]?.url, 'data:application/pdf;base64,JVBERi0xLjQK');
  assert.equal(converted[0]?.mediaType, 'application/pdf');
  assert.equal(converted[0]?.filename, 'guide.pdf');
});

test('prepareAttachmentFilesForSubmit leaves normal remote files unchanged', async () => {
  const files: FileUIPart[] = [
    {
      type: 'file',
      url: 'https://example.com/guide.pdf',
      mediaType: 'application/pdf',
      filename: 'guide.pdf',
    },
  ];

  let convertCalls = 0;
  const converted = await prepareAttachmentFilesForSubmit(files, async () => {
    convertCalls += 1;
    return null;
  });

  assert.equal(convertCalls, 0);
  assert.deepEqual(converted, files);
});
