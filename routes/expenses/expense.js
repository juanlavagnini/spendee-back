const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
//const truncateToDate = require("../helpers/truncateToDate.js")
const validateToken = require("../../middleware/validateToken.js")
const updateBudgetSpent = require("../../helpers/updateBudgetSpent.js")

const prisma = new PrismaClient()
router.post("/", validateToken, async (req, res) => {
  const { gasto, montoAnterior, categoriaId } = req.body
  try {
    const nuevoGasto = await prisma.gasto.create({
      data: {
        usuarioId: req.user.user_id,
        gasto,
        montoAnterior,
        fecha: new Date(),
        categoriaId: categoriaId,
      },
    })

    // Actualizar presupuesto si existe
    await updateBudgetSpent(
      prisma,
      req.user.user_id,
      gasto, // amount
      categoriaId,
      nuevoGasto.fecha
    )
    const racha = await prisma.racha.findUnique({
      where: { usuarioId: req.user.user_id },
    })
    const now = new Date()
    const nowAR = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const today = new Date(nowAR).toISOString().split("T")[0]
    const lastDay = racha?.ultimaFecha.toISOString().split("T")[0]
    const yesterday = new Date(nowAR.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
    if (racha == null) {
      await prisma.racha.create({
        data: {
          usuarioId: req.user.user_id,
          rachaActual: 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    } else if (lastDay == yesterday) {
      await prisma.racha.update({
        where: { usuarioId: req.user.user_id },
        data: {
          rachaActual: racha.rachaActual + 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    } else if (lastDay == today) {
    } else if (lastDay < yesterday) {
      await prisma.racha.update({
        where: { usuarioId: req.user.user_id },
        data: {
          rachaActual: 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    }
    res.status(201).json(nuevoGasto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/", validateToken, async (req, res) => {
  try {
    const { month, year, categoryId, limit, order = "asc" } = req.query
    const userId = req.user.user_id

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const filters = {
      where: {
        usuarioId: req.user.user_id,
        ...(categoryId && { categoriaId: parseInt(categoryId) }),
        ...(month &&
          year && {
            fecha: {
              gte: new Date(Number(year), Number(month) - 1, 1),
              lt: new Date(Number(year), Number(month), 1),
            },
          }),
      },
      orderBy: {
        fecha: order === "desc" ? "desc" : "asc",
      },
      ...(limit && { take: parseInt(limit) }),
    }

    const gastos = await prisma.gasto.findMany(filters)
    res.json(gastos)
  } catch (error) {
    console.error("Error fetching gastos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/grouped", validateToken, async (req, res) => {
  try {
    const userId = req.user.user_id

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const groupedExpenses = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("fecha", 'YYYY-MM') AS month,
        json_agg(
          json_build_object(
            'id', "id",
            'usuarioId', "usuarioId",
            'gasto', "gasto",
            'fecha', "fecha",
            'montoAnterior', "montoAnterior",
            'categoriaId', "categoriaId"
          )
          ORDER BY "fecha" DESC
        ) AS items
      FROM "Gasto"
      WHERE "usuarioId" = ${userId}
      GROUP BY month
      ORDER BY month DESC;
    `

    res.json(groupedExpenses)
  } catch (error) {
    console.error("Error grouping expenses:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/byId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const expense = await prisma.gasto.findFirst({
      where: { id, usuarioId: req.user.user_id },
    })
    if (!expense) return res.status(404).json({ error: "Gasto no encontrado" })
    res.status(200).json(expense)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.put("/byId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  const { toCategoryId } = req.body
  const toCategoryIdInt = parseInt(toCategoryId)

  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const gastoExistente = await prisma.gasto.findFirst({
        where: { id, usuarioId: req.user.user_id }
    })

    if (!gastoExistente) return res.status(404).json({ error: "Gasto no encontrado" })

    await prisma.gasto.update({
      where: { id, usuarioId: req.user.user_id },
      data: { categoriaId: toCategoryIdInt },
    })
    
    // Ajustar presupuestos
    // 1. Restar de la categoría anterior
    await updateBudgetSpent(prisma, req.user.user_id, -gastoExistente.gasto, gastoExistente.categoriaId, gastoExistente.fecha)
    // 2. Sumar a la nueva categoría
    await updateBudgetSpent(prisma, req.user.user_id, gastoExistente.gasto, toCategoryIdInt, gastoExistente.fecha)

    res.status(200).json({ message: "Categoría del gasto actualizada" })
  } catch (error) {
    res.status(400).json({ message: "Error al extraer categorias o gasto" })
  }
})

router.delete("/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const deletedExpense = await prisma.gasto.delete({
      where: { id, usuarioId: req.user.user_id },
    })

    // Restar monto del presupuesto
    await updateBudgetSpent(
        prisma, 
        req.user.user_id, 
        -deletedExpense.gasto, 
        deletedExpense.categoriaId, 
        deletedExpense.fecha
    )

    res
      .status(200)
      .json({ message: "Gasto eliminado correctamente", deletedExpense })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.put("/moveExpensesOfCategory", validateToken, async (req, res) => {
  const { categoriaOrigenId, categoriaDestinoId } = req.body
  try {
    const uid = req.user.user_id
    if (!categoriaOrigenId || !categoriaDestinoId) {
      return res
        .status(400)
        .json({ error: "Debes indicar las categorías origen y destino." })
    }
    const [origen, destino] = await Promise.all([
      prisma.categorias.findFirst({
        where: { id: parseInt(categoriaOrigenId), usuarioId: uid },
      }),
      prisma.categorias.findFirst({
        where: { id: parseInt(categoriaDestinoId) },
      }),
    ])
    if (!origen) {
      return res
        .status(404)
        .json({ error: "La categoría de origen no existe o no te pertenece." })
    }
    if (!destino) {
      return res
        .status(404)
        .json({ error: "La categoría de destino no existe o no te pertenece." })
    }
    const resultado = await prisma.gasto.updateMany({
      where: {
        usuarioId: uid,
        categoriaId: parseInt(categoriaOrigenId),
      },
      data: {
        categoriaId: parseInt(categoriaDestinoId),
      },
    })

    res.status(200).json({
      message: `Se movieron ${resultado.count} gastos de la categoría ${origen.nombre} a ${destino.nombre}.`,
      cantidad: resultado.count,
    })
  } catch (error) {
    console.error("Error moviendo gastos de categoría:", error)
    res.status(500).json({ error: "" })
  }
})

module.exports = router
