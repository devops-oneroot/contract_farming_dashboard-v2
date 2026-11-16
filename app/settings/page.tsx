import { redirect } from "next/navigation";

/** Settings has no page of its own yet: Role access is its first. */
export default function SettingsPage() {
  redirect("/settings/roles");
}
