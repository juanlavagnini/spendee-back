const request = require("supertest")
const express = require("express")

jest.mock("@prisma/client", () => {
  const mPrisma = {
    presupuesto: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    presupuestoCategoria: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    gasto: {
      groupBy: jest.fn(),
    },
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

jest.mock("../helpers/truncateToDate.js", () =>
  jest.fn((date) => new Date(date)),
)

// jest.mock("../helpers/budgetProjectionCalculator.js", () =>
//   jest.fn(() => ({ projectedSpend: 500 })),
// )

const budgetRouter = require("../routes/budget/budget.js") // ajustá path si hace falta
const truncateToDate = require("../helpers/truncateToDate.js")
// const budgetProjectionCalculator = require("../helpers/budgetProjectionCalculator.js")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const app = express()
app.use(express.json())
app.use("/budget", budgetRouter)

describe("Budget routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /budget", () => {
    it("deberia retornar los presupuestos agrupados en pasados, presentes y futuros", async () => {
      prisma.presupuesto.findMany
        .mockResolvedValueOnce([]) // future
        .mockResolvedValueOnce([]) // past

      prisma.presupuesto.findFirst.mockResolvedValue({
        id: 1,
        usuarioId: "user-123",
        fechaInicio: new Date(),
        fechaFin: new Date(),
        PresupuestoCategoria: [
          {
            categoriaId: 1,
            monto: 1000,
          },
        ],
      })

      prisma.gasto.groupBy.mockResolvedValue([
        {
          categoriaId: 1,
          _sum: { gasto: 200 },
        },
      ])

      const res = await request(app).get("/budget")

      expect(res.status).toBe(200)
      expect(res.body.currentBudget).toBeTruthy()
      // expect(budgetProjectionCalculator).toHaveBeenCalled()
    })

    it("deberia devolver 400 si falta el usuarioId", async () => {
      const validateToken = require("../middleware/validateToken.js")
      validateToken.mockImplementationOnce((req, _res, next) => {
        req.user = {}
        next()
      })

      const res = await request(app).get("/budget")

      expect(res.status).toBe(400)
    })
  })

  describe("POST /budget", () => {
    it("deberia crear un nuevo presupuesto", async () => {
      prisma.presupuesto.create.mockResolvedValue({ id: 10 })

      const res = await request(app)
        .post("/budget")
        .send({
          monto: 3000,
          fechaInicio: "2024-01-01",
          fechaFin: "2024-01-31",
          PresupuestoCategoria: [
            { categoriaId: 1, monto: 1000 },
            { categoriaId: 2, monto: 2000 },
          ],
        })

      expect(res.status).toBe(201)
      expect(prisma.presupuesto.create).toHaveBeenCalled()
      expect(truncateToDate).toHaveBeenCalled()
    })
  })

  describe("DELETE /budget/:id", () => {
    it("deberia eliminar un presupuesto y sus categorias", async () => {
      prisma.presupuestoCategoria.deleteMany.mockResolvedValue({ count: 2 })
      prisma.presupuesto.delete.mockResolvedValue({ id: 5 })

      const res = await request(app).delete("/budget/5")

      expect(res.status).toBe(200)
      expect(prisma.presupuesto.delete).toHaveBeenCalledWith({
        where: { id: 5, usuarioId: "user-123" },
      })
    })
  })

  describe("PUT /budget/:id", () => {
    it("deberia actualizar el presupuesto y las categorias", async () => {
      prisma.presupuesto.update.mockResolvedValue({ id: 3 })
      prisma.presupuestoCategoria.deleteMany.mockResolvedValue({ count: 2 })
      prisma.presupuestoCategoria.createMany.mockResolvedValue({ count: 2 })

      const res = await request(app)
        .put("/budget/3")
        .send({
          monto: 4000,
          fechaInicio: "2024-02-01",
          fechaFin: "2024-02-28",
          PresupuestoCategoria: [
            { categoriaId: 1, monto: 2000 },
            { categoriaId: 2, monto: 2000 },
          ],
        })

      expect(res.status).toBe(200)
      expect(prisma.presupuesto.update).toHaveBeenCalled()
      expect(prisma.presupuestoCategoria.createMany).toHaveBeenCalled()
    })
  })

  describe("GET /budget/:budgetId", () => {
    it("deberia devolver un presupuesto con gastos calculados", async () => {
      prisma.presupuesto.findUnique.mockResolvedValue({
        id: 7,
        usuarioId: "user-123",
        fechaInicio: new Date(),
        fechaFin: new Date(),
        PresupuestoCategoria: [{ categoriaId: 1, monto: 1000 }],
      })

      prisma.gasto.groupBy.mockResolvedValue([
        { categoriaId: 1, _sum: { gasto: 400 } },
      ])

      const res = await request(app).get("/budget/7")

      expect(res.status).toBe(200)
      expect(res.body.PresupuestoCategoria[0].gastado).toBe(400)
    })

    it("deberia devolver 404 si no se encuentra el presupuesto", async () => {
      prisma.presupuesto.findUnique.mockResolvedValue(null)

      const res = await request(app).get("/budget/999")

      expect(res.status).toBe(404)
    })
  })

  describe("PUT /budget/:budgetId/category/:categoryId", () => {
    it("deberia actualizar una categoria de presupuesto existente", async () => {
      // Mock findFirst budget (existente)
      prisma.presupuesto.findFirst.mockResolvedValue({
        id: 1,
        usuarioId: "user-123",
      })

      // Mock findFirst budgetCategory (existente)
      prisma.presupuestoCategoria.findFirst.mockResolvedValue({
        id: 10,
        presupuestoId: 1,
        categoriaId: 2,
        monto: 500,
      })

      // Mock update
      prisma.presupuestoCategoria.update.mockResolvedValue({
        id: 10,
        monto: 600,
        alerta: true,
        limiteAlerta: 80,
      })

      // Mock aggregate para actualizar el total del presupuesto
      prisma.presupuestoCategoria.aggregate.mockResolvedValue({
        _sum: {
          monto: 2000,
        },
      })
      
      prisma.presupuesto.update.mockResolvedValue({})

      const res = await request(app)
        .put("/budget/1/category/2")
        .send({
          monto: 600,
          alerta: true,
          limiteAlerta: 80,
        })

      expect(res.status).toBe(200)
      expect(prisma.presupuestoCategoria.update).toHaveBeenCalled()
      expect(prisma.presupuesto.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { monto: 2000 } })
      )
    })

    it("deberia devolver 404 si el presupuesto no existe", async () => {
      prisma.presupuesto.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .put("/budget/999/category/2")
        .send({ monto: 600 })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe("Presupuesto no encontrado")
    })

    it("deberia devolver 404 si la categoria no existe en el presupuesto", async () => {
      prisma.presupuesto.findFirst.mockResolvedValue({ id: 1 })
      prisma.presupuestoCategoria.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .put("/budget/1/category/999")
        .send({ monto: 600 })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe("La categoría no existe en este presupuesto")
    })

    it("deberia manejar errores internos", async () => {
       prisma.presupuesto.findFirst.mockRejectedValue(new Error("DB Error"))
       
       const res = await request(app)
        .put("/budget/1/category/2")
        .send({ monto: 600 })

       expect(res.status).toBe(400)
    })

    it("deberia actualizar alertaVista", async () => {
      prisma.presupuesto.findFirst.mockResolvedValue({
        id: 1,
        usuarioId: "user-123",
      })

      prisma.presupuestoCategoria.findFirst.mockResolvedValue({
        id: 10,
        presupuestoId: 1,
        categoriaId: 2,
        monto: 500,
      })

      prisma.presupuestoCategoria.update.mockResolvedValue({
        id: 10,
        alertaVista: true,
      })

      const res = await request(app)
        .put("/budget/1/category/2")
        .send({
          alertaVista: true,
        })
      
      expect(res.status).toBe(200)
      expect(prisma.presupuestoCategoria.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertaVista: true
          })
        })
      )
    })

    it("deberia resetear alertaVista a false si el nuevo monto hace que el gasto este dentro del limite", async () => {
      prisma.presupuesto.findFirst.mockResolvedValue({
        id: 1,
        usuarioId: "user-123",
      })

      // Situación actual: Gasto 90, Monto 100. % Gastado = 90%. Límite alerta = 80%.
      // La alerta estaría disparada.
      prisma.presupuestoCategoria.findFirst.mockResolvedValue({
        id: 10,
        presupuestoId: 1,
        categoriaId: 2,
        monto: 100,
        gastadoAct: 90,
        limiteAlerta: 80,
        alertaVista: true, // Ya fue vista
      })

      prisma.presupuestoCategoria.update.mockResolvedValue({ id: 10 })
      prisma.presupuestoCategoria.aggregate.mockResolvedValue({ _sum: { monto: 200 } })
      prisma.presupuesto.update.mockResolvedValue({})

      // Acción: Aumentamos el monto a 200.
      // Nuevo % Gastado = (90 / 200) * 100 = 45%.
      // 45% < 80% (Límite). La alerta ya no debería estar activa, así que reseteamos alertaVista.
      const res = await request(app)
        .put("/budget/1/category/2")
        .send({
          monto: 200,
        })

      expect(res.status).toBe(200)
      expect(prisma.presupuestoCategoria.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertaVista: false, // Esperamos que se resetee
          }),
        })
      )
    })
  })
})