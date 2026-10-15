import { useEffect } from "react";
import { SITE } from "./config";

interface PageMeta {
  title: string;
  description?: string;
  /** Path such as "/learn". Omit for pages that should not declare a canonical URL. */
  path?: string;
  /** Defaults to "noindex, nofollow" so private pages are never indexed by accident. */
  robots?: string;
  ogType?: "website" | "article";
  ogTitle?: string;
  ogDescription?: string;
}

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string | undefined) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (content === undefined) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string | undefined) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Keep <title>, description, canonical, robots and social tags in step with the current route. */
export function usePageMeta({ title, description, path, robots = "noindex, nofollow", ogType = "website", ogTitle, ogDescription }: PageMeta) {
  useEffect(() => {
    document.title = title;
    const url = path === undefined ? undefined : `${SITE.url}${path === "/" ? "/" : path}`;
    setCanonical(url);
    setMeta('meta[name="robots"]', "name", "robots", robots);
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", ogTitle ?? title);
    setMeta('meta[property="og:description"]', "property", "og:description", ogDescription ?? description);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[property="og:type"]', "property", "og:type", ogType);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", ogTitle ?? title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", ogDescription ?? description);
  }, [title, description, path, robots, ogType, ogTitle, ogDescription]);
}
