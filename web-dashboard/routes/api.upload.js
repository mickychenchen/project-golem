const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function(server) {
    const router = express.Router();

    // Upload API (Direct Web Upload)
    router.post('/api/upload', async (req, res) => {
        try {
            const { fileName, base64Data } = req.body;
            if (!fileName || !base64Data) {
                return res.status(400).json({ error: 'Missing fileName or base64Data' });
            }

            // Create temp upload dir
            const uploadDir = path.join(process.cwd(), 'data', 'temp_uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Sanitize filename
            const safeName = `${Date.now()}_${fileName.replace(/[^a-z0-9.]/gi, '_')}`;
            const filePath = path.join(uploadDir, safeName);

            // Save file
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);

            console.log(`💾 [WebServer] File uploaded: ${safeName}`);
            return res.json({ success: true, path: filePath, url: `/api/files/${safeName}` });
        } catch (e) {
            console.error('Failed to upload file:', e);
            return res.status(500).json({ error: e.message });
        }
    });

    return router;
};
