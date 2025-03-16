/**
 * Example patientData: 
 * {
        "age": 45,
        "weight": 85,
        "height": 175,
        "heartRate": 78,
        "sysBP": 140,
        "diaBP": 90,
        "cholesterol": 210,
        "glucose": 110,
        "smoking": true,
        "medicalHistory": "Hypertension, Diabetes"
    }
 */

import { formattedPrompt } from "./prompt.js";
import axios from "axios";

const analyseHealth = async (patientData) => {
  try {
    // generate a proper formatterd prompt for mistral
    const prompt = formattedPrompt(patientData);

    // send the promot to mistral
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "mistral",
      prompt: prompt,
      stream: false,
    });

    const data = JSON.parse(response.data.response);

    //   // log to console for testing
    //   console.log("----------------------------------------------------------------------");
    //   console.log("Analysis:", data);
    //   console.log("----------------------------------------------------------------------");
    //   console.log("Ollama Response:", response.data);

    return data;
  } catch (err) {
    return null;
  }
};

export default analyseHealth;
