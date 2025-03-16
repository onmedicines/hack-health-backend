import e from "express";
import { formattedPrompt } from "./ml/prompt.js";
import supabase from "./supabase/supabaseClient.js";
import cors from "cors";
import axios from "axios";

// const cors = require("cors");
// const axios = require("axios");
const app = e();

app.use(e.json());
app.use(cors());

app.post("/user-data", async (req, res) => {
  const { name, email, dob, sex } = req.body;
  if (!name || !email || !dob || !sex) {
    return res.status(400).json("");
  }

  const { data, error } = await supabase.from("users").insert([{ name, email, dob, sex }]).select();
  if (error) {
    console.log(error);
    return res.status(400).json(err);
  }
  if (data) {
    console.log(data);
    return res.status(200).json(data);
  }
});

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
