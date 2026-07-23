-- CreateIndex
CREATE INDEX "AuditLogEntry_createdAt_id_idx" ON "AuditLogEntry"("createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLogEntry_action_idx" ON "AuditLogEntry"("action");

-- CreateIndex
CREATE INDEX "AuditLogEntry_targetType_idx" ON "AuditLogEntry"("targetType");

-- CreateIndex
CREATE INDEX "AuditLogEntry_userId_idx" ON "AuditLogEntry"("userId");
