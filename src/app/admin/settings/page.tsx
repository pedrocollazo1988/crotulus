import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Alert } from "@/components/admin-ui";
import { SettingsTabs } from "@/components/settings-tabs";
import { requireAdmin } from "@/lib/admin-guard";
import { csrfToken, csrfVerify } from "@/lib/csrf";
import { settingsAll, setting } from "@/lib/settings";
import { adminSaveSettings, adminSystemInfo, audit } from "@/lib/admin";
import { googleReviewsEnabled, googleReviewsCached, googleReviewsRefresh } from "@/lib/google-reviews";
import { trustpilotFetch } from "@/lib/trustpilot";
import { mailNotifyTo, mailerTemplate, sendMail, mailerLastError } from "@/lib/mailer";
import { googleEnabled, googleRedirectUri, googleConfigIssues } from "@/lib/auth";
import { getConfig } from "@/lib/config";

/**
 * ============================================================================
 *  AJUSTES  ->  /admin/settings  (antes admin/settings.php)
 *  Pestanas: General, Textos, Contacto, Correo, Resenas, Aportaciones,
 *  Seguridad, Google y Rutas. La pestana activa se recuerda con #ancla.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/** Lista de campos que cada formulario controla como casilla. */
const SCOPE = {
  general: ["maintenance_mode"],
  resenas: ["reviews_enabled", "reviews_auto_approve"],
  aportaciones: ["submissions_enabled", "submissions_auto_approve"],
  seguridad: ["security_session_bind_ip"],
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const flashOk = typeof sp["ok"] === "string" ? sp["ok"] : "";
  const flashErr = typeof sp["err"] === "string" ? sp["err"] : "";
  const csrf = csrfToken();

  /** Server Action: guarda los ajustes enviados por un formulario. */
  async function save(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/settings?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const scope = (data["_checkboxes"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    await adminSaveSettings(data, scope);
    await audit("settings_updated");
    revalidatePath("/admin/settings");
    redirect(`/admin/settings?ok=${encodeURIComponent("Ajustes guardados.")}`);
  }

  /** Server Action: acciones puntuales (correo de prueba, refrescos). */
  async function action(formData: FormData) {
    "use server";
    await requireAdmin();
    const data: Record<string, string> = {};
    formData.forEach((v, k) => (data[k] = typeof v === "string" ? v : ""));
    if (!csrfVerify(data["_csrf"])) {
      redirect(`/admin/settings?err=${encodeURIComponent("Token de seguridad inválido.")}`);
    }
    const doAct = data["do"] ?? "";

    if (doAct === "test_mail") {
      const to = await mailNotifyTo();
      if (to === "") {
        redirect(`/admin/settings#correo?err=${encodeURIComponent("Configura antes un correo válido en «Correo que recibe los avisos».")}`);
      }
      const ok = await sendMail(
        to,
        `Prueba de envío · ${getConfig().siteName}`,
        mailerTemplate("Prueba de envío de correo", "<p>Si lees este mensaje, tu correo está bien configurado.</p>"),
      );
      const transport = getConfig().mail.transport || "log";
      if (ok) {
        const extra = transport === "log" ? " (transporte «log»: no sale de verdad, se guarda en el log)" : "";
        redirect(`/admin/settings?ok=${encodeURIComponent(`Correo de prueba enviado a ${to} (transporte: ${transport})${extra}.`)}`);
      }
      const motivo = mailerLastError();
      redirect(`/admin/settings?err=${encodeURIComponent(`No se pudo enviar el correo (transporte: ${transport}).${motivo ? " Motivo: " + motivo : ""}`)}`);
    }

    if (doAct === "refresh_trustpilot") {
      const tp = await trustpilotFetch(true);
      redirect(tp.ok
        ? `/admin/settings?ok=${encodeURIComponent(`Trustpilot actualizado: ${tp.summary.total} reseñas, nota ${tp.summary.average}/5.`)}`
        : `/admin/settings?err=${encodeURIComponent("Trustpilot bloquea las peticiones del servidor. Usa el widget oficial (Business Unit ID).")}`);
    }

    if (doAct === "refresh_google_reviews") {
      if (!(await googleReviewsEnabled())) {
        redirect(`/admin/settings?err=${encodeURIComponent("Configura antes el Place ID y la clave de la API de Google Places.")}`);
      }
      const gr = await googleReviewsRefresh();
      if (gr["live"]) {
        const items = gr["items"] as unknown[];
        const summary = gr["summary"] as { average: number };
        redirect(`/admin/settings?ok=${encodeURIComponent(`Reseñas de Google actualizadas: ${items.length} guardadas, nota ${summary.average}/5.`)}`);
      }
      redirect(`/admin/settings?err=${encodeURIComponent("No se pudo conectar con Google. Se mantienen las últimas guardadas.")}`);
    }

    redirect(`/admin/settings?err=${encodeURIComponent("Acción no válida.")}`);
  }

  const s = await settingsAll();
  const info = await adminSystemInfo();
  const googleOn = await googleEnabled();
  const googleIssues = await googleConfigIssues();
  const redirectUri = await googleRedirectUri();
  const grEnabled = await googleReviewsEnabled();
  const grCached = (await googleReviewsCached(3)).length;
  const grFetched = await setting("google_reviews_fetched_at", "");
  const tpCache = await setting("trustpilot_cache_updated_at", "");

  return (
    <>
      <h1>Ajustes del sitio</h1>
      <p className="muted">
        Configura aquí todo lo que la web necesita: contacto, correo de envío, reseñas,
        aportaciones, seguridad, integraciones y rutas. Lo guardado aquí tiene prioridad
        sobre las variables de entorno.
      </p>
      {flashOk ? <Alert kind="ok">{flashOk}</Alert> : null}
      {flashErr ? <Alert kind="error">{flashErr}</Alert> : null}

      <SettingsTabs>
        {/* ============================ GENERAL ============================ */}
        <section className="tabs__panel is-active" data-panel="general" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="_checkboxes" value={SCOPE.general.join(",")} />
            <div className="settings-card">
              <h2>Identidad del sitio</h2>
              <p className="muted">Nombre, dirección web y textos que aparecen en los buscadores.</p>
              <div className="grid-2">
                <div className="field"><label htmlFor="site_name">Nombre del sitio</label>
                  <input type="text" id="site_name" name="site_name" defaultValue={s["site_name"] ?? ""} /></div>
                <div className="field"><label htmlFor="site_url">URL del sitio</label>
                  <input type="text" id="site_url" name="site_url" defaultValue={s["site_url"] ?? ""} placeholder="https://www.tu-dominio.com" />
                  <p className="muted">Sin barra final. Se usa en los correos y en las URLs absolutas.</p></div>
                <div className="field"><label htmlFor="meta_description">Meta descripción (SEO)</label>
                  <input type="text" id="meta_description" name="meta_description" maxLength={300} defaultValue={s["meta_description"] ?? ""} /></div>
                <div className="field"><label htmlFor="meta_keywords">Palabras clave (SEO)</label>
                  <input type="text" id="meta_keywords" name="meta_keywords" defaultValue={s["meta_keywords"] ?? ""} /></div>
                <div className="field"><label htmlFor="og_image">Imagen para compartir (Open Graph)</label>
                  <input type="text" id="og_image" name="og_image" defaultValue={s["og_image"] ?? ""} placeholder="assets/img/og-image.jpg" /></div>
              </div>
            </div>
            <div className="settings-card">
              <h2>Modo mantenimiento</h2>
              <p className="muted">Muestra un aviso en la web pública y oculta el formulario de contacto.</p>
              <div className="grid-2">
                <div className="field"><label>
                  <input type="checkbox" name="maintenance_mode" value="1" defaultChecked={(s["maintenance_mode"] ?? "0") === "1"} /> Activar el modo mantenimiento</label></div>
                <div className="field"><label htmlFor="maintenance_message">Mensaje mostrado</label>
                  <input type="text" id="maintenance_message" name="maintenance_message" defaultValue={s["maintenance_message"] ?? ""} /></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar ajustes generales</button>
          </form>
        </section>

        {/* ============================ TEXTOS ============================ */}
        <section className="tabs__panel" data-panel="textos" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <div className="settings-card">
              <h2>Portada</h2>
              <p className="muted">Titular, subtítulo, botones e imagen de la portada.</p>
              <div className="field"><label htmlFor="hero_badge">Etiqueta superior</label>
                <input type="text" id="hero_badge" name="hero_badge" defaultValue={s["hero_badge"] ?? ""} /></div>
              <div className="field"><label htmlFor="hero_title">Titular (h1)</label>
                <input type="text" id="hero_title" name="hero_title" defaultValue={s["hero_title"] ?? ""} /></div>
              <div className="field"><label htmlFor="hero_title_accent">Palabra destacada del titular</label>
                <input type="text" id="hero_title_accent" name="hero_title_accent" defaultValue={s["hero_title_accent"] ?? ""} placeholder="hace crecer" />
                <small className="muted">Debe coincidir literalmente con una parte del titular.</small></div>
              <div className="field"><label htmlFor="hero_subtitle">Subtítulo</label>
                <textarea id="hero_subtitle" name="hero_subtitle" rows={3} defaultValue={s["hero_subtitle"] ?? ""} /></div>
              <div className="grid-2">
                <div className="field"><label htmlFor="hero_cta1_label">Botón principal</label>
                  <input type="text" id="hero_cta1_label" name="hero_cta1_label" defaultValue={s["hero_cta1_label"] ?? ""} /></div>
                <div className="field"><label htmlFor="hero_cta2_label">Botón de WhatsApp</label>
                  <input type="text" id="hero_cta2_label" name="hero_cta2_label" defaultValue={s["hero_cta2_label"] ?? ""} /></div>
              </div>
              <div className="field"><label htmlFor="hero_image">Imagen de la portada (ruta)</label>
                <input type="text" id="hero_image" name="hero_image" defaultValue={s["hero_image"] ?? ""} placeholder="assets/img/hero-tech.svg" /></div>
              <div className="field"><label htmlFor="hero_image_alt">Texto alternativo de la imagen</label>
                <input type="text" id="hero_image_alt" name="hero_image_alt" defaultValue={s["hero_image_alt"] ?? ""} /></div>
            </div>

            <div className="settings-card">
              <h2>Cifras de confianza</h2>
              <p className="muted">Cuatro cifras de la portada. El valor debe ser un número.</p>
              {[1, 2, 3, 4].map((i) => (
                <div className="grid-2" key={i}>
                  <div className="field"><label htmlFor={`stat${i}_value`}>Cifra {i}</label>
                    <input type="number" min={0} id={`stat${i}_value`} name={`stat${i}_value`} defaultValue={s[`stat${i}_value`] ?? ""} /></div>
                  <div className="field"><label htmlFor={`stat${i}_label`}>Texto de la cifra {i}</label>
                    <input type="text" id={`stat${i}_label`} name={`stat${i}_label`} defaultValue={s[`stat${i}_label`] ?? ""} /></div>
                </div>
              ))}
            </div>

            <div className="settings-card">
              <h2>Sobre nosotros (página Empresa)</h2>
              <div className="field"><label htmlFor="about_title">Titular de la sección</label>
                <input type="text" id="about_title" name="about_title" defaultValue={s["about_title"] ?? ""} /></div>
              <div className="field"><label htmlFor="about_lead">Subtítulo de la sección</label>
                <input type="text" id="about_lead" name="about_lead" defaultValue={s["about_lead"] ?? ""} /></div>
              <div className="field"><label htmlFor="about_body">Nuestra historia</label>
                <textarea id="about_body" name="about_body" rows={6} defaultValue={s["about_body"] ?? ""} /></div>
              <div className="field"><label htmlFor="about_image">Imagen del equipo (ruta)</label>
                <input type="text" id="about_image" name="about_image" defaultValue={s["about_image"] ?? ""} placeholder="assets/img/equipo.svg" /></div>
              <div className="field"><label htmlFor="about_image_alt">Texto alternativo de la imagen</label>
                <input type="text" id="about_image_alt" name="about_image_alt" defaultValue={s["about_image_alt"] ?? ""} /></div>
            </div>

            <div className="settings-card">
              <h2>Cabeceras de las secciones</h2>
              <p className="muted">Titular y subtítulo de cada sección. La etiqueta superior solo cambia si escribes un valor.</p>
              {SECTION_HEADS.map(([key, label]) => (
                <fieldset className="field-group" key={key}>
                  <legend>{label}</legend>
                  <div className="field"><label htmlFor={`${key}_eyebrow`}>Etiqueta superior</label>
                    <input type="text" id={`${key}_eyebrow`} name={`${key}_eyebrow`} defaultValue={s[`${key}_eyebrow`] ?? ""} /></div>
                  <div className="field"><label htmlFor={`${key}_title`}>Titular</label>
                    <input type="text" id={`${key}_title`} name={`${key}_title`} defaultValue={s[`${key}_title`] ?? ""} /></div>
                  <div className="field"><label htmlFor={`${key}_lead`}>Subtítulo</label>
                    <input type="text" id={`${key}_lead`} name={`${key}_lead`} defaultValue={s[`${key}_lead`] ?? ""} /></div>
                </fieldset>
              ))}
            </div>

            <div className="settings-card">
              <h2>Pie de página</h2>
              <div className="field"><label htmlFor="footer_tagline">Frase de presentación</label>
                <input type="text" id="footer_tagline" name="footer_tagline" defaultValue={s["footer_tagline"] ?? ""} /></div>
              <div className="field"><label htmlFor="footer_legal">Enlaces legales</label>
                <input type="text" id="footer_legal" name="footer_legal" defaultValue={s["footer_legal"] ?? ""} />
                <small className="muted">Separados por « · ». Cada enlace apunta a la sección de contacto.</small></div>
            </div>

            <button className="btn" type="submit">Guardar textos</button>
          </form>
        </section>

        {/* ============================ CONTACTO ============================ */}
        <section className="tabs__panel" data-panel="contacto" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <div className="settings-card">
              <h2>Contacto</h2>
              <p className="muted">Estos datos se muestran en la web, en el pie y en los enlaces de teléfono, correo y WhatsApp.</p>
              <div className="grid-2">
                <div className="field"><label htmlFor="telefono">Teléfono</label>
                  <input type="text" id="telefono" name="telefono" defaultValue={s["telefono"] ?? ""} /></div>
                <div className="field"><label htmlFor="whatsapp">WhatsApp (solo dígitos, con prefijo país)</label>
                  <input type="text" id="whatsapp" name="whatsapp" defaultValue={s["whatsapp"] ?? ""} placeholder="34600123456" /></div>
                <div className="field"><label htmlFor="correo">Correo electrónico público</label>
                  <input type="email" id="correo" name="correo" defaultValue={s["correo"] ?? ""} /></div>
                <div className="field"><label htmlFor="horario">Horario</label>
                  <input type="text" id="horario" name="horario" defaultValue={s["horario"] ?? ""} /></div>
                <div className="field"><label htmlFor="direccion">Dirección</label>
                  <input type="text" id="direccion" name="direccion" defaultValue={s["direccion"] ?? ""} /></div>
                <div className="field"><label htmlFor="ciudad">Ciudad</label>
                  <input type="text" id="ciudad" name="ciudad" defaultValue={s["ciudad"] ?? ""} /></div>
              </div>
            </div>
            <div className="settings-card">
              <h2>Mapa</h2>
              <div className="field"><label htmlFor="mapa_embed">URL del mapa (Google Maps embed)</label>
                <input type="text" id="mapa_embed" name="mapa_embed" defaultValue={s["mapa_embed"] ?? ""} placeholder="https://www.google.com/maps/embed?pb=..." />
                <p className="muted">Pega la URL que da Google Maps en «Compartir → Insertar un mapa».</p></div>
              <div className="field"><label htmlFor="google_maps_url">Enlace «Cómo llegar»</label>
                <input type="text" id="google_maps_url" name="google_maps_url" defaultValue={s["google_maps_url"] ?? ""} /></div>
              {s["mapa_embed"] ? (
                <iframe
                  src={s["mapa_embed"]} width="100%" height={280} loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade" title="Vista previa del mapa"
                  style={{ border: 0, borderRadius: 14, marginTop: ".5rem" }}
                />
              ) : null}
            </div>
            <div className="settings-card">
              <h2>Redes sociales</h2>
              <div className="grid-2">
                <div className="field"><label htmlFor="facebook">Facebook</label>
                  <input type="text" id="facebook" name="facebook" defaultValue={s["facebook"] ?? ""} /></div>
                <div className="field"><label htmlFor="instagram">Instagram</label>
                  <input type="text" id="instagram" name="instagram" defaultValue={s["instagram"] ?? ""} /></div>
                <div className="field"><label htmlFor="linkedin">LinkedIn</label>
                  <input type="text" id="linkedin" name="linkedin" defaultValue={s["linkedin"] ?? ""} /></div>
                <div className="field"><label htmlFor="github">GitHub</label>
                  <input type="text" id="github" name="github" defaultValue={s["github"] ?? ""} /></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar contacto</button>
          </form>
        </section>

        {/* ============================ CORREO ============================ */}
        <section className="tabs__panel" data-panel="correo" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <div className="settings-card">
              <h2>Envío de correo</h2>
              <p className="muted">
                Correo que la web usa para verificar cuentas, recuperar contraseñas y avisarte
                de nuevos mensajes. Con <strong>SMTP</strong> se envían correos reales.
              </p>
              <div className="grid-2">
                <div className="field"><label htmlFor="mail_transport">Método de envío</label>
                  <select id="mail_transport" name="mail_transport" defaultValue={s["mail_transport"] ?? "log"}>
                    <option value="log">Log (pruebas, no envía)</option>
                    <option value="mail">mail() del hosting</option>
                    <option value="smtp">SMTP (recomendado)</option>
                  </select></div>
                <div className="field"><label htmlFor="mail_from_name">Nombre del remitente</label>
                  <input type="text" id="mail_from_name" name="mail_from_name" defaultValue={s["mail_from_name"] ?? ""} /></div>
                <div className="field"><label htmlFor="mail_from_email">Correo del remitente (From)</label>
                  <input type="email" id="mail_from_email" name="mail_from_email" defaultValue={s["mail_from_email"] ?? ""} placeholder="crotulus.mipyme@gmail.com" />
                  <p className="muted">Con Gmail debe coincidir con la cuenta SMTP (o déjalo vacío para usarla).</p></div>
                <div className="field"><label htmlFor="mail_to_email">Correo que recibe los avisos</label>
                  <input type="email" id="mail_to_email" name="mail_to_email" defaultValue={s["mail_to_email"] ?? ""} placeholder="crotulus.mipyme@gmail.com" /></div>
                <div className="field"><label htmlFor="mail_smtp_host">Servidor SMTP</label>
                  <input type="text" id="mail_smtp_host" name="mail_smtp_host" defaultValue={s["mail_smtp_host"] ?? ""} placeholder="smtp.gmail.com" /></div>
                <div className="field"><label htmlFor="mail_smtp_port">Puerto SMTP</label>
                  <input type="text" id="mail_smtp_port" name="mail_smtp_port" inputMode="numeric" defaultValue={s["mail_smtp_port"] ?? "587"} /></div>
                <div className="field"><label htmlFor="mail_smtp_secure">Seguridad SMTP</label>
                  <select id="mail_smtp_secure" name="mail_smtp_secure" defaultValue={s["mail_smtp_secure"] ?? "tls"}>
                    <option value="tls">STARTTLS (puerto 587)</option>
                    <option value="ssl">SSL (puerto 465)</option>
                    <option value="none">Sin cifrado</option>
                  </select></div>
                <div className="field"><label htmlFor="mail_smtp_user">Usuario SMTP</label>
                  <input type="text" id="mail_smtp_user" name="mail_smtp_user" autoComplete="off" defaultValue={s["mail_smtp_user"] ?? ""} placeholder="tu-cuenta@gmail.com" /></div>
                <div className="field"><label htmlFor="mail_smtp_pass">Contraseña SMTP</label>
                  <input type="password" id="mail_smtp_pass" name="mail_smtp_pass" autoComplete="new-password"
                    defaultValue={(s["mail_smtp_pass"] ?? "") !== "" ? "********" : ""} placeholder="contraseña de aplicación" />
                  <p className="muted">Deja el valor enmascarado para no cambiarla. Con Gmail usa una «contraseña de aplicación».</p></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar correo</button>
          </form>

          <div className="settings-card">
            <h3>Probar el envío</h3>
            <p className="muted">Envía un correo de prueba al correo de avisos configurado.</p>
            <form method="post" action={action}>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="do" value="test_mail" />
              <button className="btn btn--ghost" type="submit">Enviar correo de prueba</button>
            </form>
          </div>
        </section>

        {/* ============================ RESEÑAS ============================ */}
        <section className="tabs__panel" data-panel="resenas" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="_checkboxes" value={SCOPE.resenas.join(",")} />
            <div className="settings-card">
              <h2>Valoraciones y reseñas</h2>
              <div className="grid-2">
                <div className="field"><label>
                  <input type="checkbox" name="reviews_enabled" value="1" defaultChecked={(s["reviews_enabled"] ?? "1") === "1"} /> Activar el módulo de valoraciones</label></div>
                <div className="field"><label>
                  <input type="checkbox" name="reviews_auto_approve" value="1" defaultChecked={(s["reviews_auto_approve"] ?? "0") === "1"} /> Publicar automáticamente</label></div>
                <div className="field"><label htmlFor="reviews_provider">Herramienta externa de reseñas</label>
                  <select id="reviews_provider" name="reviews_provider" defaultValue={s["reviews_provider"] ?? "trustpilot"}>
                    <option value="trustpilot">Trustpilot</option>
                    <option value="google">Google Reviews</option>
                    <option value="custom">Solo valoraciones propias</option>
                  </select></div>
                <div className="field"><label htmlFor="trustpilot_business_id">ID de Trustpilot (TrustBox)</label>
                  <input type="text" id="trustpilot_business_id" name="trustpilot_business_id" defaultValue={s["trustpilot_business_id"] ?? ""} /></div>
                <div className="field"><label htmlFor="trustpilot_template">Aspecto del widget</label>
                  <select id="trustpilot_template" name="trustpilot_template" defaultValue={s["trustpilot_template"] ?? "carrusel"}>
                    <option value="carrusel">Carrusel de reseñas</option>
                    <option value="estrellas">Mini valoración (estrellas)</option>
                  </select></div>
                <div className="field"><label htmlFor="trustpilot_url">Enlace a tu ficha en Trustpilot</label>
                  <input type="text" id="trustpilot_url" name="trustpilot_url" defaultValue={s["trustpilot_url"] ?? ""} /></div>
                <div className="field"><label htmlFor="google_reviews_url">Enlace a tu ficha en Google</label>
                  <input type="text" id="google_reviews_url" name="google_reviews_url" defaultValue={s["google_reviews_url"] ?? ""} /></div>
                <div className="field"><label htmlFor="google_place_id">Place ID de Google</label>
                  <input type="text" id="google_place_id" name="google_place_id" defaultValue={s["google_place_id"] ?? ""} /></div>
                <div className="field"><label htmlFor="google_places_api_key">Clave de la API de Google Places</label>
                  <input type="password" id="google_places_api_key" name="google_places_api_key" autoComplete="new-password"
                    defaultValue={(s["google_places_api_key"] ?? "") !== "" ? "********" : ""} /></div>
                <div className="field"><label htmlFor="google_reviews_cache_ttl">Segundos de caché de las reseñas</label>
                  <input type="number" min={1} id="google_reviews_cache_ttl" name="google_reviews_cache_ttl" defaultValue={s["google_reviews_cache_ttl"] ?? "21600"} /></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar reseñas</button>
          </form>

          <div className="settings-card">
            <h3>Reseñas de Google en vivo</h3>
            <p className="muted">
              Estado: <strong>{grEnabled ? "configurado" : "sin configurar"}</strong> · {grCached} reseñas guardadas
              {grFetched ? ` · última lectura: ${grFetched}` : ""}
            </p>
            <form method="post" action={action}>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="do" value="refresh_google_reviews" />
              <button className="btn btn--ghost" type="submit">Actualizar reseñas de Google ahora</button>
            </form>
          </div>

          <div className="settings-card">
            <h3>Reseñas de Trustpilot</h3>
            <p className="muted">Se leen de la ficha pública (sin API key) y se cachean 6 horas.</p>
            <form method="post" action={action}>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="do" value="refresh_trustpilot" />
              <button className="btn btn--ghost" type="submit">Actualizar reseñas de Trustpilot</button>
              {tpCache ? <span className="muted" style={{ marginLeft: ".6rem" }}>Última lectura: {tpCache}</span> : null}
            </form>
          </div>
        </section>

        {/* ============================ APORTACIONES ============================ */}
        <section className="tabs__panel" data-panel="aportaciones" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="_checkboxes" value={SCOPE.aportaciones.join(",")} />
            <div className="settings-card">
              <h2>Aportaciones de usuarios</h2>
              <p className="muted">
                Permite que las personas <strong>registradas</strong> envíen testimonios y propongan
                preguntas frecuentes. Solo se publican las aprobadas.
              </p>
              <div className="grid-2">
                <div className="field"><label>
                  <input type="checkbox" name="submissions_enabled" value="1" defaultChecked={(s["submissions_enabled"] ?? "1") === "1"} /> Activar las aportaciones</label></div>
                <div className="field"><label>
                  <input type="checkbox" name="submissions_auto_approve" value="1" defaultChecked={(s["submissions_auto_approve"] ?? "0") === "1"} /> Publicar automáticamente</label></div>
                <div className="field"><label htmlFor="faq_portal_count">Nº de preguntas destacadas en la portada</label>
                  <input type="text" id="faq_portal_count" name="faq_portal_count" inputMode="numeric" defaultValue={s["faq_portal_count"] ?? "6"} /></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar aportaciones</button>
          </form>
        </section>

        {/* ============================ SEGURIDAD ============================ */}
        <section className="tabs__panel" data-panel="seguridad" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="_checkboxes" value={SCOPE.seguridad.join(",")} />
            <div className="settings-card">
              <h2>Seguridad y contraseñas</h2>
              <div className="grid-2">
                <div className="field"><label htmlFor="security_password_min">Longitud mínima de contraseña</label>
                  <input type="text" id="security_password_min" name="security_password_min" inputMode="numeric" defaultValue={s["security_password_min"] ?? "8"} /></div>
                <div className="field"><label htmlFor="security_session_lifetime">Duración de la sesión (segundos)</label>
                  <input type="text" id="security_session_lifetime" name="security_session_lifetime" inputMode="numeric" defaultValue={s["security_session_lifetime"] ?? "2592000"} />
                  <p className="muted">2592000 = 30 días.</p></div>
                <div className="field"><label>
                  <input type="checkbox" name="security_session_bind_ip" value="1" defaultChecked={(s["security_session_bind_ip"] ?? "0") === "1"} /> Vincular la sesión a la IP</label>
                  <p className="muted">Actívalo solo en un hosting simple. Tras un CDN o balanceador, déjalo desactivado.</p></div>
              </div>
            </div>
            <div className="settings-card">
              <h3>Límites anti-spam (por IP)</h3>
              <div className="grid-2">
                {RATE_FIELDS.map(([key, label]) => (
                  <div className="field" key={key}>
                    <label htmlFor={key}>{label}</label>
                    <input type="text" id={key} name={key} inputMode="numeric" defaultValue={s[key] ?? ""} />
                  </div>
                ))}
              </div>
            </div>
            <button className="btn" type="submit">Guardar seguridad</button>
          </form>
        </section>

        {/* ============================ GOOGLE ============================ */}
        <section className="tabs__panel" data-panel="google" role="tabpanel">
          {googleOn && googleIssues.length === 0 ? (
            <Alert kind="ok">El acceso con Google está <strong>activado</strong>.</Alert>
          ) : null}
          {!googleOn ? (
            <Alert kind="info">
              El acceso con Google está <strong>desactivado</strong>. Rellena el Client ID y el
              Client secret para activarlo.
            </Alert>
          ) : null}
          {googleIssues.length > 0 ? (
            <Alert kind="error">
              El acceso con Google está <strong>mal configurado</strong> y Google lo rechazará.
              <ul style={{ margin: ".4rem 0 0 1rem" }}>
                {googleIssues.map((msg) => <li key={msg}>{msg}</li>)}
              </ul>
            </Alert>
          ) : null}
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <div className="settings-card">
              <h2>Acceso con Google (OAuth 2.0)</h2>
              <div className="grid-2">
                <div className="field"><label htmlFor="google_client_id">Client ID de Google</label>
                  <input type="text" id="google_client_id" name="google_client_id" defaultValue={s["google_client_id"] ?? ""} /></div>
                <div className="field"><label htmlFor="google_client_secret">Client secret de Google</label>
                  <input type="password" id="google_client_secret" name="google_client_secret" autoComplete="new-password"
                    defaultValue={(s["google_client_secret"] ?? "") !== "" ? "********" : ""} /></div>
                <div className="field"><label>URI de redirección que debes registrar en Google</label>
                  <input type="text" readOnly defaultValue={redirectUri} /></div>
                <div className="field"><label htmlFor="google_redirect_uri">URI de redirección (opcional)</label>
                  <input type="text" id="google_redirect_uri" name="google_redirect_uri" defaultValue={s["google_redirect_uri"] ?? ""} /></div>
              </div>
            </div>
            <button className="btn" type="submit">Guardar Google</button>
          </form>
        </section>

        {/* ============================ RUTAS ============================ */}
        <section className="tabs__panel" data-panel="rutas" role="tabpanel">
          <form method="post" action={save}>
            <input type="hidden" name="_csrf" value={csrf} />
            <div className="settings-card">
              <h2>Rutas del servidor</h2>
              <div className="field"><label htmlFor="paths_log_dir">Carpeta de registros (logs)</label>
                <input type="text" id="paths_log_dir" name="paths_log_dir" defaultValue={s["paths_log_dir"] ?? ""} />
                <p className="muted">Vacío = carpeta de datos de la aplicación. Aquí se escriben los registros.</p></div>
              <div className="settings-card" style={{ boxShadow: "none", borderStyle: "dashed" }}>
                <h3>Estado del sistema</h3>
                <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
                  <li>Controlador de base de datos: <strong>{info.driver}</strong></li>
                  <li>Carpeta de registros en uso: <code>{info.logDir}</code></li>
                  <li>Node: <strong>{info.node}</strong></li>
                </ul>
              </div>
            </div>
            <button className="btn" type="submit">Guardar rutas</button>
          </form>
        </section>
      </SettingsTabs>
    </>
  );
}

/** Cabeceras de seccion editables (clave, etiqueta). */
const SECTION_HEADS: Array<[string, string]> = [
  ["team", "Equipo"],
  ["services", "Servicios"],
  ["projects", "Proyectos"],
  ["blog", "Blog"],
  ["process", "Cómo trabajamos"],
  ["testimonials", "Testimonios"],
  ["reviews", "Opiniones (Google)"],
  ["trustpilot", "Reseñas verificadas (Trustpilot)"],
  ["contact", "Contacto"],
  ["location", "Ubicación"],
  ["faq", "Preguntas frecuentes"],
];

/** Campos de los limites anti-spam. */
const RATE_FIELDS: Array<[string, string]> = [
  ["security_contact_rate_max", "Mensajes de contacto · máximo"],
  ["security_contact_rate_window", "Mensajes de contacto · ventana (s)"],
  ["security_login_rate_max", "Intentos de login · máximo"],
  ["security_login_rate_window", "Intentos de login · ventana (s)"],
  ["security_review_rate_max", "Valoraciones · máximo"],
  ["security_review_rate_window", "Valoraciones · ventana (s)"],
  ["security_submission_rate_max", "Aportaciones · máximo"],
  ["security_submission_rate_window", "Aportaciones · ventana (s)"],
];
