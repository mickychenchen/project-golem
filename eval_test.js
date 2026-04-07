const { execSync } = require('child_process');
try {
    execSync('node -c src/core/PageInteractor.js', { stdio: 'ignore' });
    console.log('SCORE: 100');
} catch(e) {
    console.log('SCORE: 0');
}
