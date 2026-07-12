const { chromium } = require('playwright');
const outDir = 'C:\\Users\\client\\AppData\\Local\\Temp\\claude\\c--Users-client--gemini-antigravity-scratch-kine-cabinet-app\\715d45d7-c8ec-4125-b10f-be1b3c9bc9c7\\scratchpad\\';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });

  // Log in first — the store only persists to localStorage after its first
  // mutation (login calls set() internally), not on initial seed/load.
  await page.goto('http://127.0.0.1:5173/connexion', { waitUntil: 'networkidle' });
  await page.locator('input.mono').first().fill('+216 20 000 000');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.waitForTimeout(1000);

  // Now localStorage is populated — inject a confirmed booking dated
  // yesterday directly, and reload so the dashboard picks it up.
  await page.evaluate(() => {
    const KEY = 'lefive.v1';
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error('localStorage not seeded yet: ' + JSON.stringify(Object.keys(localStorage)));
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

  await page.evaluate(() => document.querySelector('body').scrollTo(0, 0));
  const matchesCard = page.getByText('Matchs passés');
  await matchesCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: outDir + '9assa-past-match.png' });

  // Click "Joué" and change the payment amount to test interactivity.
  await page.getByRole('button', { name: 'Joué', exact: true }).click();
  await page.waitForTimeout(300);
  const amountInput = page.locator('input.mono').last();
  await amountInput.fill('70');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: outDir + '9assa-past-match-after.png' });

  await browser.close();
  console.log('done');
})();
