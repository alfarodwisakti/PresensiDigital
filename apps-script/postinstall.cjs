const fs = require('fs');
const path = require('path');
const binDir = path.join(__dirname, '..', 'node_modules', '.bin');
try {
  if (fs.existsSync(binDir)) {
    for (const f of fs.readdirSync(binDir)) {
      try { fs.chmodSync(path.join(binDir, f), 0o755); } catch (_) {}
    }
  }
} catch (_) {}