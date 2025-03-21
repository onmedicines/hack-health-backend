import e from "express";
import isEmail from "validator/lib/isEmail.js";
import supabase from "./supabase/supabaseClient.js";
import cors from "cors";
import analyseHealth from "./ml/generateAnalysis.js";

const app = e();
const PORT = process.env.PORT || 3000;

app.use(e.json());
app.use(cors());

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// home
app.get("/", (req, res) => {
  res.send("Hackathon API");
});

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

  return res.status(200).json(userData[0]);
});

// checkup
app.post("/get-checkup", async (req, res) => {
  let { sysBP, diaBP, heartRate, cholesterol, glucose, smoking, medicalHistory, height, weight } = req.body;
  if (!sysBP || !diaBP || !heartRate || !cholesterol || !glucose || !smoking) {
    return res.status(400).json("Please provide all fields");
  }
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

  // if height, weight and medical history not provided then use the  values from user profile
  if (!height) height = userData[0].height;
  if (!weight) weight = userData[0].weight;
  if (!medicalHistory) medicalHistory = userData[0].medicalHistory;

  // if values are still null that means no values were found in user profile
  // (not an issue for medical history as it can be null)
  if (!height) {
    return res.status(400).json("Please provide the height");
  }
  if (!weight) {
    return res.status(400).json("Please provide the weight");
  }

  const age = calculateAge(userData[0].dob);
  const userID = userData[0].id;

  const analysis = await analyseHealth({ age, weight, height, heartRate, sysBP, diaBP, cholesterol, glucose, smoking });
  if (!analysis) {
    return res.status(500).json("Could not produce and analysis.");
  }

  // add the details of user at this point of time to the database
  // if cannot add, respond nevertheless
  const { error: checkupsError } = await supabase.from("checkups").insert([{ id: userID, age, weight, height, heart_rate: heartRate, sys_bp: sysBP, dia_bp: diaBP, cholesterol, glucose, smoking }]);
  let responseMessage = "Successfully uploaded data of this checkup";
  if (checkupsError) {
    responseMessage = "Could not upload data of this checkup";
  }

  return res.status(200).json({ analysis, responseMessage });
});

// get checkup history for users
app.get("/user-checkup-history", async (req, res) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return res.status(400).json("No user logged in.");
  }

  let { data: checkups, error: checkupsError } = await supabase.from("checkups").select("*").eq("id", user.id);
  if (checkupsError) {
    return res.status(500).json("Could not get checkup history.");
  }

  return res.status(200).json(checkups);
});
