const updateBudgetSpent = async (
  prisma,
  userId,
  amount,
  categoryId,
  dateStr
) => {
  try {
    const dateObj = new Date(dateStr)

    // Buscar presupuesto activo para esa fecha
    const presupuesto = await prisma.presupuesto.findFirst({
      where: {
        usuarioId: userId,
        fechaInicio: { lte: dateObj },
        fechaFin: { gte: dateObj },
      },
    })

    if (!presupuesto) return // No hay presupuesto activo

    // Buscar si esa categoría está en el presupuesto
    const presupuestoCategoria = await prisma.presupuestoCategoria.findFirst({
      where: {
        presupuestoId: presupuesto.id,
        categoriaId: parseInt(categoryId),
      },
    })

    if (!presupuestoCategoria) return // Categoría no trackeada en este presupuesto

    // Actualizar el acumulado
    // Nota: Como 'gasto' es Float y 'gastadoAct' es Int, redondeamos para evitar errores
    await prisma.presupuestoCategoria.update({
      where: { id: presupuestoCategoria.id },
      data: {
        gastadoAct: { increment: Math.round(amount) },
      },
    })
  } catch (error) {
    console.error("Error actualizando gastadoAct en presupuesto:", error)
  }
}

module.exports = updateBudgetSpent
