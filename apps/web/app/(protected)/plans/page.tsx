import { redirect } from "next/navigation"

/** The Plans page moved under the app header (/homepage/plans). Trial emails sent before the move
 * link here, so this keeps them working. */
export default function PlansRedirect() {
  redirect("/homepage/plans")
}
