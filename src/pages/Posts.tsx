import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Heart, MessageCircle, Send, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Profile {
  display_name: string | null;
}

interface Post {
  id: string;
  title: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  created_by: string | null;
}

interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
}

interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function Posts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Record<string, PostLike[]>>({});
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [submittingLike, setSubmittingLike] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, content, image_url, created_at, created_by')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);

      // Fetch likes and comments for all posts
      if (data && data.length > 0) {
        const postIds = data.map(p => p.id);
        
        // Fetch likes
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('id, post_id, user_id')
          .in('post_id', postIds);
        
        const likesMap: Record<string, PostLike[]> = {};
        likesData?.forEach(like => {
          if (!likesMap[like.post_id]) likesMap[like.post_id] = [];
          likesMap[like.post_id].push(like);
        });
        setLikes(likesMap);

        // Fetch comments
        const { data: commentsData } = await supabase
          .from('post_comments')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true });
        
        const commentsMap: Record<string, PostComment[]> = {};
        commentsData?.forEach(comment => {
          if (!commentsMap[comment.post_id]) commentsMap[comment.post_id] = [];
          commentsMap[comment.post_id].push(comment);
        });
        setComments(commentsMap);

        // Fetch all unique user ids for profiles
        const userIds = new Set<string>();
        data.forEach(p => p.created_by && userIds.add(p.created_by));
        commentsData?.forEach(c => userIds.add(c.user_id));

        if (userIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', Array.from(userIds));
          
          const profilesMap: Record<string, Profile> = {};
          profilesData?.forEach(p => {
            profilesMap[p.user_id] = { display_name: p.display_name };
          });
          setProfiles(profilesMap);
        }
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để thích bài viết');
      navigate('/auth');
      return;
    }

    setSubmittingLike(postId);
    try {
      const postLikes = likes[postId] || [];
      const existingLike = postLikes.find(l => l.user_id === user.id);

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('id', existingLike.id);
        
        if (error) throw error;
        
        setLikes(prev => ({
          ...prev,
          [postId]: prev[postId]?.filter(l => l.id !== existingLike.id) || []
        }));
      } else {
        // Like
        const { data, error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id })
          .select()
          .single();
        
        if (error) throw error;
        
        setLikes(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data]
        }));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      toast.error('Không thể thực hiện thao tác');
    } finally {
      setSubmittingLike(null);
    }
  };

  const handleComment = async (postId: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để bình luận');
      navigate('/auth');
      return;
    }

    const content = newComment[postId]?.trim();
    if (!content) {
      toast.error('Vui lòng nhập nội dung bình luận');
      return;
    }

    setSubmittingComment(postId);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, content })
        .select()
        .single();
      
      if (error) throw error;
      
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data]
      }));
      setNewComment(prev => ({ ...prev, [postId]: '' }));
      setExpandedComments(prev => ({ ...prev, [postId]: true }));
      
      // Add current user to profiles if not exists
      if (!profiles[user.id]) {
        setProfiles(prev => ({
          ...prev,
          [user.id]: { display_name: user.email?.split('@')[0] || 'Người dùng' }
        }));
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      toast.error('Không thể đăng bình luận');
    } finally {
      setSubmittingComment(null);
    }
  };

  const isLikedByUser = (postId: string) => {
    if (!user) return false;
    return (likes[postId] || []).some(l => l.user_id === user.id);
  };

  const getDisplayName = (userId: string | null) => {
    if (!userId) return 'Admin';
    return profiles[userId]?.display_name || 'Người dùng';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            Bài viết
          </h1>

          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Chưa có bài viết nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {posts.map(p => {
                const postLikes = likes[p.id] || [];
                const postComments = comments[p.id] || [];
                const isExpanded = expandedComments[p.id];
                const liked = isLikedByUser(p.id);

                return (
                  <Card key={p.id} className="glass overflow-hidden">
                    {/* Header with author */}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{getDisplayName(p.created_by)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(p.created_at)}
                          </p>
                        </div>
                      </div>
                      <CardTitle className="text-lg mt-3">{p.title}</CardTitle>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* Image */}
                      {p.image_url && (
                        <img 
                          src={p.image_url} 
                          alt={p.title} 
                          className="w-full h-auto rounded-lg mb-4 max-h-96 object-cover"
                        />
                      )}
                      
                      {/* Content */}
                      <div 
                        className="prose prose-invert max-w-full text-sm mb-4" 
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(p.content, {
                            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'span', 'div'],
                            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
                            ALLOW_DATA_ATTR: false,
                          }) 
                        }} 
                      />

                      {/* Like & Comment Buttons */}
                      <div className="flex items-center gap-4 pt-3 border-t border-border">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`gap-2 ${liked ? 'text-pink-500 hover:text-pink-600' : 'text-muted-foreground hover:text-pink-500'}`}
                          onClick={() => handleLike(p.id)}
                          disabled={submittingLike === p.id}
                        >
                          {submittingLike === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                          )}
                          {postLikes.length > 0 && postLikes.length}
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-2 text-muted-foreground hover:text-primary"
                          onClick={() => setExpandedComments(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        >
                          <MessageCircle className="h-4 w-4" />
                          {postComments.length > 0 && postComments.length}
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      </div>

                      {/* Comments Section */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border space-y-4">
                          {/* Comment List */}
                          {postComments.length > 0 && (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {postComments.map(comment => (
                                <div key={comment.id} className="flex gap-3">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarFallback className="bg-secondary text-xs">
                                      <User className="h-3 w-3" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-secondary/50 rounded-lg px-3 py-2">
                                      <p className="text-xs font-medium text-primary">
                                        {getDisplayName(comment.user_id)}
                                      </p>
                                      <p className="text-sm break-words">{comment.content}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatDate(comment.created_at)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comment Input */}
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Viết bình luận..."
                              value={newComment[p.id] || ''}
                              onChange={(e) => setNewComment(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className="min-h-[60px] resize-none text-sm"
                              rows={2}
                            />
                            <Button 
                              size="icon"
                              onClick={() => handleComment(p.id)}
                              disabled={submittingComment === p.id || !newComment[p.id]?.trim()}
                              className="flex-shrink-0"
                            >
                              {submittingComment === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
