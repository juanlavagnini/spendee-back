-- AlterTable
ALTER TABLE "PresupuestoCategoria" ADD COLUMN     "alerta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limiteAlerta" INTEGER NOT NULL DEFAULT 100;
