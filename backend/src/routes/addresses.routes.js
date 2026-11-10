import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { callDataApi } from '../clients/data.client.js'
const router = Router()
router.use(authenticate)
router.all(['/', '/:addressId', '/:addressId/default'], async (req, res, next) => {
  try {
    const isDefaultPath = req.path.endsWith('/default')
    if (isDefaultPath ? req.method !== 'PATCH' : req.params.addressId ? !['PUT', 'DELETE'].includes(req.method) : !['GET', 'POST'].includes(req.method)) return next()
    const id = req.params.addressId
    const path = `/internal/v1/users/${encodeURIComponent(req.user.id)}/addresses${id ? `/${encodeURIComponent(id)}` : ''}${isDefaultPath ? '/default' : ''}`
    const data = await callDataApi(path, { method: req.method, ...(req.method === 'POST' || req.method === 'PUT' ? { body: req.body } : {}) })
    return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, data })
  } catch (err) { return next(err) }
})
export default router
