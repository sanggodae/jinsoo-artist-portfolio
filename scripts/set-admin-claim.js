/**
 * scripts/set-admin-claim.js
 *
 * Sets the Firebase Authentication custom user claim { admin: true } for a given user email.
 *
 * -------------------------------------------------------------------------------------
 * HOW TO GENERATE THE SERVICE ACCOUNT JSON KEY:
 * -------------------------------------------------------------------------------------
 * 1. Open the Firebase Console: https://console.firebase.google.com/
 * 2. Select your Firebase project (e.g. gen-lang-client-0635539736).
 * 3. Click the gear icon (Project Settings) in the left sidebar next to "Project Overview".
 * 4. Navigate to the "Service accounts" tab.
 * 5. Ensure "Node.js" is selected, then click the "Generate new private key" button.
 * 6. Confirm the prompt by clicking "Generate key". A JSON credentials file will be downloaded.
 * 7. Rename the downloaded file to "serviceAccountKey.json" and place it in the root directory
 *    of this project (or set the GOOGLE_APPLICATION_CREDENTIALS environment variable to its path).
 *
 * SECURITY NOTE:
 * Never commit serviceAccountKey.json to public version control (GitHub, GitLab, etc.).
 * Ensure it is added to your .gitignore file.
 *
 * -------------------------------------------------------------------------------------
 * HOW TO RUN THIS SCRIPT:
 * -------------------------------------------------------------------------------------
 * 1. Ensure dependencies are installed:
 *      npm install -D firebase-admin
 *
 * 2. Run the script with the target user's email:
 *      node scripts/set-admin-claim.js user@example.com
 *
 * 3. To verify or immediately reflect the changes in the client app:
 *      The user can click "[권한 상태 새로고침]" (Refresh Claims) in the Admin Login modal
 *      or log out and log back in to obtain an updated Firebase ID token.
 * -------------------------------------------------------------------------------------
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('\n❌ Usage: node scripts/set-admin-claim.js <user-email>');
  console.error('Example: node scripts/set-admin-claim.js artist@example.com\n');
  process.exit(1);
}

// Basic email format check
if (!userEmail.includes('@') || !userEmail.includes('.')) {
  console.error(`\n❌ Error: "${userEmail}" is not a valid email address.\n`);
  process.exit(1);
}

async function setAdminClaim() {
  console.log(`\n======================================================`);
  console.log(` Firebase Admin: Assigning Custom Claim { admin: true }`);
  console.log(` Target user email: ${userEmail}`);
  console.log(`======================================================\n`);

  // 1. Dynamic import of firebase-admin
  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch (err) {
    console.error('⚠️  Error: "firebase-admin" package is not installed.');
    console.error('👉 Run: npm install -D firebase-admin\n');
    process.exit(1);
  }

  // 2. Resolve service account credentials
  const defaultKeyPath = resolve(process.cwd(), 'serviceAccountKey.json');
  let credential;

  if (existsSync(defaultKeyPath)) {
    try {
      const serviceAccount = JSON.parse(readFileSync(defaultKeyPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
      console.log(`✓ Loaded service account credentials from: ${defaultKeyPath}`);
    } catch (err) {
      console.error(`❌ Failed to parse serviceAccountKey.json: ${err.message}`);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
    console.log(`✓ Using credentials from GOOGLE_APPLICATION_CREDENTIALS environment variable.`);
  } else {
    console.error('❌ Service account private key not found.');
    console.error('\nPlease follow these steps to provide credentials:');
    console.error('1. Go to Firebase Console -> Project Settings -> Service accounts');
    console.error('2. Click "Generate new private key"');
    console.error(`3. Save the JSON file as: ${defaultKeyPath}`);
    console.error('   OR set the GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to the file.\n');
    process.exit(1);
  }

  // 3. Initialize Firebase Admin App
  const app = admin.initializeApp({ credential });
  const auth = admin.auth(app);

  try {
    // 4. Look up user record by email
    console.log(`→ Looking up Firebase user record for "${userEmail}"...`);
    const userRecord = await auth.getUserByEmail(userEmail);

    console.log(`✓ User found:`);
    console.log(`  - UID: ${userRecord.uid}`);
    console.log(`  - Email: ${userRecord.email}`);
    console.log(`  - Display Name: ${userRecord.displayName || '(none)'}`);
    console.log(`  - Existing Custom Claims:`, userRecord.customClaims || '(none)');

    // 5. Update user record with custom claim { admin: true }
    console.log(`\n→ Setting custom claim { admin: true } on user UID: ${userRecord.uid}...`);
    await auth.setCustomUserClaims(userRecord.uid, {
      ...userRecord.customClaims,
      admin: true,
    });

    // 6. Verify updated claims
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log(`\n🎉 Success! Custom claim updated successfully.`);
    console.log(`  - Verified Claims:`, updatedUser.customClaims);
    console.log(`\nℹ️ Next Steps:`);
    console.log(`  1. The user (${userEmail}) can now access admin features.`);
    console.log(`  2. In the web app, click "[권한 상태 새로고침]" in the admin login modal`);
    console.log(`     or log in again to refresh the ID token.\n`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n❌ Error: No Firebase Authentication user found with email "${userEmail}".`);
      console.error('👉 Please create the user account in the Firebase Console (Authentication > Users)');
      console.error('   or have the user sign up / sign in through the web app first.\n');
    } else {
      console.error(`\n❌ An error occurred while setting custom claims:`, error.message || error);
    }
  } finally {
    await app.delete();
  }
}

setAdminClaim();
