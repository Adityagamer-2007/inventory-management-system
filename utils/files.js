const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

// path.basename blocks "../" tricks.
function deleteUpload(filename) {
  if (!filename) return;
  const safe = path.basename(filename);
  fs.unlink(path.join(UPLOAD_DIR, safe), () => {});
}

module.exports = { UPLOAD_DIR, deleteUpload };
