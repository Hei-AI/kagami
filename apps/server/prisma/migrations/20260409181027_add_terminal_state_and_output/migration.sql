-- CreateTable
CREATE TABLE "terminal_state" (
    "id" SERIAL NOT NULL,
    "cwd" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminal_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_output" (
    "id" SERIAL NOT NULL,
    "output_id" TEXT NOT NULL,
    "stdout" TEXT NOT NULL,
    "stderr" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminal_output_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terminal_output_output_id_uq" ON "terminal_output"("output_id");

-- CreateIndex
CREATE INDEX "terminal_output_created_at_idx" ON "terminal_output"("created_at");
