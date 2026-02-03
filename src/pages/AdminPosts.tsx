import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Loader2, 
  PlusCircle, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  FileText, 
  Calendar, 
  Image as ImageIcon,
  Sparkles,
  Send,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Post {
  id: string;
  title: string;
  content: string;
  image_url?: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export default function AdminPosts() {
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      if (!isAdmin) {
        navigate('/');
        return;
      }
      fetchPosts();
    }
  }, [user, isLoading, isAdmin]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      toast.error('Không thể tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p?: Post) => {
    if (!p) {
      setEditing(null);
      setTitle('');
      setContent('');
      setImageUrl('');
      setIsPublished(false);
      setShowForm(true);
      return;
    }
    setEditing(p);
    setTitle(p.title);
    setContent(p.content);
    setImageUrl(p.image_url || '');
    setIsPublished(!!p.is_published);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setImageUrl('');
    setIsPublished(false);
    setShowForm(false);
  };

  const sendPostNotification = async (postId: string, postTitle: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-post-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ postId, postTitle }),
        }
      );

      const result = await response.json();
      if (result.success) {
        console.log(`Sent notifications to ${result.count} users`);
      }
    } catch (err) {
      console.error('Error sending notifications:', err);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Tiêu đề và nội dung không được để trống');
      return;
    }
    
    setSaving(true);
    try {
      if (editing) {
        // Check if post is being published for the first time
        const wasPublished = editing.is_published;
        
        const { error } = await supabase
          .from('posts')
          .update({
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl.trim() || null,
            is_published: isPublished,
          })
          .eq('id', editing.id);
        
        if (error) throw error;
        
        // Send notification if just published
        if (!wasPublished && isPublished) {
          await sendPostNotification(editing.id, title.trim());
        }
        
        toast.success('Cập nhật bài viết thành công');
      } else {
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert({
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl.trim() || null,
            is_published: isPublished,
            created_by: user?.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Send notification if published immediately
        if (isPublished && newPost) {
          await sendPostNotification(newPost.id, title.trim());
        }
        
        toast.success('Đăng bài viết thành công');
      }
      
      cancelEdit();
      fetchPosts();
    } catch (err: any) {
      console.error('Error saving post:', err);
      toast.error(err.message || 'Không thể lưu bài viết');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Xóa bài viết thành công');
      fetchPosts();
    } catch (err: any) {
      console.error('Error deleting post:', err);
      toast.error(err.message || 'Không thể xóa bài viết');
    }
  };

  const togglePublish = async (post: Post) => {
    try {
      const newPublishedState = !post.is_published;
      
      const { error } = await supabase
        .from('posts')
        .update({ is_published: newPublishedState })
        .eq('id', post.id);
      
      if (error) throw error;
      
      // Send notification if publishing
      if (newPublishedState) {
        await sendPostNotification(post.id, post.title);
      }
      
      toast.success(post.is_published ? 'Đã ẩn bài viết' : 'Đã xuất bản bài viết');
      fetchPosts();
    } catch (err: any) {
      console.error('Error toggling publish:', err);
      toast.error(err.message || 'Không thể thay đổi trạng thái');
    }
  };

  const publishedCount = posts.filter(p => p.is_published).length;
  const draftCount = posts.filter(p => !p.is_published).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <FileText className="w-6 h-6 text-white" />
              </div>
              Quản lý bài đăng
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Tạo và quản lý bài viết, thông báo cho người dùng
            </p>
          </div>
          <Button 
            onClick={() => startEdit()} 
            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <PlusCircle className="h-4 w-4" />
            Tạo bài viết mới
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="glass border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{posts.length}</p>
                  <p className="text-xs text-muted-foreground">Tổng bài viết</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Eye className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{publishedCount}</p>
                  <p className="text-xs text-muted-foreground">Đã xuất bản</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <EyeOff className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{draftCount}</p>
                  <p className="text-xs text-muted-foreground">Bản nháp</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass border-primary/20">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {editing ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Tiêu đề <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="title"
                    placeholder="Nhập tiêu đề bài viết..." 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content" className="text-sm font-medium">
                    Nội dung <span className="text-destructive">*</span>
                  </Label>
                  <Textarea 
                    id="content"
                    placeholder="Viết nội dung bài viết của bạn... (Hỗ trợ HTML cơ bản: <b>, <i>, <a>, <p>, <br>)" 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    rows={12}
                    className="resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ HTML: &lt;b&gt;, &lt;i&gt;, &lt;a&gt;, &lt;p&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;li&gt;
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image" className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Ảnh bìa (URL)
                  </Label>
                  <Input 
                    id="image"
                    placeholder="https://example.com/image.jpg" 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                  />
                  {imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border">
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-primary" />
                    <div>
                      <Label htmlFor="publish" className="text-sm font-medium cursor-pointer">
                        Xuất bản ngay
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Bật để hiển thị bài viết cho người dùng
                      </p>
                    </div>
                  </div>
                  <Switch 
                    id="publish"
                    checked={isPublished} 
                    onCheckedChange={setIsPublished}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleSave} 
                    className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
                    disabled={saving}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editing ? 'Lưu thay đổi' : 'Đăng bài viết'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} className="px-8">
                    Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Posts List */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Danh sách bài viết
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Đang tải bài viết...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-medium mb-1">Chưa có bài viết nào</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Bắt đầu tạo bài viết đầu tiên của bạn
                </p>
                <Button onClick={() => startEdit()} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Tạo bài viết
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(p => (
                  <div 
                    key={p.id} 
                    className="group relative p-5 rounded-xl bg-gradient-to-r from-secondary/50 to-secondary/30 hover:from-secondary/70 hover:to-secondary/50 transition-all border border-transparent hover:border-primary/20"
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      {p.image_url && (
                        <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={p.image_url} 
                            alt={p.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-lg line-clamp-1">{p.title}</h3>
                              <Badge 
                                variant={p.is_published ? "default" : "secondary"}
                                className={`${p.is_published 
                                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                                  : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                }`}
                              >
                                {p.is_published ? (
                                  <>
                                    <Eye className="h-3 w-3 mr-1" />
                                    Đã xuất bản
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Bản nháp
                                  </>
                                )}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {p.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                            </p>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => togglePublish(p)} 
                              title={p.is_published ? 'Ẩn bài' : 'Xuất bản'}
                              className={p.is_published 
                                ? 'text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10' 
                                : 'text-green-500 hover:text-green-500 hover:bg-green-500/10'
                              }
                            >
                              {p.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => startEdit(p)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDelete(p.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Meta */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(p.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
