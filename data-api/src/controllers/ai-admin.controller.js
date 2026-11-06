import { executeQuery } from '../config/database.js'
import { searchAdminData } from '../services/ai-admin.service.js'

export async function searchAdmin(req, res, next) {
  try {
    const result = await searchAdminData(executeQuery, req.query)
    if (result.error === 'VALIDATION_ERROR') return res.status(400).json({ success: false, message: 'Tham số tra cứu không hợp lệ.', error: { code: result.error } })
    if (result.error === 'FORBIDDEN') return res.status(403).json({ success: false, message: 'Không có quyền quản trị.', error: { code: result.error } })
    return res.status(200).json({ success: true, data: result })
  } catch (error) { return next(error) }
}
