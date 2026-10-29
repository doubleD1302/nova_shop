import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'

const SellerLayout = lazy(() => import('./components/seller/SellerLayout'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ShopPage = lazy(() => import('./pages/ShopPage'))
const ShopsPage = lazy(() => import('./pages/ShopsPage'))
const SellerDashboardPage = lazy(() => import('./pages/seller/SellerDashboardPage'))
const SellerOrdersPage = lazy(() => import('./pages/seller/SellerOrdersPage'))
const SellerProductFormPage = lazy(() => import('./pages/seller/SellerProductFormPage'))
const SellerProductsPage = lazy(() => import('./pages/seller/SellerProductsPage'))
const SellerShopPage = lazy(() => import('./pages/seller/SellerShopPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function PageLoading() {
  return <div className="container-shop py-12 text-center text-sm text-muted">Đang mở trang...</div>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
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
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/quan-tri" element={<Navigate to="/admin" replace />} />
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
    </Suspense>
  )
}
