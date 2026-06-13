const staff = [
  { role: "Emperor Palpatine", steamid: "76561199213286256" },
  { role: "Darth Vader", steamid: "76561198761384933" },
  { role: "Grand Moff", steamid: "76561199180679312" }
];

const grid = document.getElementById("staffGrid");
const loadingBar = document.getElementById("loadingBar");
const percentText = document.getElementById("percentText");
const statusText = document.getElementById("statusText");
const fileText = document.getElementById("fileText");

let totalFiles = 0;
let neededFiles = 0;
let currentPercent = 0;
let gmodHasSentProgress = false;
let fallbackTimer = null;

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function setProgress(percent, status, fileName) {
  const clean = clampPercent(percent);
  currentPercent = clean;
  loadingBar.style.width = clean + "%";
  percentText.textContent = clean + "%";

  if (status) statusText.textContent = status;
  if (fileName) fileText.textContent = fileName;

  if (clean >= 100) {
    statusText.textContent = "Entering the Empire...";
    fileText.textContent = "Connection complete";
  }
}

function stopFallback() {
  gmodHasSentProgress = true;
  if (fallbackTimer) clearInterval(fallbackTimer);
}

window.GameDetails = function(servername, serverurl, mapname, maxplayers, steamid, gamemode) {
  stopFallback();
  statusText.textContent = mapname ? "Loading map: " + mapname : "Loading server";
};

window.SetStatusChanged = function(status) {
  stopFallback();
  statusText.textContent = status || "Loading server content...";
};

window.SetFilesTotal = function(total) {
  stopFallback();
  totalFiles = Math.max(0, Number(total) || 0);

  if (totalFiles <= 0) {
    setProgress(5, "Checking server files...");
    return;
  }

  neededFiles = totalFiles;
  setProgress(0, "Downloading content...");
};

window.SetFilesNeeded = function(needed) {
  stopFallback();
  neededFiles = Math.max(0, Number(needed) || 0);

  if (totalFiles <= 0) {
    setProgress(currentPercent, "Downloading content...");
    return;
  }

  const downloaded = Math.max(0, totalFiles - neededFiles);
  setProgress((downloaded / totalFiles) * 100, "Downloading content...");
};

window.DownloadingFile = function(fileName) {
  stopFallback();
  fileText.textContent = fileName || "Downloading server file...";
};

window.SetProgressChanged = function(progress) {
  stopFallback();
  let value = Number(progress) || 0;
  if (value > 0 && value <= 1) value = value * 100;
  setProgress(value, "Loading server content...");
};

fallbackTimer = setInterval(() => {
  if (gmodHasSentProgress) return;
  if (currentPercent < 96) {
    setProgress(currentPercent + 1, "Preview loading...", "");
  }
}, 180);

function fallbackAvatar() {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="184" height="184" viewBox="0 0 184 184">
      <rect width="184" height="184" fill="#101014"/>
      <circle cx="92" cy="70" r="38" fill="#2e2e35"/>
      <path d="M34 164c8-38 36-58 58-58s50 20 58 58" fill="#2e2e35"/>
      <text x="92" y="175" text-anchor="middle" fill="#ff3333" font-size="15" font-family="Arial">STEAM</text>
    </svg>
  `);
}

function makeCard(member) {
  const card = document.createElement("div");
  card.className = "staff-card";
  card.id = "staff-" + member.steamid;

  card.innerHTML = `
    <img class="avatar" src="${fallbackAvatar()}" alt="${member.role}">
    <div class="staff-info">
      <div class="role">${member.role}</div>
      <div class="name">Loading Steam...</div>
      <div class="profile-state">Finding profile</div>
    </div>
  `;

  grid.appendChild(card);
  return card;
}

function updateCard(card, member, profile) {
  const name = profile.name || profile.username || profile.personaname || member.role;
  const avatar = profile.avatar || profile.avatarfull || profile.avatarmedium || fallbackAvatar();

  card.querySelector(".avatar").src = avatar;
  card.querySelector(".avatar").alt = name;
  card.querySelector(".name").textContent = name;
  card.querySelector(".profile-state").textContent = profile.source || "";
}

async function trySteamProxy(member) {
  const res = await fetch(`steam-proxy.php?steamid=${encodeURIComponent(member.steamid)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Local Steam proxy failed");
  const data = await res.json();

  if (!data || !data.name) throw new Error("No proxy profile data");
  return {
    name: data.name,
    avatar: data.avatar,
    source: ""
  };
}

async function tryPlayerDB(member) {
  const res = await fetch(`https://playerdb.co/api/player/steam/${member.steamid}`, { cache: "no-store" });
  if (!res.ok) throw new Error("PlayerDB failed");
  const data = await res.json();

  const player = data?.data?.player;
  if (!player) throw new Error("No PlayerDB profile");

  return {
    name: player.username || player.meta?.name,
    avatar: player.avatar,
    source: ""
  };
}

async function trySteamXmlProxy(member) {
  const steamXml = `https://steamcommunity.com/profiles/${member.steamid}/?xml=1`;
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(steamXml)}`;
  const res = await fetch(proxy, { cache: "no-store" });
  if (!res.ok) throw new Error("XML proxy failed");

  const xmlText = await res.text();
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");

  const name = xml.querySelector("steamID")?.textContent?.trim();
  const avatar = xml.querySelector("avatarFull")?.textContent?.trim()
    || xml.querySelector("avatarMedium")?.textContent?.trim();

  if (!name && !avatar) throw new Error("No XML profile data");

  return {
    name,
    avatar,
    source: ""
  };
}

async function loadSteamProfile(member) {
  const card = makeCard(member);

  const loaders = [
    trySteamProxy,
    tryPlayerDB,
    trySteamXmlProxy
  ];

  for (const loader of loaders) {
    try {
      const profile = await loader(member);
      updateCard(card, member, profile);
      return;
    } catch (err) {
      console.warn(member.steamid, err.message);
    }
  }

  card.querySelector(".name").textContent = member.role;
  card.querySelector(".profile-state").textContent = "Steam hidden";
}

staff.forEach(loadSteamProfile);

function startMusic() {
  const music = document.getElementById("music");
  if (!music) return;
  music.volume = 0.55;
  music.play().catch(() => {});
}

window.addEventListener("load", startMusic);
window.addEventListener("click", startMusic, { once: true });
window.addEventListener("keydown", startMusic, { once: true });
