import React, { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:3001/api/convert", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    setMessage(data.message || data.error);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>DWG → STL</h1>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Загрузить</button>
      <p>{message}</p>
    </div>
  );
}

export default App;
