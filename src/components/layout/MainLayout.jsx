import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import CategoryNav from './CategoryNav'
import Footer from './Footer'
import MainHeader from './MainHeader'
import TopBar from './TopBar'

/** Cuộn lên đầu trang mỗi khi đổi route */
function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname, search])
  return null
}

/** Layout dành cho người mua: TopBar + Header + Nav danh mục + Nội dung + Footer */
export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <ScrollToTop />
      <div>
        <TopBar />
        <MainHeader />
      </div>
      <CategoryNav />
      <main className="container-shop flex-1 pb-6 pt-4">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
