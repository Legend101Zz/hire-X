const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

export const conversationApi = {
  async startConversation(initialMessage: string) {
    const response = await fetch(`${API_BASE}/conversation/start`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ initial_message: initialMessage }),
    });
    if (!response.ok) throw new Error("Failed to start conversation");
    return response.json();
  },

  async sendMessage(sessionId: string, message: string) {
    const response = await fetch(
      `${API_BASE}/conversation/${sessionId}/message`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ message }),
      }
    );
    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
  },

  async getConversationState(sessionId: string) {
    const response = await fetch(`${API_BASE}/conversation/${sessionId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to get conversation");
    return response.json();
  },

  async finalizeConversation(sessionId: string) {
    const response = await fetch(
      `${API_BASE}/conversation/${sessionId}/finalize`,
      {
        method: "POST",
        headers: getHeaders(),
      }
    );
    if (!response.ok) throw new Error("Failed to finalize");
    return response.json();
  },

  async uploadJD(sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${API_BASE}/conversation/${sessionId}/upload-jd`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );
    if (!response.ok) throw new Error("Failed to upload JD");
    return response.json();
  },
};
