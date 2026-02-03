import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, X, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export default function AdminCategories() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'code'
  });

  const iconOptions = ['code', 'bot', 'globe', 'gamepad', 'tool'];

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchCategories();
    }
  }, [isAdmin]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Lỗi khi tải danh mục');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name,
            description: formData.description || null,
            icon: formData.icon
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Đã cập nhật danh mục');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name,
            description: formData.description || null,
            icon: formData.icon
          });

        if (error) throw error;
        toast.success('Đã thêm danh mục mới');
      }

      resetForm();
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error.code === '23505') {
        toast.error('Tên danh mục đã tồn tại');
      } else {
        toast.error('Lỗi khi lưu danh mục');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'code'
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa danh mục này?')) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Đã xóa danh mục');
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Lỗi khi xóa danh mục');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', icon: 'code' });
    setEditingId(null);
    setShowForm(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-primary" />
              Quản lý danh mục
            </h1>
            <p className="text-muted-foreground mt-1">
              Thêm, sửa, xóa danh mục sản phẩm
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Quản lý sản phẩm
            </Button>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Thêm danh mục
            </Button>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                </h2>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Tên danh mục *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: bot zalo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Mô tả</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="VD: làm về bot tự động zalo"
                  />
                </div>

                <div>
                  <Label>Icon</Label>
                  <div className="flex gap-2 mt-2">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          formData.icon === icon
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Hủy
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Categories Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium">Tên danh mục</th>
                  <th className="px-6 py-4 text-left text-sm font-medium">Mô tả</th>
                  <th className="px-6 py-4 text-left text-sm font-medium">Icon</th>
                  <th className="px-6 py-4 text-right text-sm font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{category.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {category.description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                        {category.icon || 'code'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(category.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Chưa có danh mục nào
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
