/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: 1,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		headless: true,
		actionTimeout: 90000,
		navigationTimeout: 90000,
		viewport: { width: 1280, height: 720 }
	},
	timeout: 180000,
	expect: {
		timeout: 90000
	},
	projects: [
		{
			name: 'chromium',
			use: {
				headless: true,
				launchOptions: {
					args: ['--no-sandbox', '--disable-setuid-sandbox']
				}
			}
		}
	],
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: true,
		timeout: 180000
	}
};

export default config;
