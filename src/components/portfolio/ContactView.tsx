import React, { useState } from 'react';
import { SiteSettings } from '../../types';
import {
  Mail,
  Globe,
  Instagram,
  MapPin,
  Edit3,
  Check,
  X,
  Settings2,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { saveSiteSettingsToFirestore } from '../../services/firestoreService';
import { getArtistProfile } from '../../utils/artistProfile';

interface ContactViewProps {
  settings: SiteSettings;
  isAdmin: boolean;
  onUpdateSettings: (newSettings: SiteSettings) => void;
  onOpenAuthModal?: () => void;
}

export const ContactView: React.FC<ContactViewProps> = ({
  settings,
  isAdmin,
  onUpdateSettings,
  onOpenAuthModal,
}) => {
  const artist = getArtistProfile(settings);

  // Admin Edit Settings Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SiteSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Customer Inquiry Modal State
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inquiryFeedback, setInquiryFeedback] = useState<string>('');

  const handleStartEdit = () => {
    if (!isAdmin) return;
    setFormData({
      ...settings,
      artistKoreanName: settings.artistKoreanName || '박진수',
      artistHanjaName: settings.artistHanjaName || '朴鎭洙',
      artistEnglishName: settings.artistEnglishName || 'PARK JIN SOO',
      inquiryRecipientEmail:
        settings.inquiryRecipientEmail || settings.contactEmail || 'jinsoop10@gmail.com',
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    const updated: SiteSettings = {
      ...formData,
      artistKoreanName: formData.artistKoreanName?.trim() || '박진수',
      artistHanjaName: formData.artistHanjaName?.trim() || '朴鎭洙',
      artistEnglishName: formData.artistEnglishName?.trim() || 'PARK JIN SOO',
      inquiryRecipientEmail:
        formData.inquiryRecipientEmail?.trim() ||
        formData.contactEmail ||
        'jinsoop10@gmail.com',
      updatedAt: new Date().toISOString(),
    };

    onUpdateSettings(updated);

    try {
      await saveSiteSettingsToFirestore(updated);
      setSaveSuccessMsg('연락처 및 관리자 설정이 Firestore에 성공적으로 저장되었습니다.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      setIsEditing(false);
    } catch (err: any) {
      console.error('[Contact] Failed to save settings in Firestore:', err);
      alert(`설정 저장 중 오류가 발생했습니다: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit customer inquiry via backend email API (/api/contact/send-inquiry)
  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = inquiryName.trim();
    const trimmedEmail = inquiryEmail.trim();
    const trimmedMessage = inquiryMessage.trim();

    // Client-side validation
    if (!trimmedName) {
      setInquiryStatus('error');
      setInquiryFeedback('성함(이름)을 입력해 주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setInquiryStatus('error');
      setInquiryFeedback('올바른 이메일 주소를 입력해 주세요.');
      return;
    }

    if (!trimmedMessage || trimmedMessage.length < 3) {
      setInquiryStatus('error');
      setInquiryFeedback('문의 내용을 최소 3자 이상 입력해 주세요.');
      return;
    }

    setIsSendingInquiry(true);
    setInquiryStatus('idle');
    setInquiryFeedback('');

    try {
      const recipientEmail =
        settings.inquiryRecipientEmail?.trim() ||
        settings.contactEmail ||
        'jinsoop10@gmail.com';

      const response = await fetch('/api/contact/send-inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
          recipientEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '이메일 전송 중 오류가 발생했습니다.');
      }

      setInquiryStatus('success');
      setInquiryFeedback('문의가 관리자에게 성공적으로 전송되었습니다.');
    } catch (err: any) {
      console.error('[Contact] Error sending inquiry:', err);
      setInquiryStatus('error');
      setInquiryFeedback(err.message || '문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSendingInquiry(false);
    }
  };

  const handleResetInquiryForm = () => {
    setInquiryName('');
    setInquiryEmail('');
    setInquiryMessage('');
    setInquiryStatus('idle');
    setInquiryFeedback('');
  };

  const handleCloseInquiryModal = () => {
    setIsInquiryOpen(false);
    if (inquiryStatus === 'success') {
      handleResetInquiryForm();
    }
  };

  return (
    <div id="portfolio-contact-view" className="w-full py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="border-b border-neutral-300 pb-8 mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono-code tracking-[0.25em] uppercase text-neutral-400 block mb-1.5">
              INQUIRIES & STUDIO · 연락처
            </span>
            <h1 className="font-serif-title text-3xl sm:text-4xl text-neutral-950 font-normal">
              CONTACT
            </h1>
            <p className="text-xs text-neutral-500 font-light tracking-widest uppercase mt-1">
              {artist.englishName} ({artist.formattedKoHanja}) · Studio Information
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Customer Inquiry Button */}
            <button
              type="button"
              id="header-open-inquiry-btn"
              onClick={() => {
                setInquiryStatus('idle');
                setIsInquiryOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium tracking-wide transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>고객 문의</span>
            </button>

            {isAdmin ? (
              <button
                type="button"
                id="contact-edit-btn"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-neutral-600" />
                <span>관리자 설정</span>
              </button>
            ) : (
              onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="text-xs text-neutral-400 hover:text-neutral-700 underline font-light px-2 py-1"
                >
                  관리자 로그인
                </button>
              )
            )}
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Contact Letterpress Card */}
        <div className="bg-[#FAF9F6] border border-neutral-200/90 p-8 sm:p-14 rounded-xs shadow-[0_4px_30px_rgba(0,0,0,0.03)] space-y-10">
          <div>
            <span className="text-[10px] tracking-[0.28em] uppercase text-neutral-400 block mb-1">
              Contemporary Painter
            </span>
            <h2 className="font-serif-title text-2xl sm:text-3xl text-neutral-900 font-medium">
              {artist.englishName}
              <span className="text-sm font-sans font-light text-neutral-500 ml-3">
                {artist.formattedKoHanja}
              </span>
            </h2>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs pt-4 border-t border-neutral-200/80">
            {/* Email */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 uppercase tracking-widest text-[11px] font-mono-code">
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </div>
              <div>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="text-sm sm:text-base font-medium text-neutral-900 hover:text-neutral-600 underline font-mono-code transition-colors"
                >
                  {settings.contactEmail}
                </a>
              </div>
            </div>

            {/* Instagram */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 uppercase tracking-widest text-[11px] font-mono-code">
                <Instagram className="w-3.5 h-3.5" />
                <span>Instagram</span>
              </div>
              <div>
                {settings.instagramUrl ? (
                  <a
                    href={
                      settings.instagramUrl.startsWith('http')
                        ? settings.instagramUrl
                        : `https://instagram.com/${settings.instagramUrl.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm sm:text-base font-medium text-neutral-900 hover:text-neutral-600 underline transition-colors"
                  >
                    {settings.instagramUrl}
                  </a>
                ) : (
                  <span className="text-neutral-400 italic">미입력</span>
                )}
              </div>
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 uppercase tracking-widest text-[11px] font-mono-code">
                <Globe className="w-3.5 h-3.5" />
                <span>Website</span>
              </div>
              <div>
                {settings.websiteUrl ? (
                  <a
                    href={
                      settings.websiteUrl.startsWith('http')
                        ? settings.websiteUrl
                        : `https://${settings.websiteUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm sm:text-base font-medium text-neutral-900 hover:text-neutral-600 underline font-mono-code transition-colors"
                  >
                    {settings.websiteUrl}
                  </a>
                ) : (
                  <span className="text-neutral-400 italic">미입력</span>
                )}
              </div>
            </div>

            {/* Studio / Other Contact */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 uppercase tracking-widest text-[11px] font-mono-code">
                <MapPin className="w-3.5 h-3.5" />
                <span>Studio & Details</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed font-light whitespace-pre-line">
                {settings.otherContact || 'Studio: Seoul, Republic of Korea'}
              </p>
            </div>
          </div>

          {/* Prominent Customer Inquiry Call-to-Action Bar */}
          <div className="pt-6 border-t border-neutral-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 p-5 rounded border border-neutral-200/60">
            <div>
              <div className="text-sm font-medium text-neutral-900 flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-neutral-800" />
                <span>온라인 고객 문의 및 작품 소장 상담</span>
              </div>
              <p className="text-xs text-neutral-500 font-light leading-relaxed">
                작품 구입, 개인전 및 단체전 출품, 레지던시, 아카이브 협업 문의를 남겨주시면
                기재하신 이메일로 답변을 보내드립니다.
              </p>
            </div>
            <button
              type="button"
              id="card-open-inquiry-btn"
              onClick={() => {
                setInquiryStatus('idle');
                setIsInquiryOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium tracking-widest uppercase transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>고객 문의 작성</span>
            </button>
          </div>

          {/* Admin Notice on Inquiry Recipient */}
          {isAdmin && (
            <div className="pt-2 text-[11px] text-neutral-500 font-mono-code flex items-center justify-between">
              <span>
                현재 문의 수신 관리자 이메일:{' '}
                <strong>
                  {settings.inquiryRecipientEmail || settings.contactEmail || 'jinsoop10@gmail.com'}
                </strong>
              </span>
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-neutral-700 underline hover:text-neutral-950 ml-2"
              >
                수신처 변경 →
              </button>
            </div>
          )}

          {/* Admin Code Generator Rules Info Banner */}
          {isAdmin && (
            <div className="pt-6 border-t border-neutral-200/80 bg-neutral-50/80 p-4 rounded text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium text-neutral-800">
                <Settings2 className="w-4 h-4 text-neutral-600" />
                <span>작품번호 신규 규칙 설정 상태</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                현재 신규 작품번호 형식: <code className="font-mono font-semibold text-neutral-800">YYSSSM-00,000</code><br />
                전체 누적 시작번호: <strong>{settings.codeSettings?.overallCounterOffset ?? 14}</strong>번 (기존 13점 보존)<br />
                상단 [관리자 설정] 버튼을 눌러 전체 누적번호와 연도별 시작번호를 직접 조정할 수 있습니다.
              </p>
            </div>
          )}

          {/* Inquiry Note */}
          <div className="pt-6 border-t border-neutral-200 text-xs text-neutral-400 font-light leading-relaxed">
            전시, 작품 소장, 레지던시 및 아카이브 관련 문의는 위 [고객 문의] 버튼 또는 이메일로 연락 주시면 신속하게 답변해 드립니다.
          </div>
        </div>

        {/* ============================================================ */}
        {/* CUSTOMER INQUIRY POPUP MODAL                                 */}
        {/* ============================================================ */}
        {isInquiryOpen && (
          <div
            id="customer-inquiry-modal"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-neutral-200 pb-4">
                <div>
                  <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block mb-1">
                    Direct Inquiry Form
                  </span>
                  <h3 className="font-serif-title text-xl sm:text-2xl text-neutral-950 font-normal">
                    고객 문의 (Customer Inquiry)
                  </h3>
                  <p className="text-xs text-neutral-500 font-light mt-1">
                    작품 및 전시에 관한 문의를 남겨주시면 관리자 이메일로 즉시 전송됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  id="close-inquiry-modal-btn"
                  onClick={handleCloseInquiryModal}
                  className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Screen: Success */}
              {inquiryStatus === 'success' ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-medium text-neutral-900">
                      문의가 성공적으로 전송되었습니다
                    </h4>
                    <p className="text-xs text-neutral-600 font-light leading-relaxed max-w-sm mx-auto">
                      소중한 문의가 {artist.englishName} ({artist.formattedKoHanja}) 작가 관리자에게 안전하게 접수되었습니다.<br />
                      검토 후 기재해 주신 이메일(<strong>{inquiryEmail}</strong>)로 신속히 회신 드리겠습니다.
                    </p>
                  </div>
                  <div className="pt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetInquiryForm}
                      className="px-4 py-2 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      새로운 문의 작성
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseInquiryModal}
                      className="px-5 py-2 text-xs text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium transition-colors cursor-pointer"
                    >
                      확인 및 닫기
                    </button>
                  </div>
                </div>
              ) : (
                /* Inquiry Form */
                <form onSubmit={handleSendInquiry} className="space-y-4 text-xs">
                  {inquiryStatus === 'error' && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{inquiryFeedback}</span>
                    </div>
                  )}

                  {/* 1. Name */}
                  <div className="space-y-1">
                    <label className="block text-neutral-700 font-medium">
                      성함 / 기관명 (Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="inquiry-name-input"
                      required
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      placeholder="성함 또는 기관·갤러리명을 입력해 주세요"
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/40"
                    />
                  </div>

                  {/* 2. Email */}
                  <div className="space-y-1">
                    <label className="block text-neutral-700 font-medium">
                      회신 받으실 이메일 (Email) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="inquiry-email-input"
                      required
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      placeholder="example@domain.com"
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded text-xs font-mono-code focus:outline-none focus:border-neutral-900 bg-neutral-50/40"
                    />
                  </div>

                  {/* 3. Inquiry Content */}
                  <div className="space-y-1">
                    <label className="block text-neutral-700 font-medium">
                      문의 내용 (Inquiry Message) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="inquiry-message-textarea"
                      required
                      rows={5}
                      value={inquiryMessage}
                      onChange={(e) => setInquiryMessage(e.target.value)}
                      placeholder="관심 있는 작품(작품번호 또는 제목), 전시 기획, 소장 상담, 협업 제안 등 상세한 문의 내용을 입력해 주세요."
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded text-xs leading-relaxed focus:outline-none focus:border-neutral-900 bg-neutral-50/40 font-kr-serif"
                    />
                  </div>

                  {/* Recipient Notice */}
                  <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded text-[11px] text-neutral-500 flex items-center justify-between font-mono-code">
                    <span>수신처: 관리자 전용 사서함</span>
                    <span className="text-neutral-700 font-medium">
                      {settings.inquiryRecipientEmail || settings.contactEmail || 'jinsoop10@gmail.com'}
                    </span>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200">
                    <button
                      type="button"
                      onClick={handleCloseInquiryModal}
                      disabled={isSendingInquiry}
                      className="px-4 py-2 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      id="submit-inquiry-btn"
                      disabled={isSendingInquiry}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isSendingInquiry ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>전송 중...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>문의 전송</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ADMIN EDIT SETTINGS MODAL (Admin only)                       */}
        {/* ============================================================ */}
        {isEditing && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-neutral-700" />
                  <span>연락처 및 관리자 설정 수정</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* 0. Centralized Artist Identity (한 곳에서 수정하면 전체 페이지에 반영) */}
                <div className="p-3.5 bg-neutral-50/90 border border-neutral-200 rounded space-y-3">
                  <div className="text-[11px] font-semibold text-neutral-800 uppercase tracking-wider flex items-center justify-between">
                    <span>작가 기본 정보 (Artist Identity)</span>
                    <span className="text-[10px] font-normal text-neutral-400">※ 포트폴리오 전역 자동 동기화</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">
                        한글명 (Korean)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.artistKoreanName || ''}
                        onChange={(e) => setFormData({ ...formData, artistKoreanName: e.target.value })}
                        placeholder="박진수"
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded font-sans focus:outline-none focus:border-neutral-900 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">
                        한자명 (Hanja)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.artistHanjaName || ''}
                        onChange={(e) => setFormData({ ...formData, artistHanjaName: e.target.value })}
                        placeholder="朴鎭洙"
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded font-kr-serif focus:outline-none focus:border-neutral-900 text-xs bg-white"
                      />
                      <p className="text-[10px] text-amber-700 mt-0.5 font-light">
                        ※ 가운데 한자 반드시 「鎭」
                      </p>
                    </div>
                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">
                        영문명 (English)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.artistEnglishName || ''}
                        onChange={(e) => setFormData({ ...formData, artistEnglishName: e.target.value })}
                        placeholder="PARK JIN SOO"
                        className="w-full px-2.5 py-1.5 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-xs bg-white uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* 1. Public Contact Email */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    공개 연락처 이메일 (Contact Email)
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-xs"
                  />
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    COVER 및 CONTACT 화면에 공개적으로 표시되는 이메일입니다.
                  </p>
                </div>

                {/* 2. Inquiry Recipient Email (고객 문의 수신용 관리자 이메일) */}
                <div className="p-3 bg-neutral-50/80 border border-neutral-200 rounded space-y-1.5">
                  <label className="block text-neutral-800 font-semibold">
                    고객 문의 수신 관리자 이메일 (Inquiry Recipient Email)
                  </label>
                  <input
                    type="email"
                    id="admin-inquiry-recipient-input"
                    value={formData.inquiryRecipientEmail || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, inquiryRecipientEmail: e.target.value })
                    }
                    placeholder="jinsoop10@gmail.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-xs bg-white"
                  />
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    방문객이 [고객 문의]를 통해 입력한 내용이 백엔드를 통해 전달될 관리자 이메일 주소입니다. (기본: jinsoop10@gmail.com)
                  </p>
                </div>

                {/* 3. Website */}
                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    웹사이트 (Website URL)
                  </label>
                  <input
                    type="text"
                    value={formData.websiteUrl || ''}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://parkjinsoo.art"
                    className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-xs"
                  />
                </div>

                {/* 4. Instagram */}
                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    인스타그램 (Instagram)
                  </label>
                  <input
                    type="text"
                    value={formData.instagramUrl || ''}
                    onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                    placeholder="@parkjinsoo.art 또는 URL"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 text-xs"
                  />
                </div>

                {/* 5. Studio / Other Contact */}
                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    작업실 주소 및 기타 연락처 (Studio / Details)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.otherContact || ''}
                    onChange={(e) => setFormData({ ...formData, otherContact: e.target.value })}
                    placeholder="Studio: Seoul, Republic of Korea"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 text-xs"
                  />
                </div>

                {/* 6. Artwork Code Counter Settings */}
                <div className="pt-3 border-t border-neutral-200 space-y-2">
                  <div className="text-neutral-700 font-semibold flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-neutral-600" />
                    <span>신규 작품번호 설정 (YYSSSM-00,000)</span>
                  </div>
                  <div>
                    <label className="block text-neutral-500 font-medium mb-1">
                      전체 누적번호 시작값 (Overall Counter Offset)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.codeSettings?.overallCounterOffset ?? 14}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          codeSettings: {
                            ...(formData.codeSettings || { yearlyCounters: {} }),
                            overallCounterOffset: parseInt(e.target.value, 10) || 14,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-xs"
                    />
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      현재 기본값은 14입니다 (예: 14를 입력하면 다음 번호는 014가 됩니다).
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? '저장 중...' : '저장 완료'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
