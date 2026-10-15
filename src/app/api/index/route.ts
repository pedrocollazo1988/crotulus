import { NextRequest } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { jsonOk, jsonError } from "@/lib/http";
import { settingsPublic, setting } from "@/lib/settings";
import { contentItems } from "@/lib/content";
import { blogPosts, blogPostPublic } from "@/lib/blog";
import { teamMembers, teamMemberPublic } from "@/lib/team";
import { reviewsEnabled, reviewsSummary, reviewsPublished } from "@/lib/reviews";
import { googleReviewsFetch } from "@/lib/google-reviews";
import { trustpilotFetch } from "@/lib/trustpilot";
import { faqsTop } from "@/lib/faq";
import { submissionsEnabled, submissionsForUser, testimonialsPublished } from "@/lib/submissions";
import { currentUser } from "@/lib/auth";
import { csrfToken } from "@/lib/csrf";
import { captchaIssue } from "@/lib/captcha";
import { getConfig } from "@/lib/config";
import { cleanText } from "@/lib/validator";

/**
 * ============================================================================
 *  API PUBLICA  ->  /api/index
 *  Puerto de api/index.php. Replicar los shapes JSON es CRITICO: js/main.js
 *  los consume tal cual.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await bootstrap();

  const sp = req.nextUrl.searchParams;
  const resource = sp.get("resource") ?? "settings";
  const action = sp.get("action") ?? "";

  // --- Token CSRF -----------------------------------------------------------
  if (action === "csrf") {
    return jsonOk({ csrf_token: csrfToken() });
  }

  // --- Captcha --------------------------------------------------------------
  if (action === "captcha") {
    return jsonOk({ ...captchaIssue() });
  }

  switch (resource) {
    case "settings": {
      const data = await settingsPublic();
      data["site_name"] = getConfig().siteName;
      return jsonOk({ settings: data });
    }

    case "content": {
      const type = sp.get("type") ? cleanText(sp.get("type") as string) : null;
      return jsonOk({ items: await contentItems(type) });
    }

    case "blog": {
      const limit = sp.get("limit") ? Number.parseInt(sp.get("limit") as string, 10) : 9;
      const slug = sp.get("slug") ? cleanText(sp.get("slug") as string) : "";
      if (slug !== "") {
        const posts = await blogPosts(0, true, true);
        for (const row of posts) {
          if (row.slug === slug) return jsonOk({ items: [blogPostPublic(row)] });
        }
        return jsonError("Articulo no encontrado.", 404);
      }
      return jsonOk({ items: (await blogPosts(limit, true, false)).map(blogPostPublic) });
    }

    case "team": {
      return jsonOk({ items: (await teamMembers(true)).map(teamMemberPublic) });
    }

    case "health": {
      return jsonOk({ status: "ok", driver: "pgsql" });
    }

    case "reviews": {
      if (!(await reviewsEnabled())) {
        return jsonOk({ enabled: false, summary: { total: 0, average: 0, stars: 0 }, items: [] });
      }
      const type = sp.get("type") ? cleanText(sp.get("type") as string) : "";
      const limit = sp.get("limit") ? Number.parseInt(sp.get("limit") as string, 10) : 12;
      return jsonOk({
        enabled: true,
        summary: await reviewsSummary(type !== "" ? type : null),
        items: await reviewsPublished(type, limit),
      });
    }

    case "google_reviews": {
      return jsonOk(await googleReviewsFetch(sp.get("force") === "1"));
    }

    case "trustpilot": {
      return jsonOk(await trustpilotFetch());
    }

    case "faqs": {
      const limit = sp.get("limit")
        ? Number.parseInt(sp.get("limit") as string, 10)
        : Number.parseInt(await setting("faq_portal_count", "6"), 10);
      return jsonOk({
        items: await faqsTop(limit),
        settings: { submissions_enabled: await submissionsEnabled() },
      });
    }

    case "testimonials": {
      const items: unknown[] = [];
      for (const t of await testimonialsPublished(12)) {
        items.push({
          author_name: t.title,
          comment: t.body,
          photo: t.avatar_url,
          created_at: t.created_at,
          source: "usuario",
        });
      }
      return jsonOk({ items });
    }

    case "session": {
      const user = await currentUser();
      if (!user) return jsonOk({ logged_in: false });
      return jsonOk({
        logged_in: true,
        user: { id: user.id, name: user.name, role: user.role },
        submissions: await submissionsForUser(user.id, 10),
        settings: { submissions_enabled: await submissionsEnabled() },
      });
    }

    default:
      return jsonError("Recurso no encontrado.", 404);
  }
}
