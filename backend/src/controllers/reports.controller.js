import ExcelJS from 'exceljs'
import { callDataApi } from '../clients/data.client.js'

function getShopId(req, res) {
  const shopId = req.user?.shopId
  if (!shopId) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
      error: { code: 'SHOP_NOT_FOUND' },
    })
    return null
  }
  return String(shopId)
}

/**
 * Lấy dữ liệu báo cáo doanh thu dạng JSON (cho dashboard/app)
 */
export async function getSellerRevenueData(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { startDate, endDate } = req.query
    const params = new URLSearchParams({ shopId })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const data = await callDataApi(`/internal/v1/seller/reports/revenue?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xuất file Excel báo cáo doanh thu gian hàng
 * Endpoint: GET /api/v1/seller/reports/revenue/export
 */
export async function exportSellerRevenueExcel(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { startDate, endDate } = req.query
    const params = new URLSearchParams({ shopId })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const { summary, orders } = await callDataApi(`/internal/v1/seller/reports/revenue?${params}`)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'ShopNova E-Commerce'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Báo Cáo Doanh Thu')

    // Thiết lập độ rộng cột
    worksheet.columns = [
      { header: 'Mã Đơn', key: 'orderCode', width: 16 },
      { header: 'Mã Đơn Con', key: 'shopOrderId', width: 14 },
      { header: 'Ngày Đặt', key: 'createdAt', width: 20 },
      { header: 'Khách Hàng', key: 'customerName', width: 22 },
      { header: 'Số Điện Thoại', key: 'customerPhone', width: 16 },
      { header: 'Trạng Thái', key: 'status', width: 16 },
      { header: 'Tiền Hàng (VNĐ)', key: 'subtotal', width: 18 },
      { header: 'Voucher Giảm (VNĐ)', key: 'discountAmount', width: 18 },
      { header: 'Phí Sàn (VNĐ)', key: 'commissionFee', width: 16 },
      { header: 'Thực Nhận (VNĐ)', key: 'sellerPayout', width: 18 },
      { header: 'Vận Chuyển', key: 'shippingName', width: 20 },
      { header: 'Mã Vận Đơn', key: 'trackingCode', width: 20 },
    ]

    // Style cho dòng Header
    const headerRow = worksheet.getRow(1)
    headerRow.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFA551E' }, // Màu cam thương hiệu ShopNova
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    const statusMap = {
      pending: 'Chờ xử lý',
      processing: 'Đang đóng gói',
      shipping: 'Đang giao',
      delivered: 'Đã giao (Thành công)',
      cancelled: 'Đã hủy',
    }

    // Đổ dữ liệu các dòng
    for (const o of orders) {
      const row = worksheet.addRow({
        orderCode: o.orderCode,
        shopOrderId: '#' + o.shopOrderId,
        createdAt: new Date(o.createdAt).toLocaleString('vi-VN'),
        customerName: o.customerName || 'N/A',
        customerPhone: o.customerPhone || 'N/A',
        status: statusMap[o.status] || o.status,
        subtotal: o.subtotal,
        discountAmount: o.discountAmount,
        commissionFee: o.commissionFee,
        sellerPayout: o.sellerPayout,
        shippingName: o.shippingName,
        trackingCode: o.trackingCode,
      })

      // Căn lề số tiền
      ;['subtotal', 'discountAmount', 'commissionFee', 'sellerPayout'].forEach((key) => {
        row.getCell(key).numFmt = '#,##0 "₫"'
        row.getCell(key).alignment = { horizontal: 'right' }
      })
    }

    // Dòng tổng kết
    worksheet.addRow({})
    const totalRow = worksheet.addRow({
      orderCode: 'TỔNG CỘNG',
      status: `${summary.deliveredOrders}/${summary.totalOrders} đơn thành công`,
      subtotal: summary.totalSubtotal,
      discountAmount: summary.totalDiscount,
      commissionFee: summary.totalCommission,
      sellerPayout: summary.totalPayout,
    })
    totalRow.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1E2022' } }
    ;['subtotal', 'discountAmount', 'commissionFee', 'sellerPayout'].forEach((key) => {
      totalRow.getCell(key).numFmt = '#,##0 "₫"'
      totalRow.getCell(key).alignment = { horizontal: 'right' }
    })

    const filename = `ShopNova-DoanhThu-Shop${shopId}-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy dữ liệu đối soát kho dạng JSON
 */
export async function getSellerInventoryData(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/reports/inventory?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xuất file Excel đối soát kho hàng
 * Endpoint: GET /api/v1/seller/reports/inventory/export
 */
export async function exportSellerInventoryExcel(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { summary, items } = await callDataApi(
      `/internal/v1/seller/reports/inventory?shopId=${encodeURIComponent(shopId)}`
    )

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'ShopNova E-Commerce'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('Đối Soát Kho Hàng')

    worksheet.columns = [
      { header: 'Mã SKU', key: 'sku', width: 22 },
      { header: 'Tên Sản Phẩm', key: 'productName', width: 35 },
      { header: 'Phân Loại / Biến Thể', key: 'variantName', width: 20 },
      { header: 'Đơn Giá (VNĐ)', key: 'price', width: 16 },
      { header: 'Tồn Kho Hiện Tại', key: 'stockQty', width: 18 },
      { header: 'Đã Bán', key: 'totalSold', width: 14 },
      { header: 'Đã Hoàn Trả', key: 'totalReturned', width: 14 },
      { header: 'Cảnh Báo Tồn', key: 'stockStatus', width: 18 },
      { header: 'Trạng Thái Bán', key: 'status', width: 16 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Màu xanh dương chuyên nghiệp cho quản lý kho
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    for (const it of items) {
      const row = worksheet.addRow({
        sku: it.sku,
        productName: it.productName,
        variantName: it.variantName,
        price: it.price,
        stockQty: it.stockQty,
        totalSold: it.totalSold,
        totalReturned: it.totalReturned,
        stockStatus: it.isLowStock ? '⚠️ Sắp hết hàng (<=5)' : 'Ổn định',
        status: it.status === 'active' ? 'Đang mở bán' : 'Tạm ẩn',
      })

      row.getCell('price').numFmt = '#,##0 "₫"'
      row.getCell('price').alignment = { horizontal: 'right' }
      row.getCell('stockQty').alignment = { horizontal: 'center' }
      row.getCell('totalSold').alignment = { horizontal: 'center' }
      row.getCell('totalReturned').alignment = { horizontal: 'center' }

      if (it.isLowStock) {
        row.getCell('stockStatus').font = { color: { argb: 'FFDC2626' }, bold: true }
      }
    }

    worksheet.addRow({})
    const summaryRow = worksheet.addRow({
      sku: 'TỔNG TỒN KHO',
      stockQty: summary.totalStock,
      stockStatus: `${summary.lowStockCount} SKU sắp hết hàng`,
    })
    summaryRow.font = { name: 'Calibri', bold: true, size: 12 }
    summaryRow.getCell('stockQty').alignment = { horizontal: 'center' }

    const filename = `ShopNova-DoiSoatKho-Shop${shopId}-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    return next(err)
  }
}
