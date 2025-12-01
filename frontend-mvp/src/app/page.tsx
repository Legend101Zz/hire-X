import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to search page
  redirect("/dashboard");
}