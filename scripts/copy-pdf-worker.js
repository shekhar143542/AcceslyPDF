// Script to copy PDF.js worker to public directory
// Run this after npm install or before build

const fs = require('fs');
const path = require('path');

const workerSrc = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs'
);

const workerDest = path.join(
  __dirname,
  '..',
  'public',
  'pdf.worker.min.mjs'
);

try {
  // Create public directory if it doesn't exist
  const publicDir = path.dirname(workerDest);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy worker file
  fs.copyFileSync(workerSrc, workerDest);
  console.log('✅ PDF.js worker copied to public directory');
  console.log(`   From: ${workerSrc}`);
  console.log(`   To: ${workerDest}`);
} catch (error) {
  console.error('❌ Error copying PDF.js worker:', error);
  process.exit(1);
}
