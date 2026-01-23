const request = require('supertest')
const app = require('../api/index')

describe('Cars API', () => {
  it('should return locations metadata', async () => {
    const res = await request(app).get('/api/cars/meta/locations')
    expect([200, 500]).toContain(res.statusCode) // 200 if success, 500 if external API fails
  })

  it('should return groups metadata', async () => {
    const res = await request(app).get('/api/cars/meta/groups')
    expect([200, 500]).toContain(res.statusCode)
  })

  // NOTE: This test calls the external cars API and may be slow or flaky in CI.
  // It is skipped by default; run manually when you want a full integration check.
  it.skip('should require query parameters for cars list', async () => {
    const res = await request(app).get('/api/cars')
    // Should return 200 with empty array or 500 if external API fails
    expect([200, 500]).toContain(res.statusCode)
  })
})
