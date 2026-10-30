// Tùng: tải lại quyền và dữ liệu thật cho trang chi tiết, không dùng snapshot thẻ chat.
import { useCallback, useEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import PostDetailContent from '../components/PostDetailContent/PostDetailContent';
import ReportDialog from '../components/ReportDialog/ReportDialog';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import chatbotService from '../services/chatbot.service';
import postService from '../services/post.service';
import { AUTH_TOKEN_KEY } from '../services/api';
import { postDetailBack } from '../utils/postDetailNavigation';
import styles from './PostDetailPage.module.css';

export default function PostDetailPage({ postId, user }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [voting, setVoting] = useState(false);
  const votingRef = useRef(false);
  const viewerRef = useRef(null);
  const identity = `${user.id}:${postId}`;
  if (!viewerRef.current || viewerRef.current.identity !== identity) viewerRef.current = { identity, active: true, token: localStorage.getItem(AUTH_TOKEN_KEY) };
  const context = viewerRef.current;
  const isViewerCurrent = useCallback((value) => viewerRef.current === value && value.active
    && localStorage.getItem(AUTH_TOKEN_KEY) === value.token, []);
  const updateCount = useCallback((id, count) => {
    if (isViewerCurrent(context)) setPost((value) => value?.id === id ? { ...value, commentCount: count } : value);
  }, [context, isViewerCurrent]);

  useEffect(() => {
    const controller = new AbortController();
    context.active = true;
    setPost(null);
    setError('');
    setLoading(true);
    chatbotService.getMemberPost(postId, { signal: controller.signal }).then(({ post: value }) => {
      if (!isViewerCurrent(context) || controller.signal.aborted) return;
      if (!value || String(value.id) !== String(postId)) throw new Error('Bài viết không còn khả dụng.');
      setPost(value);
    }).catch((err) => {
      if (isViewerCurrent(context) && !controller.signal.aborted) setError(err.message || 'Chưa thể tải bài viết.');
    }).finally(() => { if (isViewerCurrent(context) && !controller.signal.aborted) setLoading(false); });
    return () => { context.active = false; controller.abort(); };
  }, [postId, context, isViewerCurrent]);

  const vote = async (value) => {
    if (votingRef.current) return;
    votingRef.current = true;
    setVoting(true);
    try {
      const result = await postService.toggleVote(value.id);
      if (isViewerCurrent(context)) setPost((current) => current?.id === value.id
        ? { ...current, isVoted: result.voted, voteCount: result.voteCount } : current);
    } catch (err) { if (isViewerCurrent(context)) setError(err.message || 'Chưa thể thích bài viết.'); }
    finally { votingRef.current = false; if (isViewerCurrent(context)) setVoting(false); }
  };
  const report = async ({ reasonCode, reasonText }) => {
    const currentTarget = target;
    try {
      await postService.report({ targetType: currentTarget.type, targetId: currentTarget.id, reasonCode, reasonText });
    } catch (err) {
      if (isViewerCurrent(context) && err.status === 409 && currentTarget.type === 'post') {
        setPost((current) => current && { ...current, hasReported: true });
      }
      throw err;
    }
    if (!isViewerCurrent(context)) throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại bài viết.');
    if (currentTarget.type === 'post') setPost((current) => current && { ...current, hasReported: true, status: 'reported' });
  };

  return (
    <MemberNavigationLayout>
      <main className={styles.page}>
        <Button as="a" href={postDetailBack(postId)} variant="outline" icon="arrow-left">Quay lại</Button>
        {error && <Notice tone="alert">{error}</Notice>}
        {(post || loading) && <section className={styles.article}>
          {post && <h1>{post.title}</h1>}
          <PostDetailContent post={post} loading={loading} user={user}
            isMine={String(post?.author?.id) === String(user.id)} onVote={vote} onReport={setTarget} readOnly={voting}
            onCommentCountChange={updateCount} viewerContext={context} isViewerCurrent={isViewerCurrent} />
        </section>}
        <ReportDialog open={Boolean(target)} targetType={target?.type} targetTitle={target?.title}
          onSubmit={report} onClose={() => setTarget(null)} />
      </main>
    </MemberNavigationLayout>
  );
}
