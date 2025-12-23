#!/usr/bin/env node
/*
  scripts/generate_pdf.js
  Generate a single PDF containing all project source files (excluding vendor/ and node_modules/)
*/
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(process.cwd());
const OUT_HTML = path.join(ROOT, 'docs', 'KINESO_all_code.html');
const OUT_PDF = path.join(ROOT, 'docs', 'KINESO_full_project.pdf');

const EXCLUDES = new Set(['node_modules', 'vendor', 'public/build', '.git']);

function isExcluded(p) {
  for (const ex of EXCLUDES) {
    if (p.split(path.sep).includes(ex)) return true;
  }
  return false;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isExcluded(full)) continue;
    if (e.isDirectory()) {
      results.push(...await walk(full));
    } else if (e.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extToLang(ext) {
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
    '.php': 'php', '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown', '.env': 'text', '.yml': 'yaml', '.yaml': 'yaml'
  };
  return map[ext] || 'text';
}

(async () => {
  try {
    console.log('Collecting files...');
    const files = await walk(ROOT);
    // Filter to repository files (hide some big folders)
    const filtered = files.filter(f => !f.includes(path.join(ROOT, 'node_modules')) && !f.includes(path.join(ROOT, 'vendor')) && !f.includes(path.join(ROOT, 'public', 'build')));
    filtered.sort();

    console.log(`Found ${filtered.length} files`);

    let toc = '';
    let body = '';

    for (let i = 0; i < filtered.length; i++) {
      const f = filtered[i];
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const content = await fs.readFile(f, 'utf8');
      const ext = path.extname(f).toLowerCase();
      const lang = extToLang(ext);
      const anchor = 'file-' + i;
      toc += `<li><a href="#${anchor}">${rel}</a></li>`;
      body += `<section id="${anchor}" style="page-break-inside: avoid; margin-bottom:16px;">
<h2 style="font-family:Arial, sans-serif; font-size:14px;">${rel}</h2>
<pre style="background:#f8f9fb;border:1px solid #e6eef4;padding:12px;border-radius:6px;overflow:auto;font-size:11px;line-height:1.4;font-family:Consolas, Monaco, 'Courier New', monospace;">${escapeHtml(content)}</pre>
</section>\n`;
    }

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>KINESO — Full Project Source</title>
<style>
body { font-family: Arial, sans-serif; color:#263238; margin:24px; }
header { text-align:center; margin-bottom:20px; }
h1 { margin:0; font-size:22px; }
.subtitle { color:#586673; margin-top:6px; }
nav { margin:20px 0; }
nav ul { columns:2; -webkit-columns:2; -moz-columns:2; list-style:none; padding-left:0; }
nav li { margin-bottom:6px; }
a { color:#1e6fb6; text-decoration:none; }
</style>
</head>
<body>
<header>
  <h1>KINESO — Complete Project Source</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
</header>
<nav>
  <h3>Table of contents</h3>
  <ul>
  ${toc}
  </ul>
</nav>
<main>
${body}
</main>
<footer style="margin-top:40px; color:#8a9aa6; font-size:12px;">KINESO — Full repository source snapshot</footer>
</body>
</html>`;

    console.log('Writing HTML to', OUT_HTML);
    await fs.writeFile(OUT_HTML, html, 'utf8');

    console.log('Launching headless browser to create PDF...');
    const browser = await puppeteer.launch({args: ['--no-sandbox','--disable-setuid-sandbox']});
    const page = await browser.newPage();
    await page.goto('file://' + OUT_HTML, { waitUntil: 'networkidle0' });
    await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();
    console.log('PDF generated:', OUT_PDF);
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
