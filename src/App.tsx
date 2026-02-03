import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GeoProtection } from "@/components/GeoProtection";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminCategories from "./pages/AdminCategories";
import AdminAccounts from "./pages/AdminAccounts";
import AdminOrders from "./pages/AdminOrders";
import AdminCoinPurchases from "./pages/AdminCoinPurchases";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import Accounts from "./pages/Accounts";
import MyOrders from "./pages/MyOrders";
import Categories from "./pages/Categories";
import Free from "./pages/Free";
import Contact from "./pages/Contact";
import Posts from "./pages/Posts";
import SellerSetup from "./pages/SellerSetup";
import SellerProfile from "./pages/SellerProfile";
import SellerAccounts from "./pages/SellerAccounts";
import SellerOrders from "./pages/SellerOrders";
import UserProfile from "./pages/UserProfile";
import BuyCoins from "./pages/BuyCoins";
import AdminPosts from "./pages/AdminPosts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GeoProtection>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/free" element={<Free />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/accounts" element={<AdminAccounts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/coin-purchases" element={<AdminCoinPurchases />} />
              <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
              <Route path="/admin/posts" element={<AdminPosts />} />
              <Route path="/seller-setup" element={<SellerSetup />} />
              <Route path="/seller-profile" element={<SellerProfile />} />
              <Route path="/seller-accounts" element={<SellerAccounts />} />
              <Route path="/seller-orders" element={<SellerOrders />} />
              <Route path="/user-profile" element={<UserProfile />} />
              <Route path="/buy-coins" element={<BuyCoins />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </GeoProtection>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
