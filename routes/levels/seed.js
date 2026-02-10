const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function seedLevels() {
  await prisma.objetivos?.deleteMany()
  await prisma.niveles?.deleteMany()

  const niveles = [
    {
      id: 1,
      objetivos: [
        { descripcion: "Hacer 3 ingresos", condicion: "ingresos>=3" },
        { descripcion: "Hacer 5 egresos", condicion: "egresos>=5" },
        {
          descripcion: "Crear un presupuesto",
          condicion: "presupuesto_creado>=1",
        },
      ],
    },
    {
      id: 2,
      objetivos: [
        {
          descripcion: "Cargar gastos durante 5 días seguidos",
          condicion: "gastos_consecutivos>=5",
        },
        {
          descripcion: "Mantener el balance positivo durante 3 días seguidos",
          condicion: "balance_positivo>=3",
        },
        {
          descripcion: "Crear una categoría personalizada",
          condicion: "categoria_personalizada>=1",
        },
      ],
    },
    {
      id: 3,
      objetivos: [
        {
          descripcion: "Registrar 20 movimientos en total",
          condicion: "movimientos>=20",
        },
        {
          descripcion: "Cerrar el presupuesto entre 80% y 100%",
          condicion: "presupuesto_80_100>=1",
        },
        {
          descripcion: "Crear un presupuesto para el futuro",
          condicion: "presupuesto_futuro>=1",
        },
      ],
    },
    {
      id: 4,
      objetivos: [
        {
          descripcion: "Mantener el balance positivo durante 7 días seguidos",
          condicion: "balance_positivo>=7",
        },
        {
          descripcion: "Registrar 50 movimientos en total",
          condicion: "movimientos>=50",
        },
        {
          descripcion: "Cargar gastos durante 10 días seguidos",
          condicion: "gastos_consecutivos>=10",
        },
      ],
    },
    {
      id: 5,
      objetivos: [
        {
          descripcion: "Registrar 100 movimientos en total",
          condicion: "movimientos>=100",
        },
        {
          descripcion: "Mantener el balance positivo durante 15 días seguidos",
          condicion: "balance_positivo>=15",
        },
        {
          descripcion: "Cerrar el presupuesto entre 80% y 100%",
          condicion: "presupuesto_80_100>=1",
        },
      ],
    },
  ]

  for (const nivel of niveles) {
    await prisma.niveles?.create({
      data: {
        id: nivel.id,
        objetivos: {
          create: nivel.objetivos.map((o) => ({
            descripcion: o.descripcion,
            condicion: o.condicion,
          })),
        },
      },
    })
  }

  console.log("Seed ejecutada correctamente ✔")
}

module.exports = { seedLevels }

if (require.main === module) {
  seedLevels()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
