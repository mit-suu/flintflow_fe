import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LegalDocument from "../_legal/LegalDocument";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}
