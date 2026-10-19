import { PrismaClient } from "@prisma/client";
import { DEFAULTS } from "../src/lib/defaults";

/**
 * ============================================================================
 *  SEMILLA DE DATOS  (puerto de seed_defaults / seed_content / seed_blog_and_team)
 *  Solo actua sobre tablas vacias: nunca pisa lo que el administrador edite.
 *  Uso: npm run db:seed
 * ============================================================================
 */
const prisma = new PrismaClient();

async function seedDefaults() {
  let created = 0;
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const exists = await prisma.setting.findUnique({ where: { skey: key } });
    if (!exists) {
      await prisma.setting.create({ data: { skey: key, svalue: String(value), updatedAt: new Date() } });
      created++;
    }
  }
  console.log(`settings: ${created} valores nuevos`);
}

async function seedContent() {
  if ((await prisma.contentItem.count()) > 0) {
    console.log("content_items: ya tiene datos, no se toca");
    return;
  }

  const demo: Record<string, (string | number | Record<string, unknown>)[][]> = {
    servicio: [
      ["Soporte y mantenimiento", "Atención continua", "Soporte técnico preventivo y correctivo con tiempos de respuesta rápidos."],
      ["Consultoría", "Estrategia", "Diagnóstico tecnológico y hoja de ruta clara para tu transformación digital."],
      ["Diseño e impresiones", "Identidad visual", "Identidad visual, material gráfico e impresión de gran formato."],
      ["Instalación de redes", "Infraestructura", "Cableado estructurado, Wi-Fi de alto rendimiento y configuración segura."],
      ["Automatización con IA", "Productividad", "Automatiza tareas repetitivas y toma mejores decisiones con inteligencia artificial."],
      ["Soluciones informáticas", "Sistemas a medida", "Sistemas a medida, punto de venta y gestión empresarial adaptados a tu operación."],
    ],
    proyecto: [
      ["Red corporativa multi-sede", "Telecomunicaciones", "Cableado estructurado y Wi-Fi segmentado para una institución con tres sedes.", { image: "assets/img/proyecto-redes.jpg", resultado: "Cobertura del 99% y conectividad segura entre sedes." }],
      ["Automatización de inventario con IA", "Logística", "Predicción de demanda y reabastecimiento automático para un distribuidor regional.", { image: "assets/img/proyecto-ia.jpg", resultado: "Quiebres de stock reducidos en un 60% y rotación optimizada." }],
      ["Modernización de punto de venta", "Retail", "Sistema integrado de ventas e inventario para una cadena de tiendas en Artemisa.", { image: "assets/img/proyecto-web.jpg", resultado: "Reducción del 40% en errores de inventario y facturación 3× más rápida." }],
    ],
    testimonio: [
      ["Yanelis Pérez", "Gerente · Tienda La Artemiseña", "C-ROTULUS transformó nuestra forma de vender. El sistema de punto de venta es rápido y el soporte siempre está disponible.", { photo: "assets/img/testimonios/marta-lopez.jpg", rating: 5, resultado: "Sistema de ventas 3× más rápido" }],
      ["Javier Ruiz", "Director · Talleres Ruiz", "En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.", { photo: "assets/img/testimonios/javier-ruiz.jpg", rating: 5, resultado: "0 incidencias críticas en 12 meses" }],
      ["Cristina Serra", "Fundadora · CliniSalud", "Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.", { photo: "assets/img/testimonios/cristina-serra.jpg", rating: 5, resultado: "70% de consultas resueltas sin espera" }],
    ],
    proceso: [
      ["Diagnóstico", "", "Entendemos tu negocio y detectamos oportunidades."],
      ["Propuesta", "", "Diseñamos una solución clara con alcance y costo."],
      ["Implementación", "", "Ejecutamos la solución con calidad y a tiempo."],
      ["Capacitación", "", "Tu equipo domina la nueva tecnología."],
      ["Soporte", "", "Acompañamiento continuo tras el lanzamiento."],
    ],
    faq: [
      ["¿Atienden negocios fuera de Artemisa?", "", "Sí. Tenemos base en Artemisa pero acompañamos clientes en todo el occidente de Cuba. Para proyectos lejanos combinamos visitas con soporte remoto.", 5],
      ["¿Cuánto tarda un proyecto típico?", "", "Depende del alcance. Una instalación de red o punto de venta suele tomar de 1 a 3 semanas; proyectos con automatización de IA entre 4 y 8 semanas. Siempre entregamos un cronograma en la propuesta.", 4],
      ["¿Ofrecen soporte después de la entrega?", "", "Sí. Todos los proyectos incluyen un periodo de garantía y ofrecemos planes de soporte preventivo y correctivo con tiempos de respuesta definidos.", 4],
      ["¿Trabajan con equipos y software que ya tenemos?", "", "En la mayoría de los casos, sí. Hacemos un diagnóstico inicial para aprovechar tu infraestructura existente y recomendamos cambios solo cuando aportan valor real.", 3],
      ["¿Cómo solicito un presupuesto?", "", "Completa el formulario de contacto o escríbenos por WhatsApp. Te respondemos en menos de 24 horas hábiles con una primera propuesta.", 3],
      ["¿Sus soluciones funcionan sin conexión a Internet?", "", "Diseñamos sistemas que operan en redes locales sin depender de Internet, ideal para entornos con conectividad limitada. La nube se usa solo cuando aporta ventajas.", 2],
    ],
  };

  const now = new Date();
  for (const [ctype, items] of Object.entries(demo)) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const meta = it[3] && typeof it[3] === "object" ? (it[3] as Record<string, unknown>) : null;
      const score = ctype === "faq" && typeof it[3] === "number" ? (it[3] as number) : 0;
      await prisma.contentItem.create({
        data: {
          ctype,
          title: String(it[0]),
          subtitle: String(it[1]),
          body: String(it[2]),
          meta: meta as never,
          score,
          sortOrder: i,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  }
  console.log("content_items: sembrado");
}

async function seedBlogAndTeam() {
  const now = new Date();

  if ((await prisma.teamMember.count()) === 0) {
    const team = [
      ["Marta López", "Directora de proyectos", "Coordina cada proyecto de principio a fin y se asegura de que cumplimos plazos y presupuesto.", "marta.lopez@crotulus.example", "assets/img/equipo/marta-lopez.svg"],
      ["Javier Ruiz", "Ingeniero de redes", "Diseña y protege la infraestructura de red de nuestros clientes, con foco en la seguridad.", "javier.ruiz@crotulus.example", "assets/img/equipo/javier-ruiz.svg"],
      ["Cristina Serra", "Especialista en IA", "Crea automatizaciones y agentes de IA que ahorran horas de trabajo repetitivo.", "cristina.serra@crotulus.example", "assets/img/equipo/cristina-serra.svg"],
      ["Diego Marín", "Desarrollador web", "Construye webs y aplicaciones rápidas, accesibles y fáciles de gestionar.", "diego.marin@crotulus.example", "assets/img/equipo/diego-marin.svg"],
    ];
    for (let i = 0; i < team.length; i++) {
      const m = team[i];
      await prisma.teamMember.create({
        data: { name: m[0], role: m[1], bio: m[2], email: m[3], phone: "", avatar: m[4], sortOrder: i, isActive: true, createdAt: now, updatedAt: now },
      });
    }
    console.log("team_members: sembrado");
  }

  if ((await prisma.blogPost.count()) === 0) {
    const posts = [
      ["automatizacion-ia-pymes", "Cómo la IA puede ahorrar horas a tu pyme", "Descubre qué tareas conviene automatizar primero y cómo empezar sin complicaciones.", "La inteligencia artificial ya no es cosa de grandes empresas. En este artículo repasamos tareas cotidianas que puedes automatizar —presupuestos, respuestas frecuentes, informes— y cómo dar el primer paso con un coste bajo.", "Automatización", "Marta López", "assets/img/blog/automatizacion-ia-pymes.jpg"],
      ["seguridad-red-pyme", "Protege tu red: 5 medidas básicas", "Cinco acciones sencillas que reducen drásticamente el riesgo de un incidente.", "No necesitas un gran presupuesto para proteger tu negocio. Estas cinco medidas —copias de seguridad, contraseñas robustas, actualizaciones, Wi-Fi segmentado y formación del equipo— cubren la mayoría de riesgos habituales.", "Seguridad", "Javier Ruiz", "assets/img/blog/seguridad-red-pyme.jpg"],
      ["web-que-convierte", "Una web que convierte visitas en clientes", "Qué debe tener tu web para que quien llega termine contactando contigo.", "Una web bonita que no genera contactos es un gasto, no una inversión. Repasamos los elementos que marcan la diferencia: mensaje claro, prueba social, llamadas a la acción visibles y velocidad de carga.", "Desarrollo web", "Diego Marín", "assets/img/blog/web-que-convierte.jpg"],
    ];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      await prisma.blogPost.create({
        data: {
          slug: p[0], title: p[1], excerpt: p[2], body: p[3], category: p[4], author: p[5], image: p[6],
          meta: { reading_minutes: 4 } as never,
          sortOrder: i,
          isActive: true,
          publishedAt: new Date(Date.now() - (i + 1) * 86400000),
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    console.log("blog_posts: sembrado");
  }
}

async function main() {
  await seedDefaults();
  await seedContent();
  await seedBlogAndTeam();
  console.log("Semilla completada.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
