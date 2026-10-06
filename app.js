// ======================================================
// THE 3AM COMMITMENT QUESTION WAR — V2
// ======================================================

const firebaseConfig = {
  apiKey: "AIzaSyDlZQkLfxYp76tcPvTIl6Le7_lijxxZ2Hw",
  authDomain: "the-3-commitment-question-war.firebaseapp.com",
  projectId: "the-3-commitment-question-war",
  storageBucket: "the-3-commitment-question-war.firebasestorage.app",
  messagingSenderId: "120443792205",
  appId: "1:120443792205:web:bf7f29377c5dae478fe504",
  measurementId: "G-YK9XB6M7EF"
};

const ADMIN_EMAILS = [
  "ankushsah950@gmail.com"
];

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

auth.setPersistence(
  firebase.auth.Auth.Persistence.LOCAL
).catch(console.error);


// ======================================================
// DEFAULT CHALLENGE
// ======================================================

let challenge = {
  id: "main",
  joinCode: "JQW2026",
  phaseName: "Phase 1",

  startDate: "2026-10-07",
  endDate: "2026-10-13",

  physicsTarget: 30,
  chemistryTarget: 30,
  mathsTarget: 25,

  startingLives: 2
};


// ======================================================
// GLOBAL STATE
// ======================================================

let currentUser = null;
let currentProfile = null;

let currentChallengeDay = null;
let currentChallengeDate = null;

let chatUnsubscribe = null;
let voiceRecorder = null;
let voiceChunks = [];

const inputIds = [
  "physicsInput",
  "chemistryInput",
  "mathsInput"
];


// ======================================================
// HELPERS
// ======================================================

const $ = id => document.getElementById(id);

function isAdmin(){

  return !!(
    currentUser?.email &&
    ADMIN_EMAILS
      .map(x => x.toLowerCase().trim())
      .includes(currentUser.email.toLowerCase().trim())
  );
}


function escapeHTML(text){

  const div = document.createElement("div");

  div.textContent = text ?? "";

  return div.innerHTML;
}


function pad(n){

  return String(n).padStart(2,"0");

}


function formatDate(dateString){

  if(!dateString) return "—";

  const [y,m,d] = dateString
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day:"numeric",
      month:"long",
      year:"numeric",
      timeZone:"Asia/Kolkata"
    }
  ).format(
    new Date(Date.UTC(y,m-1,d,12))
  );
}


function dateUTC(dateString){

  const [y,m,d] = dateString
    .split("-")
    .map(Number);

  return Date.UTC(y,m-1,d);
}


function dateStringUTC(ms){

  const d = new Date(ms);

  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}


function diffDays(a,b){

  return Math.round(
    (dateUTC(b)-dateUTC(a))/86400000
  );

}


// ======================================================
// 3 AM INDIA CLOCK
// ======================================================

function challengeClock(){

  const now = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:"Asia/Kolkata",
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit",
        hourCycle:"h23"
      }
    ).formatToParts(now);

  const o = {};

  parts.forEach(
    p => o[p.type] = p.value
  );

  let date =
    `${o.year}-${o.month}-${o.day}`;

  const hour = Number(o.hour);

  // Before 3 AM belongs to previous challenge day
  if(hour < 3){

    date =
      dateStringUTC(
        dateUTC(date)-86400000
      );

  }

  return {
    challengeDate: date,
    now,
    hour
  };

}


// ======================================================
// AUTOMATIC DAY CALCULATION
// ======================================================

function calculateDay(){

  const clock = challengeClock();

  currentChallengeDate =
    clock.challengeDate;

  if(
    !challenge.startDate ||
    !challenge.endDate
  ){

    return {
      day:null,
      state:"NOT_CONFIGURED"
    };

  }

  if(
    currentChallengeDate <
    challenge.startDate
  ){

    return {
      day:0,
      state:"NOT_STARTED"
    };

  }

  if(
    currentChallengeDate >
    challenge.endDate
  ){

    return {
      day:
        diffDays(
          challenge.startDate,
          challenge.endDate
        ) + 1,

      state:"ENDED"
    };

  }

  return {

    day:
      diffDays(
        challenge.startDate,
        currentChallengeDate
      ) + 1,

    state:"ACTIVE"

  };

}


function dayLabel(){

  const x = calculateDay();

  if(x.state === "ACTIVE")
    return `Day ${x.day}`;

  if(x.state === "NOT_STARTED")
    return "Not Started";

  if(x.state === "ENDED")
    return "Challenge Ended";

  return "Not Configured";
}


function submissionId(uid,day){

  return `${uid}_${challenge.id}_${day}`;

}


function lifeEventId(uid,day){

  return `${uid}_${challenge.id}_${day}`;

}


// ======================================================
// TOAST
// ======================================================

function toast(message,type=""){

  let container =
    $("toastContainer");

  if(!container){

    container =
      document.createElement("div");

    container.id =
      "toastContainer";

    document.body.appendChild(container);

  }

  const el =
    document.createElement("div");

  el.className =
    `toast ${type}`;

  el.textContent =
    message;

  container.appendChild(el);

  setTimeout(
    () => el.remove(),
    3500
  );

}


// ======================================================
// AUTH
// ======================================================

async function login(){

  const provider =
    new firebase.auth.GoogleAuthProvider();

  try{

    await auth.signInWithPopup(provider);

  }catch(error){

    console.error(error);

    toast(
      error.message ||
      "Login failed",
      "error"
    );

  }

}


async function logout(){

  if(chatUnsubscribe)
    chatUnsubscribe();

  await auth.signOut();

}


window.login = login;
window.logout = logout;


// ======================================================
// LOAD CHALLENGE
// ======================================================

async function loadChallenge(){

  try{

    const snap =
      await db
        .collection("challenges")
        .doc("main")
        .get();

    if(snap.exists){

      challenge = {
        ...challenge,
        ...snap.data()
      };

    }else{

      await db
        .collection("challenges")
        .doc("main")
        .set(challenge);

    }

  }catch(error){

    console.error(error);

    toast(
      "Challenge load error",
      "error"
    );

  }

}


// ======================================================
// USER PROFILE
// ======================================================

async function loadUser(){

  if(!currentUser)
    return;

  const ref =
    db
      .collection("users")
      .doc(currentUser.uid);

  const snap =
    await ref.get();

  if(!snap.exists){

    currentProfile = {

      uid:currentUser.uid,

      name:
        currentUser.displayName ||
        "Aspirant",

      email:
        currentUser.email || "",

      photoURL:
        currentUser.photoURL || "",

      challengeId:null,

      status:"NOT_JOINED",

      joinRequestStatus:"NONE",

      lives:0,

      totalQuestions:0,

      physics:0,

      chemistry:0,

      maths:0,

      joinedAt:
        firebase.firestore.FieldValue.serverTimestamp()

    };

    await ref.set(
      currentProfile
    );

  }else{

    currentProfile = snap.data();

  }

}


// ======================================================
// JOIN STATUS
// ======================================================

function isJoined(){

  return (
    currentProfile &&
    currentProfile.challengeId === challenge.id &&
    currentProfile.status !== "KICKED" &&
    currentProfile.status !== "NOT_JOINED"
  );

}


function isKicked(){

  return currentProfile?.status === "KICKED";

}


function isEliminated(){

  return currentProfile?.status === "ELIMINATED";

}


// ======================================================
// JOIN REQUEST
// ======================================================

async function requestJoin(){

  if(!currentUser || !currentProfile)
    return;

  if(isKicked()){

    toast(
      "You have been kicked. Admin must unkick you first.",
      "error"
    );

    return;

  }

  const code =
    ($("joinCodeInput")?.value || "")
      .trim();

  if(!code){

    toast(
      "Enter the challenge code.",
      "error"
    );

    return;

  }

  if(code !== challenge.joinCode){

    toast(
      "Wrong challenge code.",
      "error"
    );

    return;

  }

  if(isJoined()){

    toast(
      "You are already in the challenge."
    );

    return;

  }

  if(
    currentProfile.joinRequestStatus ===
    "PENDING"
  ){

    toast(
      "Your join request is already pending."
    );

    return;

  }

  try{

    await db
      .collection("joinRequests")
      .doc(
        `${currentUser.uid}_${challenge.id}`
      )
      .set({

        uid:currentUser.uid,

        challengeId:challenge.id,

        name:
          currentProfile.name,

        email:
          currentProfile.email,

        photoURL:
          currentProfile.photoURL || "",

        status:"PENDING",

        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });

    await db
      .collection("users")
      .doc(currentUser.uid)
      .update({

        joinRequestStatus:"PENDING"

      });

    currentProfile.joinRequestStatus =
      "PENDING";

    renderAll();

    toast(
      "Join request sent to admin.",
      "success"
    );

  }catch(error){

    console.error(error);

    toast(
      "Could not send request.",
      "error"
    );

  }

}


window.requestJoin = requestJoin;


// ======================================================
// APPROVE JOIN
// ======================================================

async function approveJoin(uid,requestId){

  if(!isAdmin())
    return;

  try{

    const userRef =
      db.collection("users").doc(uid);

    await db.runTransaction(
      async transaction => {

        const userSnap =
          await transaction.get(userRef);

        if(!userSnap.exists)
          throw new Error("User not found.");

        const user =
          userSnap.data();

        const startingLives =
          Number(
            challenge.startingLives || 2
          );

        transaction.update(
          userRef,
          {

            challengeId:challenge.id,

            status:"ACTIVE",

            joinRequestStatus:"APPROVED",

            lives:
              user.challengeId === challenge.id &&
              Number(user.lives) > 0
                ? Number(user.lives)
                : startingLives,

            totalQuestions:
              Number(user.totalQuestions || 0),

            joinedAt:
              firebase.firestore.FieldValue.serverTimestamp()

          }
        );

      }
    );

    await db
      .collection("joinRequests")
      .doc(requestId)
      .update({

        status:"APPROVED",

        reviewedAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });

    toast(
      "Member approved.",
      "success"
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Approval failed.",
      "error"
    );

  }

}


window.approveJoin = approveJoin;


// ======================================================
// REJECT JOIN
// ======================================================

async function rejectJoin(uid,requestId){

  if(!isAdmin())
    return;

  try{

    await db
      .collection("joinRequests")
      .doc(requestId)
      .update({

        status:"REJECTED",

        reviewedAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });

    await db
      .collection("users")
      .doc(uid)
      .update({

        joinRequestStatus:"REJECTED"

      });

    toast(
      "Join request rejected."
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not reject request.",
      "error"
    );

  }

}


window.rejectJoin = rejectJoin;


// ======================================================
// DATE / DAY UI
// ======================================================

function renderClock(){

  const info =
    calculateDay();

  const dayEl =
    $("currentDay");

  const dateEl =
    $("currentDate");

  if(dayEl)
    dayEl.textContent =
      dayLabel();

  if(dateEl)
    dateEl.textContent =
      currentChallengeDate
        ? formatDate(currentChallengeDate)
        : "—";

  const stateEl =
    $("challengeState");

  if(stateEl)
    stateEl.textContent =
      info.state === "ACTIVE"
        ? `Day ${info.day} • 3:00 AM cycle`
        : dayLabel();

}


setInterval(
  renderClock,
  1000
);


// ======================================================
// MISSED DAY PROCESSING
// ======================================================

async function processMissedDays(){

  if(!currentUser)
    return;

  if(!isJoined())
    return;

  if(
    currentProfile.status === "KICKED" ||
    currentProfile.status === "ELIMINATED"
  )
    return;

  const info =
    calculateDay();

  if(info.state !== "ACTIVE")
    return;

  const currentDay =
    info.day;

  if(currentDay <= 1)
    return;

  const joinedAt =
    currentProfile.joinedAt;

  let joinedDay = 1;

  if(
    joinedAt &&
    joinedAt.toDate
  ){

    const joinedDate =
      joinedAt.toDate();

    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:"Asia/Kolkata",
          year:"numeric",
          month:"2-digit",
          day:"2-digit"
        }
      ).formatToParts(joinedDate);

    const o = {};

    parts.forEach(
      p => o[p.type] = p.value
    );

    const d =
      `${o.year}-${o.month}-${o.day}`;

    joinedDay =
      Math.max(
        1,
        diffDays(
          challenge.startDate,
          d
        ) + 1
      );

  }

  const lastCompletedDay =
    currentDay - 1;

  if(joinedDay > lastCompletedDay)
    return;

  for(
    let day=joinedDay;
    day<=lastCompletedDay;
    day++
  ){

    const submissionRef =
      db
        .collection("submissions")
        .doc(
          submissionId(
            currentUser.uid,
            day
          )
        );

    const eventRef =
      db
        .collection("lifeEvents")
        .doc(
          lifeEventId(
            currentUser.uid,
            day
          )
        );

    const submissionSnap =
      await submissionRef.get();

    if(submissionSnap.exists)
      continue;

    const eventSnap =
      await eventRef.get();

    if(eventSnap.exists)
      continue;

    try{

      await db.runTransaction(
        async transaction => {

          const freshUser =
            await transaction.get(
              db.collection("users")
                .doc(currentUser.uid)
            );

          const freshEvent =
            await transaction.get(eventRef);

          const freshSubmission =
            await transaction.get(
              submissionRef
            );

          if(
            freshEvent.exists ||
            freshSubmission.exists
          )
            return;

          const user =
            freshUser.data();

          const lives =
            Math.max(
              0,
              Number(user.lives || 0)-1
            );

          const status =
            lives <= 0
              ? "ELIMINATED"
              : "ACTIVE";

          transaction.update(
            db.collection("users")
              .doc(currentUser.uid),
            {

              lives,

              status,

              lastLifeDeductionDay:day

            }
          );

          transaction.set(
            eventRef,
            {

              uid:currentUser.uid,

              challengeId:
                challenge.id,

              day,

              reason:
                "MISSED_DAY",

              createdAt:
                firebase.firestore.FieldValue.serverTimestamp()

            }
          );

        }
      );

    }catch(error){

      console.error(
        "Missed day error:",
        error
      );

    }

  }

  await loadUser();

}


// ======================================================
// SUBMIT DAILY QUESTIONS
// ======================================================

async function submitQuestions(){

  if(!currentUser || !isJoined()){

    toast(
      "You must be an approved member.",
      "error"
    );

    return;

  }

  if(
    currentProfile.status === "ELIMINATED"
  ){

    toast(
      "You are eliminated.",
      "error"
    );

    return;

  }

  const info =
    calculateDay();

  if(info.state !== "ACTIVE"){

    toast(
      "Challenge is not active.",
      "error"
    );

    return;

  }

  const day =
    info.day;

  const p =
    Math.max(
      0,
      Number(
        $("physicsInput")?.value || 0
      )
    );

  const c =
    Math.max(
      0,
      Number(
        $("chemistryInput")?.value || 0
      )
    );

  const m =
    Math.max(
      0,
      Number(
        $("mathsInput")?.value || 0
      )
    );

  const total =
    p+c+m;

  if(total <= 0){

    toast(
      "Enter at least one question.",
      "error"
    );

    return;

  }

  const submissionRef =
    db
      .collection("submissions")
      .doc(
        submissionId(
          currentUser.uid,
          day
        )
      );

  const already =
    await submissionRef.get();

  if(already.exists){

    toast(
      "Today's questions are already submitted.",
      "error"
    );

    return;

  }

  const minimumMet =
    p >= Number(challenge.physicsTarget || 0) &&
    c >= Number(challenge.chemistryTarget || 0) &&
    m >= Number(challenge.mathsTarget || 0);

  try{

    await db.runTransaction(
      async transaction => {

        const userRef =
          db
            .collection("users")
            .doc(currentUser.uid);

        const userSnap =
          await transaction.get(userRef);

        const fresh =
          userSnap.data();

        let lives =
          Number(fresh.lives || 0);

        let status =
          fresh.status;

        if(!minimumMet){

          lives =
            Math.max(
              0,
              lives-1
            );

          if(lives <= 0)
            status = "ELIMINATED";

        }

        transaction.set(
          submissionRef,
          {

            uid:currentUser.uid,

            challengeId:
              challenge.id,

            day,

            challengeDate:
              currentChallengeDate,

            physics:p,

            chemistry:c,

            maths:m,

            total,

            minimumMet,

            createdAt:
              firebase.firestore.FieldValue.serverTimestamp()

          }
        );

        transaction.update(
          userRef,
          {

            physics:
              Number(fresh.physics || 0)+p,

            chemistry:
              Number(fresh.chemistry || 0)+c,

            maths:
              Number(fresh.maths || 0)+m,

            totalQuestions:
              Number(fresh.totalQuestions || 0)+total,

            lives,

            status,

            lastSubmittedDay:day

          }
        );

      }
    );

    await loadUser();

    inputIds.forEach(
      id => {
        if($(id))
          $(id).value = "";
      }
    );

    renderAll();

    if(minimumMet){

      toast(
        "🔥 Daily target completed!",
        "success"
      );

    }else{

      toast(
        "Target missed — 1 life used.",
        "error"
      );

    }

  }catch(error){

    console.error(error);

    toast(
      "Submission failed.",
      "error"
    );

  }

}


window.submitQuestions = submitQuestions;

// ======================================================
// LEADERBOARD
// ======================================================

async function getLeaderboard(){

  const snap =
    await db
      .collection("users")
      .where(
        "challengeId",
        "==",
        challenge.id
      )
      .get();

  const users =
    snap.docs
      .map(doc => ({
        id:doc.id,
        ...doc.data()
      }))
      .filter(
        user =>
          user.status !== "KICKED"
      );

  users.sort(
    (a,b) =>
      Number(b.totalQuestions || 0) -
      Number(a.totalQuestions || 0)
  );

  return users;

}


async function renderLeaderboard(){

  const tbody =
    $("leaderboardBody");

  if(!tbody)
    return;

  tbody.innerHTML =
    `<tr>
      <td colspan="6" class="empty">
        Loading ranking...
      </td>
    </tr>`;

  try{

    const users =
      await getLeaderboard();

    if(!users.length){

      tbody.innerHTML =
        `<tr>
          <td colspan="6" class="empty">
            No members yet.
          </td>
        </tr>`;

      return;

    }

    let activeRank = 0;

    tbody.innerHTML =
      users
        .map((user,index) => {

          const eliminated =
            user.status === "ELIMINATED";

          if(!eliminated)
            activeRank++;

          const rank =
            eliminated
              ? "—"
              : activeRank;

          const lives =
            Math.max(
              0,
              Number(user.lives || 0)
            );

          let lifeHTML = "";

          for(
            let i=0;
            i<Math.max(
              Number(challenge.startingLives || 2),
              lives
            );
            i++
          ){

            lifeHTML +=
              `<span class="life ${
                i < lives
                  ? ""
                  : "dead"
              }">❤️</span>`;

          }

          return `
            <tr class="${
              eliminated
                ? "eliminated-row"
                : ""
            }">

              <td>
                <span class="rank-number">
                  ${rank}
                </span>
              </td>

              <td>
                <div class="rank-user">

                  <img
                    src="${
                      escapeHTML(
                        user.photoURL ||
                        "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(
                          user.name || "A"
                        )
                      )
                    }"
                  >

                  <div>
                    <strong>
                      ${escapeHTML(
                        user.name || "Aspirant"
                      )}
                    </strong>

                    <div class="small muted">
                      ${
                        eliminated
                          ? "ELIMINATED"
                          : "ACTIVE"
                      }
                    </div>
                  </div>

                </div>
              </td>

              <td>
                <strong>
                  ${Number(
                    user.totalQuestions || 0
                  )}
                </strong>
              </td>

              <td>
                ${Number(user.physics || 0)}
              </td>

              <td>
                ${Number(user.chemistry || 0)}
              </td>

              <td>
                ${Number(user.maths || 0)}
              </td>

              <td>
                <div class="lives">
                  ${lifeHTML}
                </div>
              </td>

            </tr>
          `;

        })
        .join("");

  }catch(error){

    console.error(error);

    tbody.innerHTML =
      `<tr>
        <td colspan="7" class="empty">
          Ranking could not be loaded.
        </td>
      </tr>`;

  }

}

// ======================================================
// PROFILE
// ======================================================

function renderProfile(){

  if(!currentProfile)
    return;

  const name =
    $("profileName");

  const email =
    $("profileEmail");

  const photo =
    $("profilePhoto");

  const status =
    $("profileStatus");

  const lives =
    $("profileLives");

  const total =
    $("profileTotal");

  if(name)
    name.textContent =
      currentProfile.name || "Aspirant";

  if(email)
    email.textContent =
      currentProfile.email || "";

  if(photo)
    photo.src =
      currentProfile.photoURL || "";

  if(status)
    status.textContent =
      currentProfile.status || "NOT_JOINED";

  if(lives)
    lives.textContent =
      Number(currentProfile.lives || 0);

  if(total)
    total.textContent =
      Number(
        currentProfile.totalQuestions || 0
      );

}


// ======================================================
// DASHBOARD
// ======================================================

async function renderDashboard(){

  const info =
    calculateDay();

  if($("dashboardPhase"))
    $("dashboardPhase").textContent =
      challenge.phaseName || "Phase";

  if($("dashboardDay"))
    $("dashboardDay").textContent =
      dayLabel();

  if($("dashboardDate"))
    $("dashboardDate").textContent =
      currentChallengeDate
        ? formatDate(currentChallengeDate)
        : "—";

  if($("dashboardLives"))
    $("dashboardLives").textContent =
      currentProfile
        ? Number(currentProfile.lives || 0)
        : 0;

  if($("dashboardQuestions"))
    $("dashboardQuestions").textContent =
      currentProfile
        ? Number(currentProfile.totalQuestions || 0)
        : 0;

  const targetTotal =
    Number(challenge.physicsTarget || 0) +
    Number(challenge.chemistryTarget || 0) +
    Number(challenge.mathsTarget || 0);

  if($("todayTarget"))
    $("todayTarget").textContent =
      targetTotal;

  if($("targetPhysics"))
    $("targetPhysics").textContent =
      challenge.physicsTarget || 0;

  if($("targetChemistry"))
    $("targetChemistry").textContent =
      challenge.chemistryTarget || 0;

  if($("targetMaths"))
    $("targetMaths").textContent =
      challenge.mathsTarget || 0;

  renderJoinBox();

}


// ======================================================
// JOIN BOX
// ======================================================

function renderJoinBox(){

  const box =
    $("joinBox");

  if(!box)
    return;

  if(isKicked()){

    box.innerHTML = `
      <div class="admin-warning">
        <strong>🚫 You are kicked.</strong>
        <br>
        You cannot request to join again until the admin un-kicks you.
      </div>
    `;

    return;

  }

  if(isJoined()){

    box.innerHTML = `
      <div class="status active">
        ✓ You are an approved member
      </div>
    `;

    return;

  }

  if(
    currentProfile?.joinRequestStatus ===
    "PENDING"
  ){

    box.innerHTML = `
      <div class="status pending">
        ⏳ Join request pending admin approval
      </div>
    `;

    return;

  }

  box.innerHTML = `

    <div class="card request-card">

      <div class="card-title">
        🔐 Join Challenge
      </div>

      <p class="muted small">
        Enter the challenge code and send a request.
        Admin approval is required.
      </p>

      <div class="code-input">

        <input
          id="joinCodeInput"
          type="text"
          placeholder="Challenge code"
        >

        <button
          class="btn btn-primary"
          onclick="requestJoin()"
        >
          Request Join
        </button>

      </div>

      ${
        currentProfile?.joinRequestStatus ===
        "REJECTED"
          ? `<p class="small muted" style="margin-top:8px">
              Previous request was rejected. You may request again.
             </p>`
          : ""
      }

    </div>

  `;

}


// ======================================================
// ADMIN CHALLENGE FORM
// ======================================================

function fillAdminForm(){

  if(!isAdmin())
    return;

  if($("adminPhaseName"))
    $("adminPhaseName").value =
      challenge.phaseName || "";

  if($("adminJoinCode"))
    $("adminJoinCode").value =
      challenge.joinCode || "";

  if($("adminStartDate"))
    $("adminStartDate").value =
      challenge.startDate || "";

  if($("adminEndDate"))
    $("adminEndDate").value =
      challenge.endDate || "";

  if($("adminPhysicsTarget"))
    $("adminPhysicsTarget").value =
      challenge.physicsTarget || 0;

  if($("adminChemistryTarget"))
    $("adminChemistryTarget").value =
      challenge.chemistryTarget || 0;

  if($("adminMathsTarget"))
    $("adminMathsTarget").value =
      challenge.mathsTarget || 0;

  if($("adminStartingLives"))
    $("adminStartingLives").value =
      challenge.startingLives || 2;

  const info =
    calculateDay();

  if($("adminCurrentDay"))
    $("adminCurrentDay").textContent =
      dayLabel();

}


async function saveChallenge(){

  if(!isAdmin()){

    toast(
      "Admin access required.",
      "error"
    );

    return;

  }

  const phaseName =
    ($("adminPhaseName")?.value || "")
      .trim();

  const joinCode =
    ($("adminJoinCode")?.value || "")
      .trim();

  const startDate =
    $("adminStartDate")?.value;

  const endDate =
    $("adminEndDate")?.value;

  const physicsTarget =
    Number(
      $("adminPhysicsTarget")?.value || 0
    );

  const chemistryTarget =
    Number(
      $("adminChemistryTarget")?.value || 0
    );

  const mathsTarget =
    Number(
      $("adminMathsTarget")?.value || 0
    );

  const startingLives =
    Math.max(
      1,
      Number(
        $("adminStartingLives")?.value || 2
      )
    );

  if(!phaseName){

    toast(
      "Enter phase name.",
      "error"
    );

    return;

  }

  if(!joinCode){

    toast(
      "Enter join code.",
      "error"
    );

    return;

  }

  if(!startDate || !endDate){

    toast(
      "Select start and end dates.",
      "error"
    );

    return;

  }

  if(endDate < startDate){

    toast(
      "End date cannot be before start date.",
      "error"
    );

    return;

  }

  const updated = {

    ...challenge,

    phaseName,

    joinCode,

    startDate,

    endDate,

    physicsTarget,

    chemistryTarget,

    mathsTarget,

    startingLives

  };

  try{

    await db
      .collection("challenges")
      .doc("main")
      .set(
        updated,
        {merge:true}
      );

    challenge = updated;

    renderAll();

    toast(
      "Challenge settings saved.",
      "success"
    );

  }catch(error){

    console.error(error);

    toast(
      "Could not save challenge.",
      "error"
    );

  }

}


window.saveChallenge = saveChallenge;
   
// ======================================================
// ADMIN LIFE CONTROLS
// ======================================================

async function updateMemberLife(
  uid,
  action,
  amount=null
){

  if(!isAdmin())
    return;

  const ref =
    db.collection("users").doc(uid);

  try{

    await db.runTransaction(
      async transaction => {

        const snap =
          await transaction.get(ref);

        if(!snap.exists)
          throw new Error("User not found.");

        const user =
          snap.data();

        let lives =
          Number(user.lives || 0);

        if(action === "add"){

          lives +=
            Math.max(
              1,
              Number(amount || 1)
            );

        }

        if(action === "remove"){

          lives =
            Math.max(
              0,
              lives -
              Math.max(
                1,
                Number(amount || 1)
              )
            );

        }

        if(action === "set"){

          lives =
            Math.max(
              0,
              Number(amount || 0)
            );

        }

        let status =
          user.status;

        // Never destroy KICKED status by changing lives
        if(status !== "KICKED"){

          status =
            lives > 0
              ? "ACTIVE"
              : "ELIMINATED";

        }

        transaction.update(
          ref,
          {
            lives,
            status
          }
        );

      }
    );

    toast(
      "Life updated.",
      "success"
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not update life.",
      "error"
    );

  }

}


window.addLife =
  uid => updateMemberLife(uid,"add",1);

window.removeLife =
  uid => updateMemberLife(uid,"remove",1);

window.setLife =
  (uid,amount) =>
    updateMemberLife(
      uid,
      "set",
      amount
    );


// ======================================================
// RESTORE ACTIVE
// ======================================================

async function restoreStatus(uid){

  if(!isAdmin())
    return;

  try{

    await db
      .collection("users")
      .doc(uid)
      .update({

        status:"ACTIVE"

      });

    toast(
      "Member restored to ACTIVE.",
      "success"
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not restore member.",
      "error"
    );

  }

}


window.restoreStatus = restoreStatus;


// ======================================================
// ELIMINATE
// ======================================================

async function eliminate(uid){

  if(!isAdmin())
    return;

  try{

    await db
      .collection("users")
      .doc(uid)
      .update({

        status:"ELIMINATED",

        lives:0

      });

    toast(
      "Member eliminated."
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not eliminate member.",
      "error"
    );

  }

}


window.eliminate = eliminate;


// ======================================================
// KICK
// ======================================================

async function kickMember(uid){

  if(!isAdmin())
    return;

  try{

    await db
      .collection("users")
      .doc(uid)
      .update({

        status:"KICKED",

        joinRequestStatus:"NONE"

      });

    toast(
      "Member kicked.",
      "success"
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not kick member.",
      "error"
    );

  }

}


window.kickMember = kickMember;


// ======================================================
// UNKICK
// ======================================================

async function unkickMember(uid){

  if(!isAdmin())
    return;

  try{

    await db
      .collection("users")
      .doc(uid)
      .update({

        status:"NOT_JOINED",

        challengeId:null,

        joinRequestStatus:"NONE"

      });

    toast(
      "Member un-kicked. They can request to join again.",
      "success"
    );

    renderAdmin();

  }catch(error){

    console.error(error);

    toast(
      "Could not unkick member.",
      "error"
    );

  }

}


window.unkickMember = unkickMember;


// ======================================================
// ADMIN JOIN REQUESTS
// ======================================================

async function renderJoinRequests(){

  if(!isAdmin())
    return;

  const box =
    $("joinRequestsList");

  if(!box)
    return;

  try{

    const snap =
      await db
        .collection("joinRequests")
        .where(
          "challengeId",
          "==",
          challenge.id
        )
        .get();

    const requests =
      snap.docs
        .map(doc => ({
          id:doc.id,
          ...doc.data()
        }))
        .filter(
          r => r.status === "PENDING"
        )
        .sort(
          (a,b) => {

            const at =
              a.createdAt?.seconds || 0;

            const bt =
              b.createdAt?.seconds || 0;

            return bt-at;

          }
        );

    if(!requests.length){

      box.innerHTML =
        `<div class="empty">
          No pending join requests.
        </div>`;

      return;

    }

    box.innerHTML =
      requests.map(r => `

        <div class="admin-user">

          <div class="admin-user-head">

            <div class="admin-user-info">

              <img
                src="${
                  escapeHTML(
                    r.photoURL ||
                    "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(
                      r.name || "A"
                    )
                  )
                }"
              >

              <div>

                <strong>
                  ${escapeHTML(
                    r.name || "Aspirant"
                  )}
                </strong>

                <div class="small muted">
                  ${escapeHTML(
                    r.email || ""
                  )}
                </div>

              </div>

            </div>

            <span class="status pending">
              PENDING
            </span>

          </div>

          <div class="admin-actions">

            <button
              class="btn btn-success btn-small"
              onclick="approveJoin(
                '${r.uid}',
                '${r.id}'
              )"
            >
              ✓ Approve
            </button>

            <button
              class="btn btn-danger btn-small"
              onclick="rejectJoin(
                '${r.uid}',
                '${r.id}'
              )"
            >
              ✕ Reject
            </button>

          </div>

        </div>

      `).join("");

  }catch(error){

    console.error(error);

    box.innerHTML =
      `<div class="empty">
        Could not load requests.
      </div>`;

  }

}


// ======================================================
// ADMIN PARTICIPANTS
// ======================================================

async function renderParticipants(){

  if(!isAdmin())
    return;

  const box =
    $("participantsList");

  if(!box)
    return;

  try{

    const snap =
      await db
        .collection("users")
        .where(
          "challengeId",
          "==",
          challenge.id
        )
        .get();

    const users =
      snap.docs
        .map(doc => ({
          id:doc.id,
          ...doc.data()
        }))
        .sort(
          (a,b) =>
            String(a.name || "")
              .localeCompare(
                String(b.name || "")
              )
        );

    if(!users.length){

      box.innerHTML =
        `<div class="empty">
          No participants.
        </div>`;

      return;

    }

    box.innerHTML =
      users.map(user => {

        const lives =
          Number(user.lives || 0);

        const status =
          user.status || "ACTIVE";

        return `

          <div class="admin-user">

            <div class="admin-user-head">

              <div class="admin-user-info">

                <img
                  src="${
                    escapeHTML(
                      user.photoURL ||
                      "https://ui-avatars.com/api/?name=" +
                      encodeURIComponent(
                        user.name || "A"
                      )
                    )
                  }"
                >

                <div>

                  <strong>
                    ${escapeHTML(
                      user.name || "Aspirant"
                    )}
                  </strong>

                  <div class="small muted">
                    ${Number(
                      user.totalQuestions || 0
                    )} questions
                    • ${lives} lives
                  </div>

                </div>

              </div>

              <span class="status ${
                status === "ACTIVE"
                  ? "active"
                  : status === "ELIMINATED"
                    ? "eliminated"
                    : "kicked"
              }">
                ${escapeHTML(status)}
              </span>

            </div>

            <div class="admin-actions">

              <button
                class="btn btn-success btn-small"
                onclick="addLife('${user.id}')"
              >
                +1 Life
              </button>

              <button
                class="btn btn-warning btn-small"
                onclick="removeLife('${user.id}')"
              >
                −1 Life
              </button>

              <button
                class="btn btn-secondary btn-small"
                onclick="
                  const n = prompt(
                    'Set lives to:',
                    '${lives}'
                  );
                  if(n !== null)
                    setLife(
                      '${user.id}',
                      Number(n)
                    );
                "
              >
                Set Lives
              </button>

              ${
                status === "ELIMINATED"
                  ? `
                    <button
                      class="btn btn-success btn-small"
                      onclick="restoreStatus('${user.id}')"
                    >
                      ♻ Restore Active
                    </button>
                  `
                  : ""
              }

              ${
                status !== "KICKED"
                  ? `
                    <button
                      class="btn btn-danger btn-small"
                      onclick="kickMember('${user.id}')"
                    >
                      🚫 Kick
                    </button>
                  `
                  : `
                    <button
                      class="btn btn-success btn-small"
                      onclick="unkickMember('${user.id}')"
                    >
                      ♻ Unkick
                    </button>
                  `
              }

              ${
                status !== "ELIMINATED"
                  ? `
                    <button
                      class="btn btn-danger btn-small"
                      onclick="eliminate('${user.id}')"
                    >
                      Eliminate
                    </button>
                  `
                  : ""
              }

            </div>

          </div>

        `;

      }).join("");

  }catch(error){

    console.error(error);

    box.innerHTML =
      `<div class="empty">
        Could not load participants.
      </div>`;

  }

}


// ======================================================
// ADMIN
// ======================================================

async function renderAdmin(){

  const adminSection =
    $("adminSection");

  if(!adminSection)
    return;

  if(!isAdmin()){

    adminSection.innerHTML =
      `
        <div class="card admin-warning">
          Admin access required.
        </div>
      `;

    return;

  }

  fillAdminForm();

  await renderJoinRequests();

  await renderParticipants();

}


// ======================================================
// CHAT
// ======================================================

function startChat(){

  if(chatUnsubscribe)
    chatUnsubscribe();

  const box =
    $("chatMessages");

  if(!box)
    return;

  if(!isJoined()){

    box.innerHTML =
      `<div class="empty">
        Join the challenge to access chat.
      </div>`;

    return;

  }

  chatUnsubscribe =
    db
      .collection("messages")
      .where(
        "challengeId",
        "==",
        challenge.id
      )
      .orderBy(
        "createdAt",
        "asc"
      )
      .limitToLast(100)
      .onSnapshot(
        snapshot => {

          box.innerHTML = "";

          snapshot.docs.forEach(
            doc => {

              const msg =
                doc.data();

              const mine =
                msg.uid ===
                currentUser.uid;

              const wrapper =
                document.createElement("div");

              wrapper.className =
                `message ${
                  mine ? "me" : ""
                }`;

              const photo =
                msg.photoURL ||
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(
                  msg.name || "A"
                );

              let content = "";

              if(msg.type === "voice"){

                content = `
                  <audio
                    controls
                    src="${escapeHTML(
                      msg.audioURL || ""
                    )}"
                  ></audio>
                `;

              }else{

                content =
                  escapeHTML(
                    msg.text || ""
                  );

              }

              wrapper.innerHTML = `

                <img
                  src="${escapeHTML(photo)}"
                >

                <div class="message-body">

                  <div class="message-name">
                    ${escapeHTML(
                      msg.name || "Aspirant"
                    )}
                  </div>

                  <div class="message-bubble">
                    ${content}
                  </div>

                </div>

              `;

              box.appendChild(wrapper);

            }
          );

          box.scrollTop =
            box.scrollHeight;

        },
        error => {

          console.error(
            "Chat error:",
            error
          );

        }
      );

}


async function sendMessage(){

  if(!isJoined()){

    toast(
      "Only challenge members can chat.",
      "error"
    );

    return;

  }

  const input =
    $("chatInput");

  if(!input)
    return;

  const text =
    input.value.trim();

  if(!text)
    return;

  try{

    await db
      .collection("messages")
      .add({

        challengeId:
          challenge.id,

        uid:
          currentUser.uid,

        name:
          currentProfile.name,

        photoURL:
          currentProfile.photoURL || "",

        type:"text",

        text,

        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });

    input.value = "";

  }catch(error){

    console.error(error);

    toast(
      "Message could not be sent.",
      "error"
    );

  }

}


window.sendMessage = sendMessage;


// ======================================================
// VOICE MESSAGE
// ======================================================

async function toggleVoiceRecording(){

  if(!isJoined()){

    toast(
      "Only challenge members can use voice chat.",
      "error"
    );

    return;

  }

  const button =
    $("voiceButton");

  if(voiceRecorder){

    voiceRecorder.stop();

    if(button){

      button.classList.remove(
        "recording"
      );

      button.textContent =
        "🎙️";

    }

    return;

  }

  if(
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ){

    toast(
      "Voice recording is not supported.",
      "error"
    );

    return;

  }

  try{

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          audio:true
        });

    voiceChunks = [];

    voiceRecorder =
      new MediaRecorder(stream);

    voiceRecorder.ondataavailable =
      event => {

        if(event.data.size > 0)
          voiceChunks.push(
            event.data
          );

      };

    voiceRecorder.onstop =
      async () => {

        stream
          .getTracks()
          .forEach(
            track => track.stop()
          );

        const blob =
          new Blob(
            voiceChunks,
            {
              type:
                voiceRecorder.mimeType ||
                "audio/webm"
            }
          );

        voiceRecorder = null;

        await uploadVoice(blob);

      };

    voiceRecorder.start();

    if(button){

      button.classList.add(
        "recording"
      );

      button.textContent =
        "⏹️";

    }

    toast(
      "Recording started..."
    );

  }catch(error){

    console.error(error);

    toast(
      "Microphone permission denied.",
      "error"
    );

  }

}


window.toggleVoiceRecording =
  toggleVoiceRecording;


async function uploadVoice(blob){

  try{

    const filename =
      `voice/${challenge.id}/${currentUser.uid}/${Date.now()}.webm`;

    const ref =
      storage.ref().child(filename);

    await ref.put(
      blob,
      {
        contentType:
          blob.type || "audio/webm"
      }
    );

    const url =
      await ref.getDownloadURL();

    await db
      .collection("messages")
      .add({

        challengeId:
          challenge.id,

        uid:
          currentUser.uid,

        name:
          currentProfile.name,

        photoURL:
          currentProfile.photoURL || "",

        type:"voice",

        audioURL:url,

        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()

      });

    toast(
      "Voice message sent.",
      "success"
    );

  }catch(error){

    console.error(error);

    toast(
      "Voice message upload failed.",
      "error"
    );

  }

}


// ======================================================
// NAVIGATION
// ======================================================

function showSection(id){

  document
    .querySelectorAll(".section")
    .forEach(
      section =>
        section.classList.remove("active")
    );

  const section =
    $(id);

  if(section)
    section.classList.add("active");

  document
    .querySelectorAll(".nav button")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.section === id
        );

      }
    );

  if(id === "rankSection")
    renderLeaderboard();

  if(id === "adminSection")
    renderAdmin();

  if(id === "chatSection")
    startChat();

}


window.showSection = showSection;


// ======================================================
// RENDER ALL
// ======================================================

async function renderAll(){

  renderClock();

  renderProfile();

  await renderDashboard();

  await renderLeaderboard();

  await renderAdmin();

  startChat();

}


// ======================================================
// AUTH STATE
// ======================================================

auth.onAuthStateChanged(
  async user => {

    currentUser = user;

    const loginScreen =
      $("loginScreen");

    const app =
      $("app");

    if(!user){

      if(loginScreen)
        loginScreen.classList.remove(
          "hidden"
        );

      if(app)
        app.classList.add(
          "hidden"
        );

      return;

    }

    try{

      if(loginScreen)
        loginScreen.classList.add(
          "hidden"
        );

      if(app)
        app.classList.remove(
          "hidden"
        );

      await loadChallenge();

      await loadUser();

      await processMissedDays();

      await loadUser();

      renderAll();

    }catch(error){

      console.error(error);

      toast(
        "Could not initialize app.",
        "error"
      );

    }

  }
);


// ======================================================
// AUTOMATIC REFRESH
// ======================================================

setInterval(
  async () => {

    if(!currentUser)
      return;

    const oldDate =
      currentChallengeDate;

    const oldDay =
      currentChallengeDay;

    const info =
      calculateDay();

    currentChallengeDay =
      info.day;

    if(
      oldDate !== currentChallengeDate ||
      oldDay !== currentChallengeDay
    ){

      await loadUser();

      await processMissedDays();

      await loadUser();

      renderAll();

    }

  },
  15000
);


// ======================================================
// INITIAL UI HOOKS
// ======================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const sendButton =
      $("sendMessageButton");

    if(sendButton){

      sendButton.addEventListener(
        "click",
        sendMessage
      );

    }

    const chatInput =
      $("chatInput");

    if(chatInput){

      chatInput.addEventListener(
        "keydown",
        event => {

          if(
            event.key === "Enter" &&
            !event.shiftKey
          ){

            event.preventDefault();

            sendMessage();

          }

        }
      );

    }

    const voiceButton =
      $("voiceButton");

    if(voiceButton){

      voiceButton.addEventListener(
        "click",
        toggleVoiceRecording
      );

    }

    renderClock();

  }
);

  
