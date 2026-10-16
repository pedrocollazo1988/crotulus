/**
 * ============================================================================
 *  VALORES POR DEFECTO EDITABLES (espejo de config.php > 'defaults')
 *  Sin "server-only": lo comparten la config del servidor y los scripts
 *  (semilla y migracion de datos).
 * ============================================================================
 */

type Dict = Record<string, unknown>;

const DEFAULTS: Dict = {
  // Identidad y SEO
  meta_description:
    "Servicios tecnológicos para pymes y autónomos: desarrollo web, automatización e IA, redes, soporte y mantenimiento.",
  meta_keywords:
    "servicios tecnológicos, desarrollo web, automatización, inteligencia artificial, soporte técnico, redes, pymes",
  og_image: "assets/img/og-image.jpg",

  // Portada (hero)
  hero_badge: "Agencia de servicios tecnológicos · Pymes y autónomos",
  hero_title: "Tecnología clara que hace crecer tu negocio",
  hero_title_accent: "hace crecer",
  hero_subtitle:
    "Ayudamos a pymes y autónomos a digitalizarse con desarrollo web, automatización e IA, redes seguras y soporte continuo. Menos problemas, más tiempo para lo que importa.",
  hero_cta1_label: "Solicitar servicios",
  hero_cta2_label: "Escríbenos por WhatsApp",
  hero_image: "assets/img/hero-tech.svg",
  hero_image_alt:
    "Panel de control de C-ROTULUS con gráficas, servicios en la nube y una red de datos conectada",

  // Cifras
  stat1_value: "12", stat1_label: "años de experiencia",
  stat2_value: "180", stat2_label: "clientes satisfechos",
  stat3_value: "350", stat3_label: "proyectos entregados",
  stat4_value: "24", stat4_label: "horas de respuesta",

  // Cabeceras de seccion
  about_eyebrow: "Sobre nosotros",
  about_title: "Un equipo cercano con soluciones serias",
  about_lead:
    "Desde [AÑO DE FUNDACIÓN] acompañamos a empresas en su transformación digital, combinando tecnología y trato humano.",
  team_eyebrow: "Equipo",
  team_title: "Las personas detrás de C-ROTULUS",
  team_lead:
    "Un equipo pequeño, cercano y especializado. Estas son las personas que te atenderán y trabajarán en tu proyecto.",
  services_eyebrow: "Servicios",
  services_title: "Todo lo que tu empresa necesita, en un solo equipo",
  services_lead:
    "Servicios de ejemplo fáciles de editar. Cada tarjeta incluye icono, descripción, contenido y botón de consulta.",
  projects_eyebrow: "Proyectos",
  projects_title: "Trabajos que ya están dando resultados",
  projects_lead:
    "Una muestra de proyectos de ejemplo. Sustituye las imágenes, los textos y las etiquetas por tus casos reales.",
  blog_eyebrow: "Blog",
  blog_title: "Ideas y consejos para tu negocio",
  blog_lead:
    "Publicamos guías sencillas sobre tecnología, seguridad y productividad. Sin tecnicismos innecesarios.",
  process_eyebrow: "Cómo trabajamos",
  process_title: "Un proceso simple, en cuatro pasos",
  process_lead:
    "Sin sorpresas: te acompañamos desde la primera conversación hasta el soporte del día a día.",
  testimonials_eyebrow: "Testimonios",
  testimonials_title: "Lo que opinan nuestros clientes",
  testimonials_lead: "Opiniones de clientes reales. Para compartir la tuya, entra en tu cuenta.",
  reviews_eyebrow: "Opiniones",
  reviews_title: "Lo que opinan de nosotros en Google",
  reviews_lead:
    "Reseñas reales de clientes publicadas en nuestra ficha de Google. Puedes leerlas todas en un clic.",
  trustpilot_eyebrow: "Reseñas verificadas",
  trustpilot_title: "Lo que dicen en Trustpilot",
  trustpilot_lead:
    "Opiniones reales de clientes publicadas en nuestra ficha de Trustpilot.",
  contact_eyebrow: "Contacto",
  contact_title: "Cuéntanos tu proyecto",
  contact_lead:
    "Rellena el formulario y te respondemos en menos de 24 horas laborables.",
  location_eyebrow: "Ubicación",
  location_title: "Dónde estamos y cómo contactarnos",
  location_lead:
    "Visítanos, llámanos o escríbenos. Estamos a tu disposición en horario de oficina.",
  faq_eyebrow: "Preguntas frecuentes",
  faq_title: "Resolvemos tus dudas",
  faq_lead:
    "Mostramos las preguntas más relevantes, ordenadas automáticamente por su importancia.",

  // Sobre nosotros
  about_body:
    "C-ROTULUS nació con una idea sencilla: la tecnología no debería ser un dolor de cabeza. Empezamos resolviendo pequeños problemas informáticos para negocios de nuestro entorno y, con el tiempo, ampliamos el servicio hasta diseñar, desplegar y mantener la infraestructura digital completa de nuestros clientes.",
  about_image: "assets/img/equipo.svg",
  about_image_alt:
    "Equipo de profesionales de C-ROTULUS trabajando en un proyecto",

  // Pie
  footer_tagline:
    "Servicios tecnológicos para empresas. Desarrollo, automatización, redes y soporte con trato cercano.",
  footer_legal: "Aviso legal · Privacidad · Cookies",

  // Contacto y redes
  telefono: "+5359888821",
  whatsapp: "5359888821",
  correo: "crotulus.mipyme@gmail.com",
  direccion: "Calle 29 #5408 e/ 54 y 56",
  ciudad: "Artemisa",
  horario: "Lunes a Viernes de 9:00 am a 5:00 pm",
  mapa_embed:
    "https://www.google.com/maps?q=Calle%2029%20%235408%20e%2F%2054%20y%2056%2C%20Artemisa%2C%20Cuba&output=embed",
  google_maps_url:
    "https://www.google.com/maps/dir/?api=1&destination=Calle%2029%20%235408%20e%2F%2054%20y%2056%2C%20Artemisa%2C%20Cuba",
  facebook: "https://www.facebook.com/com.rotulus.surl",
  instagram: "[URL_INSTAGRAM]",
  linkedin: "[URL_LINKEDIN]",
  github: "[URL_GITHUB]",

  // Correo saliente
  mail_transport: "smtp",
  mail_from_email: "",
  mail_from_name: "C-ROTULUS",
  mail_to_email: "crotulus.mipyme@gmail.com",
  mail_smtp_host: "smtp.gmail.com",
  mail_smtp_port: "587",
  mail_smtp_user: "crotulus.mipyme@gmail.com",
  mail_smtp_pass: "",
  mail_smtp_secure: "tls",

  // Seguridad
  security_password_min: "8",
  security_session_lifetime: "2592000",
  security_session_bind_ip: "0",
  security_contact_rate_max: "5",
  security_contact_rate_window: "3600",
  security_login_rate_max: "10",
  security_login_rate_window: "900",
  security_review_rate_max: "6",
  security_review_rate_window: "3600",
  security_submission_rate_max: "8",
  security_submission_rate_window: "3600",

  // Verificacion en dos pasos (2FA)
  two_factor_mode: "optional",
  two_factor_channel_default: "email",
  two_factor_code_ttl: "600",
  two_factor_max_attempts: "5",
  two_factor_resend_cooldown: "60",
  two_factor_trust_device_days: "30",
  two_factor_remember_device: "1",

  // SMS (Twilio)
  sms_provider: "disabled",
  sms_twilio_account_sid: "",
  sms_twilio_auth_token: "",
  sms_twilio_from: "",
  sms_default_country_code: "+53",

  // Rutas y mantenimiento
  paths_log_dir: "",
  maintenance_mode: "0",
  maintenance_message: "Estamos mejorando la web. Volvemos en unos minutos.",

  // Valoraciones y resenas
  reviews_enabled: "1",
  reviews_auto_approve: "0",
  reviews_provider: "trustpilot",
  trustpilot_url: "https://es.trustpilot.com/review/[TU-DOMINIO]",
  trustpilot_business_id: "[TRUSTPILOT_BUSINESS_ID]",
  trustpilot_template: "carrusel",
  google_reviews_url:
    "https://www.google.com/maps/search/?api=1&query=C-ROTULUS+Artemisa",
  google_place_id: "",
  google_places_api_key: "",
  google_reviews_cache_ttl: "21600",

  // Aportaciones y FAQ
  submissions_enabled: "1",
  submissions_auto_approve: "0",
  faq_portal_count: "6",
};
export { DEFAULTS };
export type { Dict };
