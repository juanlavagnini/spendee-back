const serverless = require("serverless-http")
const express = require("express")
const validateToken = require("./middleware/validateToken")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const app = express()

app.use(express.json())

// Mount API routes protected by APISecret (x-api-key + x-api-user-id)
const apiRouter = require("./routes/api.js")
app.use("/api", apiRouter)

const authRouter = require("./routes/auth.js")
app.use("/auth", authRouter)

const oauthRouter = require("./oauth/routes.js")
app.use("/oauth", oauthRouter)

const cron = require("./routes/cron.js")
app.use("/cron", cron)

const piggyRouter = require("./piggy/routes.js")
app.use("/piggy", piggyRouter)

const expenseRouter = require("./routes/expenses/expense.js")
app.use("/expense", expenseRouter)

const categoryRouter = require("./routes/category/category.js")
app.use("/categories", categoryRouter)

const incomesRouter = require("./routes/incomes/incomes.js")
app.use("/income", incomesRouter)

const balanceRouter = require("./routes/balance/balance.js")
app.use("/balance", balanceRouter)

const budgetRouter = require("./routes/budget/budget.js")
app.use("/budget", budgetRouter)

app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

app.get("/test-jwt", validateToken, (req, res) => {
  res.json({
    message: "JWT válido!",
    usuario: req.usuario,
  })
})
//get API ID
app.get("/getApiId", validateToken, async (req, res) => {
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid
  console.log("Obteniendo API User ID:", uid)
  res.json({ apiId: uid })
})

//Generar API Secret
app.post("/generateApiSecret", validateToken, async (req, res) => {
  // Extraer identificadores desde el token (compatible con distintos claim names de Firebase)
  const uid = req.usuario?.sub || req.usuario?.user_id || req.usuario?.uid
  const email = req.usuario?.email
  const nombre = req.usuario?.name || req.usuario?.displayName || ""

  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }

  const crypto = require("crypto")

  try {
    const apiSecret = crypto.randomBytes(32).toString("hex")
    const salt = crypto.randomBytes(16).toString("hex")
    const derivedKey = crypto.scryptSync(apiSecret, salt, 64).toString("hex")
    const storedValue = `${salt}:${derivedKey}`

    const existingUser = await prisma.usuario.findUnique({
      where: { id: uid },
    })

    if (existingUser) {
      await prisma.usuario.update({
        where: { id: uid },
        data: { APISecret: storedValue },
      })
    } else {
      const emailToStore = email
      await prisma.usuario.create({
        data: {
          id: uid,
          nombre: nombre || "",
          email: emailToStore,
          isDeveloper: true,
          APISecret: storedValue,
        },
      })
    }

    // Devolver el secret en texto plano al usuario
    res.json({ apiSecret })
  } catch (error) {
    console.error("Error generando API Secret:", error)
    res.status(500).json({ error: "Error generando API Secret" })
  }
})

app.delete("/deleteApiSecret", validateToken, async (req, res) => {
  console.log("Eliminando API Secret del usuario")
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid
  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }
  try {
    await prisma.usuario.update({
      where: { id: uid },
      data: { APISecret: null, isDeveloper: false },
    })
    console.log(`API Secret eliminado para el usuario ${uid}`)
    res.json({ message: "API Secret eliminado correctamente" })
  } catch (error) {
    console.error("Error eliminando API Secret:", error)
    res.status(500).json({ error: "Error eliminando API Secret" })
  }
})

app.get("/hasAPISecret", validateToken, async (req, res) => {
  console.log("Verificando si el usuario tiene API Secret")
  const uid = req.user?.sub || req.user?.user_id || req.user?.uid

  if (!uid) {
    return res.status(400).json({
      error: "No se pudo obtener el identificador del usuario del token",
    })
  }
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: uid },
    })
    const hasSecret = !!(user && user.APISecret)
    console.log(`Usuario ${uid} tiene API Secret: ${hasSecret}`)
    res.json({ hasSecret })
  } catch (error) {
    console.error("Error verificando API Secret:", error)
    res.status(500).json({ error: "Error verificando API Secret" })
  }
})

app.get("/racha/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  // if (isNaN(userId)) {
  //   return res.status(400).json({ error: "userId inválido" })
  // }
  try {
    let racha = await prisma.racha.findUnique({
      where: { usuarioId: userId },
    })
    console.log("Racha encontrada:", racha)
    if (!racha) {
      console.log("No se encontró racha, creando una nueva con valor 0")
      racha = await prisma.racha.create({
        data: {
          usuarioId: userId,
          rachaActual: 0,
          ultimaFecha: (() => {
            const ayer = new Date()
            ayer.setDate(ayer.getDate() - 1)
            return ayer
          })(),
          isInactive: true,
        },
      })
    }
    res.status(200).json(racha)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

//ruta inicial /
app.get("/", (req, res) => {
  res.status(200).send("Spendee API is running")
})

const PORT = process.env.PORT || 3000
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`)
  })
}

//module.exports = serverless(app)
module.exports = app

/* 
app.get("/ingreso/:userId", validateToken, async (req, res) => {
  const { userId } = req.params
  try {
    const userIncomes = await prisma.ingreso.findMany({
      where: { usuarioId: userId },
    })
    res.status(200).json(userIncomes)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
*/
