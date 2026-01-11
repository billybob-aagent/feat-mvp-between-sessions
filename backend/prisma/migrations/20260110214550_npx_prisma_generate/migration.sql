-- CreateIndex
CREATE INDEX "assignments_therapist_id_status_created_at_idx" ON "assignments"("therapist_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "assignments_client_id_status_created_at_idx" ON "assignments"("client_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "assignments_title_idx" ON "assignments"("title");

-- CreateIndex
CREATE INDEX "responses_assignment_id_created_at_idx" ON "responses"("assignment_id", "created_at");
