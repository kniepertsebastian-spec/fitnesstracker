-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanPhaseHistory_trainingPlanId_startedOn_key" ON "TrainingPlanPhaseHistory"("trainingPlanId", "startedOn");
