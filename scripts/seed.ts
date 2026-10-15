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
      ["Desarrollo web y aplicaciones", "Diseño y programación", "Webs corporativas, tiendas online y aplicaciones a medida rápidas y fáciles de gestionar."],
      ["Automatización y agentes de IA", "Productividad", "Automatizamos tareas repetitivas y creamos asistentes que atienden, filtran y organizan información."],
      ["Soporte técnico", "Atención continua", "Atención rápida para tu equipo: incidencias, equipos y software resueltos sin perder tiempo."],
      ["Redes y ciberseguridad", "Infraestructura", "Infraestructura de red estable y protegida, con copias de seguridad y planes de contingencia."],
      ["Consultoría tecnológica", "Estrategia", "Analizamos qué necesitas de verdad y trazamos un plan realista, con presupuesto claro."],
      ["Mantenimiento integral", "Continuidad", "Nos ocupamos de que todo siga funcionando: actualizaciones, monitorización y mejoras continuas."],
    ],
    proyecto: [
      ["Tienda online para distribuidora local", "Desarrollo web", "Catálogo de más de 2.000 referencias, pago integrado y panel de gestión para el equipo.", { image: "assets/img/proyecto-web.svg" }],
      ["Asistente que atiende consultas 24/7", "Automatización e IA", "Un agente de IA que responde dudas frecuentes y deriva las incidencias al equipo humano.", { image: "assets/img/proyecto-ia.svg" }],
      ["Renovación de red en oficinas", "Redes y seguridad", "Cableado, Wi-Fi profesional y firewall gestionado para 60 puestos de trabajo.", { image: "assets/img/proyecto-redes.svg" }],
    ],
    testimonio: [
      ["Marta López", "Gerente · Distribuciones ML", "Nos renovaron la web y automatizaron los presupuestos. Ahora ahorramos varias horas cada semana y todo es mucho más claro.", { photo: "assets/img/testimonios/marta-lopez.jpg", rating: 5, resultado: "+40% de solicitudes online en 3 meses" }],
      ["Javier Ruiz", "Director · Talleres Ruiz", "En una semana teníamos la red y las copias de seguridad funcionando. El soporte responde siempre rápido.", { photo: "assets/img/testimonios/javier-ruiz.jpg", rating: 5, resultado: "0 incidencias críticas en 12 meses" }],
      ["Cristina Serra", "Fundadora · CliniSalud", "Un asistente de IA atiende nuestras consultas fuera de horario. Ha mejorado la atención al cliente notablemente.", { photo: "assets/img/testimonios/cristina-serra.jpg", rating: 5, resultado: "70% de consultas resueltas sin espera" }],
    ],
    proceso: [
      ["Diagnóstico", "", "Escuchamos tus necesidades y analizamos el estado actual de tu tecnología."],
      ["Propuesta", "", "Recibes una solución clara, con alcance, plazos y precio cerrado."],
      ["Implementación", "", "Ejecutamos el proyecto con seguimiento y pruebas antes de la entrega."],
      ["Soporte", "", "Te acompañamos después: mantenimiento, mejoras y atención cuando lo necesites."],
    ],
    faq: [
      ["¿Cuánto cuesta un proyecto?", "", "Depende del alcance. Tras el diagnóstico gratuito te entregamos un presupuesto cerrado y sin compromiso, con todo detallado.", 5],
      ["¿Cuánto tardáis en entregar?", "", "Una web corporativa suele estar en 2-4 semanas. Los proyectos de automatización o redes dependen del alcance; acordamos plazos antes de empezar.", 4],
      ["¿Ofrecéis garantía?", "", "Sí. Todo trabajo incluye garantía sobre lo entregado y, opcionalmente, un plan de mantenimiento para mantenerlo actualizado y seguro.", 3],
      ["¿Qué incluye el soporte?", "", "Atención por teléfono, correo o WhatsApp, resolución de incidencias, actualizaciones de seguridad y asesoramiento según el plan contratado.", 2],
      ["¿Cómo puedo pagar?", "", "Aceptamos transferencia bancaria y pago con tarjeta. En proyectos grandes, un anticipo al empezar y el resto a la entrega.", 2],
      ["¿Cómo empiezo?", "", "Escríbenos por el formulario o WhatsApp. Concertamos una llamada o reunión sin coste y te proponemos los siguientes pasos.", 3],
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
      ["automatizacion-ia-pymes", "Cómo la IA puede ahorrar horas a tu pyme", "Descubre qué tareas conviene automatizar primero y cómo empezar sin complicaciones.", "La inteligencia artificial ya no es cosa de grandes empresas. En este artículo repasamos tareas cotidianas que puedes automatizar —presupuestos, respuestas frecuentes, informes— y cómo dar el primer paso con un coste bajo.", "Automatización", "Marta López", "assets/img/blog/automatizacion-ia-pymes.svg"],
      ["seguridad-red-pyme", "Protege tu red: 5 medidas básicas", "Cinco acciones sencillas que reducen drásticamente el riesgo de un incidente.", "No necesitas un gran presupuesto para proteger tu negocio. Estas cinco medidas —copias de seguridad, contraseñas robustas, actualizaciones, Wi-Fi segmentado y formación del equipo— cubren la mayoría de riesgos habituales.", "Seguridad", "Javier Ruiz", "assets/img/blog/seguridad-red-pyme.svg"],
      ["web-que-convierte", "Una web que convierte visitas en clientes", "Qué debe tener tu web para que quien llega termine contactando contigo.", "Una web bonita que no genera contactos es un gasto, no una inversión. Repasamos los elementos que marcan la diferencia: mensaje claro, prueba social, llamadas a la acción visibles y velocidad de carga.", "Desarrollo web", "Diego Marín", "assets/img/blog/web-que-convierte.svg"],
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
