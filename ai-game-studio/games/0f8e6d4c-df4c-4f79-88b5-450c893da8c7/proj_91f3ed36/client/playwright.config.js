const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test',
    timeout: 30000,
    retries: 0,
    use: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
    },
    reporter: [['list']],
});
