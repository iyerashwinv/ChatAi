"use client";
import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const updatedMessages = [
      ...messages,
      { role: "user", content: input },
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: updatedMessages }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    
    let assistantText = "";
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
    
      buffer += decoder.decode(value, { stream: true });
    
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
    
      for (const line of lines) {
        if (!line.trim()) continue;
    
        const json = JSON.parse(line);
        const token = json?.message?.content;
    
        if (token) {
          assistantText += token;
          setMessages([
            ...updatedMessages,
            { role: "assistant", content: assistantText },
          ]);
        }
      }
    }    

    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>🧠 Ashwin's local AI</h2>

      <div style={{ border: "1px solid #ddd", padding: 16, minHeight: 320 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <strong>{m.role === "user" ? "You" : "AI"}:</strong>{" "}
            {m.content}
          </div>
        ))}
        {loading && <em>AI is typing…</em>}
      </div>

      <div style={{ display: "flex", marginTop: 12, gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask something…"
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={sendMessage} style={{ padding: "10px 16px" }}>
          Send
        </button>
      </div>
    </main>
  );
}
