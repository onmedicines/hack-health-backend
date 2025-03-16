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
  const { sysBP, diaBP, heartRate, cholesterol, glucose, smoking, medicalHistory, height, weight } = req.body;
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

  const analysis = await analyseHealth({ age, weight, height, heartRate, sysBP, diaBP, cholesterol, glucose, smoking });
  if (!analysis) {
    return res.status(500).json("Could not produce and analysis.");
  }

  return res.status(200).json(analysis);
});

// utility functions
function calculateAge(dob) {
  const birthDate = new Date(dob); // Convert DOB to Date object
  const today = new Date(); // Get today's date

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  // Adjust age if the birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}
