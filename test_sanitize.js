const fs = require('fs');

const raw = fs.readFileSync('test_data.json', 'utf8');

function _sanitizeJsonEscapes(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/\\(?:(["\\/bfnrt])|u[0-9a-fA-F]{4}|([^"\\/bfnrtu]|$))/g, (match, valid, invalid) => {
        if (invalid !== undefined) {
            return '\\\\' + invalid;
        }
        return match;
    });
}

try {
    const sanitized = _sanitizeJsonEscapes(raw);
    const parsed = JSON.parse(sanitized);
    console.log("SUCCESS:", parsed.command.substring(0, 50) + "...");
} catch(e) {
    console.error("FAIL:", e.message);
}
