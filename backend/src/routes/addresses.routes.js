import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { callDataApi } from '../clients/data.client.js'
const router = Router()
router.use(authenticate)
router.all(['/', '/:addressId'], async (req, res, next) => {
  try {
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method) || (req.params.addressId && !['PUT', 'DELETE'].includes(req.method)) || (!req.params.addressId && !['GET', 'POST'].includes(req.method))) return next()
    const id = req.params.addressId
    const path = `/internal/v1/users/${encodeURIComponent(req.user.id)}/addresses${id ? `/${encodeURIComponent(id)}` : ''}`
    const data = await callDataApi(path, { method: req.method, ...(req.method === 'POST' || req.method === 'PUT' ? { body: req.body } : {}) })
    return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data })
  } catch (err) { return next(err) }
})
export default router
