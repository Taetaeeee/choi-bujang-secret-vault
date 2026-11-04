import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

test('PWA 앱 이름·실행 범위·설치용 아이콘 설정', async () => {
  assert.equal(manifest.name, 'BYTE BACK 내 자료실');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/u);
  for (const size of [192, 512]) {
    const item = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.ok(item, `${size}px 아이콘 필요`);
    assert.equal(item.type, 'image/png');
    const data = await readFile(new URL(`../public${item.src}`, import.meta.url));
    assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
  }
});

test('서버 기기 승인 요청·재확인을 제공하며 앱 설치를 승인으로 간주하지 않음', () => {
  assert.match(html, /id="device-approval-status"/u);
  assert.match(html, /id="device-request"/u);
  assert.match(html, /id="device-recheck"/u);
  assert.match(html, /앱 설치 여부나 로그인만으로 기기가 승인되지는 않습니다/u);
  assert.match(html, /승인 요청은 대기 상태만 만들며/u);
});

test('오프라인 안내를 제공하고 개인 자료의 오프라인 캐시를 만들지 않음', () => {
  assert.match(html, /오프라인에서는 로그인·메모 조회·저장을 이용할 수 없습니다/u);
  assert.match(html, /id="offline-status"/u);
  assert.match(html, /addEventListener\('offline', syncConnectivity\)/u);
  assert.doesNotMatch(html, /serviceWorker\.register/u);
});

test('기존 메모 경로를 유지하되 토큰과 기기 키를 웹 저장소에 보관하지 않음', () => {
  assert.match(html, /fetch\('\/api\/auth'/u);
  assert.match(html, /authFetch\('\/api\/notes'\)/u);
  assert.match(html, /authFetch\(`\/api\/notes\/\$\{encodeURIComponent\(note\.id\)\}`/u);
  assert.doesNotMatch(html, /sessionStorage\.setItem/u);
  assert.doesNotMatch(html, /localStorage\.setItem/u);
  assert.doesNotMatch(html, /Authorization: `Bearer/u);
  assert.match(html, /credentials: 'same-origin'/u);
  assert.match(html, /deviceState !== 'approved'/u);
});
