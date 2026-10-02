const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

test('feature sync resolves empty groups, multiline middleware and typed request bodies', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gatenest-feature-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); };
  for (const dir of ['frontend/src/api', 'frontend/src/types', 'src/generated']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  write('backend/internal/service/payment_config_service.go', 'package service');
  write('backend/internal/handler/admin/widget.go', `package admin
type UpdateRequest struct {
  Enabled *bool \`json:"enabled"\`
  Count int \`json:"count" binding:"required"\`
}
func (h *WidgetHandler) Update(c *gin.Context) {
  var req UpdateRequest
  c.ShouldBindJSON(&req)
}
func (h *WidgetHandler) List(c *gin.Context) {
  page := c.DefaultQuery("page", "1")
}
`);
  write('backend/internal/server/routes/admin.go', `package routes
func registerWidgets(admin *gin.RouterGroup, h *handler.Handlers) {
  widgets := admin.Group("/widgets")
  reads := widgets.Group("")
  reads.GET("", h.Admin.Widget.List)
  widgets.PUT("/:id", guard.WithOptions(
    Options{Enabled: true}), h.Admin.Widget.Update)
}
`);
  write('backend/internal/server/routes/payment.go', `package routes
func registerPayment(v1 *gin.RouterGroup) {
  adminGroup := v1.Group("/admin/payment")
  adminGroup.GET("/config", adminPaymentHandler.GetConfig)
}
`);
  execFileSync(process.execPath, [path.resolve('.github/scripts/sync-sub2api-features.mjs'), root, 'a'.repeat(40)], { cwd: root });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/sub2api-features.json')));
  assert.equal(manifest.operations.length, 3);
  const update = manifest.operations.find(op => op.method === 'PUT');
  assert.equal(update.path, '/api/v1/admin/widgets/:id');
  assert.equal(update.bodySchema, 'fields');
  assert.equal(update.bodyFields.find(f => f.name === 'count').required, true);
  assert.equal(update.bodyFields.find(f => f.name === 'enabled').nullable, true);
  assert.deepEqual(manifest.operations.find(op => op.path === '/api/v1/admin/widgets').query, ['page']);
  assert(manifest.operations.some(op => op.path === '/api/v1/admin/payment/config'));
});
