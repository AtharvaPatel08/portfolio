import { memo, useEffect } from "react";
import { PORTFOLIO_DATA } from "../../data/portfolio";

const SCRIPT_ID = "schema-person-jsonld";

export function buildPersonSchema(siteUrl?: string) {
  const { identity, expertise, education, experience, exploring } = PORTFOLIO_DATA;
  const internship = experience.items[0];

  const verifiedSkills = Array.from(
    new Set([
      ...expertise.groups.flatMap((group) => group.items),
      ...exploring.topics.map((topic) => topic.title),
    ])
  );

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.shortName,
    alternateName: identity.name,
    ...(siteUrl ? { url: siteUrl } : {}),
    email: `mailto:${identity.email}`,
    jobTitle: "Aspiring AI/ML Engineer & Creative Technologist",
    description: identity.intro,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bhopal",
      addressRegion: "Madhya Pradesh",
      addressCountry: "IN",
    },
    affiliation: [
      {
        "@type": "CollegeOrUniversity",
        name: education.institution,
      },
      ...(internship
        ? [
            {
              "@type": "Organization",
              name: internship.legalEntity,
            },
          ]
        : []),
    ],
    knowsAbout: verifiedSkills,
    sameAs: [identity.github, identity.linkedin],
  };
}

export const SchemaMarkup = memo(function SchemaMarkup() {
  useEffect(() => {
    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : undefined;

    const schemaData = buildPersonSchema(currentUrl);
    const serialized = JSON.stringify(schemaData, null, 2);

    let scriptEl = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const createdScript = !scriptEl;

    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = SCRIPT_ID;
      scriptEl.type = "application/ld+json";
      document.head.appendChild(scriptEl);
    }

    scriptEl.textContent = serialized;

    // Sync canonical link and og:url dynamically in SPA runtime
    if (currentUrl) {
      let canonicalEl = document.head.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement | null;
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.rel = "canonical";
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = currentUrl;

      let ogUrlEl = document.head.querySelector(
        'meta[property="og:url"]'
      ) as HTMLMetaElement | null;
      if (!ogUrlEl) {
        ogUrlEl = document.createElement("meta");
        ogUrlEl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrlEl);
      }
      ogUrlEl.content = currentUrl;
    }

    return () => {
      if (createdScript && scriptEl && scriptEl.parentNode === document.head) {
        document.head.removeChild(scriptEl);
      }
    };
  }, []);

  return null;
});
