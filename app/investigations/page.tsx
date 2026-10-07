import { redirect } from "next/navigation";

/** The tab was renamed to Order Investigations; keep old links working. */
export default function InvestigationsRedirect() {
  redirect("/order-investigations");
}
