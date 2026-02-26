// Privacy-safe image upload route
// Stores images on the server filesystem (replaces Firebase Storage)
//
// GDPR / Data Privacy measures:
// - All EXIF/GPS metadata stripped via sharp (no location leaks)
// - UUID filenames (unguessable, cannot enumerate)
// - User-scoped folders (isolation between users)
// - Auth-gated uploads (Firebase UID verified against DB)
// - Auto-cleanup of images older than 90 days
// - Delete-my-data endpoint (user can wipe all their images)
// - No directory listing (express.static has no index)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const crypto = require('crypto');
const pool = require('../database/db');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const RETENTION_DAYS = 90;

// ensure base upload directories exist
['scans', 'thumbnails'].forEach(dir => {
  const dirPath = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// multer config - store in memory for processing with sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// helper: verify user exists in DB
async function verifyUser(firebaseUid) {
  if (!firebaseUid) return false;
  const result = await pool.query(
    'SELECT id FROM users WHERE firebase_uid = $1',
    [firebaseUid]
  );
  return result.rows.length > 0;
}

// helper: ensure user folder exists
function ensureUserDir(firebaseUid) {
  // use a hashed folder name so firebase UID isn't exposed in URLs
  const userHash = crypto.createHash('sha256').update(firebaseUid).digest('hex').slice(0, 16);
  ['scans', 'thumbnails'].forEach(dir => {
    const userDir = path.join(UPLOADS_DIR, dir, userHash);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
  });
  return userHash;
}

/**
 * POST /api/uploads/image
 * Uploads a scan image + auto-generates thumbnail
 * Body: multipart/form-data with 'image' field + 'firebaseUid' text field
 * Returns: { success, imageUrl, thumbnailUrl }
 *
 * Privacy: strips all EXIF/GPS, uses UUID filename, user-scoped folder
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { firebaseUid } = req.body;

    // auth gate: must be a registered user
    if (!firebaseUid || !(await verifyUser(firebaseUid))) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userHash = ensureUserDir(firebaseUid);

    // UUID filename - unguessable, prevents enumeration
    const fileId = crypto.randomUUID();
    const filename = `${fileId}.jpg`;

    // full-size image (max 800px wide, 80% quality)
    // sharp strips all EXIF/GPS metadata by default
    const fullPath = path.join(UPLOADS_DIR, 'scans', userHash, filename);
    await sharp(req.file.buffer)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(fullPath);

    // thumbnail (max 300px wide, 70% quality)
    const thumbPath = path.join(UPLOADS_DIR, 'thumbnails', userHash, filename);
    await sharp(req.file.buffer)
      .resize(300, null, { withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(thumbPath);

    // build URLs (use LAN IP since this runs on LXC)
    const baseUrl = `http://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/scans/${userHash}/${filename}`;
    const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${userHash}/${filename}`;

    console.log('Image uploaded (metadata stripped):', imageUrl);

    res.json({
      success: true,
      imageUrl,
      thumbnailUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/uploads/image/:userHash/:filename
 * Deletes a specific scan image and its thumbnail
 */
router.delete('/image/:userHash/:filename', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid || !(await verifyUser(firebaseUid))) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // verify user owns this folder
    const expectedHash = crypto.createHash('sha256').update(firebaseUid).digest('hex').slice(0, 16);
    if (req.params.userHash !== expectedHash) {
      return res.status(403).json({ error: 'Cannot delete another user\'s images' });
    }

    const safe = path.basename(req.params.filename);
    const safeHash = path.basename(req.params.userHash);

    const fullPath = path.join(UPLOADS_DIR, 'scans', safeHash, safe);
    const thumbPath = path.join(UPLOADS_DIR, 'thumbnails', safeHash, safe);

    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/uploads/my-data
 * GDPR: Delete ALL images for the authenticated user
 * Body: { firebaseUid }
 */
router.delete('/my-data', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid || !(await verifyUser(firebaseUid))) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userHash = crypto.createHash('sha256').update(firebaseUid).digest('hex').slice(0, 16);
    let deletedCount = 0;

    ['scans', 'thumbnails'].forEach(dir => {
      const userDir = path.join(UPLOADS_DIR, dir, userHash);
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(userDir, file));
          deletedCount++;
        });
        fs.rmdirSync(userDir);
      }
    });

    console.log(`GDPR delete: removed ${deletedCount} files for user ${userHash}`);
    res.json({ success: true, deletedFiles: deletedCount });
  } catch (error) {
    console.error('GDPR delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auto-cleanup: removes images older than RETENTION_DAYS
 * Called on server startup and every 24 hours
 */
function cleanupOldImages() {
  const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  ['scans', 'thumbnails'].forEach(dir => {
    const baseDir = path.join(UPLOADS_DIR, dir);
    if (!fs.existsSync(baseDir)) return;

    // iterate user folders
    const userFolders = fs.readdirSync(baseDir);
    userFolders.forEach(userHash => {
      const userDir = path.join(baseDir, userHash);
      const stat = fs.statSync(userDir);
      if (!stat.isDirectory()) return;

      const files = fs.readdirSync(userDir);
      files.forEach(file => {
        const filePath = path.join(userDir, file);
        const fileStat = fs.statSync(filePath);
        if (now - fileStat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      });

      // remove empty user folders
      const remaining = fs.readdirSync(userDir);
      if (remaining.length === 0) {
        fs.rmdirSync(userDir);
      }
    });
  });

  if (cleaned > 0) {
    console.log(`Auto-cleanup: removed ${cleaned} images older than ${RETENTION_DAYS} days`);
  }
}

// run cleanup on module load and every 24 hours
cleanupOldImages();
setInterval(cleanupOldImages, 24 * 60 * 60 * 1000);

module.exports = router;
