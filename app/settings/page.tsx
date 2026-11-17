import { redirect } from "next/navigation";

/** Settings has no page of its own: the daily WhatsApp report is its one page. */
export default function SettingsPage() {
  redirect("/settings/whatsapp-report");
}
