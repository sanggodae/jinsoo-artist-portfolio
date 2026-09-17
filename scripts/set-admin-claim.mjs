/**
 * Firebase Admin Custom Claim Assignment Script
 *
 * Usage:
 *   node scripts/set-admin-claim.mjs <USER_UID_OR_EMAIL>
 *
 * Prerequisites:
 *   1. Download your Firebase Admin service account key from:
 *      Firebase Console -> Project Settings -> Service accounts -> "Generate new private key"
 *   2. Save the key as 'serviceAccountKey.json' in the project root,
 *      OR set the environment variable: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const targetIdentifier = process.argv[2];

if (!targetIdentifier) {
  console.error('\n❌ 사용법: node scripts/set-admin-claim.mjs <USER_UID 또는 USER_EMAIL>');
  console.error('예시: node scripts/set-admin-claim.mjs user@example.com\n');
  process.exit(1);
}

async function run() {
  console.log(`\n🔍 관리자 권한(Custom Claim: admin=true) 부여를 시작합니다...`);
  console.log(`- 대상 사용자: ${targetIdentifier}`);

  // Dynamically import firebase-admin
  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch (err) {
    console.error('\n⚠️ firebase-admin 패키지가 필요합니다.');
    console.error('설치 명령어: npm install -D firebase-admin\n');
    process.exit(1);
  }

  // Find credentials
  const defaultKeyPath = resolve(process.cwd(), 'serviceAccountKey.json');
  let credential;

  if (existsSync(defaultKeyPath)) {
    try {
      const serviceAccount = JSON.parse(readFileSync(defaultKeyPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
      console.log(`✓ serviceAccountKey.json 인증 키 로드 완료`);
    } catch (err) {
      console.error('❌ serviceAccountKey.json 파싱 실패:', err.message);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
    console.log(`✓ GOOGLE_APPLICATION_CREDENTIALS 환경 변수 사용`);
  } else {
    console.error('\n⚠️ Firebase 서비스 계정 키(serviceAccountKey.json)를 찾을 수 없습니다.');
    console.error('발급 경로: Firebase Console -> 프로젝트 설정 -> 서비스 계정 -> "새 비공개 키 생성"');
    console.error(`저장 위치: ${defaultKeyPath}\n`);
    process.exit(1);
  }

  const app = admin.initializeApp({ credential });
  const auth = admin.auth(app);

  try {
    let userRecord;
    if (targetIdentifier.includes('@')) {
      userRecord = await auth.getUserByEmail(targetIdentifier);
    } else {
      userRecord = await auth.getUser(targetIdentifier);
    }

    console.log(`✓ 사용자 확인: ${userRecord.email || '(이메일 없음)'} (UID: ${userRecord.uid})`);

    // Set custom claim: admin = true
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: true,
    });

    console.log(`\n🎉 성공: UID [${userRecord.uid}]에 { admin: true } Custom Claim이 성공적으로 부여되었습니다!`);
    console.log(`ℹ️ 이제 웹 브라우저에서 [권한 상태 새로고침] 버튼을 누르면 즉시 관리자 권한이 적용됩니다.\n`);
  } catch (err) {
    console.error('\n❌ Custom Claim 부여 중 오류 발생:', err.message);
  } finally {
    await app.delete();
  }
}

run();
