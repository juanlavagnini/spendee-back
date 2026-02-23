const request = require("supertest")

jest.mock("@prisma/client", () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    racha: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => prisma),
  }
})

jest.mock("../middleware/validateToken", () =>
  jest.fn((req, _res, next) => {
    req.user = { user_id: "user-123", sub: "user-123", uid: "user-123" }
    req.usuario = {
      user_id: "user-123",
      sub: "user-123",
      email: "test@mail.com",
      name: "Tester",
    }
    next()
  }),
)

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const { app } = require("../index.js")

describe("App bootstrap & core routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("GET / responde que la API está viva", async () => {
    const res = await request(app).get("/")
    expect(res.status).toBe(200)
    expect(res.text).toContain("Spendee API is running")
  })

  it("GET /test-jwt valida el token", async () => {
    const res = await request(app).get("/test-jwt")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("JWT válido!")
  })

  it("GET /racha devuelve racha existente", async () => {
    prisma.racha.findUnique.mockResolvedValue({
      usuarioId: "user-123",
      rachaActual: 5,
    })

    const res = await request(app).get("/racha")

    expect(res.status).toBe(200)
    expect(res.body.rachaActual).toBe(5)
  })

  it("GET /racha crea racha si no existe", async () => {
    prisma.racha.findUnique.mockResolvedValue(null)
    prisma.racha.create.mockResolvedValue({
      usuarioId: "user-123",
      rachaActual: 0,
      isInactive: true,
    })

    const res = await request(app).get("/racha")

    expect(res.status).toBe(200)
    expect(prisma.racha.create).toHaveBeenCalled()
  })
})
