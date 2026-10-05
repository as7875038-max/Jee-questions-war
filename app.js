// ======================================================
// FIREBASE CONFIG
// ======================================================

const firebaseConfig = {

  apiKey: "AIzaSyDlZQkLfxYp76tcPvTIl6Le7_lijxxZ2Hw",

  authDomain:
    "the-3-commitment-question-war.firebaseapp.com",

  projectId:
    "the-3-commitment-question-war",

  storageBucket:
    "the-3-commitment-question-war.firebasestorage.app",

  messagingSenderId:
    "120443792205",

  appId:
    "1:120443792205:web:bf7f29377c5dae478fe504",

  measurementId:
    "G-YK9XB6M7EF"
};


// ======================================================
// ADMIN EMAIL
// ======================================================

// IMPORTANT:
// Yahan apne Google login wale Gmail ko daalo.

const ADMIN_EMAILS = [
 "ankushsah950@gmail.com" 
];


// ======================================================
// FIREBASE
// ======================================================

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
).catch(error => {
  console.error(error);
});


// ======================================================
// DEFAULT CHALLENGE
// ======================================================

let challenge = {

  id: "main",

  joinCode: "JQW2026",

  phaseName: "Phase 1",

  day: 1,

  phaseStartDay: 1,

  phaseEndDay: 7,

  physicsTarget: 30,

  chemistryTarget: 30,

  mathsTarget: 25,

  startingLives: 2

};


// ======================================================
// CURRENT USER
// ======================================================

let currentUser = null;
let currentProfile = null;


// ======================================================
// ADMIN CHECK
// ======================================================

function isAdmin() {

  if (!currentUser || !currentUser.email)
    return false;

  return ADMIN_EMAILS
    .map(email => email.toLowerCase().trim())
    .includes(currentUser.email.toLowerCase().trim());
}


// ======================================================
// GOOGLE LOGIN
// ======================================================

document
  .getElementById("googleLogin")
  .addEventListener("click", async () => {

    try {

      const provider =
        new firebase.auth.GoogleAuthProvider();

      await auth.signInWithPopup(provider);

    }

    catch(error) {

      console.error(error);

      alert(error.message);

    }

  });


// ======================================================
// LOGOUT
// ======================================================

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => {

    auth.signOut();

  });


// ======================================================
// AUTH
// ======================================================

auth.onAuthStateChanged(async user => {

  if(!user) {

    currentUser = null;
    currentProfile = null;

    document
      .getElementById("loginScreen")
      .classList.remove("hidden");

    document
      .getElementById("app")
      .classList.add("hidden");

    return;

  }


  currentUser = user;


  document
    .getElementById("loginScreen")
    .classList.add("hidden");

  document
    .getElementById("app")
    .classList.remove("hidden");


  try {

    await loadChallenge();

    await loadUser();

    updateChallengeUI();

    updateAdminVisibility();

    updateJoinUI();

    await checkTodaySubmission();

    await loadLeaderboard();

    if(isAdmin()) {

      loadAdminFields();

      loadParticipants();

    }

  }

  catch(error) {

    console.error(error);

    alert(
      "Something went wrong. Check Firebase settings."
    );

  }

});


// ======================================================
// LOAD CHALLENGE
// ======================================================

async function loadChallenge() {

  const ref =
    db.collection("challenges").doc(challenge.id);

  const snap =
    await ref.get();


  if(!snap.exists) {

    await ref.set({

      ...challenge,

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp(),

      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()

    });

    return;

  }


  const data = snap.data();

  challenge = {

    ...challenge,
    ...data

  };

}


// ======================================================
// LOAD USER
// ======================================================

async function loadUser() {

  const ref =
    db.collection("users").doc(currentUser.uid);

  const snap =
    await ref.get();


  if(!snap.exists) {

    const newUser = {

      name:
        currentUser.displayName ||
        "Aspirant",

      email:
        currentUser.email || "",

      photoURL:
        currentUser.photoURL || "",

      challengeId:
        null,

      lives:
        challenge.startingLives,

      status:
        "NOT_JOINED",

      totalQuestions:
        0,

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()

    };


    await ref.set(newUser);

    currentProfile = newUser;

  }

  else {

    currentProfile = snap.data();

  }


  updateUserUI();

}


// ======================================================
// USER UI
// ======================================================

function updateUserUI() {

  const name =
    currentProfile?.name || "Aspirant";


  document.getElementById("userName")
    .innerText = name;

  document.getElementById("profileName")
    .innerText = name;

  document.getElementById("profileEmail")
    .innerText =
      currentProfile?.email || currentUser.email || "";

  document.getElementById("nameInput")
    .value = name;


  document.getElementById("lives")
    .innerText =
      currentProfile?.lives ?? "-";

  document.getElementById("myTotal")
    .innerText =
      currentProfile?.totalQuestions || 0;

  document.getElementById("myStatus")
    .innerText =
      currentProfile?.status || "NOT JOINED";

}


// ======================================================
// JOIN CHECK
// ======================================================

function isJoined() {

  return (
    currentProfile &&
    currentProfile.challengeId === challenge.id &&
    currentProfile.status !== "NOT_JOINED"
  );

}


// ======================================================
// UPDATE JOIN UI
// ======================================================

function updateJoinUI() {

  const joined =
    isJoined();


  const joinBox =
    document.getElementById("joinBox");

  const badge =
    document.getElementById("joinedBadge");


  if(joined) {

    joinBox.classList.add("hidden");

    badge.classList.remove("hidden");

  }

  else {

    joinBox.classList.remove("hidden");

    badge.classList.add("hidden");

  }


  const notice =
    document.getElementById("dashboardJoinNotice");


  if(notice) {

    if(joined) {

      notice.classList.add("hidden");

    }

    else {

      notice.classList.remove("hidden");

    }

  }

}


// ======================================================
// JOIN CHALLENGE
// ======================================================

document
  .getElementById("joinChallengeBtn")
  .addEventListener("click", joinChallenge);


async function joinChallenge() {

  if(!currentUser)
    return;


  const code =
    document
      .getElementById("challengeCode")
      .value
      .trim()
      .toUpperCase();


  if(!code) {

    alert("Please enter Challenge Code.");

    return;

  }


  if(code !== challenge.joinCode.toUpperCase()) {

    alert("❌ Invalid Challenge Code.");

    return;

  }


  if(isJoined()) {

    alert("You are already joined.");

    return;

  }


  try {

    await db
      .collection("users")
      .doc(currentUser.uid)
      .update({

        challengeId:
          challenge.id,

        lives:
          challenge.startingLives,

        status:
          "ACTIVE",

        totalQuestions:
          0,

        joinedAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });


    currentProfile.challengeId =
      challenge.id;

    currentProfile.lives =
      challenge.startingLives;

    currentProfile.status =
      "ACTIVE";

    currentProfile.totalQuestions =
      0;


    updateUserUI();
    updateJoinUI();


    document
      .getElementById("challengeCode")
      .value = "";


    alert("🎉 Welcome to JEE Question War!");

    await loadLeaderboard();

  }

  catch(error) {

    console.error(error);

    alert(error.message);

  }

}


// ======================================================
// DASHBOARD JOIN BUTTON
// ======================================================

document
  .getElementById("goJoinBtn")
  .addEventListener("click", () => {

    document
      .querySelector('[data-page="challenge"]')
      .click();

  });


// ======================================================
// CHALLENGE UI
// ======================================================

function updateChallengeUI() {

  document.getElementById("phaseText")
    .innerText =
      challenge.phaseName;


  document.getElementById("dashboardPhase")
    .innerText =
      challenge.phaseName;


  document.getElementById("dashboardDay")
    .innerText =
      "Day " + challenge.day;


  document.getElementById("challengeTitle")
    .innerText =
      challenge.phaseName +
      " • Day " +
      challenge.day;


  document.getElementById("physicsTarget")
    .innerText =
      challenge.physicsTarget;


  document.getElementById("chemistryTarget")
    .innerText =
      challenge.chemistryTarget;


  document.getElementById("mathsTarget")
    .innerText =
      challenge.mathsTarget;

}


// ======================================================
// LIVE TOTAL
// ======================================================

const inputIds = [

  "physicsInput",
  "chemistryInput",
  "mathsInput"

];


inputIds.forEach(id => {

  document
    .getElementById(id)
    .addEventListener(
      "input",
      updateTotal
    );

});


function updateTotal() {

  const p =
    Number(
      document.getElementById("physicsInput").value
    ) || 0;


  const c =
    Number(
      document.getElementById("chemistryInput").value
    ) || 0;


  const m =
    Number(
      document.getElementById("mathsInput").value
    ) || 0;


  document
    .getElementById("liveTotal")
    .innerText =
      p + c + m;

}


// ======================================================
// TODAY SUBMISSION CHECK
// ======================================================

async function checkTodaySubmission() {

  if(!currentUser || !isJoined())
    return;


  const docId =
    currentUser.uid +
    "_" +
    challenge.id +
    "_" +
    challenge.day;


  const snap =
    await db
      .collection("submissions")
      .doc(docId)
      .get();


  if(snap.exists) {

    disableSubmission();

    const data = snap.data();

    document
      .getElementById("submitMessage")
      .innerText =
        "✅ Today's score is already submitted.";

    document
      .getElementById("physicsInput")
      .value = data.physics || 0;

    document
      .getElementById("chemistryInput")
      .value = data.chemistry || 0;

    document
      .getElementById("mathsInput")
      .value = data.maths || 0;

    updateTotal();

  }

  else {

    enableSubmission();

  }

}


// ======================================================
// DISABLE / ENABLE SUBMISSION
// ======================================================

function disableSubmission() {

  inputIds.forEach(id => {

    document.getElementById(id).disabled = true;

  });


  document.getElementById("submitBtn").disabled = true;

}


function enableSubmission() {

  inputIds.forEach(id => {

    document.getElementById(id).disabled = false;

  });


  document.getElementById("submitBtn").disabled = false;

}


// ======================================================
// SUBMIT SCORE
// ======================================================

document
  .getElementById("submitBtn")
  .addEventListener(
    "click",
    submitScore
  );


async function submitScore() {

  if(!currentUser)
    return;


  if(!isJoined()) {

    alert("First join the challenge.");

    return;

  }


  if(currentProfile.status !== "ACTIVE") {

    alert("You are eliminated from this challenge.");

    return;

  }


  const p =
    Math.max(
      0,
      Number(
        document.getElementById("physicsInput").value
      ) || 0
    );


  const c =
    Math.max(
      0,
      Number(
        document.getElementById("chemistryInput").value
      ) || 0
    );


  const m =
    Math.max(
      0,
      Number(
        document.getElementById("mathsInput").value
      ) || 0
    );


  const minimum =

    p >= challenge.physicsTarget &&
    c >= challenge.chemistryTarget &&
    m >= challenge.mathsTarget;


  const total =
    p + c + m;


  const submissionId =
    currentUser.uid +
    "_" +
    challenge.id +
    "_" +
    challenge.day;


  const userRef =
    db.collection("users")
      .doc(currentUser.uid);


  const submissionRef =
    db.collection("submissions")
      .doc(submissionId);


  try {

    await db.runTransaction(
      async transaction => {

        const submissionSnap =
          await transaction.get(
            submissionRef
          );


        if(submissionSnap.exists) {

          throw new Error(
            "TODAY_ALREADY_SUBMITTED"
          );

        }


        const userSnap =
          await transaction.get(
            userRef
          );


        if(!userSnap.exists) {

          throw new Error(
            "USER_NOT_FOUND"
          );

        }


        const user =
          userSnap.data();


        if(user.status !== "ACTIVE") {

          throw new Error(
            "NOT_ACTIVE"
          );

        }


        const oldTotal =
          user.totalQuestions || 0;


        const oldLives =
          user.lives ?? challenge.startingLives;


        let newLives =
          oldLives;


        let newStatus =
          user.status;


        if(!minimum) {

          newLives =
            Math.max(0, oldLives - 1);


          if(newLives === 0) {

            newStatus =
              "ELIMINATED";

          }

        }


        transaction.update(
          userRef,
          {

            totalQuestions:
              oldTotal + total,

            lives:
              newLives,

            status:
              newStatus,

            lastSubmission:
              firebase.firestore.FieldValue.serverTimestamp()

          }
        );


        transaction.set(
          submissionRef,
          {

            uid:
              currentUser.uid,

            challengeId:
              challenge.id,

            name:
              user.name || "Aspirant",

            phase:
              challenge.phaseName,

            day:
              challenge.day,

            physics:
              p,

            chemistry:
              c,

            maths:
              m,

            total:
              total,

            targetCompleted:
              minimum,

            timestamp:
              firebase.firestore.FieldValue.serverTimestamp()

          }
        );


        currentProfile.totalQuestions =
          oldTotal + total;

        currentProfile.lives =
          newLives;

        currentProfile.status =
          newStatus;

      }
    );


    updateUserUI();

    disableSubmission();


    if(minimum) {

      document
        .getElementById("submitMessage")
        .innerText =
          "🎉 TARGET COMPLETED!";

    }

    else if(
      currentProfile.status === "ELIMINATED"
    ) {

      document
        .getElementById("submitMessage")
        .innerText =
          "❌ You have been eliminated.";

    }

    else {

      document
        .getElementById("submitMessage")
        .innerText =
          "⚠️ Target missed. 1 life lost.";

    }


    await loadLeaderboard();

  }

  catch(error) {

    console.error(error);


    if(
      error.message ===
      "TODAY_ALREADY_SUBMITTED"
    ) {

      alert(
        "You have already submitted today's score."
      );

      disableSubmission();

      return;

    }


    alert(error.message);

  }

}


// ======================================================
// LEADERBOARD
// ======================================================

async function loadLeaderboard() {

  if(!currentUser)
    return;


  const snapshot =
    await db
      .collection("users")
      .where(
        "challengeId",
        "==",
        challenge.id
      )
      .get();


  const users =
    snapshot.docs.map(doc => ({

      id: doc.id,

      ...doc.data()

    }));


  // Highest questions first

  users.sort(
    (a,b) =>
      (b.totalQuestions || 0) -
      (a.totalQuestions || 0)
  );


  const container =
    document.getElementById("leaderboard");


  container.innerHTML = "";


  let activeRank = 0;


  users.forEach(user => {

    if(user.status === "ACTIVE") {

      activeRank++;

    }


    const displayRank =
      user.status === "ACTIVE"
        ? activeRank
        : "—";


    let medal = "#" + displayRank;


    if(activeRank === 1)
      medal = "🥇";

    else if(activeRank === 2)
      medal = "🥈";

    else if(activeRank === 3)
      medal = "🥉";


    const card =
      document.createElement("div");


    card.className =
      "rank-card " +
      (
        user.status === "ELIMINATED"
          ? "eliminated"
          : ""
      );


    card.innerHTML = `

      <div class="rank-number">
        ${medal}
      </div>

      <div class="rank-name">

        <strong>
          ${escapeHTML(user.name || "Aspirant")}
        </strong>

        <small>
          ${
            user.status === "ACTIVE"
              ? "🟢 ACTIVE"
              : "❌ ELIMINATED"
          }
        </small>

      </div>

      <div class="rank-score">
        ${user.totalQuestions || 0} Q
      </div>

    `;


    container.appendChild(card);

  });


  const myIndex =
    users.findIndex(
      user =>
        user.id === currentUser.uid &&
        user.status === "ACTIVE"
    );


  if(myIndex !== -1) {

    document
      .getElementById("myRank")
      .innerText =
        "#" + (myIndex + 1);

  }

  else {

    document
      .getElementById("myRank")
      .innerText = "-";

  }

}


// ======================================================
// SAVE NAME
// ======================================================

document
  .getElementById("saveNameBtn")
  .addEventListener(
    "click",
    async () => {

      const newName =
        document
          .getElementById("nameInput")
          .value
          .trim();


      if(!newName) {

        alert("Please enter a name.");

        return;

      }


      await db
        .collection("users")
        .doc(currentUser.uid)
        .update({

          name:
            newName

        });


      currentProfile.name =
        newName;


      updateUserUI();

      await loadLeaderboard();

      if(isAdmin())
        await loadParticipants();


      alert("Name updated!");

    }
  );


// ======================================================
// ADMIN VISIBILITY
// ======================================================

function updateAdminVisibility() {

  const adminBtn =
    document.getElementById("adminNavBtn");


  if(isAdmin()) {

    adminBtn.classList.remove("hidden");

  }

  else {

    adminBtn.classList.add("hidden");

  }

}


// ======================================================
// LOAD ADMIN FIELDS
// ======================================================

function loadAdminFields() {

  document.getElementById("adminJoinCode")
    .value =
      challenge.joinCode;

  document.getElementById("adminPhaseName")
    .value =
      challenge.phaseName;

  document.getElementById("adminDay")
    .value =
      challenge.day;

  document.getElementById("adminStartDay")
    .value =
      challenge.phaseStartDay;

  document.getElementById("adminEndDay")
    .value =
      challenge.phaseEndDay;

  document.getElementById("adminPhysics")
    .value =
      challenge.physicsTarget;

  document.getElementById("adminChemistry")
    .value =
      challenge.chemistryTarget;

  document.getElementById("adminMaths")
    .value =
      challenge.mathsTarget;

  document.getElementById("adminLives")
    .value =
      challenge.startingLives;

}


// ======================================================
// SAVE CHALLENGE SETTINGS
// ======================================================

document
  .getElementById("saveChallengeBtn")
  .addEventListener(
    "click",
    saveChallengeSettings
  );


async function saveChallengeSettings() {

  if(!isAdmin()) {

    alert("Admin access required.");

    return;

  }


  const updated = {

    joinCode:
      document
        .getElementById("adminJoinCode")
        .value
        .trim()
        .toUpperCase(),

    phaseName:
      document
        .getElementById("adminPhaseName")
        .value
        .trim(),

    day:
      Number(
        document
          .getElementById("adminDay")
          .value
      ),

    phaseStartDay:
      Number(
        document
          .getElementById("adminStartDay")
          .value
      ),

    phaseEndDay:
      Number(
        document
          .getElementById("adminEndDay")
          .value
       ),

    physicsTarget:
      Number(
        document
          .getElementById("adminPhysics")
          .value
      ),

    chemistryTarget:
      Number(
        document
          .getElementById("adminChemistry")
          .value
      ),

    mathsTarget:
      Number(
        document
          .getElementById("adminMaths")
          .value
      ),

    startingLives:
      Number(
        document
          .getElementById("adminLives")
          .value
      ),

    updatedAt:
      firebase.firestore.FieldValue.serverTimestamp()

  };


  if(!updated.joinCode) {

    alert("Challenge Code cannot be empty.");

    return;

  }


  if(!updated.phaseName) {

    alert("Phase Name cannot be empty.");

    return;

  }


  try {

    await db
      .collection("challenges")
      .doc(challenge.id)
      .update(updated);


    challenge = {

      ...challenge,
      ...updated

    };


    updateChallengeUI();

    loadAdminFields();

    updateJoinUI();


    document
      .getElementById("adminMessage")
      .innerText =
        "✅ Challenge settings saved successfully.";

    await checkTodaySubmission();

  }

  catch(error) {

    console.error(error);

    alert(error.message);

  }

}


// ======================================================
// ADMIN PARTICIPANTS
// ======================================================

async function loadParticipants() {

  if(!isAdmin())
    return;


  const snapshot =
    await db
      .collection("users")
      .where(
        "challengeId",
        "==",
        challenge.id
      )
      .get();


  const participants =
    snapshot.docs.map(doc => ({

      id: doc.id,

      ...doc.data()

    }));


  participants.sort(
    (a,b) =>
      (b.totalQuestions || 0) -
      (a.totalQuestions || 0)
  );


  const container =
    document.getElementById(
      "participantsList"
    );


  container.innerHTML = "";


  if(participants.length === 0) {

    container.innerHTML =
      `<p class="admin-muted">
        No participants have joined yet.
      </p>`;

    return;

  }

  
  participants.forEach((user,index) => {

    const card =
      document.createElement("div");

    card.className =
      "participant-card";


    const active =
      user.status === "ACTIVE";


    card.innerHTML = `

      <div class="participant-info">

        <strong>
          #${index + 1}
          &nbsp;
          ${escapeHTML(user.name || "Aspirant")}
        </strong>

        <small>
          ${escapeHTML(user.email || "")}
        </small>

      </div>

      <div class="participant-stats">

        <strong>
          ${user.totalQuestions || 0} Q
        </strong>

        <small>
          ❤️ ${user.lives ?? 0}
          &nbsp; • &nbsp;
          ${active ? "🟢 ACTIVE" : "❌ ELIMINATED"}
        </small>

      </div>

      <button
        class="admin-action"
        data-uid="${user.id}"
        data-action="${active ? "eliminate" : "restore"}"
      >
        ${active ? "❌ Eliminate" : "♻️ Restore"}
      </button>

    `;


    container.appendChild(card);

  });


  container
    .querySelectorAll(".admin-action")
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const uid =
            button.dataset.uid;

          const action =
            button.dataset.action;


          await changeParticipantStatus(
            uid,
            action
          );

        }
      );

    });

}


// ======================================================
// ADMIN CHANGE STATUS
// ======================================================

async function changeParticipantStatus(
  uid,
  action
) {

  if(!isAdmin())
    return;


  const newStatus =
    action === "eliminate"
      ? "ELIMINATED"
      : "ACTIVE";


  try {

    await db
      .collection("users")
      .doc(uid)
      .update({

        status:
          newStatus

      });


    await loadParticipants();

    await loadLeaderboard();

  }

  catch(error) {

    console.error(error);

    alert(error.message);

  }

}


// ======================================================
// REFRESH PARTICIPANTS
// ======================================================

document
  .getElementById("refreshParticipantsBtn")
  .addEventListener(
    "click",
    loadParticipants
  );


// ======================================================
// NAVIGATION
// ======================================================

document
  .querySelectorAll(".nav-btn")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const page =
          button.dataset.page;


        if(
          page === "admin" &&
          !isAdmin()
        ) {

          alert("Admin access required.");

          return;

        }


        document
          .querySelectorAll(".page")
          .forEach(section => {

            section.classList.add("hidden");

          });


        document
          .getElementById(page)
          .classList.remove("hidden");


        document
          .querySelectorAll(".nav-btn")
          .forEach(btn => {

            btn.classList.remove("active");

          });


        button.classList.add("active");


        if(page === "ranking") {

          loadLeaderboard();

        }


        if(page === "admin") {

          loadAdminFields();

          loadParticipants();

        }

      }
    );

  });


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHTML(text) {

  const div =
    document.createElement("div");

  div.textContent =
    text ?? "";

  return div.innerHTML;

}
