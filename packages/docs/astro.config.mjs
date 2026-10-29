// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  site: "https://apiary-f4n.pages.dev/",
  integrations: [
    starlight({
      title: "Apiary",
      description:
        "Zero-dependency, framework-agnostic scheduling primitives for the web.",
      logo: {
        src: "./src/assets/apiary-logo.svg",
        alt: "Apiary",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/IngeniumOfficial/apiary",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/IngeniumOfficial/apiary/tree/main/packages/docs",
      },
      customCss: ["./src/styles/theme.scss"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Overview", slug: "getting-started/overview" },
            { label: "Installation", slug: "getting-started/installation" },
            { label: "Quickstart", slug: "getting-started/quickstart" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Using Apiary in an App", slug: "guides/using-apiary-in-an-app" },
            { label: "The Dual Availability Model", slug: "guides/dual-model" },
            { label: "Slots, Buffers & Rules", slug: "guides/slots-and-buffers" },
            { label: "Timezones & DST", slug: "guides/timezones" },
            { label: "Calendar Views", slug: "guides/calendar-views" },
            { label: "PostgreSQL Adapter", slug: "guides/postgres" },
            { label: "Server Operations", slug: "guides/server-integration" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "@apiary-dev/core", slug: "reference/core" },
            { label: "@apiary-dev/postgres", slug: "reference/postgres" },
            { label: "@apiary-dev/server", slug: "reference/server" },
          ],
        },
      ],
    }),
  ],
});
