// node letter-land/build.js  ->  letter-land/dist/letter-land.html (one self-contained file to send to a phone)
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const html = read('index.html');
const body = html.match(/<body>([\s\S]*?)<script src="letters\.js">/)[1];
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]); // same list as index.html
const scripts = files.map((f) => {
  const code = read(f);
  if (code.includes('</script')) throw new Error(f + ' contains </script');
  return `<script>\n${code}\n</script>`;
}).join('\n');

const out = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#cfeeff">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>سرزمین حرف‌ها</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@500;800&display=swap">
<style>
${read('style.css')}
</style>
</head>
<body>${body}
${scripts}
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'letter-land.html'), out);
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), out); // so a static host serves it at the site root
console.log('dist/letter-land.html', (out.length / 1024).toFixed(0) + ' KB');
