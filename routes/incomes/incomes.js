const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const truncateToDate = require("../../helpers/truncateToDate.js")
const validateToken = require("../../middleware/validateToken.js")

const prisma = new PrismaClient()

router.post("/", validateToken, async (req, res) => {
  const { ingreso, montoAnterior } = req.body
  const userId = req.user.user_id
  try {
    const nuevoIngreso = await prisma.ingreso.create({
      data: {
        usuarioId: userId,
        ingreso,
        montoAnterior,
        fecha: new Date(),
      },
    })
    const racha = await prisma.racha.findUnique({
      where: { usuarioId: userId },
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
          usuarioId: userId,
          rachaActual: 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    } else if (lastDay == yesterday) {
      await prisma.racha.update({
        where: { usuarioId: userId },
        data: {
          rachaActual: racha.rachaActual + 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    } else if (lastDay == today) {
    } else if (lastDay < yesterday) {
      await prisma.racha.update({
        where: { usuarioId: userId },
        data: {
          rachaActual: 1,
          ultimaFecha: nowAR,
          isInactive: false,
        },
      })
    }
    res.status(201).json(nuevoIngreso)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get("/", validateToken, async (req, res) => {
  try {
    const { month, year, limit, order = "asc" } = req.query

    const userId = req.user.user_id
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" })
    }

    const filters = {
      where: {
        usuarioId: userId,
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

    const ingresos = await prisma.ingreso.findMany(filters)
    res.json(ingresos)
  } catch (error) {
    console.error("Error fetching ingresos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/grouped", validateToken, async (req, res) => {
  try {
    const userId = req.user.user_id

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId"})
    }

    const groupedIncomes = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("fecha", 'YYYY-MM') AS month,
        json_agg(
          json_build_object(
            'id', "id",
            'usuarioId', "usuarioId",
            'ingreso', "ingreso",
            'montoAnterior', "montoAnterior",
            'fecha', "fecha"
          )
          ORDER BY "fecha" DESC
        ) AS items
      FROM "Ingreso"
      WHERE "usuarioId" = ${userId}
      GROUP BY month
      ORDER BY month DESC;
    `

    res.json(groupedIncomes)
  } catch (error) {
    console.error("Error grouping ingresos:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

router.get("/byId/:id", validateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" })
  }

  try {
    const income = await prisma.ingreso.findUnique({
      where: { id, usuarioId: req.user.user_id },
    })
    if (!income) return res.status(404).json({ error: "Ingreso no encontrado" })
    res.status(200).json(income)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router