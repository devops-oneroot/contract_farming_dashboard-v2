import { redirect } from "next/navigation";

/** Role access moved to its own section, Roles & Access. Old links still land there. */
export default function OldRoleAccessPage() {
  redirect("/roles");
}
