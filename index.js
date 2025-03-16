import e from "express";
import isEmail from "validator/lib/isEmail.js";
import { formattedPrompt } from "./ml/prompt.js";
import supabase from "./supabase/supabaseClient.js";
import cors from "cors";
import axios from "axios";

const app = e();

app.use(e.json());
app.use(cors());

// signup
app.post("/signup", async (req, res) => {
  const { email, password, name, dob, sex, height, weight, medicalHistory } = req.body;

  // error checking
  if (!email || !name || !dob || !password || !sex) {
    return res.status(400).json("Please provide all fields.");
  }
  if (!isEmail(email)) {
    return res.status(400).json("Email invalid.");
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) return res.status(400).json({ error: authError.message });

  const { error: dbError } = await supabase.from("users").insert([{ id: authData.user?.id, name, dob, sex, height, weight, medical_history: medicalHistory }]);
  if (dbError) return res.status(400).json({ error: dbError.message });

  res.status(201).json({ message: "User registered successfully", token: authData.session?.access_token });
});

// resend email confirmation mail
app.post("/resend-confirmation-email", async (req, res) => {
  const { email } = req.body;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    return res.status(500).json(error.message);
  }

  return res.status(200).json("Confirmation link resent.");
});

// login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("Please provide all fields");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json({ message: "Login successful", token: data.session?.access_token });
});

// logout
app.get("/logout", async (req, res) => {
  let { error } = await supabase.auth.signOut();
  if (error) {
    return res.status(500).json("Could not logout, please try again.");
  }

  return res.status(200).json("Successfully logged out.");
});

// get user data
app.get("/user", async (req, res) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return res.status(400).json("No user logged in.");
  }

  let { data: userData, error: userError } = await supabase.from("users").select().eq("id", user.id);
  if (userError) {
    return res.status(500).json("Could not fetch user details");
  }

  return res.status(200).json(userData);
});

// // checkup
// app.post("/get-checkup", async (req, res) => {
//   const { sysBP, diaBP, heartRate, cholestrol, glucose, smoking, medicalHistory } = req.body;
//   return;
// });

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//

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
