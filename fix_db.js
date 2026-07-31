const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('C:/Users/shinn/.gemini/antigravity-ide/scratch/one-bite/src/app/api', function(filePath) {
  if (filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("import { db } from '@/lib/firebase';") && content.includes("firebase/database")) {
      content = content.replace("import { db } from '@/lib/firebase';", "import { rtdb as db } from '@/lib/firebase';");
      fs.writeFileSync(filePath, content);
      console.log('Fixed', filePath);
    }
  }
});
