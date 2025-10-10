import PromptPage from "@/components/PromptPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Home() {
  return (
    <ProtectedRoute>
      <PromptPage />
    </ProtectedRoute>
  );
}