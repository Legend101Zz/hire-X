import PromptPage from "@/components/ui/prompt";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Home() {
  return (
    <ProtectedRoute>
      <PromptPage />
    </ProtectedRoute>
  );
}
