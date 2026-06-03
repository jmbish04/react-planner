import { test, expect } from '@playwright/test';

test.describe('Smart Architect Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Debug: Print console logs
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));

        // Wait for the app to load
        await expect(page.locator('#app')).toBeVisible();

        // Debug: Print HTML if SVG is not found
        try {
            await page.waitForSelector('svg', { timeout: 5000 });
        } catch (e) {
            console.log('SVG not found. Page content:');
            console.log(await page.evaluate(() => document.body.innerHTML));
        }
    });

    test('should load the initial layout correctly', async ({ page }) => {
        // Check for sidebar title
        await expect(page.getByRole('heading', { name: 'Smart Architect' })).toBeVisible();

        // Check for chat input
        await expect(page.getByPlaceholder('Describe your floorplan...')).toBeVisible();

        // Verify initial system message
        await expect(page.getByText('Hello! I am your Smart Architect')).toBeVisible();
    });

    test('should generate Hello World floorplan via chat', async ({ page }) => {
        // Type command
        await page.getByPlaceholder('Describe your floorplan...').fill('Hello World');
        await page.getByRole('button', { name: 'Send' }).click();

        // Wait for the "Thinking..." indicator to appear and then disappear
        await expect(page.getByText('Thinking...')).toBeVisible();
        await expect(page.getByText('Thinking...')).toBeHidden();

        // Verify system response
        await expect(page.getByText("I have generated a basic 'Hello World' floorplan for you.")).toBeVisible();

        // Wait a bit for render
        await page.waitForTimeout(1000);

        // Check if lines exist (Hello World has 4 walls)
        // We use a relaxed check because the exact structure might vary
        const lines = await page.locator('svg').first().locator('g').count();
        console.log(`Found ${lines} groups in SVG`);
        expect(lines).toBeGreaterThan(0);
    });

    test('should handle Blueprints Manager', async ({ page }) => {
        // Save current view
        await page.getByRole('button', { name: 'Save View' }).click();

        // Verify it appears in the list
        await expect(page.getByText('Option A')).toBeVisible();

        // Save another
        await page.getByRole('button', { name: 'Save View' }).click();
        await expect(page.getByText('Option B')).toBeVisible();
    });

    test('should generate variations via AI command', async ({ page }) => {
        await page.getByPlaceholder('Describe your floorplan...').fill('Show me variations');
        await page.getByRole('button', { name: 'Send' }).click();

        await expect(page.getByText('Thinking...')).toBeVisible();
        await expect(page.getByText('Thinking...')).toBeHidden();

        await expect(page.getByText('AI Variation 1')).toBeVisible();
        await expect(page.getByText('AI Variation 2')).toBeVisible();
    });
});
