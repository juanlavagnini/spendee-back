const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    gasto: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    presupuesto: {
      findFirst: jest.fn(),
    },
    presupuestoCategoria: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    racha: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    categorias: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => mPrisma),
  }
})

jest.mock("../middleware/validateToken.js", () =>
  jest.fn((req, _res, next) => {
    req.user = { user_id: "user-123" }
    next()
  }),
)

const expensesRouter = require("../routes/expenses/expense.js")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/expenses", expensesRouter)

describe("Expenses routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /expenses", () => {
    it("deberia crear un gasto e inicializar una racha si no existe", async () => {
      prisma.gasto.create.mockResolvedValue({ id: 1, gasto: 100 })
      prisma.racha.findUnique.mockResolvedValue(null)
      prisma.racha.create.mockResolvedValue({ rachaActual: 1 })

      const res = await request(app).post("/expenses").send({
        gasto: 100,
        montoAnterior: 90,
        categoriaId: 1,
      })

      expect(res.status).toBe(201)
      expect(prisma.gasto.create).toHaveBeenCalled()
      expect(prisma.racha.create).toHaveBeenCalled()
    })

    it("deberia incrementar la racha si el ultimo dia fue ayer", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

      prisma.gasto.create.mockResolvedValue({ id: 2 })
      prisma.racha.findUnique.mockResolvedValue({
        rachaActual: 3,
        ultimaFecha: yesterday,
      })
      prisma.racha.update.mockResolvedValue({ rachaActual: 4 })

      const res = await request(app).post("/expenses").send({
        gasto: 50,
        montoAnterior: 40,
        categoriaId: 2,
      })

      expect(res.status).toBe(201)
      expect(prisma.racha.update).toHaveBeenCalled()
    })

    it("deberia reiniciar la racha si esta inactiva", async () => {
      const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)

      prisma.gasto.create.mockResolvedValue({ id: 3 })
      prisma.racha.findUnique.mockResolvedValue({
        rachaActual: 5,
        ultimaFecha: oldDate,
      })
      prisma.racha.update.mockResolvedValue({ rachaActual: 1 })

      const res = await request(app).post("/expenses").send({
        gasto: 30,
        montoAnterior: 25,
        categoriaId: 3,
      })

      expect(res.status).toBe(201)
      expect(prisma.racha.update).toHaveBeenCalled()
    })
  })

  describe("GET /expenses", () => {
    it("deberia retornar los gastos filtrados", async () => {
      prisma.gasto.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])

      const res = await request(app)
        .get("/expenses")
        .query({ month: 5, year: 2024, categoryId: 1, limit: 10 })

      expect(res.status).toBe(200)
      expect(prisma.gasto.findMany).toHaveBeenCalled()
      expect(res.body).toHaveLength(2)
    })

    it("deberia retornar 400 si el userId es invalido", async () => {
      const validateToken = require("../middleware/validateToken.js")
      validateToken.mockImplementationOnce((req, _res, next) => {
        req.user = { user_id: null }
        next()
      })

      const res = await request(app).get("/expenses")

      expect(res.status).toBe(400)
    })
  })

  describe("GET /expenses/grouped", () => {
    it("deberia retornar los gastos agrupados por mes", async () => {
      prisma.$queryRaw.mockResolvedValue([{ month: "2024-01", items: [] }])

      const res = await request(app).get("/expenses/grouped")

      expect(res.status).toBe(200)
      expect(prisma.$queryRaw).toHaveBeenCalled()
    })
  })

  describe("GET /expenses/byId/:id", () => {
    it("deberia retornar un gasto por id", async () => {
      prisma.gasto.findFirst.mockResolvedValue({ id: 10 })

      const res = await request(app).get("/expenses/byId/10")

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(10)
    })

    it("deberia retornar 404 si el gasto no se encuentra", async () => {
      prisma.gasto.findFirst.mockResolvedValue(null)

      const res = await request(app).get("/expenses/byId/999")

      expect(res.status).toBe(404)
    })

    it("deberia retornar 400 si el id es invalido", async () => {
      const res = await request(app).get("/expenses/byId/abc")

      expect(res.status).toBe(400)
    })
  })

  describe("PUT /expenses/byId/:id", () => {
    it("deberia actualizar la categoria del gasto", async () => {
      prisma.gasto.findFirst.mockResolvedValue({ id: 5, usuarioId: "user-123" })
      prisma.gasto.update.mockResolvedValue({})

      const res = await request(app)
        .put("/expenses/byId/5")
        .send({ toCategoryId: 2 })

      expect(res.status).toBe(200)
      expect(prisma.gasto.update).toHaveBeenCalled()
    })
  })

  describe("DELETE /expenses/:id", () => {
    it("deberia eliminar un gasto", async () => {
      prisma.gasto.delete.mockResolvedValue({ id: 7 })

      const res = await request(app).delete("/expenses/7")

      expect(res.status).toBe(200)
    })

    it("deberia retornar 400 si el id es invalido", async () => {
      const res = await request(app).delete("/expenses/abc")

      expect(res.status).toBe(400)
    })
  })

  describe("PUT /expenses/moveExpensesOfCategory", () => {
    it("deberia mover los gastos entre categorias", async () => {
      prisma.categorias.findFirst
        .mockResolvedValueOnce({
          id: 1,
          nombre: "Origen",
          usuarioId: "user-123",
        })
        .mockResolvedValueOnce({ id: 2, nombre: "Destino" })

      prisma.gasto.updateMany.mockResolvedValue({ count: 3 })

      const res = await request(app)
        .put("/expenses/moveExpensesOfCategory")
        .send({ categoriaOrigenId: 1, categoriaDestinoId: 2 })

      expect(res.status).toBe(200)
      expect(res.body.cantidad).toBe(3)
    })

    it("deberia retornar 404 si la categoria de origen no existe", async () => {
      prisma.categorias.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 })

      const res = await request(app)
        .put("/expenses/moveExpensesOfCategory")
        .send({ categoriaOrigenId: 1, categoriaDestinoId: 2 })

      expect(res.status).toBe(404)
    })
  })
})
