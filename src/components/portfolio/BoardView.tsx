import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BoardPost, BoardPostStatus, SiteSettings } from '../../types';
import {
  fetchBoardPostsFromFirestore,
  saveBoardPostToFirestore,
  updateBoardPostStatusInFirestore,
  deleteBoardPostFromFirestore,
} from '../../services/firestoreService';
import {
  uploadBoardImage,
  uploadBoardVideo,
} from '../../services/storageService';
import {
  PenLine,
  Image as ImageIcon,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit,
  ArrowLeft,
  Upload,
  X,
  ExternalLink,
  ChevronRight,
  ZoomIn,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Lock,
} from 'lucide-react';

interface BoardViewProps {
  isAdmin?: boolean;
  settings?: SiteSettings;
  onOpenAuthModal?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  isAdmin = false,
  settings,
  onOpenAuthModal,
}) => {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | BoardPostStatus>('ALL');
  const [page, setPage] = useState<number>(1);
  const POSTS_PER_PAGE = 9;

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Visitor feedback message
  const [visitorNotice, setVisitorNotice] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formAuthorName, setFormAuthorName] = useState<string>('');
  const [formCoverImage, setFormCoverImage] = useState<string>('');
  const [formImageUrls, setFormImageUrls] = useState<string[]>([]);
  const [formVideoUrls, setFormVideoUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Load Posts from Firestore
  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBoardPostsFromFirestore(isAdmin);
      setPosts(data);
    } catch (err) {
      console.error('[BoardView] Failed to load posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [isAdmin]);

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    if (!isAdmin) {
      // General visitors only see published posts
      return posts.filter((p) => p.status === 'published');
    }
    if (statusFilter === 'ALL') return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, isAdmin, statusFilter]);

  // Counts for Admin Tabs
  const counts = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === 'published').length;
    const pending = posts.filter((p) => p.status === 'pending').length;
    const rejected = posts.filter((p) => p.status === 'rejected').length;
    return { total, published, pending, rejected };
  }, [posts]);

  // Paginated Posts
  const displayedPosts = useMemo(() => {
    return filteredPosts.slice(0, page * POSTS_PER_PAGE);
  }, [filteredPosts, page]);

  const hasMore = displayedPosts.length < filteredPosts.length;

  // Open Editor for New Post
  const handleOpenNewPost = () => {
    setEditingPost(null);
    setFormTitle('');
    setFormContent('');
    setFormAuthorName(isAdmin ? (settings?.artistEnglishName || 'PARK JIN SOO') : '');
    setFormCoverImage('');
    setFormImageUrls([]);
    setFormVideoUrls([]);
    setIsEditorOpen(true);
  };

  // Open Editor for Existing Post (Admin only)
  const handleOpenEditPost = (post: BoardPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormAuthorName(post.authorName);
    setFormCoverImage(post.coverImage || '');
    setFormImageUrls(post.imageUrls || []);
    setFormVideoUrls(post.videoUrls || []);
    setIsEditorOpen(true);
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const tempId = editingPost?.id || `post_${Date.now()}`;
    setUploadProgressText(`사진 ${files.length}장 업로드 중...`);

    const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgressText(`사진 업로드 중 (${i + 1}/${files.length})...`);
        const url = await uploadBoardImage(tempId, file);
        newUrls.push(url);
      }
      setFormImageUrls((prev) => {
        const updated = [...prev, ...newUrls];
        if (!formCoverImage && updated.length > 0) {
          setFormCoverImage(updated[0]);
        }
        return updated;
      });
    } catch (err: any) {
      alert(`사진 업로드 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Video Upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // Check file size (recommend under 50MB)
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 50) {
      const confirmLarge = window.confirm(
        `선택하신 동영상 파일 크기는 약 ${sizeInMB.toFixed(1)}MB 입니다.\n50MB 이상의 파일은 재생 및 업로드 시 지연될 수 있습니다. 계속 업로드하시겠습니까?`
      );
      if (!confirmLarge) {
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }
    }

    const tempId = editingPost?.id || `post_${Date.now()}`;
    setUploadProgressText('동영상 업로드 중 (잠시만 기다려주세요)...');

    try {
      const url = await uploadBoardVideo(tempId, file);
      setFormVideoUrls((prev) => [...prev, url]);
    } catch (err: any) {
      alert(`동영상 업로드 실패: ${err?.message || err}`);
    } finally {
      setUploadProgressText('');
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Submit Post
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('제목을 입력해 주세요.');
      return;
    }
    if (!formContent.trim()) {
      alert('본문 내용을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const isNew = !editingPost;
      const postId = editingPost?.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Status determination:
      // - If admin is creating or editing: keep existing or default to 'published'
      // - If visitor: ALWAYS 'pending', isAdminPost: false
      let postStatus: BoardPostStatus = 'pending';
      let postIsAdminPost = false;

      if (isAdmin) {
        postStatus = editingPost ? editingPost.status : 'published';
        postIsAdminPost = true;
      } else {
        postStatus = 'pending';
        postIsAdminPost = false;
      }

      // Determine cover image
      let finalCover = formCoverImage.trim();
      if (!finalCover && formImageUrls.length > 0) {
        finalCover = formImageUrls[0];
      }

      const postData: BoardPost = {
        id: postId,
        title: formTitle.trim(),
        content: formContent.trim(),
        coverImage: finalCover || undefined,
        imageUrls: formImageUrls,
        videoUrls: formVideoUrls,
        createdAt: editingPost ? editingPost.createdAt : now,
        updatedAt: now,
        status: postStatus,
        authorName: formAuthorName.trim() || (isAdmin ? 'PARK JIN SOO' : '방문자'),
        isAdminPost: postIsAdminPost,
      };

      await saveBoardPostToFirestore(postData);

      setIsEditorOpen(false);
      await loadPosts();

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(postData);
      }

      if (!isAdmin) {
        setVisitorNotice('게시물이 관리자 승인 대기 중입니다. 관리자 확인 후 공개됩니다.');
        setTimeout(() => setVisitorNotice(null), 8000);
      }
    } catch (err: any) {
      console.error('[BoardView] Save failed:', err);
      alert(`게시물 저장 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change (Admin only)
  const handleStatusChange = async (postId: string, newStatus: BoardPostStatus) => {
    if (!isAdmin) return;
    try {
      await updateBoardPostStatusInFirestore(postId, newStatus);
      await loadPosts();
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      alert(`상태 변경 실패: ${err?.message || err}`);
    }
  };

  // Delete Post (Admin only)
  const handleDeletePost = async (postId: string) => {
    if (!isAdmin) return;
    const confirmDelete = window.confirm('정말 이 게시물을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.');
    if (!confirmDelete) return;

    try {
      await deleteBoardPostFromFirestore(postId);
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(null);
      }
      await loadPosts();
    } catch (err: any) {
      alert(`게시물 삭제 실패: ${err?.message || err}`);
    }
  };

  // Date Formatter
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="board-view-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Visitor Success Banner */}
      {visitorNotice && (
        <div
          id="board-visitor-notice-banner"
          className="mb-8 p-4 bg-amber-50 border border-amber-200/80 rounded-sm text-amber-950 flex items-start gap-3 shadow-xs animate-in fade-in"
        >
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-amber-900 mb-0.5">게시물 등록 완료</p>
            <p>{visitorNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setVisitorNotice(null)}
            className="ml-auto text-amber-600 hover:text-amber-900 p-1"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DETAIL VIEW */}
      {selectedPost ? (
        <div id="board-detail-container" className="max-w-4xl mx-auto animate-in fade-in duration-200">
          {/* Back button & Action Bar */}
          <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-200">
            <button
              type="button"
              id="board-detail-back-btn"
              onClick={() => setSelectedPost(null)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium tracking-wider text-neutral-600 hover:text-neutral-950 uppercase transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>목록으로 돌아가기</span>
            </button>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="board-detail-edit-btn"
                  onClick={() => handleOpenEditPost(selectedPost)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>수정</span>
                </button>
                <button
                  type="button"
                  id="board-detail-delete-btn"
                  onClick={() => handleDeletePost(selectedPost.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 rounded-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              </div>
            )}
          </div>

          {/* Admin Approval Control Bar */}
          {isAdmin && (
            <div
              id="board-admin-approval-bar"
              className="mb-8 p-4 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  게시물 상태:
                </span>
                {selectedPost.status === 'published' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 공개 (Published)
                  </span>
                )}
                {selectedPost.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                    <Clock className="w-3.5 h-3.5" /> 승인 대기 (Pending)
                  </span>
                )}
                {selectedPost.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-800 rounded-full">
                    <XCircle className="w-3.5 h-3.5" /> 반려 (Rejected)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedPost.status !== 'published' && (
                  <button
                    type="button"
                    id="board-approve-post-btn"
                    onClick={() => handleStatusChange(selectedPost.id, 'published')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-xs hover:bg-emerald-800 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>게시물 승인 (공개)</span>
                  </button>
                )}
                {selectedPost.status !== 'rejected' && (
                  <button
                    type="button"
                    id="board-reject-post-btn"
                    onClick={() => handleStatusChange(selectedPost.id, 'rejected')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-neutral-700 text-white rounded-xs hover:bg-neutral-800 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>게시물 반려</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Post Header */}
          <header className="mb-8">
            <h1
              id="board-detail-title"
              className="text-2xl sm:text-3xl font-serif font-light text-neutral-950 tracking-tight leading-snug mb-4"
            >
              {selectedPost.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-neutral-500 border-b border-neutral-100 pb-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                {selectedPost.authorName}
                {selectedPost.isAdminPost && (
                  <span className="text-[10px] uppercase tracking-wider bg-neutral-900 text-white px-1.5 py-0.2 rounded-xs ml-1">
                    ARTIST
                  </span>
                )}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {formatDate(selectedPost.createdAt)}
              </span>
              {selectedPost.imageUrls?.length > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
                    사진 {selectedPost.imageUrls.length}장
                  </span>
                </>
              )}
              {selectedPost.videoUrls?.length > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-neutral-400" />
                    동영상 {selectedPost.videoUrls.length}개
                  </span>
                </>
              )}
            </div>
          </header>

          {/* Videos Section (if any) */}
          {selectedPost.videoUrls && selectedPost.videoUrls.length > 0 && (
            <div className="mb-10 space-y-6">
              {selectedPost.videoUrls.map((videoUrl, vIdx) => (
                <div key={vIdx} className="overflow-hidden rounded-xs border border-neutral-200 bg-black shadow-sm">
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="w-full max-h-[500px] object-contain mx-auto"
                  >
                    브라우저가 동영상 재생을 지원하지 않습니다.
                  </video>
                </div>
              ))}
            </div>
          )}

          {/* Post Body Content */}
          <div
            id="board-detail-content"
            className="text-neutral-800 text-base sm:text-[17px] leading-relaxed font-serif whitespace-pre-line mb-12 space-y-4"
          >
            {selectedPost.content}
          </div>

          {/* Photos Gallery */}
          {selectedPost.imageUrls && selectedPost.imageUrls.length > 0 && (
            <div id="board-detail-photos" className="mt-10 pt-8 border-t border-neutral-200 space-y-6">
              <h2 className="text-xs uppercase tracking-[0.2em] font-semibold text-neutral-500 mb-4">
                ATTACHED PHOTOS ({selectedPost.imageUrls.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPost.imageUrls.map((imgUrl, imgIdx) => (
                  <div
                    key={imgIdx}
                    onClick={() => setLightboxImage(imgUrl)}
                    className="group relative cursor-pointer overflow-hidden rounded-xs border border-neutral-200 bg-neutral-100 aspect-4/3 flex items-center justify-center"
                  >
                    <img
                      src={imgUrl}
                      alt={`${selectedPost.title} - ${imgIdx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-neutral-900 text-xs px-2.5 py-1 rounded-xs inline-flex items-center gap-1 shadow-sm font-medium">
                        <ZoomIn className="w-3.5 h-3.5" /> 크게 보기
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW */
        <div>
          {/* Header Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 mb-8 border-b border-neutral-200/90">
            <div>
              <span className="text-[11px] uppercase tracking-[0.28em] font-semibold text-neutral-400 block mb-1">
                STUDIO JOURNAL & EXHIBITION ARCHIVE
              </span>
              <h1 className="text-3xl sm:text-4xl font-serif font-light text-neutral-950 tracking-tight">
                BOARD
              </h1>
              <p className="mt-2 text-sm text-neutral-600 max-w-2xl font-light leading-relaxed">
                작가 박진수의 작업 과정, 신작 준비, 전시회 관람 및 일상의 사유를 기록하는 공간입니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                id="board-write-post-btn"
                onClick={handleOpenNewPost}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-950 text-white text-xs sm:text-sm font-medium tracking-wider uppercase rounded-xs hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <PenLine className="w-4 h-4" />
                <span>글 작성</span>
              </button>
            </div>
          </div>

          {/* Admin Status Tabs */}
          {isAdmin && (
            <div
              id="board-admin-status-tabs"
              className="flex items-center gap-2 mb-8 pb-3 border-b border-neutral-100 overflow-x-auto no-scrollbar"
            >
              <button
                type="button"
                id="board-tab-all"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                전체 ({counts.total})
              </button>
              <button
                type="button"
                id="board-tab-published"
                onClick={() => setStatusFilter('published')}
                className={`px-3 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
                  statusFilter === 'published'
                    ? 'bg-emerald-800 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                공개 ({counts.published})
              </button>
              <button
                type="button"
                id="board-tab-pending"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap relative ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                승인 대기 ({counts.pending})
                {counts.pending > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                )}
              </button>
              <button
                type="button"
                id="board-tab-rejected"
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
                  statusFilter === 'rejected'
                    ? 'bg-neutral-700 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                반려 ({counts.rejected})
              </button>
            </div>
          )}

          {/* Posts Grid */}
          {isLoading ? (
            <div className="py-20 text-center text-neutral-400">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full mb-3" />
              <p className="text-xs uppercase tracking-widest font-mono">게시물을 불러오는 중...</p>
            </div>
          ) : displayedPosts.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-neutral-200 rounded-sm">
              <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 text-sm font-medium mb-1">등록된 게시물이 없습니다.</p>
              <p className="text-neutral-400 text-xs">작가의 새로운 기록과 소식이 곧 등록될 예정입니다.</p>
              <button
                type="button"
                onClick={handleOpenNewPost}
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 text-xs font-medium tracking-wider uppercase text-neutral-800 hover:bg-neutral-50 rounded-xs"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>첫 게시물 작성하기</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {displayedPosts.map((post) => {
                const cover = post.coverImage || (post.imageUrls && post.imageUrls[0]) || null;
                return (
                  <article
                    key={post.id}
                    id={`board-card-${post.id}`}
                    onClick={() => setSelectedPost(post)}
                    className="group cursor-pointer flex flex-col bg-white border border-neutral-200/90 rounded-xs overflow-hidden hover:border-neutral-900/40 hover:shadow-md transition-all duration-200"
                  >
                    {/* Cover Image or Editorial Fallback */}
                    <div className="relative aspect-16/10 bg-neutral-100 overflow-hidden">
                      {cover ? (
                        <img
                          src={cover}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 text-neutral-400">
                          <FileText className="w-8 h-8 mb-2 stroke-[1.5] text-neutral-300" />
                          <span className="text-[10px] tracking-[0.2em] uppercase font-mono">STUDIO LOG</span>
                        </div>
                      )}

                      {/* Admin Status Pill */}
                      {isAdmin && (
                        <div className="absolute top-2.5 left-2.5">
                          {post.status === 'published' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-600/90 backdrop-blur-xs text-white rounded-xs">
                              공개
                            </span>
                          )}
                          {post.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-amber-500/95 backdrop-blur-xs text-white rounded-xs">
                              승인 대기
                            </span>
                          )}
                          {post.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-neutral-700/90 backdrop-blur-xs text-white rounded-xs">
                              반려
                            </span>
                          )}
                        </div>
                      )}

                      {/* Media Badges */}
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                        {post.imageUrls && post.imageUrls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded-xs backdrop-blur-xs">
                            <ImageIcon className="w-3 h-3" />
                            {post.imageUrls.length}
                          </span>
                        )}
                        {post.videoUrls && post.videoUrls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded-xs backdrop-blur-xs">
                            <Video className="w-3 h-3" />
                            {post.videoUrls.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Meta */}
                        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                          <span className="font-mono">{formatDate(post.createdAt)}</span>
                          <span className="text-[11px] font-medium text-neutral-600">
                            {post.authorName}
                            {post.isAdminPost && ' (작가)'}
                          </span>
                        </div>

                        {/* Title */}
                        <h2 className="text-base sm:text-lg font-serif font-medium text-neutral-900 group-hover:text-neutral-950 transition-colors line-clamp-2 leading-snug mb-2.5">
                          {post.title}
                        </h2>

                        {/* Excerpt */}
                        <p className="text-xs sm:text-sm text-neutral-600 line-clamp-3 leading-relaxed font-light">
                          {post.content}
                        </p>
                      </div>

                      {/* Footer Read More */}
                      <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                        <span className="font-serif italic text-neutral-400 text-[11px]">기록 읽기</span>
                        <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="mt-12 text-center">
              <button
                type="button"
                id="board-load-more-btn"
                onClick={() => setPage((prev) => prev + 1)}
                className="px-8 py-3 text-xs sm:text-sm font-medium tracking-[0.16em] uppercase border border-neutral-300 text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white rounded-xs transition-colors"
              >
                더보기 ({displayedPosts.length} / {filteredPosts.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT POST MODAL */}
      {isEditorOpen && (
        <div
          id="board-editor-modal-overlay"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            id="board-editor-modal"
            className="bg-white rounded-xs max-w-2xl w-full my-8 shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50/70">
              <div>
                <h3 className="text-base font-serif font-medium text-neutral-900">
                  {editingPost ? '게시물 수정' : '새 게시물 작성'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isAdmin
                    ? '관리자 권한으로 작성된 글은 즉시 [공개] 상태로 등록됩니다.'
                    : '방문자가 작성한 글은 작가 승인 후 [공개] 상태로 전환됩니다.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsEditorOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notice Banner */}
            {!isAdmin && (
              <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  작성하신 게시물은 스팸 방지 및 아카이브 품질 유지를 위해 <strong>관리자 승인 대기</strong> 상태로
                  저장되며, 작가의 검토 후 사이트에 공개됩니다.
                </p>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmitPost} className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="board-form-title-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="제목을 입력하세요 (예: 캔버스 작업 과정, 전시 관람 후기)"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-xs focus:outline-hidden focus:border-neutral-900 transition-colors"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  작성자 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="board-form-author-input"
                  value={formAuthorName}
                  onChange={(e) => setFormAuthorName(e.target.value)}
                  placeholder="작성자 이름 또는 닉네임"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-xs focus:outline-hidden focus:border-neutral-900 transition-colors"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  본문 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="board-form-content-input"
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="작업에 대한 생각, 제작 과정, 전시 관람 소감 등을 자유롭게 기록해 주세요."
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-xs focus:outline-hidden focus:border-neutral-900 transition-colors leading-relaxed"
                />
              </div>

              {/* Photos Attachment */}
              <div className="pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-neutral-500" />
                    <span>사진 첨부 (다중 선택 가능)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || !!uploadProgressText}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs border border-neutral-300 rounded-xs hover:bg-neutral-50 text-neutral-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>사진 추가</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Upload Progress Indicator */}
                {uploadProgressText && (
                  <div className="p-2.5 bg-neutral-50 text-xs text-neutral-700 rounded-xs flex items-center gap-2 mb-3">
                    <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                    <span>{uploadProgressText}</span>
                  </div>
                )}

                {/* Photo Previews */}
                {formImageUrls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2">
                    {formImageUrls.map((url, idx) => {
                      const isCover = formCoverImage === url;
                      return (
                        <div
                          key={idx}
                          className={`relative group rounded-xs overflow-hidden border aspect-square bg-neutral-100 ${
                            isCover ? 'border-neutral-900 ring-2 ring-neutral-900' : 'border-neutral-200'
                          }`}
                        >
                          <img src={url} alt={`첨부사진 ${idx + 1}`} className="w-full h-full object-cover" />
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => {
                              setFormImageUrls((prev) => prev.filter((_, i) => i !== idx));
                              if (formCoverImage === url) {
                                setFormCoverImage('');
                              }
                            }}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                            title="사진 삭제"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {/* Cover Image Tag / Selector */}
                          <button
                            type="button"
                            onClick={() => setFormCoverImage(url)}
                            className={`absolute bottom-1 left-1 right-1 text-[10px] py-0.5 rounded-xs transition-colors font-medium text-center ${
                              isCover
                                ? 'bg-neutral-900 text-white'
                                : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            {isCover ? '대표 이미지' : '대표로 설정'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Video Attachment */}
              <div className="pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-neutral-500" />
                    <span>동영상 첨부</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isSubmitting || !!uploadProgressText}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs border border-neutral-300 rounded-xs hover:bg-neutral-50 text-neutral-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>동영상 선택</span>
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mb-2">
                  원활한 업로드 및 스트리밍 재생을 위해 50MB 이하의 MP4 동영상을 권장합니다.
                </p>

                {formVideoUrls.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {formVideoUrls.map((vUrl, vIdx) => (
                      <div
                        key={vIdx}
                        className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-xs text-xs"
                      >
                        <span className="truncate max-w-[80%] font-mono text-neutral-700">
                          동영상 첨부 #{vIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormVideoUrls((prev) => prev.filter((_, i) => i !== vIdx))}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="동영상 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  id="board-form-submit-btn"
                  disabled={isSubmitting || !!uploadProgressText}
                  className="px-6 py-2 text-xs sm:text-sm font-medium tracking-wider uppercase bg-neutral-950 text-white rounded-xs hover:bg-neutral-800 disabled:bg-neutral-400 transition-colors shadow-xs"
                >
                  {isSubmitting
                    ? '저장 중...'
                    : isAdmin
                    ? '게시물 등록 (즉시 공개)'
                    : '게시물 등록 (승인 대기)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          id="board-lightbox-modal"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="닫기"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Enlarged photo"
            className="max-w-full max-h-[90vh] object-contain rounded-xs shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
