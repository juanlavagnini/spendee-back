const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function seedPiggy() {
  await prisma.objetivo?.deleteMany()
  const objetivos = [
    { descripcion: "Añadir 3 gastos", accion: "expense", maxProgreso: 3 },
    { descripcion: "Añadir 5 ingresos", accion: "income", maxProgreso: 5 },
    { descripcion: "Crear 3 presupuestos", accion: "budget", maxProgreso: 3 },
    {
      descripcion: "Crear 1 categoría nueva",
      accion: "category",
      maxProgreso: 1,
    },
    { descripcion: "Crear 1 presupuesto", accion: "budget", maxProgreso: 1 },
    { descripcion: "Añadir 10 gastos", accion: "expense", maxProgreso: 10 },
    { descripcion: "Añadir 10 ingresos", accion: "income", maxProgreso: 10 },
    {
      descripcion: "Actualizar un presupuesto existente",
      accion: "budget_update",
      maxProgreso: 1,
    },
    {
      descripcion: "Agregar 3 categorías personalizadas",
      accion: "category",
      maxProgreso: 3,
    },
    {
      descripcion: "Agregar 1 categoría personalizada",
      accion: "category",
      maxProgreso: 1,
    },
    { descripcion: "Editar 1 gasto", accion: "expense_edit", maxProgreso: 1 },
    {
      descripcion: "Editar el nombre del Piggy",
      accion: "piggy_edit",
      maxProgreso: 1,
    },
    {
      descripcion: "Editar tu nombre en el perfil",
      accion: "profile_edit",
      maxProgreso: 1,
    },
    {
      descripcion: "Eliminar 5 gastos",
      accion: "delete_expense",
      maxProgreso: 5,
    },
    { descripcion: "Crear 2 presupuestos", accion: "budget", maxProgreso: 2 },
    {
      descripcion: "Editar 1 categoría existente",
      accion: "category_edit",
      maxProgreso: 1,
    },
  ]

  for (const obj of objetivos) {
    await prisma.objetivo.create({ data: obj })
  }

  console.log("Seed cargado.")
}

module.exports = { seedPiggy }

if (require.main === module) {
  seedPiggy()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
