import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getAdminAuth } from './src/server/firebaseAdmin.ts';
import { sendCustomerInquiry } from './src/server/emailService.ts';
import { translateArtistNote } from './src/server/translationService.ts';

const ALLOWED_BOOTSTRAP_EMAIL = 'jinsoop10@gmail.com';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  /**
   * One-time Bootstrap Endpoint for Initial Admin Custom Claim Assignment
   * Strict Security Controls:
   * 1. Only accepts target email: jinsoop10@gmail.com
   * 2. Verifies client-sent Firebase ID Token cryptographically using Firebase Admin SDK
   * 3. Verifies decodedToken.email matches jinsoop10@gmail.com
   * 4. Verifies decodedToken.email_verified === true
   * 5. Preserves existing custom claims and merges { admin: true }
   */
  app.post('/api/admin/bootstrap', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: '인증 헤더(Bearer Token)가 제공되지 않았습니다.',
        });
      }

      const idToken = authHeader.split('Bearer ')[1].trim();
      const auth = getAdminAuth();

      // 1. Verify ID Token signature & expiration
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(idToken, true);
      } catch (verifyErr: any) {
        console.error('[Bootstrap] ID Token verification failed:', verifyErr.message);
        return res.status(401).json({
          success: false,
          error: `ID 토큰 검증 실패: ${verifyErr.message}`,
        });
      }

      const clientEmail = decodedToken.email?.toLowerCase();
      const clientUid = decodedToken.uid;
      const isEmailVerified = decodedToken.email_verified;

      // 2. Enforce strict email restriction: jinsoop10@gmail.com only
      if (clientEmail !== ALLOWED_BOOTSTRAP_EMAIL) {
        console.warn(`[Bootstrap] Unauthorized attempt for email: ${clientEmail}`);
        return res.status(403).json({
          success: false,
          error: `허용되지 않은 계정입니다. 초기 관리자 등록은 ${ALLOWED_BOOTSTRAP_EMAIL} 계정만 가능합니다.`,
        });
      }

      // 3. Enforce email_verified check
      if (!isEmailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Google 계정의 이메일 인증(email_verified)이 완료되지 않았습니다.',
        });
      }

      // 4. Retrieve user record to inspect and preserve existing claims
      const userRecord = await auth.getUser(clientUid);
      const existingClaims = userRecord.customClaims || {};

      // 5. Merge existing claims with admin: true
      const updatedClaims = {
        ...existingClaims,
        admin: true,
      };

      // 6. Set custom user claims via Firebase Admin SDK
      await auth.setCustomUserClaims(clientUid, updatedClaims);

      console.log(`[Bootstrap] Successfully assigned admin: true to UID [${clientUid}] (${clientEmail})`);

      return res.json({
        success: true,
        message: `${ALLOWED_BOOTSTRAP_EMAIL} 계정에 관리자(admin: true) 권한이 안전하게 부여되었습니다.`,
        uid: clientUid,
        email: clientEmail,
        claims: updatedClaims,
      });
    } catch (err: any) {
      console.error('[Bootstrap Error]:', err);
      return res.status(500).json({
        success: false,
        error: `서버 처리 중 오류 발생: ${err.message}`,
      });
    }
  });

  // In-memory store for client IndexedDB audit logs (read-only verification)
  let latestIndexedDbInspection: any = null;

  app.post('/api/indexeddb/log-inspection', (req, res) => {
    try {
      const { artworks, source, totalCount } = req.body;
      const top5 = Array.isArray(artworks) ? artworks.slice(0, 5) : [];
      latestIndexedDbInspection = {
        timestamp: new Date().toISOString(),
        totalCount: totalCount || (artworks ? artworks.length : 0),
        source: source || 'IndexedDB: artworks_store / artworks_list',
        top5: top5.map((a: any, i: number) => ({
          rank: i + 1,
          id: a.id,
          code: a.code,
          title: a.title,
          canvasSizeCode: a.canvasSizeCode,
          material: a.material,
          year: a.year,
        })),
      };

      console.log('====================================================');
      console.log(`[IndexedDB INSPECTION LOG] Total: ${latestIndexedDbInspection.totalCount} items`);
      console.log(`Source: ${latestIndexedDbInspection.source}`);
      console.log('Top 5 Artworks:');
      latestIndexedDbInspection.top5.forEach((item: any) => {
        console.log(`  #${item.rank} | ID: ${item.id} | Code: ${item.code} | Title: ${item.title}`);
      });
      console.log('====================================================');

      return res.json({ success: true, logged: latestIndexedDbInspection });
    } catch (e: any) {
      console.error('[IndexedDB Log Error]:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/indexeddb/inspection', (req, res) => {
    res.json({
      success: true,
      data: latestIndexedDbInspection,
    });
  });

  /**
   * Customer Inquiry API Endpoint
   * Sends inquiry email to admin email (customizable via SiteSettings)
   * Validates name, email, message and logs/stores inquiry.
   */
  app.post('/api/contact/send-inquiry', async (req, res) => {
    try {
      const { name, email, message, recipientEmail } = req.body;

      const result = await sendCustomerInquiry({
        name,
        email,
        message,
        recipientEmail,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('[Customer Inquiry Error]:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message || '문의 전송 중 오류가 발생했습니다.',
      });
    }
  });

  /**
   * Artist Note Auto-Translation Endpoint
   * Translates Korean fine art statements into literary English using Gemini / fallback.
   */
  app.post('/api/translate/artist-note', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: '번역할 텍스트가 전달되지 않았습니다.',
        });
      }

      const result = await translateArtistNote(text);
      return res.json({
        success: true,
        translation: result.translation,
        source: result.source,
      });
    } catch (err: any) {
      console.error('[Translation Route Error]:', err.message);
      return res.status(500).json({
        success: false,
        error: `번역 처리 중 오류 발생: ${err.message}`,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
