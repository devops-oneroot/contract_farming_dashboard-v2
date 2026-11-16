"use client";

import { useAuth } from "./auth";
import { canDo } from "./rbac";

/**
 * What the signed-in account may do in a module, from Settings → Role access.
 *
 *   const perm = usePerm("products");
 *   {perm.add && <button>Add product</button>}
 *
 * Hiding a button is for tidiness: the server refuses the request anyway.
 */
export function usePerm(module: string) {
  const { admin } = useAuth();
  return {
    view: canDo(admin, module, "view"),
    add: canDo(admin, module, "add"),
    edit: canDo(admin, module, "edit"),
    delete: canDo(admin, module, "delete"),
  };
}
