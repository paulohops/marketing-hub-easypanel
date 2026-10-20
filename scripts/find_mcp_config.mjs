import fs from 'fs';

const content = fs.readFileSync('C:/Users/OnNet Telecom/.gemini/antigravity/conversation_summaries.db', 'utf8');
let pos = 0;
while (true) {
  const idx = content.indexOf('"marketing-hub"', pos);
  if (idx === -1) break;
  console.log('--- FOUND AT POS', idx, '---');
  console.log(content.slice(Math.max(0, idx - 50), idx + 350));
  pos = idx + 15;
  if (pos > 500000) break;
}
