const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const truncateToDate = require("../../helpers/truncateToDate.js")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.get("/agrupado", validateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = "month",
      order = "asc",
    } = req.query

    const userId  = req.user.user_id

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const start = startDate ? new Date(startDate) : new Date("1970-01-01")
    const end = endDate ? new Date(endDate) : new Date()

    let format
    switch (groupBy) {
      case "day":
        format = "YYYY-MM-DD"
        break
      case "year":
        format = "YYYY"
        break
      case "month":
      default:
        format = "YYYY-MM"
        break
    }

    const expenses = await prisma.gasto.findMany({
      where: {
        usuarioId: userId,
        fecha: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        usuarioId: true,
        gasto: true,
        fecha: true,
        montoAnterior: true,
        categoriaId: true,
      },
    })

    const incomes = await prisma.ingreso.findMany({
      where: {
        usuarioId: userId,
        fecha: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        usuarioId: true,
        ingreso: true,
        fecha: true,
        montoAnterior: true,
      },
    })

    const formattedExpenses = expenses.map((e) => ({
      id: e.id,
      usuarioId: e.usuarioId,
      monto: Number(e.gasto),
      fecha: e.fecha,
      tipo: "expense",
      categoriaId: e.categoriaId,
      period: e.fecha.toISOString().slice(0, 7),
    }))

    const formattedIncomes = incomes.map((i) => ({
      id: i.id,
      usuarioId: i.usuarioId,
      monto: Number(i.ingreso),
      fecha: i.fecha,
      tipo: "income",
      categoriaId: null,
      period: i.fecha.toISOString().slice(0, 7),
    }))

    const allMovements = [...formattedExpenses, ...formattedIncomes].sort(
      (a, b) => {
        const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        return order === "desc" ? -diff : diff
      },
    )

    const grouped = Object.values(
      allMovements.reduce((acc, mov) => {
        const { period, tipo, monto } = mov

        if (!acc[period]) {
          acc[period] = {
            period,
            items: [],
            totalEgresos: 0,
            totalIngresos: 0,
          }
        }

        acc[period].items.push(mov)

        if (tipo === "income") acc[period].totalIngresos += monto
        if (tipo === "expense") acc[period].totalEgresos += monto

        return acc
      }, {}),
    )

    const result = grouped.sort((a, b) =>
      order === "desc"
        ? b.period.localeCompare(a.period)
        : a.period.localeCompare(b.period),
    )

    res.json(result)
  } catch (error) {
    console.error("Error agrupando movimientos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/", validateToken, async (req, res) => {
  // Prefer param if provided, otherwise fallback to authenticated user id
  const userId = req.user?.user_id
  try {
    const gastoSum = await prisma.gasto.aggregate({
      where: { usuarioId: userId },
      _sum: { gasto: true },
    })

    const ingresoSum = await prisma.ingreso.aggregate({
      where: { usuarioId: userId },
      _sum: { ingreso: true },
    })

    const sumaGastos = gastoSum._sum.gasto
      ? parseFloat(gastoSum._sum.gasto.toString())
      : 0
    const sumaIngresos = ingresoSum._sum.ingreso
      ? parseFloat(ingresoSum._sum.ingreso.toString())
      : 0

    const balance = sumaIngresos - sumaGastos
    res.json({ balance, sumaIngresos, sumaGastos })
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: error.message })
  }
})


module.exports = router 