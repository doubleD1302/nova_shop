import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import SellerLayout from './components/seller/SellerLayout'
import AccountPage from './pages/AccountPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrdersPage from './pages/OrdersPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import ProductDetailPage from './pages/ProductDetailPage'
import RegisterPage from './pages/RegisterPage'
import SearchPage from './pages/SearchPage'
import ShopPage from './pages/ShopPage'
import ShopsPage from './pages/ShopsPage'
import SellerDashboardPage from './pages/seller/SellerDashboardPage'
import SellerOrdersPage from './pages/seller/SellerOrdersPage'
import SellerProductFormPage from './pages/seller/SellerProductFormPage'
import SellerProductsPage from './pages/seller/SellerProductsPage'
import SellerShopPage from './pages/seller/SellerShopPage'

/**
 * Bảng tuyến đường của toàn sàn ShopNova.
 * - Khu người mua: dùng <MainLayout /> (header, nav danh mục, footer).
 * - Khu người bán: dùng <SellerLayout /> tại /nguoi-ban/*.
 */
export default function App() {
  return (
    <Routes>
      {/* ---------- NGƯỜI MUA ---------- */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tim-kiem" element={<SearchPage />} />
        <Route path="/san-pham/:slug" element={<ProductDetailPage />} />
        <Route path="/shop" element={<ShopsPage />} />
        <Route path="/shop/:shopId" element={<ShopPage />} />
        <Route path="/gio-hang" element={<CartPage />} />
        <Route path="/dat-hang" element={<CheckoutPage />} />
        <Route path="/dat-hang-thanh-cong/:orderId" element={<OrderSuccessPage />} />
        <Route path="/don-hang" element={<OrdersPage />} />
        <Route path="/don-hang/:orderId" element={<OrderDetailPage />} />
        <Route path="/tai-khoan" element={<AccountPage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ---------- NGƯỜI BÁN ---------- */}
      <Route path="/nguoi-ban" element={<SellerLayout />}>
        <Route index element={<SellerDashboardPage />} />
        <Route path="san-pham" element={<SellerProductsPage />} />
        <Route path="san-pham/them-moi" element={<SellerProductFormPage />} />
        <Route path="san-pham/:productId" element={<SellerProductFormPage />} />
        <Route path="don-hang" element={<SellerOrdersPage />} />
        <Route path="gian-hang" element={<SellerShopPage />} />
        <Route path="*" element={<Navigate to="/nguoi-ban" replace />} />
      </Route>
    </Routes>
  )
}
