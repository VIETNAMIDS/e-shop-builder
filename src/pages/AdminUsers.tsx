import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Trash2, Users, Shield, User, ShieldPlus, ShieldMinus, Loader2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { adminUsersApi, verifyAdminApi } from '@/hooks/useAdminApi';
import { supabase } from '@/integrations/supabase/client';

interface UserWithRoles {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  email?: string;
  roles: string[];
  isAdmin: boolean;
  isRootAdmin?: boolean;
  isSeller?: boolean;
}

export default function AdminUsers() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [isRootAdmin, setIsRootAdmin] = useState(false);

  // Verify admin via backend - SECURE
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      const isAdmin = await verifyAdminApi();
      if (!isAdmin) {
        toast.error('Không có quyền truy cập');
        navigate('/');
        return;
      }

      setIsVerifiedAdmin(true);
    };

    if (!isLoading) {
      verifyAdmin();
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (isVerifiedAdmin) {
      fetchUsers();
    }
  }, [isVerifiedAdmin]);

  // Removed auto-ensure logic to prevent errors when root admin email doesn't exist yet

  // Use backend API to fetch users - SECURE
  const fetchUsers = async () => {
    try {
      const result = await adminUsersApi.list();
      setUsers(result.data || []);
      setIsRootAdmin(result.currentUserIsRootAdmin || false);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Ensure root admin has admin role
  const handleEnsureRootAdmin = async () => {
    try {
      // Call function endpoint directly
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'ensureRootAdmin', data: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');

      toast.success('Đã đảm bảo Admin Gốc có quyền admin');
      fetchUsers();
    } catch (err: any) {
      console.error('Error ensuring root admin:', err);
      toast.error(err?.message || 'Không thể đảm bảo Admin Gốc');
    }
  };

  // Use backend API to delete user - SECURE
  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) {
      toast.error('Không thể xóa tài khoản của chính bạn');
      return;
    }

    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;

    setDeleting(userId);
    try {
      await adminUsersApi.deleteUser(userId);
      toast.success('Đã xóa người dùng thành công');
      setUsers(users.filter(u => u.user_id !== userId));
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi khi xóa người dùng';
      toast.error(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  // Use backend API to toggle admin - SECURE
  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (userId === user?.id) {
      toast.error('Không thể thay đổi vai trò của chính bạn');
      return;
    }

    const action = isCurrentlyAdmin ? 'xóa quyền admin của' : 'thêm quyền admin cho';

    if (!confirm(`Bạn có chắc muốn ${action} người dùng này?`)) return;

    setTogglingAdmin(userId);
    try {
      if (isCurrentlyAdmin) {
        await adminUsersApi.removeAdmin(userId);
        toast.success('Đã xóa quyền admin');
      } else {
        await adminUsersApi.addAdmin(userId);
        toast.success('Đã thêm quyền admin');
      }
      
      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, isAdmin: !isCurrentlyAdmin } : u
      ));
    } catch (error: unknown) {
      console.error('Error toggling admin:', error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi khi thay đổi vai trò';
      toast.error(errorMessage);
    } finally {
      setTogglingAdmin(null);
    }
  };

  // Use backend API to add/remove seller - SECURE
  const handleToggleSeller = async (userId: string, isCurrentlySeller: boolean) => {
    if (!confirm(`Bạn có chắc muốn ${isCurrentlySeller ? 'gỡ seller cho' : 'thêm seller cho'} người dùng này?`)) return;

    setTogglingAdmin(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const action = isCurrentlySeller ? 'removeSeller' : 'addSeller';
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, data: { userId } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');

      toast.success(isCurrentlySeller ? 'Đã gỡ seller' : 'Đã thêm seller');
      setUsers(users.map(u =>
        u.user_id === userId ? { ...u, isSeller: !isCurrentlySeller } : u
      ));
    } catch (error: unknown) {
      console.error('Error toggling seller:', error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi khi thay đổi seller';
      toast.error(errorMessage);
    } finally {
      setTogglingAdmin(null);
    }
  };

  if (isLoading || !isVerifiedAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Users className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
              Quản lý người dùng
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Xem và quản lý tài khoản người dùng
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Quản lý sản phẩm
            </Button>
            {isRootAdmin && (
              <Button variant="default" size="sm" onClick={handleEnsureRootAdmin}>
                Đảm bảo Admin Gốc
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-0 sm:rounded-xl sm:border sm:border-border sm:overflow-hidden">
            {/* Mobile cards / Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium">Người dùng</th>
                    <th className="px-6 py-4 text-left text-sm font-medium">Vai trò</th>
                    <th className="px-6 py-4 text-left text-sm font-medium">Ngày đăng ký</th>
                    <th className="px-6 py-4 text-right text-sm font-medium">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            u.isRootAdmin ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-primary/20'
                          }`}>
                            {u.isRootAdmin ? (
                              <Crown className="w-5 h-5 text-white" />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {u.display_name || 'Chưa đặt tên'}
                              {u.isRootAdmin && (
                                <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                  ROOT
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email || u.user_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          u.isRootAdmin
                            ? 'bg-gradient-to-r from-yellow-400/20 to-orange-500/20 text-orange-500'
                            : u.isAdmin
                              ? 'bg-yellow-500/20 text-yellow-500' 
                              : 'bg-primary/20 text-primary'
                        }`}>
                          {u.isRootAdmin ? <Crown className="w-3 h-3" /> : u.isAdmin && <Shield className="w-3 h-3" />}
                          {u.isRootAdmin ? 'Admin Gốc' : u.isAdmin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Only show admin toggle if current user is root admin and target is not root admin */}
                          {isRootAdmin && !u.isRootAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAdmin(u.user_id, u.isAdmin)}
                              disabled={togglingAdmin === u.user_id || u.user_id === user?.id}
                              className={u.isAdmin
                                ? 'text-orange-500 hover:text-orange-500 hover:bg-orange-500/10' 
                                : 'text-green-500 hover:text-green-500 hover:bg-green-500/10'}
                              title={u.isAdmin ? 'Xóa quyền admin' : 'Thêm quyền admin'}
                            >
                              {togglingAdmin === u.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : u.isAdmin ? (
                                <ShieldMinus className="w-4 h-4" />
                              ) : (
                                <ShieldPlus className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {/* Root admin can add/remove seller */}
                          {isRootAdmin && !u.isRootAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleSeller(u.user_id, !!u.isSeller)}
                              disabled={togglingAdmin === u.user_id || u.user_id === user?.id}
                              className={u.isSeller
                                ? 'text-indigo-500 hover:text-indigo-500 hover:bg-indigo-500/10'
                                : 'text-blue-500 hover:text-blue-500 hover:bg-blue-500/10'}
                              title={u.isSeller ? 'Gỡ seller' : 'Thêm seller'}
                            >
                              {togglingAdmin === u.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : u.isSeller ? (
                                <User className="w-4 h-4" />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {/* Show delete button if: root admin can delete anyone except self and root, non-root can delete non-admins */}
                          {!u.isRootAdmin && u.user_id !== user?.id && (isRootAdmin || !u.isAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u.user_id)}
                              disabled={deleting === u.user_id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {deleting === u.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view */}
            <div className="sm:hidden space-y-3">
              {users.map((u) => (
                <div key={u.user_id} className={`glass rounded-xl p-4 ${u.isRootAdmin ? 'border border-orange-500/50' : ''}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      u.isRootAdmin ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-primary/20'
                    }`}>
                      {u.isRootAdmin ? (
                        <Crown className="w-6 h-6 text-white" />
                      ) : (
                        <User className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium flex items-center gap-2">
                        {u.display_name || 'Chưa đặt tên'}
                        {u.isRootAdmin && (
                          <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                            ROOT
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email || u.user_id.slice(0, 8)}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        u.isRootAdmin
                          ? 'bg-gradient-to-r from-yellow-400/20 to-orange-500/20 text-orange-500'
                          : u.isAdmin
                            ? 'bg-yellow-500/20 text-yellow-500' 
                            : 'bg-primary/20 text-primary'
                      }`}>
                        {u.isRootAdmin ? <Crown className="w-3 h-3" /> : u.isAdmin && <Shield className="w-3 h-3" />}
                        {u.isRootAdmin ? 'Admin Gốc' : u.isAdmin ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <div className="flex gap-1">
                      {/* Only show admin toggle if current user is root admin and target is not root admin */}
                      {isRootAdmin && !u.isRootAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleToggleAdmin(u.user_id, u.isAdmin)}
                          disabled={togglingAdmin === u.user_id || u.user_id === user?.id}
                        >
                          {togglingAdmin === u.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.isAdmin ? (
                            <ShieldMinus className="w-4 h-4 text-orange-500" />
                          ) : (
                            <ShieldPlus className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                      )}
                      {/* Root admin can add/remove seller (mobile) */}
                      {isRootAdmin && !u.isRootAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => handleToggleSeller(u.user_id, !!u.isSeller)}
                          disabled={togglingAdmin === u.user_id || u.user_id === user?.id}
                        >
                          {togglingAdmin === u.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.isSeller ? (
                            <User className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <User className="w-4 h-4 text-blue-500" />
                          )}
                        </Button>
                      )}
                      {/* Show delete button if: root admin can delete anyone except self and root, non-root can delete non-admins */}
                      {!u.isRootAdmin && u.user_id !== user?.id && (isRootAdmin || !u.isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => handleDeleteUser(u.user_id)}
                          disabled={deleting === u.user_id}
                        >
                          {deleting === u.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Chưa có người dùng nào
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

