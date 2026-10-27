import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (config.step !== 1) {
  throw new Error('2단계 서버 API·점검을 완성한 뒤 단계 설정을 갱신하세요.');
}
await mkdir(publicDir, { recursive: true });
// 이전 빌드에 남은 정적 메모도 배포에 포함되지 않도록 제거합니다.
await rm(resolve(publicDir, 'data.json'), { force: true });
console.log('공개 data.json을 배포 결과물에서 제외했습니다.');
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(publicDir, 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
