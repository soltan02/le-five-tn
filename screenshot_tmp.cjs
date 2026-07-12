const { chromium } = require('playwright');
const outDir = 'C:\\Users\\client\\AppData\\Local\\Temp\\claude\\c--Users-client--gemini-antigravity-scratch-kine-cabinet-app\\715d45d7-c8ec-4125-b10f-be1b3c9bc9c7\\scratchpad\\';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('http://127.0.0.1:5173/connexion', { waitUntil: 'networkidle' });
  const phoneInput = page.locator('input.mono').first();
  await phoneInput.fill('+216 20 000 000');
  await page.getByRole('button', { name: 'Envoyer le code' }).click();
  await page.waitForTimeout(500);

  const codeText = await page.locator('strong.mono').first().textContent();
  const code = codeText.trim();
  const otpBoxes = await page.locator('input.mono[maxlength="1"]').all();
  for (let i = 0; i < 6; i++) {
    await otpBoxes[i].fill(code[i]);
  }
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: outDir + '9assa-dashboard.png', fullPage: true });
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})();
