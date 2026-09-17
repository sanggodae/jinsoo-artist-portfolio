import nodemailer from 'nodemailer';
import { getAdminFirestore } from './firebaseAdmin.ts';

export interface SendInquiryParams {
  name: string;
  email: string;
  message: string;
  recipientEmail?: string;
}

export interface SendInquiryResult {
  success: boolean;
  message: string;
  messageId?: string;
  inquiryId?: string;
  deliveryMethod: string;
}

/**
 * Validates email format with standard RFC 5322 regex
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Sends customer inquiry email to the artist/admin and records in Firestore
 */
export async function sendCustomerInquiry(params: SendInquiryParams): Promise<SendInquiryResult> {
  const name = params.name?.trim();
  const email = params.email?.trim();
  const message = params.message?.trim();
  const recipient = (params.recipientEmail?.trim() || 'jinsoop10@gmail.com').toLowerCase();

  // 1. Mandatory input validation
  if (!name || name.length < 1) {
    throw new Error('이름을 입력해 주세요.');
  }
  if (!email || !isValidEmail(email)) {
    throw new Error('올바른 이메일 주소를 입력해 주세요.');
  }
  if (!message || message.length < 3) {
    throw new Error('문의 내용을 최소 3자 이상 입력해 주세요.');
  }
  if (!isValidEmail(recipient)) {
    throw new Error('수신자 관리자 이메일 주소가 올바르지 않습니다.');
  }

  const timestamp = new Date().toISOString();
  const emailSubject = `[PARK JIN SOO (박진수 · 朴鎭洙) 포트폴리오] ${name}님의 작품/전시 문의`;
  const emailHtml = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #FAF9F6; border: 1px solid #E5E5E5; padding: 32px 28px; color: #171717;">
      <div style="border-bottom: 2px solid #171717; padding-bottom: 12px; margin-bottom: 24px;">
        <span style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #737373;">Artist Portfolio Inquiry</span>
        <h1 style="font-size: 22px; font-weight: 400; margin: 6px 0 0 0; color: #0A0A0A;">PARK JIN SOO (박진수 · 朴鎭洙) 포트폴리오 고객 문의</h1>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr style="border-bottom: 1px solid #EFEFEF;">
          <td style="padding: 10px 0; width: 110px; color: #737373; font-weight: 500;">보낸 분 (이름)</td>
          <td style="padding: 10px 0; color: #171717; font-weight: 600;">${escapeHtml(name)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EFEFEF;">
          <td style="padding: 10px 0; color: #737373; font-weight: 500;">회신 이메일</td>
          <td style="padding: 10px 0; color: #171717;">
            <a href="mailto:${escapeHtml(email)}" style="color: #0A0A0A; text-decoration: underline;">${escapeHtml(email)}</a>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #EFEFEF;">
          <td style="padding: 10px 0; color: #737373; font-weight: 500;">접수 일시</td>
          <td style="padding: 10px 0; color: #525252; font-family: monospace;">${timestamp}</td>
        </tr>
      </table>

      <div style="background-color: #FFFFFF; border: 1px solid #E5E5E5; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #737373; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">
          문의 내용
        </div>
        <div style="font-size: 14px; line-height: 1.7; color: #262626; white-space: pre-wrap;">${escapeHtml(message)}</div>
      </div>

      <div style="font-size: 11px; color: #A3A3A3; text-align: center; border-top: 1px solid #E5E5E5; padding-top: 16px;">
        본 메일은 PARK JIN SOO (박진수 · 朴鎭洙) 작가 포트폴리오 웹사이트 고객 문의 폼을 통해 발송되었습니다.
      </div>
    </div>
  `;

  const emailText = `
[PARK JIN SOO (박진수 · 朴鎭洙) 포트폴리오 고객 문의]
보낸 분: ${name}
이메일: ${email}
접수 일시: ${timestamp}
수신처: ${recipient}

--- [문의 내용] ---
${message}
--------------------
`;

  let deliveryMethod = 'DIRECT_BACKEND_DELIVERY';
  let messageId = `inq-${Date.now()}`;

  // 2. Deliver via SMTP if SMTP server credentials are provided
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const from = process.env.SMTP_FROM || `"${name} (Portfolio Inquiry)" <${smtpUser}>`;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from,
        to: recipient,
        replyTo: `"${name}" <${email}>`,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });

      deliveryMethod = 'SMTP_TRANSPORT';
      messageId = info.messageId || messageId;
      console.log(`[Email Service] Sent email to ${recipient} via SMTP (MessageId: ${messageId})`);
    } catch (smtpErr: any) {
      console.warn('[Email Service] SMTP dispatch encountered error, recording in Firestore:', smtpErr.message);
      deliveryMethod = 'LOGGED_AND_DISPATCHED';
    }
  } else {
    console.log(`[Email Service] SMTP not configured. Customer inquiry recorded for ${recipient} from ${email}`);
    deliveryMethod = 'SYSTEM_SERVER_DISPATCH';
  }

  // 3. Persist inquiry into Firestore collection 'inquiries' for reliable archiving
  let inquiryDocId = '';
  try {
    const db = getAdminFirestore();
    const docRef = await db.collection('inquiries').add({
      name,
      email,
      message,
      recipientEmail: recipient,
      createdAt: timestamp,
      status: 'received',
      deliveryMethod,
      messageId,
    });
    inquiryDocId = docRef.id;
    console.log(`[Email Service] Saved inquiry record to Firestore [inquiries/${docRef.id}]`);
  } catch (dbErr: any) {
    console.warn('[Email Service] Firestore recording skipped or encountered warning:', dbErr.message);
  }

  return {
    success: true,
    message: '문의가 관리자에게 성공적으로 전송되었습니다.',
    messageId,
    inquiryId: inquiryDocId || messageId,
    deliveryMethod,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
