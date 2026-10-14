import { AuthProvider } from './AuthContext'
import { CartProvider } from './CartContext'
import { CatalogProvider } from './CatalogContext'
import { OrderProvider } from './OrderContext'
import { ToastProvider } from './ToastContext'

/**
 * Gom toàn bộ provider của ứng dụng vào 1 chỗ.
 * Thứ tự: Toast -> Catalog -> Auth -> Cart -> Orders (không phụ thuộc vòng).
 */
export default function StoreProvider({ children }) {
  return (
    <ToastProvider>
      <CatalogProvider>
        <AuthProvider>
          <CartProvider>
            <OrderProvider>{children}</OrderProvider>
          </CartProvider>
        </AuthProvider>
      </CatalogProvider>
    </ToastProvider>
  )
}
