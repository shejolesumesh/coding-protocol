import { collection, addDoc } from
"https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { db } from "./firebase.js";


let selectedRole = "";
let resumeUploaded = false;
let lastMatchScore = 0;


document.addEventListener("DOMContentLoaded", () => {
  const resumeInput = document.getElementById("resumeFile");

  resumeInput.addEventListener("change", () => {
    resumeUploaded = true;

    document.getElementById("result").innerText =
      "📄 Resume uploaded. Select an internship and check resume match (Minimum 75% required).";

    document.getElementById("applyBtn").style.display = "none";
    document.getElementById("applyForm").style.display = "none";
  });
});

function checkMatch(role) {
  if (!resumeUploaded) {
    showUserPopup(
  "📄 Resume Required",
  "Please upload your resume before applying."
);
return;
  }

  const resumeFile = document.getElementById("resumeFile").files[0];
  if (!resumeFile) {
  showUserPopup(
    "❌ Resume Not Found",
    "Please upload a valid resume file."
  );
  return;


  }

  selectedRole = role;

  const resumeSizeKB = resumeFile.size / 1024;
  const resumeName = resumeFile.name.toLowerCase();


  if (resumeSizeKB < 40) {
    lastMatchScore = 0;
    document.getElementById("result").innerText =
      "❌ Resume looks empty or too small. Please upload a proper resume.";
    document.getElementById("applyBtn").style.display = "none";
    document.getElementById("applyForm").style.display = "none";
    return;
  }


  const roleHints = {
    "Web Developer Intern": ["web", "frontend", "developer"],
    "Backend Developer Intern": ["backend", "server", "api"],
    "Data Analyst Intern": ["data", "analytics", "analyst"],
    "Machine Learning Intern": ["ml", "ai", "machine"],
    "Mechanical Design Intern": ["mechanical", "design"],
    "Electrical Engineer Intern": ["electrical", "power"],
    "UI/UX Designer Intern": ["ui", "ux", "design"],
    "Digital Marketing Intern": ["marketing", "seo"],
    "Business Analyst Intern": ["business", "analysis"],
    "HR Intern": ["hr", "human"]
  };

  const hints = roleHints[role] || [];
  let roleRelevant = false;

  hints.forEach(hint => {
    if (resumeName.includes(hint)) roleRelevant = true;
  });


  let match = 0;


  if (resumeSizeKB > 40) match += 30;
  if (resumeSizeKB > 120) match += 20;
  if (resumeSizeKB > 250) match += 15;

  
  if (roleRelevant) match += 30;
  else match += 15;

  
  match += Math.floor(Math.random() * 6); 

  if (match > 95) match = 95;
  lastMatchScore = match;

  
  if (match >= 75) {
    document.getElementById("result").innerText =
      `🤖 Resume Match for ${role}: ${match}% ✅ Eligible to apply`;
    document.getElementById("applyBtn").style.display = "block";
  } else {
    document.getElementById("result").innerText =
      `🤖 Resume Match for ${role}: ${match}% ❌ Resume needs improvement (Minimum 75% required)`;
    document.getElementById("applyBtn").style.display = "none";
    document.getElementById("applyForm").style.display = "none";
  }
}


function apply() {
  if (lastMatchScore < 75) {
  showUserPopup(
    "❌ Not Eligible",
    "Minimum 75% resume match is required to apply."
  );
  return;

  }

  const form = document.getElementById("applyForm");
  form.style.display = "block";
  form.scrollIntoView({ behavior: "smooth" });
}


async function submitApplication() {

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const collegeName = document.getElementById("collegeName").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const linkedin = document.getElementById("linkedin").value.trim();
  const cgpa = document.getElementById("cgpa").value.trim();
  const branch = document.getElementById("branch").value.trim();
  const year = document.getElementById("year").value.trim();

  
  if (!name || !email || !collegeName || !contact || !linkedin || !cgpa || !branch || !year) {
    showUserPopup(
  "⚠️ Incomplete Form",
  "Please fill all the required fields."
);
return;

  }

  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showUserPopup(
  "📧 Invalid Email",
  "Please enter a valid email address."
);
return;

  }

  
  if (!/^[6-9]\d{9}$/.test(contact)) {
    showUserPopup(
  "📱 Invalid Contact",
  "Please enter a valid 10-digit contact number."
);
return;

  }

  
  if (!linkedin.startsWith("https://www.linkedin.com/")) {
    showUserPopup(
  "🔗 Invalid LinkedIn",
  "Please enter a valid LinkedIn profile URL."
);
return;

  }

  
  if (cgpa < 0 || cgpa > 10) {
    showUserPopup(
  "📊 Invalid CGPA",
  "CGPA must be between 0 and 10."
);
return;

  }

  const application = {
    name,
    email,
    collegeName,
    contact,
    linkedin,
    cgpa,
    branch,
    year,
    role: selectedRole,
    date: new Date().toLocaleString(),
    status: "pending"

  };

  try {
  await addDoc(collection(db, "applications"), application);
  showUserPopup(
  "✅ Application Submitted",
  "Your application has been submitted successfully 🚀"
);
document.getElementById("applyBtn").style.display = "none";
document.getElementById("result").innerText =
  "🎉 Application submitted. You can apply again for another role.";


  }catch (error) {
  console.error(error);
  showUserPopup(
  "❌ Submission Failed",
  "Something went wrong. Please try again."
);
return;

}


  
  document.getElementById("applyForm").reset();
  document.getElementById("applyForm").style.display = "none";
}



function detectIntent(text) {
  text = text.toLowerCase();
  if (text.includes("resume")) return "resume";
  if (text.includes("internship")) return "internship";
  if (text.includes("job")) return "job";
  if (text.includes("interview")) return "interview";
  if (text.includes("motivate")) return "motivation";
  return "general";
}

const tutorReplies = {
  resume: ["A resume should clearly show your skills and projects."],
  internship: ["Internships help you gain real-world experience."],
  job: ["Companies hire problem-solvers."],
  interview: ["Interviews test thinking, not memorization."],
  motivation: ["Discipline beats motivation."],
  general: ["Ask me about resumes, internships, jobs, interviews."]
};

function aiSend() {
  const input = document.getElementById("aiInput");
  const messages = document.getElementById("aiMessages");
  const text = input.value.trim();
  if (!text) return;

  messages.innerHTML += `<div class="ai-user">${text}</div>`;
  input.value = "";

  setTimeout(() => {
    messages.innerHTML += `<div class="ai-bot">${tutorReplies[detectIntent(text)][0]}</div>`;
    messages.scrollTop = messages.scrollHeight;
  }, 300);
}

window.checkMatch = checkMatch;
window.apply = apply;
window.submitApplication = submitApplication;
window.aiSend = aiSend;


(function () {

  const KNOWLEDGE_BASE = [
    
    {
      keywords: ["what is resume", "resume kya", "resume meaning"],
      answer:
        "A resume is a professional document that summarizes your education, skills, projects, and experience. Its goal is to get you shortlisted for an interview."
    },
    {
      keywords: ["how to make resume", "resume kaise banaye", "resume tips"],
      answer:
        "Use a one-page reverse-chronological format. Focus on skills, projects, and measurable results. Avoid paragraphs—use bullet points with action verbs."
    },
    {
      keywords: ["ats", "applicant tracking"],
      answer:
        "ATS (Applicant Tracking System) is software used by companies to filter resumes. To pass ATS, use job-description keywords, simple formatting, and no tables or images."
    },
    {
      keywords: ["resume bullet", "resume points"],
      answer:
        "Use the XYZ formula: Achieved X, measured by Y, by doing Z. Example: Improved website load time by 30% by optimizing JavaScript code."
    },

    
    {
      keywords: ["what is internship", "internship kya"],
      answer:
        "An internship is a short-term professional experience where students learn real-world skills by working on practical tasks."
    },
    {
      keywords: ["internship without experience", "no experience internship"],
      answer:
        "Build projects, contribute to GitHub, complete certifications, and show learning ability. Projects count as experience."
    },
    {
      keywords: ["how to get internship", "internship kaise milegi"],
      answer:
        "Apply early, build 2–3 solid projects, optimize LinkedIn, and message recruiters with a short, focused introduction."
    },

    
    {
      keywords: ["job kaise milegi", "how to get job"],
      answer:
        "Focus on skills, not just degrees. Apply consistently, build projects, network on LinkedIn, and prepare for interviews."
    },
    {
      keywords: ["hidden job market"],
      answer:
        "Around 70% jobs are filled through referrals and networking, not job portals. Connections matter."
    },

    
    {
      keywords: ["tell me about yourself"],
      answer:
        "Use Past–Present–Future. Past: your background. Present: what you're doing now. Future: why this role and how you add value."
    },
    {
      keywords: ["interview preparation", "interview tips"],
      answer:
        "Practice mock interviews, revise fundamentals, explain your thinking clearly, and prepare STAR stories."
    },
    {
      keywords: ["why should we hire you"],
      answer:
        "Explain how your skills solve the company’s problems and how you will add value from day one."
    },
    {
      keywords: ["weakness"],
      answer:
        "Choose a real weakness and explain what you are doing to improve it. Avoid clichés like perfectionism."
    },

    
    {
      keywords: ["demotivated", "motivation", "stress"],
      answer:
        "Motivation comes and goes. Discipline and consistency create long-term success. Focus on small daily progress."
    }
  ];

  function findAnswer(question) {
    const q = question.toLowerCase();

    for (let item of KNOWLEDGE_BASE) {
      for (let key of item.keywords) {
        if (q.includes(key)) {
          return item.answer;
        }
      }
    }

    return "Sorry Sir/Ma’am, I am not developed enough to give an accurate answer to this question yet.";
  }

  function aiSend() {
    const input = document.getElementById("aiInput");
    const messages = document.getElementById("aiMessages");
    const text = input.value.trim();

    if (!text) return;

    messages.innerHTML += `<div class="ai-user">${text}</div>`;
    input.value = "";

    const reply = findAnswer(text);

    setTimeout(() => {
      messages.innerHTML += `<div class="ai-bot">${reply}</div>`;
      messages.scrollTop = messages.scrollHeight;
    }, 300);
  }


  window.aiSend = aiSend;

})();


(function () {

  
  const knowledge = [
    
    { keys: ["resume"], ans: "A resume is a professional document that highlights your skills, education, projects, and experience to get shortlisted for interviews." },
    { keys: ["ats"], ans: "ATS (Applicant Tracking System) is software that scans resumes for keywords. Use job-description keywords and simple formatting to pass ATS." },
    { keys: ["resume format"], ans: "The best resume format is reverse-chronological. Keep it one page, use bullet points, and avoid images or tables." },
    { keys: ["resume tips"], ans: "Use action verbs, quantify results, tailor your resume for every job, and focus on projects if you are a fresher." },

    
    { keys: ["internship"], ans: "An internship helps students gain real-world experience. Focus on learning skills, not just stipend." },
    { keys: ["internship without experience"], ans: "Build projects, contribute to GitHub, complete certifications, and show learning ability. Projects count as experience." },

    
    { keys: ["job"], ans: "To get a job, focus on skills, apply consistently, network on LinkedIn, and prepare well for interviews." },
    { keys: ["hidden job market"], ans: "Most jobs are filled through referrals and networking, not job portals. Connections matter." },

    
    { keys: ["tell me about yourself"], ans: "Answer using Past–Present–Future: background, current work, and why you want this role." },
    { keys: ["interview"], ans: "Interviews test how you think. Be clear, think aloud, and use STAR method for behavioral questions." },

    
    { keys: ["demotivated","tired","fail","failure","stress","confused","give up","quit"], ans: "Feeling low is normal. Stay consistent, focus on small daily progress, and trust the process. Discipline beats motivation." }
  ];

  const motivationLines = [
    "Consistency beats motivation every time.",
    "Every expert was once a beginner.",
    "Progress is invisible before it becomes visible.",
    "Failure is feedback, not judgment.",
    "Small steps daily create big results.",
    "You are not behind; you are building.",
    "Discipline creates confidence.",
    "Your effort today shapes your future.",
    "Learning never goes to waste.",
    "Don’t quit—refine your strategy."
  ];

  
  function getAnswer(question) {
    const q = question.toLowerCase();

    
    for (let item of knowledge) {
      for (let k of item.keys) {
        if (q.includes(k)) {
          return item.ans;
        }
      }
    }

  
    for (let word of ["sad","tired","lost","demotivated","stress","fail","failure"]) {
      if (q.includes(word)) {
        return motivationLines[Math.floor(Math.random() * motivationLines.length)];
      }
    }

    
    return "Sorry Sir/Ma’am, I am not developed enough to give an accurate answer to this question yet.";
  }

  
  function aiSend() {
    const input = document.getElementById("aiInput");
    const messages = document.getElementById("aiMessages");
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text) return;

    messages.innerHTML += `<div class="ai-user">${text}</div>`;
    input.value = "";

    const reply = getAnswer(text);

    setTimeout(() => {
      messages.innerHTML += `<div class="ai-bot">${reply}</div>`;
      messages.scrollTop = messages.scrollHeight;
    }, 300);
  }

  
  window.aiSend = aiSend;

})();
window.showUserPopup = function (title, message, onYes) {
  const modal = document.getElementById("userPopup");
  const titleEl = document.getElementById("userPopupTitle");
  const msgEl = document.getElementById("userPopupMsg");
  const yesBtn = document.getElementById("userPopupYes");
  const noBtn = document.getElementById("userPopupNo");

  titleEl.textContent = title;
  msgEl.textContent = message;

  modal.style.display = "flex";

  yesBtn.onclick = () => {
    modal.style.display = "none";
    if (onYes) onYes();
  };

  noBtn.onclick = () => {
    modal.style.display = "none";
  };
};




