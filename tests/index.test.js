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

const app = require("../index.js")

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

  it("GET /getApiId devuelve el uid", async () => {
    const res = await request(app).get("/getApiId")
    expect(res.status).toBe(200)
    expect(res.body.apiId).toBe("user-123")
  })

  it("POST /generateApiSecret crea usuario si no existe", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null)
    prisma.usuario.create.mockResolvedValue({})

    const res = await request(app).post("/generateApiSecret")

    expect(res.status).toBe(200)
    expect(res.body.apiSecret).toBeDefined()
    expect(prisma.usuario.create).toHaveBeenCalled()
  })

  it("POST /generateApiSecret actualiza usuario existente", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "user-123" })
    prisma.usuario.update.mockResolvedValue({})

    const res = await request(app).post("/generateApiSecret")

    expect(res.status).toBe(200)
    expect(prisma.usuario.update).toHaveBeenCalled()
  })

  it("DELETE /deleteApiSecret elimina el APISecret", async () => {
    prisma.usuario.update.mockResolvedValue({})

    const res = await request(app).delete("/deleteApiSecret")

    expect(res.status).toBe(200)
    expect(res.body.message).toContain("eliminado")
  })

  it("GET /hasAPISecret devuelve true si existe", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ APISecret: "hash" })

    const res = await request(app).get("/hasAPISecret")

    expect(res.status).toBe(200)
    expect(res.body.hasSecret).toBe(true)
  })

  it("GET /hasAPISecret devuelve false si no existe", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ APISecret: null })

    const res = await request(app).get("/hasAPISecret")

    expect(res.status).toBe(200)
    expect(res.body.hasSecret).toBe(false)
  })

  it("GET /racha/:userId devuelve racha existente", async () => {
    prisma.racha.findUnique.mockResolvedValue({
      usuarioId: "user-123",
      rachaActual: 5,
    })

    const res = await request(app).get("/racha/user-123")

    expect(res.status).toBe(200)
    expect(res.body.rachaActual).toBe(5)
  })

  it("GET /racha/:userId crea racha si no existe", async () => {
    prisma.racha.findUnique.mockResolvedValue(null)
    prisma.racha.create.mockResolvedValue({
      usuarioId: "user-123",
      rachaActual: 0,
      isInactive: true,
    })

    const res = await request(app).get("/racha/user-123")

    expect(res.status).toBe(200)
    expect(prisma.racha.create).toHaveBeenCalled()
  })
})
