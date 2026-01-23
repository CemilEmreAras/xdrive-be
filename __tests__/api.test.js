const request = require('supertest')
const app = require('../api/index')

describe('API Health Check', () => {
  it('should return 200 for root endpoint', async () => {
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('message')
  })

  it('should handle 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route')
    expect(res.statusCode).toBe(404)
  })
})

describe('CORS Headers', () => {
  it('should include CORS headers in response', async () => {
    const res = await request(app).get('/')
    expect(res.headers['access-control-allow-origin']).toBeDefined()
  })
})
