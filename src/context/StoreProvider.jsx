import { AuthProvider } from './AuthContext'
import { CartProvider } from './CartContext'
import { CatalogProvider } from './CatalogContext'
import { OrderProvider } from './OrderContext'
import { ToastProvider } from './ToastContext'

/**
 * Gom toàn bộ provider của ứng dụng vào 1 chỗ.
 * Provider order: Toast -> Auth -> Catalog -> Cart -> Orders.
 */
export default function StoreProvider({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CatalogProvider>
          <CartProvider>
            <OrderProvider>{children}</OrderProvider>
          </CartProvider>
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
