const { spawn } = require('child_process');
const { chromium } = require('playwright');
const path = require('path');
const outDir = 'C:\\Users\\client\\AppData\\Local\\Temp\\claude\\c--Users-client--gemini-antigravity-scratch-kine-cabinet-app\\715d45d7-c8ec-4125-b10f-be1b3c9bc9c7\\scratchpad\\';

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start in time'));
        else setTimeout(tryFetch, 300);
      });
    };
    tryFetch();
  });
}

(async () => {
  const server = spawn('npm', ['run', 'dev'], { cwd: __dirname, stdio: 'pipe', shell: true });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServer('http://127.0.0.1:5173/', 20000);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });

    await page.goto('http://127.0.0.1:5173/connexion', { waitUntil: 'networkidle' });
    await page.locator('input.mono').first().fill('+216 20 000 000');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const KEY = 'lefive.v1';
      const raw = localStorage.getItem(KEY);
      if (!raw) throw new Error('localStorage not seeded: ' + JSON.stringify(Object.keys(localStorage)));
      const state = JSON.parse(raw);
      const yesterday = new Date(Date.now() - 86400000);
      const y = yesterday.getFullYear();
      const m = String(yesterday.getMonth() + 1).padStart(2, '0');
      const d = String(yesterday.getDate()).padStart(2, '0');
      state.bookings.push({
        id: 'test-past-1',
        dayKey: `${y}-${m}-${d}`,
        pitchId: state.pitches[0].id,
        slotStart: '18:00',
        slotEnd: '19:30',
        phone: '+216 22 111 222',
        name: 'Aymen',
        status: 'confirmed',
        createdAt: Date.now() - 2 * 86400000,
      });
      localStorage.setItem(KEY, JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const matchesCard = page.getByText('Matchs passés');
    await matchesCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: outDir + '9assa-past-match.png' });

    await page.getByRole('button', { name: 'Joué', exact: true }).click();
    await page.waitForTimeout(300);
    const amountInput = page.locator('input.mono').last();
    await amountInput.fill('70');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: outDir + '9assa-past-match-after.png' });

    console.log('SUCCESS');
    await browser.close();
  } finally {
    server.kill();
  }
})();
