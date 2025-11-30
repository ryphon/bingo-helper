/**
 * Generates a random session code in format: OSRS-XXXXXX
 * Where X is an alphanumeric character (excluding similar looking characters)
 */
function generateSessionCode() {
    // Exclude similar looking characters: 0, O, I, 1, l
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `OSRS-${code}`;
}

/**
 * Validates session code format
 */
function isValidSessionCode(code) {
    if (!code || typeof code !== 'string') {
        return false;
    }

    // Must match format: OSRS-XXXXXX (6 alphanumeric chars)
    const pattern = /^OSRS-[A-Z0-9]{6}$/;
    return pattern.test(code);
}

module.exports = {
    generateSessionCode,
    isValidSessionCode
};
