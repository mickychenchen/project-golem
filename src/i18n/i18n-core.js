/**
 * Golem i18n Core — Shared translation logic for Node.js and Browser
 */

/**
 * Resolve a dot-notation key in an object
 */
function resolve(obj, keyPath) {
    if (!keyPath || !obj) return undefined;
    return keyPath.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
    }, obj);
}

/**
 * Translate a key with variable substitution
 */
function translate(messages, fallbackMessages, key, vars = {}) {
    let msg = resolve(messages, key);

    // Fallback if not found
    if (msg === undefined && fallbackMessages) {
        msg = resolve(fallbackMessages, key);
    }

    if (msg === undefined) return key;

    // Fast substitution
    return String(msg).replace(/{{(.*?)}}/g, (match, p1) => {
        const varName = p1.trim();
        return vars[varName] !== undefined ? vars[varName] : match;
    });
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { resolve, translate };
} else if (typeof window !== 'undefined') {
    window.i18nCore = { resolve, translate };
} else {
    // Basic export for ESM environments that don't support CJS
    // This part is tricky without a build step, but this should work for Next.js/Browser
    // if it supports importing CommonJS files.
}
