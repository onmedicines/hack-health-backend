import { formattedPrompt } from "./ml/prompt";

const cors = require("cors");
const axios = require("axios");

app.use(express.json());
app.use(cors());

// api end-point for anaylzing health data
app.post("/analyze-health", async (req, res) => {
  const { patientData } = req.body;

  if (!patientData) {
    return res.status(400).json({ error: "Patient data is required." });
  }

  try {
    const prompt = formattedPrompt(patientData);
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "mistral",
      prompt: prompt,
      stream: false,
    });
    const data = JSON.parse(response.data.response);

    res.json({ analysis: data });
    console.log("----------------------------------------------------------------------");
    console.log("Analysis:", data);
    console.log("----------------------------------------------------------------------");
    console.log("Ollama Response:", response.data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to analyze health data." });
  }
});

app.get("/", (req, res) => {
  res.send("Hackathon API");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
